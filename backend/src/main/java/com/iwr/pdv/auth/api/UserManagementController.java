package com.iwr.pdv.auth.api;

import com.iwr.pdv.auth.api.dto.UserCreateRequest;
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
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
@Tag(name = "Users", description = "User management endpoints.")
public class UserManagementController {

    private final UserManagementService userManagementService;
    private final AuthorizationService authorizationService;

    public UserManagementController(
            UserManagementService userManagementService,
            AuthorizationService authorizationService
    ) {
        this.userManagementService = userManagementService;
        this.authorizationService = authorizationService;
    }

    @GetMapping
    @Operation(summary = "List users")
    public List<UserManagementResponse> list(HttpServletRequest servletRequest) {
        authorizationService.requireAdmin(currentUser(servletRequest));
        return userManagementService.list();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create a user")
    public UserManagementResponse create(
            @Valid @RequestBody UserCreateRequest request,
            HttpServletRequest servletRequest
    ) {
        authorizationService.requireAdmin(currentUser(servletRequest));
        return userManagementService.create(request);
    }

    @PutMapping("/{userId}")
    @Operation(summary = "Update a user")
    public UserManagementResponse update(
            @PathVariable Long userId,
            @Valid @RequestBody UserUpdateRequest request,
            HttpServletRequest servletRequest
    ) {
        authorizationService.requireAdmin(currentUser(servletRequest));
        return userManagementService.update(userId, request);
    }

    @PatchMapping("/{userId}/password")
    @Operation(summary = "Update a user password")
    public UserManagementResponse updatePassword(
            @PathVariable Long userId,
            @Valid @RequestBody UserPasswordUpdateRequest request,
            HttpServletRequest servletRequest
    ) {
        authorizationService.requireAdmin(currentUser(servletRequest));
        return userManagementService.updatePassword(userId, request);
    }

    private AppUser currentUser(HttpServletRequest request) {
        return (AppUser) request.getAttribute("authenticatedUser");
    }
}
