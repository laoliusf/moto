package com.moto.app.maintenance;

public record MaintenanceRecord(
        Long id,
        Long userId,
        Long vehicleId,
        String title,
        double cost,
        int mileage,
        int nextMaintenanceMileage,
        String date,
        String notes
) {}
