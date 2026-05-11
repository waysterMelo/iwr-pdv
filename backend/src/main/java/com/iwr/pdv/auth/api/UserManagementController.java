package com.iwr.pdv.auth.api;

import com.iwr.pdv.audit.application.AuditLogService;
import com.iwr.pdv.audit.domain.AuditAction;
import com.iwr.pdv.auth.api.dto.UserCreateRequest;
import com.iwr.pdv.auth.api.dto.UserManagementPageResponse;
import com.iwr.pdv.auth.api.dto.UserManagementResponse;
import com.iwr.pdv.auth.api.dto.UserPasswordUpdateRequest;
import com.iwr.pdv.auth.api.dto.UserUpdateRequest;
import com.iwr.pdv.auth.application.UserManagementService;
import com.iwr.pdv.auth.domain.AppUser;
import com.iwr.pdv.auth.infrastructure.AuthorizationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
@Tag(name = "Users", description = "User management endpoints.")
public class UserManagementController {

    private final UserManagementService userManagementService;
    private final AuthorizationService authorizationService;
    private final AuditLogService auditLogService;

    public UserManagementController(
            UserManagementService userManagementService,
            AuthorizationService authorizationService,
            AuditLogService auditLogService
    ) {
        this.userManagementService = userManagementService;
        this.authorizationService = authorizationService;
        this.auditLogService = auditLogService;
    }

    @GetMapping
    @Operation(summary = "List users with pagination")
    public UserManagementPageResponse list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "6") int size,
            HttpServletRequest servletRequest
    ) {
        authorizationService.requireAdmin(currentUser(servletRequest));
        return userManagementService.list(page, size);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create a user")
    public UserManagementResponse create(
            @Valid @RequestBody UserCreateRequest request,
            HttpServletRequest servletRequest
    ) {
        AppUser actor = currentUser(servletRequest);
        authorizationService.requireAdmin(actor);
        UserManagementResponse response = userManagementService.create(request);
        auditLogService.log(AuditAction.USER_CREATED, actor, "USER", response.id(), "User created: " + response.username() + ".");
        return response;
    }

    @PutMapping("/{userId}")
    @Operation(summary = "Update a user")
    public UserManagementResponse update(
            @PathVariable Long userId,
            @Valid @RequestBody UserUpdateRequest request,
            HttpServletRequest servletRequest
    ) {
        AppUser actor = currentUser(servletRequest);
        authorizationService.requireAdmin(actor);
        UserManagementResponse response = userManagementService.update(userId, request);
        auditLogService.log(AuditAction.USER_UPDATED, actor, "USER", userId, "User updated: " + response.username() + ".");
        return response;
    }

    @PatchMapping("/{userId}/password")
    @Operation(summary = "Update a user password")
    public UserManagementResponse updatePassword(
            @PathVariable Long userId,
            @Valid @RequestBody UserPasswordUpdateRequest request,
            HttpServletRequest servletRequest
    ) {
        AppUser actor = currentUser(servletRequest);
        authorizationService.requireAdmin(actor);
        UserManagementResponse response = userManagementService.updatePassword(userId, request);
        auditLogService.log(AuditAction.USER_PASSWORD_CHANGED, actor, "USER", userId, "Password updated.");
        return response;
    }

    private AppUser currentUser(HttpServletRequest request) {
        return (AppUser) request.getAttribute("authenticatedUser");
    }
}
