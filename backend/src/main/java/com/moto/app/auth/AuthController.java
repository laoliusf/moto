package com.moto.app.auth;

import com.moto.app.common.ApiException;
import com.moto.app.user.User;
import com.moto.app.user.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final UserRepository userRepository;
    private final Pbkdf2PasswordService passwordService;
    private final JwtTokenService jwtTokenService;

    public AuthController(UserRepository userRepository, Pbkdf2PasswordService passwordService, JwtTokenService jwtTokenService) {
        this.userRepository = userRepository;
        this.passwordService = passwordService;
        this.jwtTokenService = jwtTokenService;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody AuthRequest request) {
        userRepository.findByUsername(request.username()).ifPresent(u -> {
            throw ApiException.conflict("Username already exists");
        });
        String hash = passwordService.hash(request.password());
        User saved = userRepository.save(request.username(), hash);
        String token = jwtTokenService.generate(saved.id(), saved.username());
        return ResponseEntity.ok(Map.of("token", token, "user", Map.of("id", saved.id(), "username", saved.username())));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody AuthRequest request) {
        User user = userRepository.findByUsername(request.username())
                .orElseThrow(() -> ApiException.unauthorized("Invalid credentials"));
        if (!passwordService.verify(request.password(), user.passwordHash())) {
            throw ApiException.unauthorized("Invalid credentials");
        }
        String token = jwtTokenService.generate(user.id(), user.username());
        return ResponseEntity.ok(Map.of("token", token, "user", Map.of("id", user.id(), "username", user.username())));
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(@AuthenticationPrincipal AuthUser authUser) {
        return ResponseEntity.ok(Map.of("id", authUser.id(), "username", authUser.username()));
    }

    public record AuthRequest(@NotBlank(message = "用户名不能为空") String username,
                              @NotBlank(message = "密码不能为空") String password) {}
}
