package com.iwr.pdv.auth.application;

import com.iwr.pdv.auth.api.dto.UserCreateRequest;
import com.iwr.pdv.auth.api.dto.UserManagementResponse;
import com.iwr.pdv.auth.api.dto.UserPasswordUpdateRequest;
import com.iwr.pdv.auth.api.dto.UserUpdateRequest;
import java.util.List;

public interface UserManagementService {

    List<UserManagementResponse> list();

    UserManagementResponse create(UserCreateRequest request);

    UserManagementResponse update(Long userId, UserUpdateRequest request);

    UserManagementResponse updatePassword(Long userId, UserPasswordUpdateRequest request);
}
