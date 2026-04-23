package com.iwr.pdv.health.api.dto;

import com.iwr.pdv.health.domain.HealthSnapshot;
import com.iwr.pdv.health.domain.HealthState;
import java.time.OffsetDateTime;

public record HealthResponse(
        String application,
        HealthState status,
        HealthState database,
        OffsetDateTime checkedAt
) {
    public static HealthResponse from(String applicationName, HealthSnapshot snapshot) {
        return new HealthResponse(
                applicationName,
                snapshot.status(),
                snapshot.database(),
                snapshot.checkedAt()
        );
    }
}
