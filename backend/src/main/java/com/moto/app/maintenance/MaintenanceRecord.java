package com.moto.app.maintenance;

public record MaintenanceRecord(Long id, Long userId, Long vehicleId, String title, double cost, int mileage, String date, String notes) {}
