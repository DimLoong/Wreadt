package com.wreadt.server.config;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("wreadt")
public record AppProperties(
        Jwt jwt,
        List<String> corsOrigins,
        String appUrl,
        String mailFrom,
        int rateLimitPerMinute,
        Ai ai,
        Tts tts) {

    public record Jwt(String secret, Duration accessTtl, Duration refreshTtl) {}

    public record Ai(String baseUrl, String apiKey, String model, int dailyLimit, Duration timeout) {
        public boolean enabled() {
            return apiKey != null && !apiKey.isBlank();
        }
    }

    /** 云端语音合成（阿里云百炼 DashScope 原生接口）；dailyChars 为每人每天可合成的字符数（命中缓存不计） */
    public record Tts(String baseUrl, String apiKey, String model, int dailyChars, Duration timeout) {
        public boolean enabled() {
            return apiKey != null && !apiKey.isBlank();
        }
    }
}
