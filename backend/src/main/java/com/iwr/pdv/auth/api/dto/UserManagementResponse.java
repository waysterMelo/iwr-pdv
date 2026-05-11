package com.iwr.pdv.auth.api.dto;

import com.iwr.pdv.auth.domain.UserRole;
import java.time.OffsetDateTime;

public record UserManagementResponse(
        Long id,
        String username,
        String displayName,
        UserRole role,
        Boolean active,
        Boolean passwordChangeRequired,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}
