package com.moto.app.maintenance;

import com.moto.app.common.ApiException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;

@Repository
public class MaintenanceRepository {
    private final JdbcTemplate jdbcTemplate;

    public MaintenanceRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private final RowMapper<MaintenanceRecord> mapper = new RowMapper<>() {
        @Override
        public MaintenanceRecord mapRow(ResultSet rs, int rowNum) throws SQLException {
            return new MaintenanceRecord(
                    rs.getLong("id"),
                    rs.getLong("user_id"),
                    rs.getObject("vehicle_id") == null ? null : rs.getLong("vehicle_id"),
                    rs.getString("title"),
                    rs.getDouble("cost"),
                    rs.getInt("mileage"),
                    rs.getObject("next_maintenance_mileage") == null ? 0 : rs.getInt("next_maintenance_mileage"),
                    rs.getString("date"),
                    rs.getString("notes")
            );
        }
    };

    public List<MaintenanceRecord> list(Long userId, Long vehicleId) {
        StringBuilder sql = new StringBuilder("SELECT * FROM maintenance_records WHERE user_id = ?");
        java.util.List<Object> params = new java.util.ArrayList<>();
        params.add(userId);
        if (vehicleId != null) {
            sql.append(" AND vehicle_id = ?");
            params.add(vehicleId);
        }
        sql.append(" ORDER BY date DESC, id DESC");
        return jdbcTemplate.query(sql.toString(), mapper, params.toArray());
    }

    public MaintenanceRecord create(Long userId, MaintenanceRecord record) {
        jdbcTemplate.update("INSERT INTO maintenance_records(user_id, vehicle_id, title, cost, mileage, next_maintenance_mileage, date, notes) VALUES(?,?,?,?,?,?,?,?)",
                userId, record.vehicleId(), record.title(), record.cost(), record.mileage(), record.nextMaintenanceMileage(), record.date(), record.notes());
        Long id = jdbcTemplate.queryForObject("SELECT last_insert_rowid()", Long.class);
        return new MaintenanceRecord(id, userId, record.vehicleId(), record.title(), record.cost(), record.mileage(), record.nextMaintenanceMileage(), record.date(), record.notes());
    }

    public Optional<MaintenanceRecord> findById(Long id, Long userId) {
        return jdbcTemplate.query("SELECT * FROM maintenance_records WHERE id = ? AND user_id = ?", mapper, id, userId).stream().findFirst();
    }

    public MaintenanceRecord update(Long id, Long userId, MaintenanceRecord record) {
        int updated = jdbcTemplate.update(
                "UPDATE maintenance_records SET vehicle_id=?, title=?, cost=?, mileage=?, next_maintenance_mileage=?, date=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?",
                record.vehicleId(), record.title(), record.cost(), record.mileage(), record.nextMaintenanceMileage(), record.date(), record.notes(), id, userId
        );
        if (updated == 0) throw ApiException.notFound("Maintenance record not found");
        return new MaintenanceRecord(id, userId, record.vehicleId(), record.title(), record.cost(), record.mileage(), record.nextMaintenanceMileage(), record.date(), record.notes());
    }

    public void delete(Long id, Long userId) {
        int deleted = jdbcTemplate.update("DELETE FROM maintenance_records WHERE id=? AND user_id=?", id, userId);
        if (deleted == 0) throw ApiException.notFound("Maintenance record not found");
    }
}
