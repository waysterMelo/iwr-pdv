package com.iwr.pdv.common.config;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ClockConfiguration {

    @Bean
    public Clock systemClock() {
        return Clock.systemUTC();
    }
}
