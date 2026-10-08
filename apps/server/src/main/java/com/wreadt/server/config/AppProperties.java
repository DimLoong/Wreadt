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
        Ai ai) {

    public record Jwt(String secret, Duration accessTtl, Duration refreshTtl) {}

    public record Ai(String baseUrl, String apiKey, String model, int dailyLimit, Duration timeout) {
        public boolean enabled() {
            return apiKey != null && !apiKey.isBlank();
        }
    }
}
