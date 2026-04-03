package com.moto.app.fuel;

import com.moto.app.auth.AuthUser;
import com.moto.app.common.ApiException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/fuel")
public class FuelController {
    private final FuelRepository fuelRepository;
    private final FuelOcrService fuelOcrService;

    public FuelController(FuelRepository fuelRepository, FuelOcrService fuelOcrService) {
        this.fuelRepository = fuelRepository;
        this.fuelOcrService = fuelOcrService;
    }

    @GetMapping
    public List<FuelRecord> list(@AuthenticationPrincipal AuthUser user,
                                 @RequestParam(name = "vehicleId", required = false) Long vehicleId,
                                 @RequestParam(name = "from", required = false) String from,
                                 @RequestParam(name = "to", required = false) String to) {
        return fuelRepository.list(user.id(), vehicleId, from, to);
    }

    @PostMapping
    public ResponseEntity<FuelRecord> create(@AuthenticationPrincipal AuthUser user,
                                             @Valid @RequestBody FuelRequest request) {
        FuelRecord created = fuelRepository.create(user.id(), request.toRecord(user.id()));
        return ResponseEntity.ok(created);
    }

    @PostMapping("/ocr")
    public FuelOcrService.FuelOcrResult recognize(@AuthenticationPrincipal AuthUser user,
                                                  @Valid @RequestBody FuelOcrRequest request) {
        return fuelOcrService.recognize(request.imageBase64());
    }

    @PutMapping("/{id}")
    public FuelRecord update(@AuthenticationPrincipal AuthUser user,
                             @PathVariable Long id,
                             @Valid @RequestBody FuelRequest request) {
        fuelRepository.findById(id, user.id()).orElseThrow(() -> ApiException.notFound("Fuel record not found"));
        return fuelRepository.update(id, user.id(), request.toRecord(user.id()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@AuthenticationPrincipal AuthUser user, @PathVariable Long id) {
        fuelRepository.delete(id, user.id());
        return ResponseEntity.noContent().build();
    }

    public record FuelRequest(@NotBlank(message = "日期不能为空") String date,
                              @Min(value = 0, message = "里程必须大于等于 0") int mileage,
                              double liters,
                              double pricePerLiter,
                              double totalCost,
                              boolean isFullTank,
                              String notes,
                              Long vehicleId) {
        public FuelRecord toRecord(Long userId) {
            return new FuelRecord(null, userId, vehicleId, date, mileage, liters, pricePerLiter, totalCost, isFullTank, notes == null ? "" : notes);
        }
    }

    public record FuelOcrRequest(@NotBlank(message = "图片内容不能为空") String imageBase64) {
    }
}
