package com.wreadt.server;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class AiDisabledTests extends IntegrationTest {

    @Test
    void returns503WhenNoApiKey() throws Exception {
        postJson("/api/ai/sentence-exercises", accessToken(), Map.of("lang", "en", "words", List.of("theme")))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error").value("AI_DISABLED"));
    }

    @Test
    void ttsReturns503WhenNoApiKey() throws Exception {
        postJson("/api/tts", accessToken(), Map.of("text", "Hello there.", "voice", "Jennifer"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error").value("TTS_DISABLED"));
    }

    @Test
    void requiresAuth() throws Exception {
        postJson("/api/ai/sentence-exercises", Map.of("lang", "en", "words", List.of("theme")))
                .andExpect(status().isUnauthorized());
    }
}
