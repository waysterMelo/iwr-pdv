package com.iwr.pdv.health.application;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.iwr.pdv.health.domain.HealthRepository;
import com.iwr.pdv.health.domain.HealthSnapshot;
import com.iwr.pdv.health.domain.HealthState;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class HealthServiceTest {

    @Test
    void shouldReturnUpWhenDatabaseIsAvailable() {
        HealthRepository repository = () -> true;
        Clock clock = Clock.fixed(Instant.parse("2026-04-22T00:00:00Z"), ZoneOffset.UTC);
        HealthService healthService = new HealthService(repository, clock);

        HealthSnapshot snapshot = healthService.getCurrentStatus();

        assertEquals(HealthState.UP, snapshot.status());
        assertEquals(HealthState.UP, snapshot.database());
        assertEquals("2026-04-22T00:00Z", snapshot.checkedAt().toString());
    }

    @Test
    void shouldReturnDegradedWhenDatabaseIsUnavailable() {
        HealthRepository repository = () -> false;
        Clock clock = Clock.fixed(Instant.parse("2026-04-22T00:00:00Z"), ZoneOffset.UTC);
        HealthService healthService = new HealthService(repository, clock);

        HealthSnapshot snapshot = healthService.getCurrentStatus();

        assertEquals(HealthState.DEGRADED, snapshot.status());
        assertEquals(HealthState.DOWN, snapshot.database());
    }

    @Test
    void shouldReturnDegradedWhenRepositoryThrowsException() {
        HealthRepository repository = () -> {
            throw new IllegalStateException("database offline");
        };
        Clock clock = Clock.fixed(Instant.parse("2026-04-22T00:00:00Z"), ZoneOffset.UTC);
        HealthService healthService = new HealthService(repository, clock);

        HealthSnapshot snapshot = healthService.getCurrentStatus();

        assertEquals(HealthState.DEGRADED, snapshot.status());
        assertEquals(HealthState.DOWN, snapshot.database());
    }
}
