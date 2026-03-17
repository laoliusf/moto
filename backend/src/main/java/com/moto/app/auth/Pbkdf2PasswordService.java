package com.moto.app.auth;

import org.springframework.stereotype.Service;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.security.SecureRandom;
import java.util.HexFormat;

@Service
public class Pbkdf2PasswordService {
    private static final int ITERATIONS = 1000;
    private static final int KEY_LENGTH = 256;
    private static final int SALT_BYTES = 16;
    private final SecureRandom secureRandom = new SecureRandom();
    private final HexFormat hex = HexFormat.of();

    public String hash(String password) {
        byte[] salt = new byte[SALT_BYTES];
        secureRandom.nextBytes(salt);
        byte[] hash = derive(password.toCharArray(), salt);
        return hex.formatHex(salt) + "|" + hex.formatHex(hash);
    }

    public boolean verify(String password, String stored) {
        if (stored == null || !stored.contains("|")) {
            return false;
        }
        String[] parts = stored.split("\\|");
        byte[] salt = hex.parseHex(parts[0]);
        byte[] expected = hex.parseHex(parts[1]);
        byte[] actual = derive(password.toCharArray(), salt);
        return slowEquals(expected, actual);
    }

    private byte[] derive(char[] password, byte[] salt) {
        try {
            PBEKeySpec spec = new PBEKeySpec(password, salt, ITERATIONS, KEY_LENGTH);
            SecretKeyFactory skf = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
            return skf.generateSecret(spec).getEncoded();
        } catch (Exception e) {
            throw new IllegalStateException("Password hashing failed", e);
        }
    }

    private boolean slowEquals(byte[] a, byte[] b) {
        if (a.length != b.length) return false;
        int diff = 0;
        for (int i = 0; i < a.length; i++) {
            diff |= a[i] ^ b[i];
        }
        return diff == 0;
    }
}
