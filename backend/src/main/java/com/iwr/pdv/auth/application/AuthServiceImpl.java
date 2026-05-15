package com.iwr.pdv.auth.application;

import com.iwr.pdv.audit.application.AuditLogService;
import com.iwr.pdv.audit.domain.AuditAction;
import com.iwr.pdv.auth.api.dto.LoginRequest;
import com.iwr.pdv.auth.api.dto.LoginResponse;
import com.iwr.pdv.auth.domain.AppUser;
import com.iwr.pdv.auth.domain.AppUserRepository;
import com.iwr.pdv.auth.domain.AuthSession;
import com.iwr.pdv.auth.domain.AuthSessionRepository;
import com.iwr.pdv.auth.exception.AuthenticationFailedException;
import com.iwr.pdv.auth.mapper.AuthMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthServiceImpl implements AuthService {

    private static final int TOKEN_BYTE_LENGTH = 48;
    private static final int SESSION_HOURS = 12;
    private static final int MAX_INVALID_LOGIN_ATTEMPTS = 5;
    private static final int LOGIN_LOCK_MINUTES = 15;

    private final AppUserRepository userRepository;
    private final AuthSessionRepository sessionRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthMapper authMapper;
    private final AuditLogService auditLogService;
    private final Clock clock;
    private final SecureRandom secureRandom = new SecureRandom();

    public AuthServiceImpl(
            AppUserRepository userRepository,
            AuthSessionRepository sessionRepository,
            PasswordEncoder passwordEncoder,
            AuthMapper authMapper,
            AuditLogService auditLogService,
            Clock clock
    ) {
        this.userRepository = userRepository;
        this.sessionRepository = sessionRepository;
        this.passwordEncoder = passwordEncoder;
        this.authMapper = authMapper;
        this.auditLogService = auditLogService;
        this.clock = clock;
    }

    @Override
    @Transactional(noRollbackFor = AuthenticationFailedException.class)
    public LoginResponse login(LoginRequest request) {
        String username = request.username().trim();
        AppUser user = userRepository.findByUsernameIgnoreCase(username)
                .filter(foundUser -> Boolean.TRUE.equals(foundUser.getActive()))
                .orElse(null);

        if (user == null) {
            auditLogService.logAnonymous(AuditAction.LOGIN_FAILED, username, "AUTH", null, "Invalid username.");
            throw new AuthenticationFailedException("Invalid username or password.");
        }

        OffsetDateTime now = OffsetDateTime.now(clock);
        if (user.getLockedUntil() != null && user.getLockedUntil().isAfter(now)) {
            auditLogService.log(AuditAction.LOGIN_FAILED, user, "AUTH", user.getId(), "User temporarily locked.");
            throw new AuthenticationFailedException("User is temporarily locked. Try again later.");
        }

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            registerInvalidLogin(user, now);
            auditLogService.log(AuditAction.LOGIN_FAILED, user, "AUTH", user.getId(), "Invalid password.");
            throw new AuthenticationFailedException("Invalid username or password.");
        }

        user.setInvalidLoginAttempts(0);
        user.setLockedUntil(null);
        user.setUpdatedAt(now);

        String token = generateToken();
        AuthSession session = new AuthSession();
        session.setUser(user);
        session.setTokenHash(hashToken(token));
        session.setCreatedAt(now);
        session.setLastUsedAt(now);
        session.setExpiresAt(now.plusHours(SESSION_HOURS));

        sessionRepository.deleteByExpiresAtBefore(now);
        AuthSession savedSession = sessionRepository.save(session);
        auditLogService.log(AuditAction.LOGIN_SUCCESS, user, "AUTH", user.getId(), "Login successful.");

        return new LoginResponse(token, savedSession.getExpiresAt(), authMapper.toResponse(user));
    }

    @Override
    @Transactional
    public Optional<AppUser> authenticateToken(String token) {
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }

        OffsetDateTime now = OffsetDateTime.now(clock);
        Optional<AuthSession> session = sessionRepository.findByTokenHash(hashToken(token.trim()));

        if (session.isEmpty() || session.get().getExpiresAt().isBefore(now)) {
            return Optional.empty();
        }

        AuthSession validSession = session.get();
        validSession.setLastUsedAt(now);

        AppUser user = validSession.getUser();
        if (!Boolean.TRUE.equals(user.getActive())) {
            return Optional.empty();
        }

        return Optional.of(user);
    }

    @Override
    @Transactional
    public void logout(String token) {
        if (token == null || token.isBlank()) {
            return;
        }

        sessionRepository.findByTokenHash(hashToken(token.trim()))
                .ifPresent(session -> {
                    AppUser user = session.getUser();
                    sessionRepository.delete(session);
                    auditLogService.log(AuditAction.LOGOUT, user, "AUTH", user.getId(), "Logout successful.");
                });
    }

    private void registerInvalidLogin(AppUser user, OffsetDateTime now) {
        int attempts = user.getInvalidLoginAttempts() == null ? 1 : user.getInvalidLoginAttempts() + 1;
        user.setInvalidLoginAttempts(attempts);
        user.setUpdatedAt(now);

        if (attempts >= MAX_INVALID_LOGIN_ATTEMPTS) {
            user.setLockedUntil(now.plusMinutes(LOGIN_LOCK_MINUTES));
        }
    }

    private String generateToken() {
        byte[] tokenBytes = new byte[TOKEN_BYTE_LENGTH];
        secureRandom.nextBytes(tokenBytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 algorithm is not available.", exception);
        }
    }
}
