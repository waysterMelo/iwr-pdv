package com.iwr.pdv.auth.api.dto;

import com.iwr.pdv.auth.domain.UserRole;

public record UserResponse(
        Long id,
        String username,
        String displayName,
        UserRole role,
        Boolean passwordChangeRequired
) {
}
