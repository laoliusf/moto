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
        Integer minMileage = jdbcTemplate.queryForObject("SELECT MIN(mileage) FROM fuel_records WHERE user_id=?", Integer.class, userId);
        Integer maxMileage = jdbcTemplate.queryForObject("SELECT MAX(mileage) FROM fuel_records WHERE user_id=?", Integer.class, userId);
        double totalMileage = (minMileage == null || maxMileage == null) ? 0 : (maxMileage - minMileage);
        Double totalLiters = jdbcTemplate.queryForObject("SELECT COALESCE(SUM(liters),0) FROM fuel_records WHERE user_id=?", Double.class, userId);
        double avgPrice = (totalFuel != null && totalLiters != null && totalLiters > 0)
                ? totalFuel / totalLiters
                : 0;
        double historicalAverageConsumption = (maxMileage != null && totalLiters != null && totalLiters > 0)
                ? maxMileage / totalLiters
                : 0;
        List<FuelStatSnapshot> firstAndLastRecords = jdbcTemplate.query(
                "SELECT mileage, liters FROM fuel_records WHERE user_id=? ORDER BY date ASC, id ASC LIMIT 1",
                (rs, rowNum) -> new FuelStatSnapshot(rs.getInt("mileage"), rs.getDouble("liters")),
                userId
        );
        List<FuelStatSnapshot> lastRecord = jdbcTemplate.query(
                "SELECT mileage, liters FROM fuel_records WHERE user_id=? ORDER BY date DESC, id DESC LIMIT 1",
                (rs, rowNum) -> new FuelStatSnapshot(rs.getInt("mileage"), rs.getDouble("liters")),
                userId
        );
        if (!firstAndLastRecords.isEmpty() && !lastRecord.isEmpty() && totalLiters != null) {
            FuelStatSnapshot first = firstAndLastRecords.get(0);
            FuelStatSnapshot last = lastRecord.get(0);
            int totalMileageDelta = last.mileage() - first.mileage();
            double adjustedTotalLiters = totalLiters - first.liters();
            if (totalMileageDelta > 0 && adjustedTotalLiters > 0) {
                historicalAverageConsumption = (adjustedTotalLiters / totalMileageDelta) * 100;
            } else {
                historicalAverageConsumption = 0;
            }
        } else {
            historicalAverageConsumption = 0;
        }
        List<FuelStatSnapshot> latestRecords = jdbcTemplate.query(
                "SELECT mileage, liters FROM fuel_records WHERE user_id=? ORDER BY date DESC, id DESC LIMIT 2",
                (rs, rowNum) -> new FuelStatSnapshot(rs.getInt("mileage"), rs.getDouble("liters")),
                userId
        );
        double avgConsumption = 0;
        if (latestRecords.size() >= 2) {
            FuelStatSnapshot latest = latestRecords.get(0);
            FuelStatSnapshot previous = latestRecords.get(1);
            int mileageDelta = latest.mileage() - previous.mileage();
            if (mileageDelta > 0) {
                avgConsumption = (latest.liters() / mileageDelta) * 100;
            }
        }
        String monthStart = LocalDate.now().withDayOfMonth(1).toString();
        Double monthFuel = jdbcTemplate.queryForObject("SELECT COALESCE(SUM(total_cost),0) FROM fuel_records WHERE user_id=? AND date >= ?", Double.class, userId, monthStart);
        Double monthMaint = jdbcTemplate.queryForObject("SELECT COALESCE(SUM(cost),0) FROM maintenance_records WHERE user_id=? AND date >= ?", Double.class, userId, monthStart);
        double monthCost = (monthFuel == null ? 0 : monthFuel) + (monthMaint == null ? 0 : monthMaint);
        return new StatsSummary(totalCost, totalMileage, avgConsumption, avgPrice, monthCost, historicalAverageConsumption);
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

    private record FuelStatSnapshot(int mileage, double liters) {}
}
