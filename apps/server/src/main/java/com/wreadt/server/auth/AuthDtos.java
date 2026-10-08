package com.wreadt.server.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

public final class AuthDtos {

    private AuthDtos() {}

    private static String trim(String s) {
        return s == null ? null : s.trim();
    }

    public record CredentialsRequest(
            @NotBlank(message = "不能为空") @Email(message = "邮箱格式不正确") @Size(max = 320, message = "过长") String email,
            @NotBlank(message = "不能为空") String password) {
        public CredentialsRequest {
            email = trim(email);
        }
    }

    public record RefreshRequest(@NotBlank(message = "不能为空") String refreshToken) {}

    public record TokenRequest(@NotBlank(message = "不能为空") String token) {}

    public record EmailRequest(
            @NotBlank(message = "不能为空") @Email(message = "邮箱格式不正确") @Size(max = 320, message = "过长") String email) {
        public EmailRequest {
            email = trim(email);
        }
    }

    public record ResetPasswordRequest(
            @NotBlank(message = "不能为空") String token,
            @NotBlank(message = "不能为空") String password) {}

    public record UserDto(UUID id, String email, boolean emailVerified) {
        static UserDto of(User u) {
            return new UserDto(u.getId(), u.getEmail(), u.isEmailVerified());
        }
    }

    public record AuthResponse(String accessToken, String refreshToken, long expiresIn, UserDto user) {}

    public record MeResponse(UUID id, String email, boolean emailVerified, Instant createdAt) {}
}
