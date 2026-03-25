package com.moto.app.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app")
public class AppProperties {
    private Jwt jwt = new Jwt();
    private Cors cors = new Cors();

    public Jwt getJwt() {
        return jwt;
    }

    public Cors getCors() {
        return cors;
    }

    public static class Jwt {
        private String secret;
        private int expirationDays = 30;

        public String getSecret() {
            return secret;
        }

        public void setSecret(String secret) {
            this.secret = secret;
        }

        public int getExpirationDays() {
            return expirationDays;
        }

        public void setExpirationDays(int expirationDays) {
            this.expirationDays = expirationDays;
        }
    }

    public static class Cors {
        private String allowedOrigins = "*";

        public String getAllowedOrigins() {
            return allowedOrigins;
        }

        public void setAllowedOrigins(String allowedOrigins) {
            this.allowedOrigins = allowedOrigins;
        }
    }
}
