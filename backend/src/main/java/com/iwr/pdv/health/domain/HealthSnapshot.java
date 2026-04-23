package com.iwr.pdv.health.domain;

import java.time.OffsetDateTime;

public record HealthSnapshot(
        HealthState status,
        HealthState database,
        OffsetDateTime checkedAt
) {
}
