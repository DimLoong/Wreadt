package com.wreadt.server.sync;

import com.wreadt.server.sync.SyncDtos.SyncRequest;
import com.wreadt.server.sync.SyncDtos.SyncResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SyncController {

    private final SyncService sync;

    public SyncController(SyncService sync) {
        this.sync = sync;
    }

    @PostMapping("/api/sync")
    SyncResponse sync(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody SyncRequest req) {
        return sync.sync(UUID.fromString(jwt.getSubject()),
                req.since() == null ? 0 : req.since(),
                req.changes() == null ? List.of() : req.changes());
    }
}
