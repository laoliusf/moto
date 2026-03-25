package com.moto.app.vehicle;

public record Vehicle(Long id, Long userId, String name, String brand, String model, String displacement,
                      String purchaseDate, Integer currentMileage, String notes) {}
