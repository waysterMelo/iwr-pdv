package com.iwr.pdv.auth.application;

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

    private final AppUserRepository userRepository;
    private final AuthSessionRepository sessionRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthMapper authMapper;
    private final Clock clock;
    private final SecureRandom secureRandom = new SecureRandom();

    public AuthServiceImpl(
            AppUserRepository userRepository,
            AuthSessionRepository sessionRepository,
            PasswordEncoder passwordEncoder,
            AuthMapper authMapper,
            Clock clock
    ) {
        this.userRepository = userRepository;
        this.sessionRepository = sessionRepository;
        this.passwordEncoder = passwordEncoder;
        this.authMapper = authMapper;
        this.clock = clock;
    }

    @Override
    @Transactional
    public LoginResponse login(LoginRequest request) {
        AppUser user = userRepository.findByUsernameIgnoreCase(request.username().trim())
                .filter(foundUser -> Boolean.TRUE.equals(foundUser.getActive()))
                .orElseThrow(() -> new AuthenticationFailedException("Invalid username or password."));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new AuthenticationFailedException("Invalid username or password.");
        }

        OffsetDateTime now = OffsetDateTime.now(clock);
        String token = generateToken();
        AuthSession session = new AuthSession();
        session.setUser(user);
        session.setTokenHash(hashToken(token));
        session.setCreatedAt(now);
        session.setLastUsedAt(now);
        session.setExpiresAt(now.plusHours(SESSION_HOURS));

        sessionRepository.deleteByExpiresAtBefore(now);
        AuthSession savedSession = sessionRepository.save(session);

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
                .ifPresent(sessionRepository::delete);
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
