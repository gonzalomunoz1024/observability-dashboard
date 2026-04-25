package com.dashboard.command.healthmonitor.ports.outbound;

import com.dashboard.command.healthmonitor.domain.AlertNotification;
import reactor.core.publisher.Mono;

import java.util.List;

public interface EmailNotificationPort {

    Mono<Void> sendAlert(AlertNotification notification);

    Mono<Void> sendRecoveryNotification(AlertNotification notification);

    Mono<Void> sendTestEmail(List<String> recipients, String serviceName);
}
