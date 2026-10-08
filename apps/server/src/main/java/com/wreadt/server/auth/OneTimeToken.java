package com.wreadt.server.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** 邮箱验证 / 重置密码令牌，一次性使用。 */
@Entity
@Table(name = "one_time_tokens")
public class OneTimeToken {

    public enum Purpose { VERIFY_EMAIL, RESET_PASSWORD }

    @Id
    @Column(name = "token_hash")
    private String tokenHash;
    @Column(name = "user_id")
    private UUID userId;
    @Enumerated(EnumType.STRING)
    private Purpose purpose;
    @Column(name = "expires_at")
    private Instant expiresAt;
    @Column(name = "used_at")
    private Instant usedAt;

    protected OneTimeToken() {}

    public OneTimeToken(String tokenHash, UUID userId, Purpose purpose, Instant expiresAt) {
        this.tokenHash = tokenHash;
        this.userId = userId;
        this.purpose = purpose;
        this.expiresAt = expiresAt;
    }

    public boolean isUsable(Purpose expected, Instant now) {
        return purpose == expected && usedAt == null && expiresAt.isAfter(now);
    }

    public UUID getUserId() { return userId; }

    public void markUsed() { this.usedAt = Instant.now(); }
}
