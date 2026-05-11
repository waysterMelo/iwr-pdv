package com.iwr.pdv.auth.infrastructure;

import com.iwr.pdv.auth.application.AuthService;
import com.iwr.pdv.auth.domain.AppUser;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.OffsetDateTime;
import org.springframework.core.env.Environment;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class AuthInterceptor implements HandlerInterceptor {

    private static final String SESSION_COOKIE_NAME = "IWR_PDV_SESSION";

    private final AuthService authService;
    private final Environment environment;

    public AuthInterceptor(AuthService authService, Environment environment) {
        this.authService = authService;
        this.environment = environment;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws IOException {
        if (isPublicRequest(request)) {
            return true;
        }

        String token = extractToken(request);
        AppUser user = authService.authenticateToken(token).orElse(null);

        if (user == null) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write("""
                    {"status":401,"error":"Unauthorized","message":"Authentication is required.","path":"%s","timestamp":"%s"}
                    """.formatted(request.getRequestURI(), OffsetDateTime.now()));
            return false;
        }

        request.setAttribute("authenticatedUser", user);
        return true;
    }

    private boolean isPublicRequest(HttpServletRequest request) {
        String path = request.getRequestURI();

        return "OPTIONS".equalsIgnoreCase(request.getMethod())
                || (!isProductionProfile() && path.equals("/health"))
                || (!isProductionProfile() && path.startsWith("/actuator"))
                || (!isProductionProfile() && path.startsWith("/swagger-ui"))
                || (!isProductionProfile() && path.startsWith("/v3/api-docs"))
                || path.equals("/api/auth/login");
    }

    private boolean isProductionProfile() {
        for (String profile : environment.getActiveProfiles()) {
            if ("prod".equalsIgnoreCase(profile) || "production".equalsIgnoreCase(profile)) {
                return true;
            }
        }

        return false;
    }

    private String extractToken(HttpServletRequest request) {
        String authorization = request.getHeader("Authorization");

        if (authorization != null && authorization.startsWith("Bearer ")) {
            return authorization.substring("Bearer ".length());
        }

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
}
