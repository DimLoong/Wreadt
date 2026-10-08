CREATE TABLE users (
    id             UUID PRIMARY KEY,
    email          VARCHAR(320) NOT NULL UNIQUE,
    password_hash  VARCHAR(100) NOT NULL,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE refresh_tokens (
    token_hash VARCHAR(64) PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);

-- 邮箱验证 / 重置密码令牌（只存哈希，一次性）
CREATE TABLE one_time_tokens (
    token_hash VARCHAR(64) PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    purpose    VARCHAR(20) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at    TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_one_time_tokens_user ON one_time_tokens (user_id);

CREATE TABLE user_sync_state (
    user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    version BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE sync_records (
    user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type       VARCHAR(20) NOT NULL,
    id         VARCHAR(64) NOT NULL,
    updated_at BIGINT NOT NULL,
    deleted    BOOLEAN NOT NULL,
    data       TEXT,
    version    BIGINT NOT NULL,
    PRIMARY KEY (user_id, type, id)
);
CREATE INDEX idx_sync_records_user_version ON sync_records (user_id, version);

CREATE TABLE ai_usage (
    user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    usage_date DATE NOT NULL,
    count      INT NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, usage_date)
);
