package com.iwr.pdv.health.infrastructure;

import com.iwr.pdv.health.domain.HealthRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcHealthRepository implements HealthRepository {

    private final JdbcTemplate jdbcTemplate;

    public JdbcHealthRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public boolean isDatabaseAvailable() {
        Integer result = jdbcTemplate.queryForObject("SELECT 1", Integer.class);
        return Integer.valueOf(1).equals(result);
    }
}
