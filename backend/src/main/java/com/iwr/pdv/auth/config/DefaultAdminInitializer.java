package com.iwr.pdv.auth.config;

import com.iwr.pdv.auth.domain.AppUser;
import com.iwr.pdv.auth.domain.AppUserRepository;
import com.iwr.pdv.auth.domain.UserRole;
import java.time.Clock;
import java.time.OffsetDateTime;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
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

    public DefaultAdminInitializer(
            AppUserRepository userRepository,
            PasswordEncoder passwordEncoder,
            Clock clock,
            @Value("${app.auth.default-admin.username:admin}") String username,
            @Value("${app.auth.default-admin.password:admin123}") String password,
            @Value("${app.auth.default-admin.display-name:Administrador}") String displayName
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.clock = clock;
        this.username = username;
        this.password = password;
        this.displayName = displayName;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (userRepository.count() > 0) {
            return;
        }

        OffsetDateTime now = OffsetDateTime.now(clock);
        AppUser admin = new AppUser();
        admin.setUsername(username.trim());
        admin.setDisplayName(displayName.trim());
        admin.setPasswordHash(passwordEncoder.encode(password));
        admin.setRole(UserRole.ADMIN);
        admin.setActive(true);
        admin.setCreatedAt(now);
        admin.setUpdatedAt(now);

        userRepository.save(admin);
    }
}
