package com.moto.app.vehicle;

import com.moto.app.common.ApiException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;

@Repository
public class VehicleRepository {
    private final JdbcTemplate jdbcTemplate;

    public VehicleRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private final RowMapper<Vehicle> mapper = new RowMapper<>() {
        @Override
        public Vehicle mapRow(ResultSet rs, int rowNum) throws SQLException {
            return new Vehicle(
                    rs.getLong("id"),
                    rs.getLong("user_id"),
                    rs.getString("name"),
                    rs.getString("brand"),
                    rs.getString("model"),
                    rs.getString("displacement"),
                    rs.getString("purchase_date"),
                    rs.getObject("current_mileage") == null ? 0 : rs.getInt("current_mileage"),
                    rs.getString("notes")
            );
        }
    };

    public List<Vehicle> list(Long userId) {
        return jdbcTemplate.query("SELECT * FROM vehicles WHERE user_id = ? ORDER BY id DESC", mapper, userId);
    }

    public Vehicle create(Long userId, Vehicle vehicle) {
        jdbcTemplate.update("INSERT INTO vehicles(user_id, name, brand, model, displacement, purchase_date, current_mileage, notes) VALUES(?,?,?,?,?,?,?,?)",
                userId, vehicle.name(), vehicle.brand(), vehicle.model(), vehicle.displacement(), vehicle.purchaseDate(), vehicle.currentMileage(), vehicle.notes());
        Long id = jdbcTemplate.queryForObject("SELECT last_insert_rowid()", Long.class);
        return new Vehicle(id, userId, vehicle.name(), vehicle.brand(), vehicle.model(), vehicle.displacement(), vehicle.purchaseDate(), vehicle.currentMileage(), vehicle.notes());
    }

    public Optional<Vehicle> findById(Long id, Long userId) {
        return jdbcTemplate.query("SELECT * FROM vehicles WHERE id = ? AND user_id = ?", mapper, id, userId).stream().findFirst();
    }

    public Vehicle update(Long id, Long userId, Vehicle vehicle) {
        int updated = jdbcTemplate.update("UPDATE vehicles SET name=?, brand=?, model=?, displacement=?, purchase_date=?, current_mileage=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?",
                vehicle.name(), vehicle.brand(), vehicle.model(), vehicle.displacement(), vehicle.purchaseDate(), vehicle.currentMileage(), vehicle.notes(), id, userId);
        if (updated == 0) throw ApiException.notFound("Vehicle not found");
        return new Vehicle(id, userId, vehicle.name(), vehicle.brand(), vehicle.model(), vehicle.displacement(), vehicle.purchaseDate(), vehicle.currentMileage(), vehicle.notes());
    }

    public boolean hasFuelRecords(Long vehicleId, Long userId) {
        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(1) FROM fuel_records WHERE vehicle_id=? AND user_id=?", Integer.class, vehicleId, userId);
        return count != null && count > 0;
    }

    public boolean hasMaintenanceRecords(Long vehicleId, Long userId) {
        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(1) FROM maintenance_records WHERE vehicle_id=? AND user_id=?", Integer.class, vehicleId, userId);
        return count != null && count > 0;
    }

    public void delete(Long id, Long userId) {
        int deleted = jdbcTemplate.update("DELETE FROM vehicles WHERE id=? AND user_id=?", id, userId);
        if (deleted == 0) throw ApiException.notFound("Vehicle not found");
    }
}
