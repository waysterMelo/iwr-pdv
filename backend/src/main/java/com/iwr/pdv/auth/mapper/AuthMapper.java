package com.iwr.pdv.auth.mapper;

import com.iwr.pdv.auth.api.dto.UserResponse;
import com.iwr.pdv.auth.api.dto.UserManagementResponse;
import com.iwr.pdv.auth.domain.AppUser;
import org.springframework.stereotype.Component;

@Component
public class AuthMapper {

    public UserResponse toResponse(AppUser user) {
        return new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getDisplayName(),
                user.getRole(),
                user.getPasswordChangeRequired()
        );
    }

    public UserManagementResponse toManagementResponse(AppUser user) {
        return new UserManagementResponse(
                user.getId(),
                user.getUsername(),
                user.getDisplayName(),
                user.getRole(),
                user.getActive(),
                user.getPasswordChangeRequired(),
                user.getCreatedAt(),
                user.getUpdatedAt()
        );
    }
}
