package com.iwr.pdv.auth.api.dto;

import java.time.OffsetDateTime;

public record LoginResponse(
        String token,
        OffsetDateTime expiresAt,
        UserResponse user
) {
}
