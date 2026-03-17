package com.moto.app.fuel;

public record FuelRecord(Long id, Long userId, Long vehicleId, String date, int mileage,
                         double liters, double pricePerLiter, double totalCost, boolean isFullTank, String notes) {}
