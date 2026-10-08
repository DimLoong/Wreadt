package com.wreadt.server.sync;

import com.fasterxml.jackson.annotation.JsonRawValue;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import tools.jackson.databind.JsonNode;

public final class SyncDtos {

    private SyncDtos() {}

    public record SyncRequest(
            @Min(value = 0, message = "不能为负数") Long since,
            @Size(max = 500, message = "单次最多 500 条") List<@Valid @NotNull(message = "不能为空") Change> changes) {}

    public record Change(
            @NotNull(message = "不能为空")
            @Pattern(regexp = "card|customWord|reviewLog|setting", message = "必须是 card、customWord、reviewLog、setting 之一")
            String type,
            @NotBlank(message = "不能为空") @Size(max = 64, message = "过长") String id,
            @NotNull(message = "不能为空") @Min(value = 0, message = "不能为负数") Long updatedAt,
            boolean deleted,
            JsonNode data) {}

    /** data 以原始 JSON 字符串输出，服务端不解析 */
    public record Record(String type, String id, long updatedAt, boolean deleted, @JsonRawValue String data) {}

    public record SyncResponse(long version, List<Record> changes, boolean hasMore) {}
}
