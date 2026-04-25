package com.dashboard.command.healthmonitor.adapters.outbound;

import com.dashboard.command.healthmonitor.domain.AlertNotification;
import com.dashboard.command.healthmonitor.ports.outbound.EmailNotificationPort;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.time.Duration;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Slf4j
@Component
public class SpringMailNotificationAdapter implements EmailNotificationPort {

    private final JavaMailSender mailSender;
    private final TemplateEngine templateEngine;

    public SpringMailNotificationAdapter(JavaMailSender mailSender,
                                         @Qualifier("emailTemplateEngine") TemplateEngine templateEngine) {
        this.mailSender = mailSender;
        this.templateEngine = templateEngine;
    }

    @Value("${health-monitor.alerts.from-email}")
    private String fromEmail;

    @Value("${health-monitor.alerts.default-recipients}")
    private String defaultRecipients;

    private static final DateTimeFormatter TIMESTAMP_FORMATTER =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss z");

    @Override
    public Mono<Void> sendAlert(AlertNotification notification) {
        return Mono.fromRunnable(() -> {
            try {
                MimeMessage message = mailSender.createMimeMessage();
                MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

                helper.setFrom(fromEmail);
                helper.setTo(resolveRecipients(notification.getRecipients()));
                helper.setSubject(String.format("[ALERT] Service Down: %s", notification.getServiceName()));

                Context context = new Context();
                context.setVariable("serviceName", notification.getServiceName());
                context.setVariable("serviceUrl", notification.getServiceUrl());
                context.setVariable("consecutiveFailures", notification.getConsecutiveFailures());
                context.setVariable("errorMessage", notification.getErrorMessage());
                context.setVariable("timestamp", notification.getTimestamp()
                        .atZone(ZoneId.systemDefault())
                        .format(TIMESTAMP_FORMATTER));

                String htmlContent = templateEngine.process("alert-email", context);
                helper.setText(htmlContent, true);

                mailSender.send(message);
                log.info("Alert email sent for service: {} to {}",
                        notification.getServiceName(),
                        String.join(", ", resolveRecipients(notification.getRecipients())));
            } catch (MessagingException e) {
                log.error("Failed to send alert email for service {}: {}",
                        notification.getServiceName(), e.getMessage());
                throw new RuntimeException("Failed to send email", e);
            }
        }).subscribeOn(Schedulers.boundedElastic()).then();
    }

    @Override
    public Mono<Void> sendRecoveryNotification(AlertNotification notification) {
        return Mono.fromRunnable(() -> {
            try {
                MimeMessage message = mailSender.createMimeMessage();
                MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

                helper.setFrom(fromEmail);
                helper.setTo(resolveRecipients(notification.getRecipients()));
                helper.setSubject(String.format("[RECOVERY] Service Restored: %s", notification.getServiceName()));

                Context context = new Context();
                context.setVariable("serviceName", notification.getServiceName());
                context.setVariable("serviceUrl", notification.getServiceUrl());
                context.setVariable("timestamp", notification.getTimestamp()
                        .atZone(ZoneId.systemDefault())
                        .format(TIMESTAMP_FORMATTER));
                context.setVariable("downDuration", formatDuration(notification.getDownDurationSeconds()));

                String htmlContent = templateEngine.process("recovery-email", context);
                helper.setText(htmlContent, true);

                mailSender.send(message);
                log.info("Recovery email sent for service: {} to {}",
                        notification.getServiceName(),
                        String.join(", ", resolveRecipients(notification.getRecipients())));
            } catch (MessagingException e) {
                log.error("Failed to send recovery email for service {}: {}",
                        notification.getServiceName(), e.getMessage());
                throw new RuntimeException("Failed to send email", e);
            }
        }).subscribeOn(Schedulers.boundedElastic()).then();
    }

    private String[] resolveRecipients(List<String> recipients) {
        if (recipients == null || recipients.isEmpty()) {
            return defaultRecipients.split(",");
        }
        return recipients.stream()
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toArray(String[]::new);
    }

    @Override
    public Mono<Void> sendTestEmail(List<String> recipients, String serviceName) {
        return Mono.fromRunnable(() -> {
            try {
                MimeMessage message = mailSender.createMimeMessage();
                MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

                helper.setFrom(fromEmail);
                helper.setTo(resolveRecipients(recipients));
                helper.setSubject(String.format("[TEST] Email Configuration Test: %s", serviceName));

                Context context = new Context();
                context.setVariable("serviceName", serviceName);
                context.setVariable("timestamp", java.time.Instant.now()
                        .atZone(ZoneId.systemDefault())
                        .format(TIMESTAMP_FORMATTER));

                String htmlContent = templateEngine.process("test-email", context);
                helper.setText(htmlContent, true);

                mailSender.send(message);
                log.info("Test email sent for service: {} to {}",
                        serviceName,
                        String.join(", ", resolveRecipients(recipients)));
            } catch (MessagingException e) {
                log.error("Failed to send test email for service {}: {}",
                        serviceName, e.getMessage());
                throw new RuntimeException("Failed to send test email", e);
            }
        }).subscribeOn(Schedulers.boundedElastic()).then();
    }

    private String formatDuration(Long seconds) {
        if (seconds == null) return "unknown";
        Duration duration = Duration.ofSeconds(seconds);
        long hours = duration.toHours();
        long minutes = duration.toMinutesPart();
        long secs = duration.toSecondsPart();

        if (hours > 0) {
            return String.format("%d hours, %d minutes, %d seconds", hours, minutes, secs);
        } else if (minutes > 0) {
            return String.format("%d minutes, %d seconds", minutes, secs);
        } else {
            return String.format("%d seconds", secs);
        }
    }
}
