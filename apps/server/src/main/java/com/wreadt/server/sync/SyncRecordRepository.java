package com.wreadt.server.sync;

import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SyncRecordRepository extends JpaRepository<SyncRecord, SyncRecord.Key> {

    List<SyncRecord> findByUserIdAndVersionGreaterThanOrderByVersionAsc(UUID userId, long since, Limit limit);
}
