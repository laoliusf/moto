package com.moto.app.maintenance;

import com.moto.app.auth.AuthUser;
import com.moto.app.common.ApiException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/maintenance")
public class MaintenanceController {
    private final MaintenanceRepository repository;

    public MaintenanceController(MaintenanceRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public List<MaintenanceRecord> list(@AuthenticationPrincipal AuthUser user,
                                        @RequestParam(name = "vehicleId", required = false) Long vehicleId) {
        return repository.list(user.id(), vehicleId);
    }

    @PostMapping
    public ResponseEntity<MaintenanceRecord> create(@AuthenticationPrincipal AuthUser user,
                                                    @Valid @RequestBody MaintenanceRequest request) {
        MaintenanceRecord created = repository.create(user.id(), request.toRecord(user.id()));
        return ResponseEntity.ok(created);
    }

    @PutMapping("/{id}")
    public MaintenanceRecord update(@AuthenticationPrincipal AuthUser user,
                                    @PathVariable Long id,
                                    @Valid @RequestBody MaintenanceRequest request) {
        repository.findById(id, user.id()).orElseThrow(() -> ApiException.notFound("Maintenance record not found"));
        return repository.update(id, user.id(), request.toRecord(user.id()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@AuthenticationPrincipal AuthUser user, @PathVariable Long id) {
        repository.findById(id, user.id()).orElseThrow(() -> ApiException.notFound("Maintenance record not found"));
        repository.delete(id, user.id());
        return ResponseEntity.noContent().build();
    }

    public record MaintenanceRequest(
            @NotBlank(message = "标题不能为空") String title,
            @Min(value = 0, message = "费用必须大于等于0") double cost,
            @Min(value = 0, message = "里程必须大于等于0") int mileage,
            @Min(value = 0, message = "下次保养里程必须大于等于0") int nextMaintenanceMileage,
            @NotBlank(message = "日期不能为空") String date,
            String notes,
            Long vehicleId
    ) {
        public MaintenanceRecord toRecord(Long userId) {
            return new MaintenanceRecord(
                    null,
                    userId,
                    vehicleId,
                    title,
                    cost,
                    mileage,
                    nextMaintenanceMileage,
                    date,
                    notes == null ? "" : notes
            );
        }
    }
}
