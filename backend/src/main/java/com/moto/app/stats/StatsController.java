package com.moto.app.stats;

import com.moto.app.auth.AuthUser;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/stats")
public class StatsController {
    private final StatsRepository repository;

    public StatsController(StatsRepository repository) {
        this.repository = repository;
    }

    @GetMapping("/summary")
    public StatsSummary summary(@AuthenticationPrincipal AuthUser user) {
        return repository.summary(user.id());
    }

    @GetMapping("/fuel-trend")
    public List<TrendPoint> trend(@AuthenticationPrincipal AuthUser user,
                                  @RequestParam(name = "limit", defaultValue = "20") int limit) {
        return repository.fuelTrend(user.id(), limit);
    }

    @GetMapping("/cost-breakdown")
    public CostBreakdown breakdown(@AuthenticationPrincipal AuthUser user) {
        return repository.breakdown(user.id());
    }
}
