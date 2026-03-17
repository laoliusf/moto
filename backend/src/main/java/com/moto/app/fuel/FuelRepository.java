package com.moto.app.fuel;

import com.moto.app.common.ApiException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;

@Repository
public class FuelRepository {
    private final JdbcTemplate jdbcTemplate;

    public FuelRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private final RowMapper<FuelRecord> mapper = new RowMapper<>() {
        @Override
        public FuelRecord mapRow(ResultSet rs, int rowNum) throws SQLException {
            return new FuelRecord(
                    rs.getLong("id"),
                    rs.getLong("user_id"),
                    rs.getObject("vehicle_id") == null ? null : rs.getLong("vehicle_id"),
                    rs.getString("date"),
                    rs.getInt("mileage"),
                    rs.getDouble("liters"),
                    rs.getDouble("price_per_liter"),
                    rs.getDouble("total_cost"),
                    rs.getInt("is_full_tank") == 1,
                    rs.getString("notes")
            );
        }
    };

    public List<FuelRecord> list(Long userId, Long vehicleId, String from, String to) {
        StringBuilder sql = new StringBuilder("SELECT * FROM fuel_records WHERE user_id = ?");
        java.util.List<Object> params = new java.util.ArrayList<>();
        params.add(userId);
        if (vehicleId != null) {
            sql.append(" AND vehicle_id = ?");
            params.add(vehicleId);
        }
        if (from != null) {
            sql.append(" AND date >= ?");
            params.add(from);
        }
        if (to != null) {
            sql.append(" AND date <= ?");
            params.add(to);
        }
        sql.append(" ORDER BY date DESC, id DESC");
        return jdbcTemplate.query(sql.toString(), mapper, params.toArray());
    }

    public FuelRecord create(Long userId, FuelRecord record) {
        jdbcTemplate.update("INSERT INTO fuel_records(user_id, vehicle_id, date, mileage, liters, price_per_liter, total_cost, is_full_tank, notes) VALUES(?,?,?,?,?,?,?,?,?)",
                userId, record.vehicleId(), record.date(), record.mileage(), record.liters(), record.pricePerLiter(), record.totalCost(), record.isFullTank() ? 1 : 0, record.notes());
        Long id = jdbcTemplate.queryForObject("SELECT last_insert_rowid()", Long.class);
        return new FuelRecord(id, userId, record.vehicleId(), record.date(), record.mileage(), record.liters(), record.pricePerLiter(), record.totalCost(), record.isFullTank(), record.notes());
    }

    public Optional<FuelRecord> findById(Long id, Long userId) {
        return jdbcTemplate.query("SELECT * FROM fuel_records WHERE id = ? AND user_id = ?", mapper, id, userId).stream().findFirst();
    }

    public FuelRecord update(Long id, Long userId, FuelRecord record) {
        int updated = jdbcTemplate.update("UPDATE fuel_records SET vehicle_id=?, date=?, mileage=?, liters=?, price_per_liter=?, total_cost=?, is_full_tank=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?",
                record.vehicleId(), record.date(), record.mileage(), record.liters(), record.pricePerLiter(), record.totalCost(), record.isFullTank() ? 1 : 0, record.notes(), id, userId);
        if (updated == 0) throw ApiException.notFound("Fuel record not found");
        return new FuelRecord(id, userId, record.vehicleId(), record.date(), record.mileage(), record.liters(), record.pricePerLiter(), record.totalCost(), record.isFullTank(), record.notes());
    }

    public void delete(Long id, Long userId) {
        int deleted = jdbcTemplate.update("DELETE FROM fuel_records WHERE id=? AND user_id=?", id, userId);
        if (deleted == 0) throw ApiException.notFound("Fuel record not found");
    }
}
