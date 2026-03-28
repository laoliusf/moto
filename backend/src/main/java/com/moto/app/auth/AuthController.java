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
                .orElseThrow(() -> ApiException.unauthorized("用户名或密码错误"));
        if (!passwordService.verify(request.password(), user.passwordHash())) {
            throw ApiException.unauthorized("用户名或密码错误");
        }
        String token = jwtTokenService.generate(user.id(), user.username());
        return ResponseEntity.ok(Map.of("token", token, "user", Map.of("id", user.id(), "username", user.username())));
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(@AuthenticationPrincipal AuthUser authUser) {
        return ResponseEntity.ok(Map.of(
                "id", authUser.id(),
                "username", authUser.username(),
                "isAdmin", "admin".equalsIgnoreCase(authUser.username())
        ));
    }

    @PostMapping("/change-password")
    public ResponseEntity<?> changePassword(@AuthenticationPrincipal AuthUser authUser,
                                            @Valid @RequestBody ChangePasswordRequest request) {
        User user = userRepository.findById(authUser.id())
                .orElseThrow(() -> ApiException.notFound("User not found"));
        if (!passwordService.verify(request.currentPassword(), user.passwordHash())) {
            throw ApiException.badRequest("原密码错误");
        }
        if (!request.newPassword().equals(request.confirmPassword())) {
            throw ApiException.badRequest("两次输入的新密码不一致");
        }
        String hash = passwordService.hash(request.newPassword());
        userRepository.updatePassword(user.id(), hash);
        return ResponseEntity.ok(Map.of("message", "密码已更新"));
    }

    @PostMapping("/admin-reset-password")
    public ResponseEntity<?> adminResetPassword(@AuthenticationPrincipal AuthUser authUser,
                                                @Valid @RequestBody AdminResetPasswordRequest request) {
        if (!"admin".equalsIgnoreCase(authUser.username())) {
            throw ApiException.unauthorized("仅管理员可执行密码重置");
        }
        User targetUser = userRepository.findByUsername(request.username())
                .orElseThrow(() -> ApiException.notFound("目标用户不存在"));
        String resetPassword = "moto123";
        userRepository.updatePasswordByUsername(targetUser.username(), passwordService.hash(resetPassword));
        return ResponseEntity.ok(Map.of(
                "message", "密码已重置为 moto123",
                "username", targetUser.username()
        ));
    }

    public record AuthRequest(@NotBlank(message = "用户名不能为空") String username,
                              @NotBlank(message = "密码不能为空") String password) {}

    public record ChangePasswordRequest(
            @NotBlank(message = "原密码不能为空") String currentPassword,
            @NotBlank(message = "新密码不能为空") String newPassword,
            @NotBlank(message = "确认密码不能为空") String confirmPassword
    ) {}

    public record AdminResetPasswordRequest(
            @NotBlank(message = "目标用户名不能为空") String username
    ) {}
}
