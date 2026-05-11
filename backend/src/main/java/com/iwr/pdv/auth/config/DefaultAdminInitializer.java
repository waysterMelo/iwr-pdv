package com.iwr.pdv.auth.config;

import com.iwr.pdv.auth.domain.AppUser;
import com.iwr.pdv.auth.domain.AppUserRepository;
import com.iwr.pdv.auth.domain.UserRole;
import java.time.Clock;
import java.time.OffsetDateTime;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class DefaultAdminInitializer implements ApplicationRunner {

    private final AppUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;
    private final String username;
    private final String password;
    private final String displayName;
    private final Environment environment;

    public DefaultAdminInitializer(
            AppUserRepository userRepository,
            PasswordEncoder passwordEncoder,
            Clock clock,
            @Value("${app.auth.default-admin.username:admin}") String username,
            @Value("${app.auth.default-admin.password:admin123}") String password,
            @Value("${app.auth.default-admin.display-name:Administrador}") String displayName,
            Environment environment
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.clock = clock;
        this.username = username;
        this.password = password;
        this.displayName = displayName;
        this.environment = environment;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (userRepository.count() > 0) {
            return;
        }

        if (isProductionProfile() && isDefaultCredential()) {
            throw new IllegalStateException("Configure DEFAULT_ADMIN_USERNAME and DEFAULT_ADMIN_PASSWORD before starting production.");
        }

        OffsetDateTime now = OffsetDateTime.now(clock);
        AppUser admin = new AppUser();
        admin.setUsername(username.trim());
        admin.setDisplayName(displayName.trim());
        admin.setPasswordHash(passwordEncoder.encode(password));
        admin.setRole(UserRole.ADMIN);
        admin.setActive(true);
        admin.setInvalidLoginAttempts(0);
        admin.setPasswordChangeRequired(isDefaultCredential());
        admin.setCreatedAt(now);
        admin.setUpdatedAt(now);

        userRepository.save(admin);
    }

    private boolean isDefaultCredential() {
        return "admin".equalsIgnoreCase(username.trim()) || "admin123".equals(password);
    }

    private boolean isProductionProfile() {
        for (String profile : environment.getActiveProfiles()) {
            if ("prod".equalsIgnoreCase(profile) || "production".equalsIgnoreCase(profile)) {
                return true;
            }
        }

        return false;
    }
}
