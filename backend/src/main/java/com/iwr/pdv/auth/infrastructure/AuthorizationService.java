package com.iwr.pdv.auth.infrastructure;

import com.iwr.pdv.auth.domain.AppUser;
import com.iwr.pdv.auth.domain.UserRole;
import com.iwr.pdv.common.exception.AccessDeniedException;
import org.springframework.stereotype.Component;

@Component
public class AuthorizationService {

    public void requireAdmin(AppUser user) {
        if (user == null || user.getRole() != UserRole.ADMIN) {
            throw new AccessDeniedException("Admin access is required.");
        }
    }
}
