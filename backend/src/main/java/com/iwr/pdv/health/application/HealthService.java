package com.iwr.pdv.health.application;

import com.iwr.pdv.health.domain.HealthRepository;
import com.iwr.pdv.health.domain.HealthSnapshot;
import com.iwr.pdv.health.domain.HealthState;
import java.time.Clock;
import java.time.OffsetDateTime;
import org.springframework.stereotype.Service;

@Service
public class HealthService {

    private final HealthRepository healthRepository;
    private final Clock clock;

    public HealthService(HealthRepository healthRepository, Clock clock) {
        this.healthRepository = healthRepository;
        this.clock = clock;
    }

    public HealthSnapshot getCurrentStatus() {
        boolean databaseAvailable = isDatabaseAvailable();

        return new HealthSnapshot(
                databaseAvailable ? HealthState.UP : HealthState.DEGRADED,
                databaseAvailable ? HealthState.UP : HealthState.DOWN,
                OffsetDateTime.now(clock)
        );
    }

    private boolean isDatabaseAvailable() {
        try {
            return healthRepository.isDatabaseAvailable();
        } catch (RuntimeException exception) {
            return false;
        }
    }
}
