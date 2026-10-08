package com.wreadt.server.sync;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface UserSyncStateRepository extends JpaRepository<UserSyncState, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from UserSyncState s where s.userId = :userId")
    Optional<UserSyncState> lockByUserId(UUID userId);
}
