package com.wreadt.server;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

/** 用本地 HttpServer 模拟 OpenAI 兼容接口。 */
class AiEnabledTests extends IntegrationTest {

    private static final ObjectMapper MAPPER = JsonMapper.builder().build();
    private static final AtomicReference<String> LAST_REQUEST = new AtomicReference<>();
    private static final AtomicReference<String> CONTENT = new AtomicReference<>();
    private static final HttpServer SERVER = startServer();

    private static HttpServer startServer() {
        try {
            HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/v1/chat/completions", ex -> {
                LAST_REQUEST.set(new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
                assertThat(ex.getRequestHeaders().getFirst("Authorization")).isEqualTo("Bearer test-key");
                String resp = MAPPER.writeValueAsString(Map.of("choices",
                        List.of(Map.of("message", Map.of("role", "assistant", "content", CONTENT.get())))));
                byte[] bytes = resp.getBytes(StandardCharsets.UTF_8);
                ex.getResponseHeaders().add("Content-Type", "application/json");
                ex.sendResponseHeaders(200, bytes.length);
                ex.getResponseBody().write(bytes);
                ex.close();
            });
            server.start();
            return server;
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    @DynamicPropertySource
    static void aiProps(DynamicPropertyRegistry registry) {
        registry.add("wreadt.ai.base-url", () -> "http://127.0.0.1:" + SERVER.getAddress().getPort());
        registry.add("wreadt.ai.api-key", () -> "test-key");
        registry.add("wreadt.ai.daily-limit", () -> 2);
    }

    @AfterAll
    static void stop() {
        SERVER.stop(0);
    }

    @Test
    void returnsParsedExercisesAndEnforcesDailyLimit() throws Exception {
        CONTENT.set("""
                {"exercises":[
                  {"word":"theme","kind":"cloze","prompt":"The ___ of the conference was sustainability.","answer":"theme","explanation":"theme 表示主题"},
                  {"word":"progress","kind":"bogus","prompt":"x","answer":"y","explanation":"z"},
                  {"word":"progress","kind":"usage","prompt":"用 progress 描述你的学习进展","answer":"I made good progress.","explanation":"进展"}
                ]}""");
        String token = accessToken();
        Map<String, Object> req = Map.of("lang", "en", "words", List.of("theme", "progress"), "locale", "zh-CN");

        postJson("/api/ai/sentence-exercises", token, req)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.exercises.length()").value(2))
                .andExpect(jsonPath("$.exercises[0].kind").value("cloze"))
                .andExpect(jsonPath("$.exercises[0].answer").value("theme"))
                .andExpect(jsonPath("$.exercises[1].kind").value("usage"));

        JsonNode upstream = MAPPER.readTree(LAST_REQUEST.get());
        assertThat(upstream.get("model").asString()).isEqualTo("deepseek-chat");
        assertThat(upstream.at("/response_format/type").asString()).isEqualTo("json_object");
        assertThat(upstream.at("/messages/1/content").asString()).contains("theme", "progress");

        postJson("/api/ai/sentence-exercises", token, req).andExpect(status().isOk());
        postJson("/api/ai/sentence-exercises", token, req)
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.error").value("RATE_LIMITED"));
    }

    @Test
    void invalidUpstreamOutputIs502AndNotCounted() throws Exception {
        String token = accessToken();
        Map<String, Object> req = Map.of("lang", "en", "words", List.of("theme"));
        CONTENT.set("not json");
        for (int i = 0; i < 3; i++) {
            postJson("/api/ai/sentence-exercises", token, req)
                    .andExpect(status().isBadGateway())
                    .andExpect(jsonPath("$.error").value("AI_FAILED"));
        }
    }

    @Test
    void rejectsTooManyWords() throws Exception {
        List<String> words = List.of("a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k");
        postJson("/api/ai/sentence-exercises", accessToken(), Map.of("lang", "en", "words", words))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_FAILED"));
    }
}
