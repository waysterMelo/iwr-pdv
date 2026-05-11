package com.iwr.pdv.audit.api.dto;

import com.iwr.pdv.audit.domain.AuditAction;
import java.time.OffsetDateTime;

public record AuditLogResponse(
        Long id,
        Long userId,
        String username,
        AuditAction action,
        String entityType,
        String entityId,
        String details,
        OffsetDateTime occurredAt
) {
}
