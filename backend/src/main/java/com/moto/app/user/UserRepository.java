package com.moto.app.user;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Optional;

@Repository
public class UserRepository {
    private final JdbcTemplate jdbcTemplate;

    public UserRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private final RowMapper<User> mapper = new RowMapper<>() {
        @Override
        public User mapRow(ResultSet rs, int rowNum) throws SQLException {
            return new User(rs.getLong("id"), rs.getString("username"), rs.getString("password_hash"));
        }
    };

    public Optional<User> findByUsername(String username) {
        return jdbcTemplate.query("SELECT * FROM users WHERE username = ?", mapper, username).stream().findFirst();
    }

    public Optional<User> findById(Long id) {
        return jdbcTemplate.query("SELECT * FROM users WHERE id = ?", mapper, id).stream().findFirst();
    }

    public User save(String username, String passwordHash) {
        jdbcTemplate.update("INSERT INTO users(username, password_hash) VALUES(?, ?)", username, passwordHash);
        Long id = jdbcTemplate.queryForObject("SELECT id FROM users WHERE username = ?", Long.class, username);
        return new User(id, username, passwordHash);
    }

    public void updatePassword(Long id, String passwordHash) {
        jdbcTemplate.update("UPDATE users SET password_hash = ? WHERE id = ?", passwordHash, id);
    }

    public void updatePasswordByUsername(String username, String passwordHash) {
        jdbcTemplate.update("UPDATE users SET password_hash = ? WHERE username = ?", passwordHash, username);
    }
}
