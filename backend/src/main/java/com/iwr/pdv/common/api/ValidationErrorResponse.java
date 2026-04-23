package com.iwr.pdv.common.api;

import java.time.OffsetDateTime;
import java.util.List;

public record ValidationErrorResponse(
        int status,
        String error,
        String message,
        String path,
        OffsetDateTime timestamp,
        List<FieldViolation> violations
) {
    public record FieldViolation(String field, String message) {
    }
}
