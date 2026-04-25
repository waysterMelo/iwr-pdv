package com.iwr.pdv.auth.application;

import com.iwr.pdv.auth.api.dto.LoginRequest;
import com.iwr.pdv.auth.api.dto.LoginResponse;
import com.iwr.pdv.auth.domain.AppUser;
import java.util.Optional;

public interface AuthService {

    LoginResponse login(LoginRequest request);

    Optional<AppUser> authenticateToken(String token);

    void logout(String token);
}
