package com.compledger.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.TaskExecutor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * Configures the thread pool used to run SSE (Server-Sent Events) tasks off
 * the HTTP request thread, so the HTTP thread is freed immediately while the
 * long-running trace work happens in the background.
 */
@Configuration
public class AsyncConfig {

    /**
     * Creates a bounded thread pool for background SSE processing.
     *
     * - corePoolSize(10): keep 10 threads alive permanently, ready for incoming requests
     * - maxPoolSize(50): allow burst up to 50 simultaneous SSE streams
     * - queueCapacity(100): queue up to 100 tasks before rejecting (prevents OOM under spike)
     * - threadNamePrefix("sse-"): names threads "sse-1", "sse-2", … for easier debugging
     */
    @Bean
    public TaskExecutor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(10);
        executor.setMaxPoolSize(50);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("sse-");
        executor.initialize();
        return executor;
    }
}
