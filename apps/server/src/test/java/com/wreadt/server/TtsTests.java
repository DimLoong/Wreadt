package com.wreadt.server;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/** 用本地 HttpServer 模拟百炼语音合成接口与音频下载地址。 */
class TtsTests extends IntegrationTest {

    private static final byte[] WAV = "RIFF-fake-wav".getBytes(StandardCharsets.US_ASCII);
    private static final AtomicInteger CALLS = new AtomicInteger();
    private static final AtomicReference<String> LAST_BODY = new AtomicReference<>();
    private static final AtomicReference<String> DOWNLOAD_AUTH = new AtomicReference<>("unset");
    private static final HttpServer SERVER = startServer();

    private static HttpServer startServer() {
        try {
            HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/api/v1/services/aigc/multimodal-generation/generation", ex -> {
                CALLS.incrementAndGet();
                LAST_BODY.set(new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
                assertThat(ex.getRequestHeaders().getFirst("Authorization")).isEqualTo("Bearer tts-key");
                String url = "http://127.0.0.1:" + server.getAddress().getPort() + "/audio.wav";
                byte[] bytes = ("{\"output\":{\"audio\":{\"url\":\"" + url + "\"},\"finish_reason\":\"stop\"}}").getBytes(StandardCharsets.UTF_8);
                ex.getResponseHeaders().add("Content-Type", "application/json");
                ex.sendResponseHeaders(200, bytes.length);
                ex.getResponseBody().write(bytes);
                ex.close();
            });
            server.createContext("/audio.wav", ex -> {
                DOWNLOAD_AUTH.set(String.valueOf(ex.getRequestHeaders().getFirst("Authorization")));
                ex.getResponseHeaders().add("Content-Type", "audio/x-wav");
                ex.sendResponseHeaders(200, WAV.length);
                ex.getResponseBody().write(WAV);
                ex.close();
            });
            server.start();
            return server;
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    @DynamicPropertySource
    static void ttsProps(DynamicPropertyRegistry registry) {
        registry.add("wreadt.tts.base-url", () -> "http://127.0.0.1:" + SERVER.getAddress().getPort() + "/api/v1");
        registry.add("wreadt.tts.api-key", () -> "tts-key");
        registry.add("wreadt.tts.daily-chars", () -> 60);
    }

    @AfterAll
    static void stop() {
        SERVER.stop(0);
    }

    @Test
    void synthesizesCachesAndLimitsDailyChars() throws Exception {
        String token = accessToken();
        int before = CALLS.get();
        String text = "We need to postpone the meeting.";

        postJson("/api/tts", token, Map.of("text", text, "voice", "Jennifer"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("audio/wav"))
                .andExpect(content().bytes(WAV));
        assertThat(LAST_BODY.get()).contains("\"voice\":\"Jennifer\"").contains("qwen3-tts-flash").contains(text);
        assertThat(DOWNLOAD_AUTH.get()).isEqualTo("null");

        // 同样的文本与声音命中缓存，不再请求上游、不计额度
        postJson("/api/tts", token, Map.of("text", "  We need to postpone   the meeting. ", "voice", "Jennifer"))
                .andExpect(status().isOk())
                .andExpect(content().bytes(WAV));
        assertThat(CALLS.get()).isEqualTo(before + 1);

        // 额度 60 字符：再合成一句 32 字符的新句子会超出
        postJson("/api/tts", token, Map.of("text", "Please send me the report today.", "voice", "Ryan"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.error").value("RATE_LIMITED"));
    }

    @Test
    void rejectsUnknownVoiceAndRequiresAuth() throws Exception {
        postJson("/api/tts", accessToken(), Map.of("text", "Hello there.", "voice", "Zarvox"))
                .andExpect(status().isBadRequest());
        postJson("/api/tts", Map.of("text", "Hello there.", "voice", "Jennifer"))
                .andExpect(status().isUnauthorized());
    }
}
