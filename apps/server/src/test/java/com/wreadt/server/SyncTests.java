package com.wreadt.server;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

class SyncTests extends IntegrationTest {

    private static Map<String, Object> change(String type, String id, long updatedAt, boolean deleted, Object data) {
        Map<String, Object> c = new HashMap<>();
        c.put("type", type);
        c.put("id", id);
        c.put("updatedAt", updatedAt);
        c.put("deleted", deleted);
        c.put("data", data);
        return c;
    }

    private JsonNode sync(String token, long since, List<?> changes) throws Exception {
        return body(postJson("/api/sync", token, Map.of("since", since, "changes", changes)).andExpect(status().isOk()));
    }

    @Test
    void emptySyncReturnsVersionZero() throws Exception {
        JsonNode res = sync(accessToken(), 0, List.of());
        assertThat(res.get("version").asLong()).isZero();
        assertThat(res.get("changes").size()).isZero();
        assertThat(res.get("hasMore").asBoolean()).isFalse();
    }

    @Test
    void newerWinsOlderIgnoredDeletedPersisted() throws Exception {
        String token = accessToken();
        String id = UUID.randomUUID().toString();

        JsonNode r1 = sync(token, 0, List.of(change("card", id, 1000, false, Map.of("word", "theme", "reps", 1))));
        assertThat(r1.get("version").asLong()).isEqualTo(1);
        assertThat(r1.at("/changes/0/data/word").asString()).isEqualTo("theme");
        assertThat(r1.at("/changes/0/updatedAt").asLong()).isEqualTo(1000);

        // 较旧的修改被忽略，版本号不变
        JsonNode r2 = sync(token, 1, List.of(change("card", id, 999, false, Map.of("word", "old"))));
        assertThat(r2.get("version").asLong()).isEqualTo(1);
        assertThat(r2.get("changes").size()).isZero();

        // 相同 updatedAt 也写入（>=）
        JsonNode r3 = sync(token, 1, List.of(change("card", id, 1000, false, Map.of("word", "same"))));
        assertThat(r3.get("version").asLong()).isEqualTo(2);
        assertThat(r3.at("/changes/0/data/word").asString()).isEqualTo("same");

        // 软删除
        JsonNode r4 = sync(token, 2, List.of(change("card", id, 2000, true, Map.of())));
        assertThat(r4.get("version").asLong()).isEqualTo(3);
        assertThat(r4.at("/changes/0/deleted").asBoolean()).isTrue();

        // 全量拉取只有一条记录（最新状态）
        JsonNode all = sync(token, 0, List.of());
        assertThat(all.get("changes").size()).isEqualTo(1);
        assertThat(all.at("/changes/0/deleted").asBoolean()).isTrue();
        assertThat(all.at("/changes/0/updatedAt").asLong()).isEqualTo(2000);
        assertThat(all.get("version").asLong()).isEqualTo(3);
    }

    @Test
    void sameIdDifferentTypesAreDistinct() throws Exception {
        String token = accessToken();
        String id = UUID.randomUUID().toString();
        JsonNode res = sync(token, 0, List.of(
                change("card", id, 1, false, Map.of("a", 1)),
                change("setting", id, 1, false, Map.of("b", 2))));
        assertThat(res.get("changes").size()).isEqualTo(2);
        assertThat(res.at("/changes/0/type").asString()).isEqualTo("card");
        assertThat(res.at("/changes/1/type").asString()).isEqualTo("setting");
    }

    @Test
    void usersAreIsolated() throws Exception {
        String alice = accessToken();
        String bob = accessToken();
        String id = UUID.randomUUID().toString();
        sync(alice, 0, List.of(change("customWord", id, 5, false, Map.of("word", "alice"))));

        JsonNode bobView = sync(bob, 0, List.of());
        assertThat(bobView.get("changes").size()).isZero();
        assertThat(bobView.get("version").asLong()).isZero();

        // 相同 id 在 Bob 名下是独立记录，不会覆盖 Alice 的
        sync(bob, 0, List.of(change("customWord", id, 1, false, Map.of("word", "bob"))));
        JsonNode aliceView = sync(alice, 0, List.of());
        assertThat(aliceView.at("/changes/0/data/word").asString()).isEqualTo("alice");
    }

    @Test
    void paginatesWithHasMore() throws Exception {
        String token = accessToken();
        for (int batch = 0; batch < 3; batch++) {
            List<Map<String, Object>> changes = new ArrayList<>();
            for (int i = 0; i < (batch < 2 ? 500 : 200); i++) {
                changes.add(change("reviewLog", UUID.randomUUID().toString(), 1, false, Map.of("i", i)));
            }
            sync(token, 0, List.of());
            postJson("/api/sync", token, Map.of("since", 1_000_000, "changes", changes)).andExpect(status().isOk());
        }

        JsonNode page1 = sync(token, 0, List.of());
        assertThat(page1.get("changes").size()).isEqualTo(1000);
        assertThat(page1.get("hasMore").asBoolean()).isTrue();
        assertThat(page1.get("version").asLong()).isEqualTo(1000);
        assertThat(page1.at("/changes/0/data/i").asInt()).isZero();

        JsonNode page2 = sync(token, page1.get("version").asLong(), List.of());
        assertThat(page2.get("changes").size()).isEqualTo(200);
        assertThat(page2.get("hasMore").asBoolean()).isFalse();
        assertThat(page2.get("version").asLong()).isEqualTo(1200);
    }

    @Test
    void validatesInput() throws Exception {
        String token = accessToken();
        postJson("/api/sync", token, Map.of("since", 0, "changes", List.of(change("bogus", "x", 1, false, Map.of()))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_FAILED"));

        List<Map<String, Object>> tooMany = new ArrayList<>();
        for (int i = 0; i < 501; i++) {
            tooMany.add(change("card", "id" + i, 1, false, Map.of()));
        }
        postJson("/api/sync", token, Map.of("since", 0, "changes", tooMany))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_FAILED"));

        String big = "x".repeat(17 * 1024);
        postJson("/api/sync", token, Map.of("since", 0, "changes", List.of(change("card", "big", 1, false, Map.of("s", big)))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_FAILED"));

        // 校验失败的请求不会部分写入
        assertThat(sync(token, 0, List.of()).get("version").asLong()).isZero();
    }
}
