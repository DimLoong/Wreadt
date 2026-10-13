package com.wreadt.server.tts;

import com.wreadt.server.config.AppProperties;
import java.net.URI;
import java.net.http.HttpClient;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

/**
 * 阿里云百炼的千问语音合成（qwen3-tts-flash）。接口返回一个临时的 wav 地址，这里再把音频下载下来。
 * baseUrl 为原生接口地址（如 https://dashscope.aliyuncs.com/api/v1），不是 OpenAI 兼容地址。
 */
@Component
public class TtsClient {

    private final AppProperties.Tts tts;
    private final RestClient api;
    private final RestClient download;

    public TtsClient(AppProperties props) {
        this.tts = props.tts();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(
                HttpClient.newBuilder().connectTimeout(tts.timeout()).followRedirects(HttpClient.Redirect.NORMAL).build());
        factory.setReadTimeout(tts.timeout());
        this.api = RestClient.builder()
                .baseUrl(tts.baseUrl())
                .requestFactory(factory)
                .defaultHeader("Authorization", "Bearer " + tts.apiKey())
                .build();
        // 下载音频不能带 Authorization（对象存储的签名地址会拒绝）
        this.download = RestClient.builder().requestFactory(factory).build();
    }

    /** 合成一句英文，返回 wav 字节 */
    public byte[] synthesize(String text, String voice) {
        JsonNode res = api.post()
                .uri("/services/aigc/multimodal-generation/generation")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("model", tts.model(), "input", Map.of("text", text, "voice", voice, "language_type", "English")))
                .retrieve()
                .body(JsonNode.class);
        String url = res == null ? "" : res.path("output").path("audio").path("url").asString("");
        if (url.isBlank()) {
            throw new IllegalStateException("语音合成未返回音频地址");
        }
        // 阿里云对象存储返回 http 地址，同样支持 https
        URI uri = URI.create(url.matches("^http://[^/]+\\.aliyuncs\\.com/.*") ? url.replaceFirst("^http:", "https:") : url);
        byte[] audio = download.get().uri(uri).retrieve().body(byte[].class);
        if (audio == null || audio.length == 0) {
            throw new IllegalStateException("语音合成的音频为空");
        }
        return audio;
    }
}
