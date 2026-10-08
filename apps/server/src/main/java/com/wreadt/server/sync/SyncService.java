package com.wreadt.server.sync;

import com.wreadt.server.common.ApiException;
import com.wreadt.server.sync.SyncDtos.Change;
import com.wreadt.server.sync.SyncDtos.Record;
import com.wreadt.server.sync.SyncDtos.SyncResponse;
import jakarta.persistence.EntityManager;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SyncService {

    static final int PAGE_SIZE = 1000;
    static final int MAX_DATA_BYTES = 16 * 1024;

    private final SyncRecordRepository records;
    private final UserSyncStateRepository states;
    private final EntityManager em;

    public SyncService(SyncRecordRepository records, UserSyncStateRepository states, EntityManager em) {
        this.records = records;
        this.states = states;
        this.em = em;
    }

    @Transactional
    public SyncResponse sync(UUID userId, long since, List<Change> changes) {
        // 行锁串行化同一用户的并发同步，保证 version 单调且不重复
        UserSyncState state = states.lockByUserId(userId)
                .orElseThrow(() -> ApiException.unauthorized("用户不存在"));

        if (!changes.isEmpty()) {
            List<SyncRecord.Key> keys = changes.stream()
                    .map(c -> new SyncRecord.Key(userId, c.type(), c.id())).distinct().toList();
            Map<SyncRecord.Key, SyncRecord> existing = new HashMap<>();
            records.findAllById(keys).forEach(r -> existing.put(new SyncRecord.Key(userId, r.getType(), r.getId()), r));

            for (Change c : changes) {
                String data = c.data() == null ? null : c.data().toString();
                if (data != null && data.getBytes(StandardCharsets.UTF_8).length > MAX_DATA_BYTES) {
                    throw ApiException.validation("data 超过 16KB：" + c.type() + "/" + c.id());
                }
                SyncRecord.Key key = new SyncRecord.Key(userId, c.type(), c.id());
                SyncRecord record = existing.get(key);
                if (record == null) {
                    record = new SyncRecord(userId, c.type(), c.id());
                    record.apply(c.updatedAt(), c.deleted(), data, state.nextVersion());
                    em.persist(record);
                    existing.put(key, record);
                } else if (c.updatedAt() >= record.getUpdatedAt()) {
                    record.apply(c.updatedAt(), c.deleted(), data, state.nextVersion());
                }
            }
            em.flush();
        }

        List<SyncRecord> page = records.findByUserIdAndVersionGreaterThanOrderByVersionAsc(
                userId, since, Limit.of(PAGE_SIZE + 1));
        boolean hasMore = page.size() > PAGE_SIZE;
        if (hasMore) {
            page = page.subList(0, PAGE_SIZE);
        }
        long version = hasMore ? page.getLast().getVersion() : state.getVersion();
        List<Record> out = page.stream()
                .map(r -> new Record(r.getType(), r.getId(), r.getUpdatedAt(), r.isDeleted(), r.getData()))
                .toList();
        return new SyncResponse(version, out, hasMore);
    }
}
