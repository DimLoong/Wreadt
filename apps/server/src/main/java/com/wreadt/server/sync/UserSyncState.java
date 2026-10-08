package com.wreadt.server.sync;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

/** 每个用户一行，保存单调递增的同步版本号。 */
@Entity
@Table(name = "user_sync_state")
public class UserSyncState {

    @Id
    @Column(name = "user_id")
    private UUID userId;
    private long version;

    protected UserSyncState() {}

    public UserSyncState(UUID userId) {
        this.userId = userId;
    }

    public long getVersion() { return version; }

    public long nextVersion() { return ++version; }
}
