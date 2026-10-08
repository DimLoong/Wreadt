package com.wreadt.server.common;

import com.wreadt.server.config.AppProperties;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.stereotype.Component;

/** 进程内固定窗口限流（每分钟），单实例部署足够；多实例需换成共享存储。 */
@Component
public class RateLimiter {

    private static final long WINDOW_MS = 60_000;

    private record Window(long start, AtomicInteger count) {}

    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
    private final int limit;

    public RateLimiter(AppProperties props) {
        this.limit = props.rateLimitPerMinute();
    }

    public void check(String action, String ip, String email) {
        long now = System.currentTimeMillis();
        if (windows.size() > 10_000) {
            windows.values().removeIf(w -> now - w.start() >= WINDOW_MS);
        }
        String key = action + '|' + ip + '|' + (email == null ? "" : email);
        Window w = windows.compute(key, (k, old) ->
                old == null || now - old.start() >= WINDOW_MS ? new Window(now, new AtomicInteger()) : old);
        if (w.count().incrementAndGet() > limit) {
            throw ApiException.rateLimited("请求过于频繁，请稍后再试");
        }
    }
}
