package com.wreadt.server.auth;

import com.wreadt.server.auth.AuthDtos.AuthResponse;
import com.wreadt.server.auth.AuthDtos.CredentialsRequest;
import com.wreadt.server.auth.AuthDtos.EmailRequest;
import com.wreadt.server.auth.AuthDtos.MeResponse;
import com.wreadt.server.auth.AuthDtos.RefreshRequest;
import com.wreadt.server.auth.AuthDtos.ResetPasswordRequest;
import com.wreadt.server.auth.AuthDtos.TokenRequest;
import com.wreadt.server.common.RateLimiter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class AuthController {

    private final AuthService auth;
    private final RateLimiter rateLimiter;

    public AuthController(AuthService auth, RateLimiter rateLimiter) {
        this.auth = auth;
        this.rateLimiter = rateLimiter;
    }

    @PostMapping("/auth/register")
    @ResponseStatus(HttpStatus.CREATED)
    AuthResponse register(@Valid @RequestBody CredentialsRequest req, HttpServletRequest http) {
        rateLimiter.check("register", http.getRemoteAddr(), AuthService.normalizeEmail(req.email()));
        return auth.register(req.email(), req.password());
    }

    @PostMapping("/auth/login")
    AuthResponse login(@Valid @RequestBody CredentialsRequest req, HttpServletRequest http) {
        rateLimiter.check("login", http.getRemoteAddr(), AuthService.normalizeEmail(req.email()));
        return auth.login(req.email(), req.password());
    }

    @PostMapping("/auth/refresh")
    AuthResponse refresh(@Valid @RequestBody RefreshRequest req) {
        return auth.refresh(req.refreshToken());
    }

    @PostMapping("/auth/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void logout(@Valid @RequestBody RefreshRequest req) {
        auth.logout(req.refreshToken());
    }

    @PostMapping("/auth/verify-email")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void verifyEmail(@Valid @RequestBody TokenRequest req) {
        auth.verifyEmail(req.token());
    }

    @PostMapping("/auth/forgot-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void forgotPassword(@Valid @RequestBody EmailRequest req, HttpServletRequest http) {
        rateLimiter.check("forgot", http.getRemoteAddr(), AuthService.normalizeEmail(req.email()));
        auth.forgotPassword(req.email());
    }

    @PostMapping("/auth/reset-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void resetPassword(@Valid @RequestBody ResetPasswordRequest req) {
        auth.resetPassword(req.token(), req.password());
    }

    @GetMapping("/me")
    MeResponse me(@AuthenticationPrincipal Jwt jwt) {
        return auth.me(UUID.fromString(jwt.getSubject()));
    }
}
