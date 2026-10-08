package com.wreadt.server.ai;

import com.wreadt.server.ai.AiDtos.Exercise;
import com.wreadt.server.ai.AiDtos.ExercisesRequest;
import com.wreadt.server.ai.AiDtos.ExercisesResponse;
import com.wreadt.server.common.ApiException;
import com.wreadt.server.config.AppProperties;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Service
public class AiService {

    private static final Logger log = LoggerFactory.getLogger(AiService.class);
    private static final Set<String> KINDS = Set.of("cloze", "usage", "mistake");
    /** 每日额度按北京时间零点重置 */
    private static final ZoneId QUOTA_ZONE = ZoneId.of("Asia/Shanghai");

    private final AiClient client;
    private final JdbcClient jdbc;
    private final ObjectMapper json;
    private final AppProperties.Ai ai;
    private final String systemPrompt;

    public AiService(AiClient client, JdbcClient jdbc, ObjectMapper json, AppProperties props) {
        this.client = client;
        this.jdbc = jdbc;
        this.json = json;
        this.ai = props.ai();
        try {
            this.systemPrompt = new ClassPathResource("prompts/sentence-exercises.txt")
                    .getContentAsString(StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public ExercisesResponse sentenceExercises(UUID userId, ExercisesRequest req) {
        if (!ai.enabled()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "AI_DISABLED", "AI 功能未启用");
        }
        LocalDate today = LocalDate.now(QUOTA_ZONE);
        acquireQuota(userId, today);
        try {
            Map<String, Object> input = new LinkedHashMap<>();
            input.put("lang", req.lang());
            input.put("locale", req.locale() == null ? "zh-CN" : req.locale());
            input.put("words", req.words());
            String content = client.chatJson(systemPrompt, json.writeValueAsString(input));
            return new ExercisesResponse(parse(content));
        } catch (RuntimeException e) {
            // 上游失败不扣次数
            jdbc.sql("UPDATE ai_usage SET count = count - 1 WHERE user_id = ? AND usage_date = ? AND count > 0")
                    .params(userId, today).update();
            if (e instanceof ApiException api) {
                throw api;
            }
            log.warn("AI 请求失败: {}", e.toString());
            throw new ApiException(HttpStatus.BAD_GATEWAY, "AI_FAILED", "AI 服务暂时不可用，请稍后再试");
        }
    }

    /** 原子地占用一次额度；已满则 429。 */
    private void acquireQuota(UUID userId, LocalDate day) {
        jdbc.sql("INSERT INTO ai_usage (user_id, usage_date, count) VALUES (?, ?, 0) ON CONFLICT DO NOTHING")
                .params(userId, day).update();
        int updated = jdbc.sql("UPDATE ai_usage SET count = count + 1 WHERE user_id = ? AND usage_date = ? AND count < ?")
                .params(userId, day, ai.dailyLimit()).update();
        if (updated == 0) {
            throw ApiException.rateLimited("今日 AI 使用次数已达上限");
        }
    }

    private List<Exercise> parse(String content) {
        JsonNode root;
        try {
            root = json.readTree(content);
        } catch (JacksonException e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "AI_FAILED", "AI 返回内容无法解析");
        }
        List<Exercise> out = new ArrayList<>();
        for (JsonNode n : root.path("exercises")) {
            Exercise ex = new Exercise(text(n, "word"), text(n, "kind"), text(n, "prompt"), text(n, "answer"),
                    text(n, "explanation"));
            if (!ex.word().isBlank() && KINDS.contains(ex.kind()) && !ex.prompt().isBlank() && !ex.answer().isBlank()) {
                out.add(ex);
            }
        }
        if (out.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "AI_FAILED", "AI 未返回有效题目");
        }
        return out;
    }

    private static String text(JsonNode n, String field) {
        return n.path(field).asString("").trim();
    }
}
