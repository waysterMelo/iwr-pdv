package com.iwr.pdv.health.api;

import com.iwr.pdv.health.api.dto.HealthResponse;
import com.iwr.pdv.health.application.HealthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/health")
@Tag(name = "Health", description = "Operational health endpoints.")
public class HealthController {

    private final HealthService healthService;
    private final String applicationName;

    public HealthController(
            HealthService healthService,
            @Value("${spring.application.name}") String applicationName
    ) {
        this.healthService = healthService;
        this.applicationName = applicationName;
    }

    @GetMapping
    @Operation(summary = "Check application and database health")
    public HealthResponse check() {
        return HealthResponse.from(applicationName, healthService.getCurrentStatus());
    }
}
