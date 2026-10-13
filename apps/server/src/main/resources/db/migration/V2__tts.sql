-- 云端语音合成：音频按 (模型, 声音, 文本) 的哈希缓存，所有用户共用；每人每天的合成字符数
CREATE TABLE tts_cache (
    hash       VARCHAR(64) PRIMARY KEY,
    voice      VARCHAR(32) NOT NULL,
    audio      BYTEA NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tts_usage (
    user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    usage_date DATE NOT NULL,
    chars      INT NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, usage_date)
);
