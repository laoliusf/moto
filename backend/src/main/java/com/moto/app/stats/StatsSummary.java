package com.moto.app.stats;

public record StatsSummary(
        double totalCost,
        double totalMileage,
        double averageConsumption,
        double averagePrice,
        double monthCost,
        double historicalAverageConsumption
) {}
