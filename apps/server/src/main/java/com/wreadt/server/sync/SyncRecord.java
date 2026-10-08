package com.wreadt.server.sync;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.util.UUID;

@Entity
@Table(name = "sync_records")
@IdClass(SyncRecord.Key.class)
public class SyncRecord {

    public record Key(UUID userId, String type, String id) implements Serializable {
        protected Key() {
            this(null, null, null);
        }
    }

    @Id
    @Column(name = "user_id")
    private UUID userId;
    @Id
    private String type;
    @Id
    private String id;
    @Column(name = "updated_at")
    private long updatedAt;
    private boolean deleted;
    /** 客户端不透明 JSON，原样存储 */
    private String data;
    private long version;

    protected SyncRecord() {}

    public SyncRecord(UUID userId, String type, String id) {
        this.userId = userId;
        this.type = type;
        this.id = id;
    }

    public void apply(long updatedAt, boolean deleted, String data, long version) {
        this.updatedAt = updatedAt;
        this.deleted = deleted;
        this.data = data;
        this.version = version;
    }

    public String getType() { return type; }
    public String getId() { return id; }
    public long getUpdatedAt() { return updatedAt; }
    public boolean isDeleted() { return deleted; }
    public String getData() { return data; }
    public long getVersion() { return version; }
}
