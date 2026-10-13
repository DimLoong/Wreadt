package com.wreadt.server.tts;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Duration;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class TtsController {

    public record TtsRequest(
            @NotBlank(message = "不能为空") @Size(max = TtsService.MAX_CHARS, message = "过长") String text,
            @NotBlank(message = "不能为空") String voice) {}

    private final TtsService tts;

    public TtsController(TtsService tts) {
        this.tts = tts;
    }

    /** 返回 wav 音频；同样的文本与声音会命中服务端缓存 */
    @PostMapping("/api/tts")
    ResponseEntity<byte[]> speak(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody TtsRequest req) {
        byte[] audio = tts.speak(UUID.fromString(jwt.getSubject()), req.text(), req.voice());
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("audio/wav"))
                .cacheControl(CacheControl.maxAge(Duration.ofDays(30)).cachePrivate())
                .body(audio);
    }
}
