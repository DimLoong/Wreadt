package com.wreadt.server.tts;

import com.wreadt.server.common.ApiException;
import com.wreadt.server.config.AppProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HexFormat;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/** 云端语音合成：校验、缓存（所有用户共用）与每日字符额度（命中缓存不计） */
@Service
public class TtsService {

    private static final Logger log = LoggerFactory.getLogger(TtsService.class);
    private static final ZoneId QUOTA_ZONE = ZoneId.of("Asia/Shanghai");
    /** 与 packages/core/src/tts.ts 的 TTS_VOICES 保持一致 */
    static final Set<String> VOICES = Set.of("Jennifer", "Cherry", "Katerina", "Ryan", "Ethan", "Elias");
    static final int MAX_CHARS = 300;

    private final TtsClient client;
    private final JdbcClient jdbc;
    private final AppProperties.Tts tts;

    public TtsService(TtsClient client, JdbcClient jdbc, AppProperties props) {
        this.client = client;
        this.jdbc = jdbc;
        this.tts = props.tts();
    }

    public byte[] speak(UUID userId, String rawText, String voice) {
        if (!tts.enabled()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "TTS_DISABLED", "云端语音未启用");
        }
        String text = rawText == null ? "" : rawText.strip().replaceAll("\\s+", " ");
        if (text.isEmpty() || text.length() > MAX_CHARS) {
            throw ApiException.validation("文本长度需在 1～" + MAX_CHARS + " 个字符之间");
        }
        if (!VOICES.contains(voice)) {
            throw ApiException.validation("不支持的声音");
        }
        String hash = sha256(tts.model() + "|" + voice + "|" + text);
        Optional<byte[]> cached = jdbc.sql("SELECT audio FROM tts_cache WHERE hash = ?").param(hash).query(byte[].class).optional();
        if (cached.isPresent()) {
            return cached.get();
        }

        LocalDate today = LocalDate.now(QUOTA_ZONE);
        acquireChars(userId, today, text.length());
        byte[] audio;
        try {
            audio = client.synthesize(text, voice);
        } catch (RuntimeException e) {
            // 上游失败不扣额度
            jdbc.sql("UPDATE tts_usage SET chars = chars - ? WHERE user_id = ? AND usage_date = ? AND chars >= ?")
                    .params(text.length(), userId, today, text.length()).update();
            log.warn("语音合成失败: {}", e.toString());
            throw new ApiException(HttpStatus.BAD_GATEWAY, "TTS_FAILED", "语音合成暂时不可用，请稍后再试");
        }
        jdbc.sql("INSERT INTO tts_cache (hash, voice, audio) VALUES (?, ?, ?) ON CONFLICT DO NOTHING")
                .params(hash, voice, audio).update();
        return audio;
    }

    /** 原子地占用字符额度；超出则 429 */
    private void acquireChars(UUID userId, LocalDate day, int chars) {
        jdbc.sql("INSERT INTO tts_usage (user_id, usage_date, chars) VALUES (?, ?, 0) ON CONFLICT DO NOTHING")
                .params(userId, day).update();
        int updated = jdbc.sql("UPDATE tts_usage SET chars = chars + ? WHERE user_id = ? AND usage_date = ? AND chars + ? <= ?")
                .params(chars, userId, day, chars, tts.dailyChars()).update();
        if (updated == 0) {
            throw ApiException.rateLimited("今日云端语音额度已用完");
        }
    }

    private static String sha256(String s) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
