package com.wreadt.server.ai;

import com.wreadt.server.config.AppProperties;
import java.net.http.HttpClient;
import java.util.List;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

/** OpenAI 兼容的 Chat Completions 客户端；baseUrl 需包含版本路径（如 https://dashscope.aliyuncs.com/compatible-mode/v1）。 */
@Component
public class AiClient {

    private final AppProperties.Ai ai;
    private final RestClient http;

    public AiClient(AppProperties props) {
        this.ai = props.ai();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(
                HttpClient.newBuilder().connectTimeout(ai.timeout()).build());
        factory.setReadTimeout(ai.timeout());
        this.http = RestClient.builder()
                .baseUrl(ai.baseUrl())
                .requestFactory(factory)
                .defaultHeader("Authorization", "Bearer " + ai.apiKey())
                .build();
    }

    /** 以 JSON 模式调用，返回 assistant 消息的文本内容。 */
    public String chatJson(String system, String user) {
        Map<String, Object> body = new java.util.HashMap<>(Map.of(
                "model", ai.model(),
                "messages", List.of(
                        Map.of("role", "system", "content", system),
                        Map.of("role", "user", "content", user)),
                "response_format", Map.of("type", "json_object"),
                "temperature", 0.7));
        // 千问 3 系列默认可能开启思考，出题 / 点评不需要，关闭可大幅提速
        if (ai.baseUrl().matches("(?i).*(qianwen|dashscope|aliyuncs).*")) {
            body.put("enable_thinking", false);
        }
        JsonNode res = http.post()
                .uri("/chat/completions")
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(JsonNode.class);
        return res == null ? "" : res.path("choices").path(0).path("message").path("content").asString("");
    }
}
