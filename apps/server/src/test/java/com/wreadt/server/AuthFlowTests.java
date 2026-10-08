package com.wreadt.server;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

class AuthFlowTests extends IntegrationTest {

    @Test
    void registerReturnsTokensAndSendsVerificationMail() throws Exception {
        String email = uniqueEmail();
        JsonNode res = register("  " + email.toUpperCase() + " ", "password123");
        assertThat(res.get("accessToken").asString()).isNotBlank();
        assertThat(res.get("refreshToken").asString()).isNotBlank();
        assertThat(res.get("expiresIn").asLong()).isEqualTo(900);
        assertThat(res.at("/user/email").asString()).isEqualTo(email);
        assertThat(res.at("/user/emailVerified").asBoolean()).isFalse();
        assertThat(tokenFromMail(email, "http://localhost:5173/verify-email")).isNotBlank();

        mvc.perform(get("/api/me").header("Authorization", "Bearer " + res.get("accessToken").asString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.emailVerified").value(false))
                .andExpect(jsonPath("$.createdAt").isNotEmpty());
    }

    @Test
    void duplicateEmailIs409() throws Exception {
        String email = uniqueEmail();
        register(email, "password123");
        postJson("/api/auth/register", Map.of("email", email.toUpperCase(), "password", "password456"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("EMAIL_TAKEN"))
                .andExpect(jsonPath("$.message").value("该邮箱已注册"));
    }

    @Test
    void invalidInputIs400() throws Exception {
        postJson("/api/auth/register", Map.of("email", uniqueEmail(), "password", "short"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_FAILED"));
        postJson("/api/auth/register", Map.of("email", "not-an-email", "password", "password123"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_FAILED"));
    }

    @Test
    void loginWithCorrectAndWrongPassword() throws Exception {
        String email = uniqueEmail();
        register(email, "password123");
        postJson("/api/auth/login", Map.of("email", email.toUpperCase(), "password", "password123"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.email").value(email));
        postJson("/api/auth/login", Map.of("email", email, "password", "wrong-password"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("INVALID_CREDENTIALS"));
        postJson("/api/auth/login", Map.of("email", uniqueEmail(), "password", "password123"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("INVALID_CREDENTIALS"));
    }

    @Test
    void unauthorizedRequestsGet401Json() throws Exception {
        mvc.perform(get("/api/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("UNAUTHORIZED"));
        mvc.perform(get("/api/me").header("Authorization", "Bearer garbage"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("UNAUTHORIZED"));
        postJson("/api/sync", Map.of("since", 0))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void staleBearerHeaderIsIgnoredOnAuthEndpoints() throws Exception {
        String email = uniqueEmail();
        register(email, "password123");
        postJson("/api/auth/login", "garbage", Map.of("email", email, "password", "password123"))
                .andExpect(status().isOk());
    }

    @Test
    void refreshRotatesToken() throws Exception {
        JsonNode reg = register(uniqueEmail(), "password123");
        String r1 = reg.get("refreshToken").asString();

        JsonNode refreshed = body(postJson("/api/auth/refresh", Map.of("refreshToken", r1)).andExpect(status().isOk()));
        String r2 = refreshed.get("refreshToken").asString();
        assertThat(r2).isNotEqualTo(r1);
        assertThat(refreshed.get("accessToken").asString()).isNotBlank();

        postJson("/api/auth/refresh", Map.of("refreshToken", r1))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("UNAUTHORIZED"));
        postJson("/api/auth/refresh", Map.of("refreshToken", r2)).andExpect(status().isOk());
    }

    @Test
    void logoutRevokesRefreshToken() throws Exception {
        String r = register(uniqueEmail(), "password123").get("refreshToken").asString();
        postJson("/api/auth/logout", Map.of("refreshToken", r)).andExpect(status().isNoContent());
        postJson("/api/auth/refresh", Map.of("refreshToken", r)).andExpect(status().isUnauthorized());
        // 重复登出也是 204
        postJson("/api/auth/logout", Map.of("refreshToken", r)).andExpect(status().isNoContent());
    }

    @Test
    void verifyEmailIsSingleUse() throws Exception {
        String email = uniqueEmail();
        String access = register(email, "password123").get("accessToken").asString();
        String token = tokenFromMail(email, "/verify-email");

        postJson("/api/auth/verify-email", Map.of("token", token)).andExpect(status().isNoContent());
        mvc.perform(get("/api/me").header("Authorization", "Bearer " + access))
                .andExpect(jsonPath("$.emailVerified").value(true));

        postJson("/api/auth/verify-email", Map.of("token", token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("INVALID_TOKEN"));
        postJson("/api/auth/verify-email", Map.of("token", "nope"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("INVALID_TOKEN"));
    }

    @Test
    void forgotAndResetPassword() throws Exception {
        String email = uniqueEmail();
        String oldRefresh = register(email, "password123").get("refreshToken").asString();

        postJson("/api/auth/forgot-password", Map.of("email", email)).andExpect(status().isNoContent());
        String token = tokenFromMail(email, "/reset-password");

        // 校验令牌（验证邮件的令牌不能用于重置）
        postJson("/api/auth/reset-password", Map.of("token", tokenFromMail(email, "/verify-email"), "password", "newpassword1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("INVALID_TOKEN"));

        postJson("/api/auth/reset-password", Map.of("token", token, "password", "newpassword1"))
                .andExpect(status().isNoContent());

        postJson("/api/auth/refresh", Map.of("refreshToken", oldRefresh)).andExpect(status().isUnauthorized());
        postJson("/api/auth/login", Map.of("email", email, "password", "password123")).andExpect(status().isUnauthorized());
        postJson("/api/auth/login", Map.of("email", email, "password", "newpassword1")).andExpect(status().isOk());

        postJson("/api/auth/reset-password", Map.of("token", token, "password", "another-pass"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("INVALID_TOKEN"));
    }

    @Test
    void forgotPasswordForUnknownEmailIs204WithoutMail() throws Exception {
        String email = uniqueEmail();
        postJson("/api/auth/forgot-password", Map.of("email", email)).andExpect(status().isNoContent());
        assertThat(mailCount(email)).isZero();
    }

    @Test
    void loginIsRateLimited() throws Exception {
        String email = uniqueEmail();
        for (int i = 0; i < 10; i++) {
            postJson("/api/auth/login", Map.of("email", email, "password", "wrong-password"))
                    .andExpect(status().isUnauthorized());
        }
        postJson("/api/auth/login", Map.of("email", email, "password", "wrong-password"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.error").value("RATE_LIMITED"));
    }
}
