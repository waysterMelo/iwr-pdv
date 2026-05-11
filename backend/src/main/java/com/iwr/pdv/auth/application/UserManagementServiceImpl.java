package com.iwr.pdv.auth.application;

import com.iwr.pdv.auth.api.dto.UserCreateRequest;
import com.iwr.pdv.auth.api.dto.UserManagementPageResponse;
import com.iwr.pdv.auth.api.dto.UserManagementResponse;
import com.iwr.pdv.auth.api.dto.UserPasswordUpdateRequest;
import com.iwr.pdv.auth.api.dto.UserUpdateRequest;
import com.iwr.pdv.auth.domain.AppUser;
import com.iwr.pdv.auth.domain.AppUserRepository;
import com.iwr.pdv.auth.domain.UserRole;
import com.iwr.pdv.auth.mapper.AuthMapper;
import com.iwr.pdv.common.exception.BusinessRuleException;
import com.iwr.pdv.common.exception.ResourceConflictException;
import com.iwr.pdv.common.exception.ResourceNotFoundException;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserManagementServiceImpl implements UserManagementService {

    private final AppUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthMapper authMapper;
    private final Clock clock;

    public UserManagementServiceImpl(
            AppUserRepository userRepository,
            PasswordEncoder passwordEncoder,
            AuthMapper authMapper,
            Clock clock
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.authMapper = authMapper;
        this.clock = clock;
    }

    @Override
    @Transactional(readOnly = true)
    public UserManagementPageResponse list(int page, int size) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 50);
        Page<AppUser> users = userRepository.findAll(
                PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.ASC, "username"))
        );

        return new UserManagementPageResponse(
                users.getContent().stream().map(authMapper::toManagementResponse).toList(),
                users.getNumber(),
                users.getSize(),
                users.getTotalElements(),
                users.getTotalPages(),
                users.isFirst(),
                users.isLast()
        );
    }

    @Override
    @Transactional
    public UserManagementResponse create(UserCreateRequest request) {
        String username = normalizeUsername(request.username());
        ensureUsernameIsUnique(username, null);

        OffsetDateTime now = OffsetDateTime.now(clock);
        AppUser user = new AppUser();
        user.setUsername(username);
        user.setDisplayName(request.displayName().trim());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setRole(request.role());
        user.setActive(request.active());
        user.setInvalidLoginAttempts(0);
        user.setPasswordChangeRequired(true);
        user.setCreatedAt(now);
        user.setUpdatedAt(now);

        AppUser savedUser = userRepository.save(user);

        return authMapper.toManagementResponse(savedUser);
    }

    @Override
    @Transactional
    public UserManagementResponse update(Long userId, UserUpdateRequest request) {
        AppUser user = findUser(userId);
        String username = normalizeUsername(request.username());
        ensureUsernameIsUnique(username, userId);
        ensureAtLeastOneAdminRemains(user, request);

        user.setUsername(username);
        user.setDisplayName(request.displayName().trim());
        user.setRole(request.role());
        user.setActive(request.active());
        user.setUpdatedAt(OffsetDateTime.now(clock));

        AppUser savedUser = userRepository.save(user);

        return authMapper.toManagementResponse(savedUser);
    }

    @Override
    @Transactional
    public UserManagementResponse updatePassword(Long userId, UserPasswordUpdateRequest request) {
        AppUser user = findUser(userId);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setPasswordChangeRequired(false);
        user.setInvalidLoginAttempts(0);
        user.setLockedUntil(null);
        user.setUpdatedAt(OffsetDateTime.now(clock));

        AppUser savedUser = userRepository.save(user);

        return authMapper.toManagementResponse(savedUser);
    }

    private AppUser findUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found for id " + userId + "."));
    }

    private String normalizeUsername(String username) {
        return username.trim().toLowerCase();
    }

    private void ensureUsernameIsUnique(String username, Long currentUserId) {
        userRepository.findByUsernameIgnoreCase(username)
                .filter(user -> currentUserId == null || !user.getId().equals(currentUserId))
                .ifPresent(user -> {
                    throw new ResourceConflictException("A user with username '" + username + "' already exists.");
                });
    }

    private void ensureAtLeastOneAdminRemains(AppUser existingUser, UserUpdateRequest request) {
        if (existingUser.getRole() != UserRole.ADMIN) {
            return;
        }

        boolean removingAdminAccess = request.role() != UserRole.ADMIN
                || !Boolean.TRUE.equals(request.active());

        if (!removingAdminAccess) {
            return;
        }

        long activeAdmins = userRepository.findAll()
                .stream()
                .filter(user -> user.getRole() == UserRole.ADMIN)
                .filter(user -> Boolean.TRUE.equals(user.getActive()))
                .filter(user -> !user.getId().equals(existingUser.getId()))
                .count();

        if (activeAdmins == 0) {
            throw new BusinessRuleException("At least one active admin user is required.");
        }
    }
}
