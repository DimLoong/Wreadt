package com.wreadt.server.ai;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

public final class AiDtos {

    private AiDtos() {}

    public record ExercisesRequest(
            @NotBlank(message = "不能为空") @Pattern(regexp = "[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})?", message = "语言代码不合法")
            String lang,
            @NotEmpty(message = "不能为空") @Size(max = 10, message = "单次最多 10 个单词")
            List<@NotBlank(message = "不能为空") @Size(max = 64, message = "过长") String> words,
            @Pattern(regexp = "[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})?", message = "locale 不合法") String locale) {}

    public record Exercise(String word, String kind, String prompt, String answer, String explanation) {}

    public record ExercisesResponse(List<Exercise> exercises) {}

    /** 通用任务：task 对应 prompts/{task}.txt，input 原样作为用户消息 */
    public record CompleteRequest(
            @NotBlank(message = "不能为空")
            @Pattern(regexp = "sentence-exercises|word-examples|analyze-words|expand-dict|scenario-question|scenario-review|confusable-quiz|interest-feed|micro-reading|word-tips", message = "不支持的任务")
            String task,
            @jakarta.validation.constraints.NotNull(message = "不能为空") tools.jackson.databind.JsonNode input) {}

    /** content 为模型返回的 JSON 文本，由客户端（packages/core）校验解析 */
    public record CompleteResponse(String content) {}

    public record ExamplesRequest(
            @NotBlank(message = "不能为空") @Pattern(regexp = "[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})?", message = "语言代码不合法")
            String lang,
            @NotBlank(message = "不能为空") @Size(max = 64, message = "过长") String word,
            @Pattern(regexp = "[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})?", message = "locale 不合法") String locale) {}

    public record Example(String sentence, String translation) {}

    public record ExamplesResponse(List<Example> examples) {}
}
