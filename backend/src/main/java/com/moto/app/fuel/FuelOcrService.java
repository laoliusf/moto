package com.moto.app.fuel;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.moto.app.common.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class FuelOcrService {
    private static final Pattern NUMERIC_PATTERN = Pattern.compile("\\d+(?:\\.\\d+)?");
    private static final double MAX_ALLOWED_ERROR = 0.25d;

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String ocrBaseUrl;

    public FuelOcrService(ObjectMapper objectMapper,
                          @Value("${app.ocr.base-url:http://127.0.0.1:1224}") String ocrBaseUrl) {
        this.objectMapper = objectMapper;
        this.ocrBaseUrl = ocrBaseUrl.replaceAll("/+$", "");
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(8))
                .build();
    }

    public FuelOcrResult recognize(String imageBase64) {
        String sanitizedBase64 = sanitizeBase64(imageBase64);
        JsonNode root = callUmiOcr(sanitizedBase64);
        JsonNode dataNode = root.path("data");
        if (!dataNode.isArray() || dataNode.isEmpty()) {
            throw ApiException.badRequest("未识别到油机屏幕内容，请更换清晰图片后再试");
        }

        List<OcrBlock> blocks = parseBlocks(dataNode);
        String rawText = blocks.stream()
                .map(OcrBlock::text)
                .filter(text -> !text.isBlank())
                .reduce((left, right) -> left + "\n" + right)
                .orElse("");

        Extraction extraction = extractValues(blocks);
        if (extraction.liters() == null && extraction.totalCost() == null && extraction.pricePerLiter() == null) {
            throw ApiException.badRequest("OCR 已返回结果，但未能提取升数、总价和单价");
        }
        return new FuelOcrResult(
                extraction.liters(),
                extraction.pricePerLiter(),
                extraction.totalCost(),
                rawText,
                extraction.warnings()
        );
    }

    private JsonNode callUmiOcr(String imageBase64) {
        try {
            String body = objectMapper.writeValueAsString(new UmiOcrRequest(
                    imageBase64,
                    new UmiOcrOptions(
                            "models/config_chinese.txt",
                            false,
                            960,
                            "single_line",
                            "dict"
                    )
            ));
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(ocrBaseUrl + "/api/ocr"))
                    .timeout(Duration.ofSeconds(30))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw ApiException.badRequest("本地 OCR 服务不可用，请确认 Umi-OCR 已启动");
            }
            JsonNode root = objectMapper.readTree(response.body());
            if (root.path("code").asInt() != 100) {
                String error = root.path("data").asText(root.path("message").asText("图片识别失败"));
                throw ApiException.badRequest(error);
            }
            return root;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw ApiException.badRequest("调用本地 OCR 服务失败: " + ex.getMessage());
        } catch (IOException ex) {
            throw ApiException.badRequest("调用本地 OCR 服务失败: " + ex.getMessage());
        }
    }

    private String sanitizeBase64(String imageBase64) {
        if (imageBase64 == null || imageBase64.isBlank()) {
            throw ApiException.badRequest("图片内容不能为空");
        }
        String sanitized = imageBase64.trim();
        if (sanitized.startsWith("data:")) {
            int commaIndex = sanitized.indexOf(',');
            if (commaIndex < 0) {
                throw ApiException.badRequest("图片格式不正确");
            }
            sanitized = sanitized.substring(commaIndex + 1);
        }
        try {
            Base64.getDecoder().decode(sanitized);
        } catch (IllegalArgumentException ex) {
            throw ApiException.badRequest("图片数据无法解析");
        }
        return sanitized;
    }

    private List<OcrBlock> parseBlocks(JsonNode dataNode) {
        List<OcrBlock> blocks = new ArrayList<>();
        for (int index = 0; index < dataNode.size(); index += 1) {
            JsonNode item = dataNode.get(index);
            String text = item.path("text").asText("");
            JsonNode box = item.path("box");
            if (!box.isArray() || box.isEmpty()) {
                continue;
            }
            double minX = Double.MAX_VALUE;
            double maxX = Double.MIN_VALUE;
            double minY = Double.MAX_VALUE;
            double maxY = Double.MIN_VALUE;
            for (JsonNode point : box) {
                if (!point.isArray() || point.size() < 2) continue;
                double x = point.get(0).asDouble();
                double y = point.get(1).asDouble();
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
            }
            if (minX == Double.MAX_VALUE || minY == Double.MAX_VALUE) {
                continue;
            }
            blocks.add(new OcrBlock(index, text, normalizeText(text), minX, maxX, minY, maxY));
        }
        return blocks;
    }

    private Extraction extractValues(List<OcrBlock> blocks) {
        List<String> warnings = new ArrayList<>();
        List<OcrBlock> numericBlocks = blocks.stream()
                .filter(block -> !extractDigits(block.text()).isBlank())
                .toList();
        Set<Integer> usedIds = new LinkedHashSet<>();

        OcrBlock amountBlock = selectBestNumericBlock(findLabelBlocks(blocks, LabelType.AMOUNT), numericBlocks, usedIds);
        if (amountBlock != null) usedIds.add(amountBlock.id());
        OcrBlock litersBlock = selectBestNumericBlock(findLabelBlocks(blocks, LabelType.LITERS), numericBlocks, usedIds);
        if (litersBlock != null) usedIds.add(litersBlock.id());
        OcrBlock priceBlock = selectBestNumericBlock(findLabelBlocks(blocks, LabelType.PRICE), numericBlocks, usedIds);

        List<ValueCandidate> amountCandidates = buildCandidates(amountBlock, ValueType.TOTAL_COST);
        List<ValueCandidate> litersCandidates = buildCandidates(litersBlock, ValueType.LITERS);
        List<ValueCandidate> priceCandidates = buildCandidates(priceBlock, ValueType.PRICE_PER_LITER);

        List<ValueCandidate> resolvedAmountCandidates = amountCandidates.isEmpty() ? new ArrayList<>(List.of()) : amountCandidates;
        List<ValueCandidate> resolvedLiterCandidates = litersCandidates.isEmpty() ? new ArrayList<>(List.of()) : litersCandidates;
        List<ValueCandidate> resolvedPriceCandidates = priceCandidates.isEmpty() ? new ArrayList<>(List.of()) : priceCandidates;
        if (resolvedAmountCandidates.isEmpty()) resolvedAmountCandidates.add(null);
        if (resolvedLiterCandidates.isEmpty()) resolvedLiterCandidates.add(null);
        if (resolvedPriceCandidates.isEmpty()) resolvedPriceCandidates.add(null);

        BestMatch best = null;
        for (ValueCandidate amountCandidate : resolvedAmountCandidates) {
            for (ValueCandidate litersCandidate : resolvedLiterCandidates) {
                for (ValueCandidate priceCandidate : resolvedPriceCandidates) {
                    BestMatch current = scoreCombination(amountCandidate, litersCandidate, priceCandidate);
                    if (current == null) continue;
                    if (best == null || current.score() < best.score()) {
                        best = current;
                    }
                }
            }
        }

        if (best == null) {
            return new Extraction(null, null, null, List.of("当前图片未形成完整数值组合，请手动补充"));
        }

        if (best.inferredTotalCost()) {
            warnings.add("总价未稳定识别，已按 升数 × 单价 自动回填");
        }
        if (best.inferredLiters()) {
            warnings.add("升数未稳定识别，已按 总价 ÷ 单价 自动回填");
        }
        if (best.inferredPrice()) {
            warnings.add("单价未稳定识别，已按 总价 ÷ 升数 自动回填");
        }
        if (best.decimalAdjustedTotalCost()) {
            warnings.add("总价已按油量和单价关系自动修正小数点");
        }
        if (best.decimalAdjustedLiters()) {
            warnings.add("升数已按油量和单价关系自动修正小数点");
        }
        if (best.decimalAdjustedPrice()) {
            warnings.add("单价已按油量和单价关系自动修正小数点");
        }
        if (best.error() > MAX_ALLOWED_ERROR) {
            warnings.add("识别结果误差偏大，请保存前再核对一次");
        }
        return new Extraction(best.liters(), best.totalCost(), best.pricePerLiter(), warnings);
    }

    private List<OcrBlock> findLabelBlocks(List<OcrBlock> blocks, LabelType type) {
        return blocks.stream()
                .filter(block -> switch (type) {
                    case AMOUNT -> isAmountLabel(block.normalized());
                    case LITERS -> isLitersLabel(block.normalized());
                    case PRICE -> isPriceLabel(block.normalized());
                })
                .toList();
    }

    private OcrBlock selectBestNumericBlock(List<OcrBlock> labels, List<OcrBlock> numericBlocks, Set<Integer> usedIds) {
        OcrBlock bestBlock = null;
        double bestScore = Double.MAX_VALUE;
        for (OcrBlock label : labels) {
            for (OcrBlock numeric : numericBlocks) {
                if (usedIds.contains(numeric.id())) continue;
                double score = relationScore(label, numeric);
                if (score < bestScore) {
                    bestScore = score;
                    bestBlock = numeric;
                }
            }
        }
        return bestBlock;
    }

    private double relationScore(OcrBlock label, OcrBlock numeric) {
        double verticalDiff = Math.abs(numeric.centerY() - label.centerY());
        double horizontalGap;
        if (numeric.left() > label.right()) {
            horizontalGap = numeric.left() - label.right();
        } else if (label.left() > numeric.right()) {
            horizontalGap = label.left() - numeric.right();
        } else {
            horizontalGap = Math.abs(numeric.centerX() - label.centerX()) * 0.5d;
        }
        double score = verticalDiff * 3.5d + horizontalGap;
        if (verticalDiff > 180d) score += 600d;
        return score;
    }

    private List<ValueCandidate> buildCandidates(OcrBlock block, ValueType type) {
        if (block == null) return List.of();
        String digits = extractDigits(block.text());
        if (digits.isBlank()) return List.of();

        LinkedHashSet<ValueCandidate> candidates = new LinkedHashSet<>();
        if (digits.contains(".")) {
            Double value = tryParseDouble(cleanDotNoise(digits));
            if (value != null && value > 0) {
                candidates.add(new ValueCandidate(round(value), false, block.text()));
            }
            return new ArrayList<>(candidates);
        }

        Double base = tryParseDouble(digits);
        if (base == null || base <= 0) return List.of();

        candidates.add(new ValueCandidate(round(base), false, block.text()));
        int maxShift = switch (type) {
            case PRICE_PER_LITER -> 2;
            case LITERS, TOTAL_COST -> 3;
        };
        for (int shift = 1; shift <= maxShift; shift += 1) {
            candidates.add(new ValueCandidate(round(base / Math.pow(10, shift)), true, block.text()));
        }
        return new ArrayList<>(candidates);
    }

    private BestMatch scoreCombination(ValueCandidate amountCandidate,
                                       ValueCandidate litersCandidate,
                                       ValueCandidate priceCandidate) {
        Double amount = amountCandidate == null ? null : amountCandidate.value();
        Double liters = litersCandidate == null ? null : litersCandidate.value();
        Double price = priceCandidate == null ? null : priceCandidate.value();

        boolean inferredTotalCost = false;
        boolean inferredLiters = false;
        boolean inferredPrice = false;

        int knownCount = (amount != null ? 1 : 0) + (liters != null ? 1 : 0) + (price != null ? 1 : 0);
        if (knownCount < 2) {
            return null;
        }

        if (amount == null && liters != null && price != null) {
            amount = round(liters * price);
            inferredTotalCost = true;
        }
        if (liters == null && amount != null && price != null && price > 0) {
            liters = round(amount / price);
            inferredLiters = true;
        }
        if (price == null && amount != null && liters != null && liters > 0) {
            price = round(amount / liters);
            inferredPrice = true;
        }
        if (amount == null || liters == null || price == null || liters <= 0 || price <= 0 || amount <= 0) {
            return null;
        }

        double error = Math.abs(amount - (liters * price));
        double score = error * 100d;
        score += plausibilityPenalty(ValueType.TOTAL_COST, amount);
        score += plausibilityPenalty(ValueType.LITERS, liters);
        score += plausibilityPenalty(ValueType.PRICE_PER_LITER, price);
        if (inferredTotalCost) score += 8d;
        if (inferredLiters) score += 8d;
        if (inferredPrice) score += 8d;

        return new BestMatch(
                round(liters),
                round(amount),
                round(price),
                round(error),
                score,
                inferredTotalCost,
                inferredLiters,
                inferredPrice,
                amountCandidate != null && amountCandidate.decimalAdjusted(),
                litersCandidate != null && litersCandidate.decimalAdjusted(),
                priceCandidate != null && priceCandidate.decimalAdjusted()
        );
    }

    private double plausibilityPenalty(ValueType type, double value) {
        return switch (type) {
            case PRICE_PER_LITER -> value < 1d || value > 20d ? 120d : 0d;
            case LITERS -> value < 0.5d || value > 150d ? 120d : 0d;
            case TOTAL_COST -> value < 1d || value > 10000d ? 120d : 0d;
        };
    }

    private boolean isAmountLabel(String normalized) {
        return normalized.contains("金额") || Objects.equals(normalized, "金") || Objects.equals(normalized, "额");
    }

    private boolean isLitersLabel(String normalized) {
        return normalized.contains("油量") || Objects.equals(normalized, "升");
    }

    private boolean isPriceLabel(String normalized) {
        return normalized.contains("单价");
    }

    private String normalizeText(String text) {
        return Optional.ofNullable(text)
                .orElse("")
                .replaceAll("[\\s（）()【】\\[\\]：:·/\\\\.,，。；;‘’“”\"'-]", "")
                .toLowerCase(Locale.ROOT);
    }

    private String extractDigits(String text) {
        Matcher matcher = NUMERIC_PATTERN.matcher(Optional.ofNullable(text).orElse(""));
        if (!matcher.find()) return "";
        return matcher.group();
    }

    private String cleanDotNoise(String digits) {
        int firstDot = digits.indexOf('.');
        if (firstDot < 0) return digits;
        StringBuilder builder = new StringBuilder();
        for (int index = 0; index < digits.length(); index += 1) {
            char ch = digits.charAt(index);
            if (Character.isDigit(ch) || (ch == '.' && index == firstDot)) {
                builder.append(ch);
            }
        }
        return builder.toString();
    }

    private Double tryParseDouble(String value) {
        try {
            return Double.parseDouble(value);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private double round(double value) {
        return Math.round(value * 100d) / 100d;
    }

    private record UmiOcrRequest(String base64, UmiOcrOptions options) {
    }

    private record UmiOcrOptions(@JsonProperty("ocr.language") String ocrLanguage,
                                 @JsonProperty("ocr.cls") boolean ocrCls,
                                 @JsonProperty("ocr.limit_side_len") int ocrLimitSideLen,
                                 @JsonProperty("tbpu.parser") String tbpuParser,
                                 @JsonProperty("data.format") String dataFormat) {
    }

    private record OcrBlock(int id,
                            String text,
                            String normalized,
                            double left,
                            double right,
                            double top,
                            double bottom) {
        double centerX() {
            return (left + right) / 2d;
        }

        double centerY() {
            return (top + bottom) / 2d;
        }
    }

    private record ValueCandidate(double value, boolean decimalAdjusted, String sourceText) {
    }

    private record Extraction(Double liters, Double totalCost, Double pricePerLiter, List<String> warnings) {
    }

    private record BestMatch(Double liters,
                             Double totalCost,
                             Double pricePerLiter,
                             double error,
                             double score,
                             boolean inferredTotalCost,
                             boolean inferredLiters,
                             boolean inferredPrice,
                             boolean decimalAdjustedTotalCost,
                             boolean decimalAdjustedLiters,
                             boolean decimalAdjustedPrice) {
    }

    private enum LabelType {
        AMOUNT,
        LITERS,
        PRICE
    }

    private enum ValueType {
        TOTAL_COST,
        LITERS,
        PRICE_PER_LITER
    }

    public record FuelOcrResult(Double liters,
                                Double pricePerLiter,
                                Double totalCost,
                                String rawText,
                                List<String> warnings) {
    }
}
