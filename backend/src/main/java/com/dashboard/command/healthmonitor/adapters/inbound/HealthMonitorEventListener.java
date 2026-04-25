package com.dashboard.command.healthmonitor.adapters.inbound;

import com.dashboard.command.healthmonitor.domain.event.ServiceDownEvent;
import com.dashboard.command.healthmonitor.domain.event.ServiceRecoveredEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class HealthMonitorEventListener {

    @EventListener
    public void onServiceDown(ServiceDownEvent event) {
        log.warn("SERVICE DOWN EVENT: {} ({}) - {} consecutive failures. Error: {}",
                event.getServiceName(),
                event.getServiceUrl(),
                event.getConsecutiveFailures(),
                event.getErrorMessage());
    }

    @EventListener
    public void onServiceRecovered(ServiceRecoveredEvent event) {
        String downDuration = event.getDownDurationSeconds() != null
                ? formatDuration(event.getDownDurationSeconds())
                : "unknown";

        log.info("SERVICE RECOVERED EVENT: {} ({}) - Was down for {}",
                event.getServiceName(),
                event.getServiceUrl(),
                downDuration);
    }

    private String formatDuration(long seconds) {
        if (seconds < 60) {
            return seconds + " seconds";
        } else if (seconds < 3600) {
            return (seconds / 60) + " minutes";
        } else {
            return (seconds / 3600) + " hours, " + ((seconds % 3600) / 60) + " minutes";
        }
    }
}
