package com.iwr.pdv.customer.api.dto;

public record CustomerProfileInsightResponse(
        String code,
        Severity severity,
        String title,
        String message,
        String recommendedAction
) {
    public enum Severity {
        INFO,
        SUCCESS,
        WARNING,
        DANGER
    }
}
