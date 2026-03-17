package com.moto.app.vehicle;

import com.moto.app.auth.AuthUser;
import com.moto.app.common.ApiException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/vehicle")
public class VehicleController {
    private final VehicleRepository repository;

    public VehicleController(VehicleRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public List<Vehicle> list(@AuthenticationPrincipal AuthUser user) {
        return repository.list(user.id());
    }

    @PostMapping
    public ResponseEntity<Vehicle> create(@AuthenticationPrincipal AuthUser user,
                                          @Valid @RequestBody VehicleRequest request) {
        Vehicle created = repository.create(user.id(), request.toVehicle(user.id()));
        return ResponseEntity.ok(created);
    }

    @PutMapping("/{id}")
    public Vehicle update(@AuthenticationPrincipal AuthUser user,
                          @PathVariable Long id,
                          @Valid @RequestBody VehicleRequest request) {
        repository.findById(id, user.id()).orElseThrow(() -> ApiException.notFound("Vehicle not found"));
        return repository.update(id, user.id(), request.toVehicle(user.id()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@AuthenticationPrincipal AuthUser user, @PathVariable Long id) {
        repository.findById(id, user.id()).orElseThrow(() -> ApiException.notFound("Vehicle not found"));
        if (repository.hasFuelRecords(id, user.id()) || repository.hasMaintenanceRecords(id, user.id())) {
            throw ApiException.conflict("Vehicle has related records; cannot delete");
        }
        repository.delete(id, user.id());
        return ResponseEntity.noContent().build();
    }

    public record VehicleRequest(
            @NotBlank(message = "名称不能为空") String name,
            String brand,
            String model,
            String displacement,
            String purchaseDate,
            Integer currentMileage,
            String notes
    ) {
        public Vehicle toVehicle(Long userId) {
            return new Vehicle(null, userId, name, emptyIfNull(brand), emptyIfNull(model), emptyIfNull(displacement), emptyIfNull(purchaseDate), currentMileage == null ? 0 : currentMileage, emptyIfNull(notes));
        }

        private String emptyIfNull(String v) {
            return v == null ? "" : v;
        }
    }
}
