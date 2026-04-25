package com.iwr.pdv.auth.api;

import com.iwr.pdv.auth.api.dto.LoginRequest;
import com.iwr.pdv.auth.api.dto.LoginResponse;
import com.iwr.pdv.auth.api.dto.UserResponse;
import com.iwr.pdv.auth.application.AuthService;
import com.iwr.pdv.auth.domain.AppUser;
import com.iwr.pdv.auth.mapper.AuthMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.time.Duration;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "Auth", description = "Authentication endpoints.")
public class AuthController {

    private static final String SESSION_COOKIE_NAME = "IWR_PDV_SESSION";

    private final AuthService authService;
    private final AuthMapper authMapper;

    public AuthController(AuthService authService, AuthMapper authMapper) {
        this.authService = authService;
        this.authMapper = authMapper;
    }

    @PostMapping("/login")
    @Operation(summary = "Authenticate user and create a session token")
    public LoginResponse login(@Valid @RequestBody LoginRequest request, HttpServletResponse response) {
        LoginResponse loginResponse = authService.login(request);
        response.addHeader(HttpHeaders.SET_COOKIE, buildSessionCookie(loginResponse.token()).toString());

        return loginResponse;
    }

    @GetMapping("/me")
    @Operation(summary = "Return current authenticated user")
    public UserResponse me(HttpServletRequest request) {
        AppUser user = (AppUser) request.getAttribute("authenticatedUser");
        return authMapper.toResponse(user);
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Invalidate current session token")
    public void logout(HttpServletRequest request, HttpServletResponse response) {
        authService.logout(extractToken(request));
        response.addHeader(HttpHeaders.SET_COOKIE, expireSessionCookie().toString());
    }

    private String extractToken(HttpServletRequest request) {
        String authorization = request.getHeader("Authorization");
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            return extractCookieToken(request);
        }

        return authorization.substring("Bearer ".length());
    }

    private String extractCookieToken(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();

        if (cookies == null) {
            return null;
        }

        for (Cookie cookie : cookies) {
            if (SESSION_COOKIE_NAME.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }

        return null;
    }

    private ResponseCookie buildSessionCookie(String token) {
        return ResponseCookie.from(SESSION_COOKIE_NAME, token)
                .httpOnly(true)
                .sameSite("Lax")
                .path("/")
                .maxAge(Duration.ofHours(12))
                .build();
    }

    private ResponseCookie expireSessionCookie() {
        return ResponseCookie.from(SESSION_COOKIE_NAME, "")
                .httpOnly(true)
                .sameSite("Lax")
                .path("/")
                .maxAge(Duration.ZERO)
                .build();
    }
}
