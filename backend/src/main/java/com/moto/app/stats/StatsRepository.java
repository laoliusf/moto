package com.moto.app.stats;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public class StatsRepository {
    private final JdbcTemplate jdbcTemplate;

    public StatsRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public StatsSummary summary(Long userId) {
        Double totalFuel = jdbcTemplate.queryForObject("SELECT COALESCE(SUM(total_cost),0) FROM fuel_records WHERE user_id=?", Double.class, userId);
        Double totalMaintenance = jdbcTemplate.queryForObject("SELECT COALESCE(SUM(cost),0) FROM maintenance_records WHERE user_id=?", Double.class, userId);
        Double totalCost = (totalFuel == null ? 0 : totalFuel) + (totalMaintenance == null ? 0 : totalMaintenance);
        Double avgPrice = jdbcTemplate.queryForObject("SELECT COALESCE(AVG(price_per_liter),0) FROM fuel_records WHERE user_id=?", Double.class, userId);
        Integer minMileage = jdbcTemplate.queryForObject("SELECT MIN(mileage) FROM fuel_records WHERE user_id=?", Integer.class, userId);
        Integer maxMileage = jdbcTemplate.queryForObject("SELECT MAX(mileage) FROM fuel_records WHERE user_id=?", Integer.class, userId);
        double totalMileage = (minMileage == null || maxMileage == null) ? 0 : (maxMileage - minMileage);
        Double totalLiters = jdbcTemplate.queryForObject("SELECT COALESCE(SUM(liters),0) FROM fuel_records WHERE user_id=? AND is_full_tank=1", Double.class, userId);
        double avgConsumption = (totalMileage > 0 && totalLiters != null && totalLiters > 0) ? (totalLiters / totalMileage) * 100 : 0;
        String monthStart = LocalDate.now().withDayOfMonth(1).toString();
        Double monthFuel = jdbcTemplate.queryForObject("SELECT COALESCE(SUM(total_cost),0) FROM fuel_records WHERE user_id=? AND date >= ?", Double.class, userId, monthStart);
        Double monthMaint = jdbcTemplate.queryForObject("SELECT COALESCE(SUM(cost),0) FROM maintenance_records WHERE user_id=? AND date >= ?", Double.class, userId, monthStart);
        double monthCost = (monthFuel == null ? 0 : monthFuel) + (monthMaint == null ? 0 : monthMaint);
        return new StatsSummary(totalCost, totalMileage, avgConsumption, avgPrice == null ? 0 : avgPrice, monthCost);
    }

    public List<TrendPoint> fuelTrend(Long userId, int limit) {
        return jdbcTemplate.query("SELECT date, liters, total_cost FROM fuel_records WHERE user_id=? ORDER BY date DESC, id DESC LIMIT ?",
                (rs, rowNum) -> new TrendPoint(rs.getString("date"), rs.getDouble("liters"), rs.getDouble("total_cost")), userId, limit);
    }

    public CostBreakdown breakdown(Long userId) {
        Double fuel = jdbcTemplate.queryForObject("SELECT COALESCE(SUM(total_cost),0) FROM fuel_records WHERE user_id=?", Double.class, userId);
        Double m = jdbcTemplate.queryForObject("SELECT COALESCE(SUM(cost),0) FROM maintenance_records WHERE user_id=?", Double.class, userId);
        return new CostBreakdown(fuel == null ? 0 : fuel, m == null ? 0 : m);
    }
}
