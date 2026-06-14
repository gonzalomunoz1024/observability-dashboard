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

-- Synthetic Transactions Table
CREATE TABLE IF NOT EXISTS synthetic_transactions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    mode VARCHAR(20) NOT NULL,
    config CLOB NOT NULL,
    interval_seconds INT,
    enabled BOOLEAN DEFAULT TRUE,
    next_run_at TIMESTAMP,
    last_run_at TIMESTAMP,
    last_status VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Synthetic Runs Table
CREATE TABLE IF NOT EXISTS synthetic_runs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    transaction_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL,
    trigger_type VARCHAR(20) NOT NULL,
    started_at TIMESTAMP NOT NULL,
    finished_at TIMESTAMP,
    elapsed_ms BIGINT,
    result CLOB,
    error VARCHAR(4096),
    FOREIGN KEY (transaction_id) REFERENCES synthetic_transactions(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_monitored_services_enabled ON monitored_services(enabled);
CREATE INDEX IF NOT EXISTS idx_service_health_states_service_id ON service_health_states(service_id);
CREATE INDEX IF NOT EXISTS idx_synthetic_tx_next_run ON synthetic_transactions(next_run_at);
CREATE INDEX IF NOT EXISTS idx_synthetic_runs_started ON synthetic_runs(started_at);
CREATE INDEX IF NOT EXISTS idx_synthetic_runs_transaction ON synthetic_runs(transaction_id);
