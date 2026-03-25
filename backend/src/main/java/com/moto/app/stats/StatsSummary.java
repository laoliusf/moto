package com.moto.app.stats;

public record StatsSummary(
        double totalCost,
        double totalFuelCost,
        double totalMaintenanceCost,
        double totalMileage,
        double averageConsumption,
        double averagePrice,
        double monthCost,
        double monthFuelCost,
        double monthMaintenanceCost,
        double historicalAverageConsumption
) {}
