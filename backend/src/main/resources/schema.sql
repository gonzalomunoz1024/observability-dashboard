-- Monitored Services Table
CREATE TABLE IF NOT EXISTS monitored_services (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(2048) NOT NULL,
    method VARCHAR(10) DEFAULT 'GET',
    timeout INT DEFAULT 5000,
    expected_status INT DEFAULT 200,
    check_interval_seconds INT DEFAULT 60,
    enabled BOOLEAN DEFAULT TRUE,
    alert_recipients VARCHAR(2048),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Service Health States Table
CREATE TABLE IF NOT EXISTS service_health_states (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    service_id BIGINT NOT NULL UNIQUE,
    consecutive_failures INT DEFAULT 0,
    alert_sent BOOLEAN DEFAULT FALSE,
    last_check_time TIMESTAMP,
    last_success_time TIMESTAMP,
    last_failure_time TIMESTAMP,
    alert_sent_time TIMESTAMP,
    last_error VARCHAR(4096),
    current_status VARCHAR(20) DEFAULT 'unknown',
    FOREIGN KEY (service_id) REFERENCES monitored_services(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_monitored_services_enabled ON monitored_services(enabled);
CREATE INDEX IF NOT EXISTS idx_service_health_states_service_id ON service_health_states(service_id);
