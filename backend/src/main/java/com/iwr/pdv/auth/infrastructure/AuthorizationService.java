package com.iwr.pdv.auth.infrastructure;

import com.iwr.pdv.audit.application.AuditLogService;
import com.iwr.pdv.audit.domain.AuditAction;
import com.iwr.pdv.auth.domain.AppUser;
import com.iwr.pdv.auth.domain.UserRole;
import com.iwr.pdv.common.exception.AccessDeniedException;
import org.springframework.stereotype.Component;

@Component
public class AuthorizationService {

    private final AuditLogService auditLogService;

    public AuthorizationService(AuditLogService auditLogService) {
        this.auditLogService = auditLogService;
    }

    public void requireAdmin(AppUser user) {
        if (user == null || user.getRole() != UserRole.ADMIN) {
            auditLogService.log(AuditAction.ACCESS_DENIED, user, "AUTHORIZATION", null, "Admin access is required.");
            throw new AccessDeniedException("Admin access is required.");
        }
    }

    public void requireAuthenticated(AppUser user) {
        if (user == null) {
            auditLogService.log(AuditAction.ACCESS_DENIED, null, "AUTHORIZATION", null, "Authenticated access is required.");
            throw new AccessDeniedException("Authenticated access is required.");
        }
    }
}
