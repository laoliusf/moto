package com.moto.app.auth;

import com.moto.app.config.AppProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;

import java.security.Key;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;

@Service
public class JwtTokenService {
    private final AppProperties properties;
    private Key key;

    public JwtTokenService(AppProperties properties) {
        this.properties = properties;
    }

    @PostConstruct
    public void init() {
        String secret = properties.getJwt().getSecret();
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("APP_JWT_SECRET is required");
        }
        this.key = Keys.hmacShaKeyFor(secret.getBytes());
    }

    public String generate(Long userId, String username) {
        Instant now = Instant.now();
        Instant exp = now.plus(properties.getJwt().getExpirationDays(), ChronoUnit.DAYS);
        return Jwts.builder()
                .setSubject(String.valueOf(userId))
                .claim("username", username)
                .setIssuedAt(Date.from(now))
                .setExpiration(Date.from(exp))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    public Claims parse(String token) {
        return Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token).getBody();
    }
}
