package com.dashboard.command.cli.domain;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class ValidationResult {
    private boolean passed;
    private List<ValidationItem> validations;

    @Data
    @Builder
    public static class ValidationItem {
        private String type;
        private Object expected;
        private Object actual;
        private boolean passed;
    }
}
