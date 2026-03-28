package com.moto.app.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class DatabaseMigrationRunner implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(DatabaseMigrationRunner.class);
    private static final Pattern CREATE_TABLE_PATTERN = Pattern.compile(
            "(?is)^CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\\s*\\((.*)\\)\\s*$"
    );
    private static final Pattern CREATE_INDEX_PATTERN = Pattern.compile(
            "(?is)^CREATE\\s+INDEX\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\\s+ON\\s+([a-zA-Z_][a-zA-Z0-9_]*)\\s*\\((.*)\\)\\s*$"
    );

    private final JdbcTemplate jdbcTemplate;

    public DatabaseMigrationRunner(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        SchemaDefinition schema = loadSchemaDefinition();

        for (TableDefinition table : schema.tables()) {
            if (!tableExists(table.name())) {
                jdbcTemplate.execute(table.createSql());
                log.info("Applied SQLite schema migration: created table {}", table.name());
                continue;
            }
            ensureMissingColumns(table);
        }

        for (IndexDefinition index : schema.indexes()) {
            if (indexExists(index.name())) {
                continue;
            }
            jdbcTemplate.execute(index.createSql());
            log.info("Applied SQLite schema migration: created index {}", index.name());
        }
    }

    private void ensureMissingColumns(TableDefinition table) {
        List<String> existingColumns = jdbcTemplate.query(
                "PRAGMA table_info(" + table.name() + ")",
                (rs, rowNum) -> rs.getString("name").toLowerCase(Locale.ROOT)
        );

        for (ColumnDefinition column : table.columns()) {
            if (existingColumns.contains(column.name().toLowerCase(Locale.ROOT))) {
                continue;
            }
            String alterSql = "ALTER TABLE " + table.name() + " ADD COLUMN " + column.definition();
            jdbcTemplate.execute(alterSql);
            log.info("Applied SQLite schema migration: added {}.{}", table.name(), column.name());
        }
    }

    private SchemaDefinition loadSchemaDefinition() throws IOException {
        String schemaSql = new String(
                new ClassPathResource("schema.sql").getInputStream().readAllBytes(),
                StandardCharsets.UTF_8
        );

        List<String> statements = splitStatements(schemaSql);
        List<TableDefinition> tables = new ArrayList<>();
        List<IndexDefinition> indexes = new ArrayList<>();

        for (String rawStatement : statements) {
            String statement = rawStatement.trim();
            if (statement.isBlank() || statement.toUpperCase(Locale.ROOT).startsWith("PRAGMA ")) {
                continue;
            }

            Matcher tableMatcher = CREATE_TABLE_PATTERN.matcher(statement);
            if (tableMatcher.matches()) {
                String tableName = tableMatcher.group(1);
                String body = tableMatcher.group(2);
                tables.add(new TableDefinition(tableName, statement, parseColumns(body)));
                continue;
            }

            Matcher indexMatcher = CREATE_INDEX_PATTERN.matcher(statement);
            if (indexMatcher.matches()) {
                indexes.add(new IndexDefinition(indexMatcher.group(1), statement));
            }
        }

        return new SchemaDefinition(tables, indexes);
    }

    private List<ColumnDefinition> parseColumns(String body) {
        List<ColumnDefinition> columns = new ArrayList<>();
        for (String part : splitTopLevel(body, ',')) {
            String definition = part.trim();
            if (definition.isBlank()) {
                continue;
            }
            String upper = definition.toUpperCase(Locale.ROOT);
            if (upper.startsWith("PRIMARY KEY")
                    || upper.startsWith("FOREIGN KEY")
                    || upper.startsWith("UNIQUE")
                    || upper.startsWith("CHECK")
                    || upper.startsWith("CONSTRAINT")) {
                continue;
            }

            String columnName = extractLeadingIdentifier(definition);
            if (columnName != null) {
                columns.add(new ColumnDefinition(columnName, definition));
            }
        }
        return columns;
    }

    private String extractLeadingIdentifier(String definition) {
        int end = 0;
        while (end < definition.length()) {
            char ch = definition.charAt(end);
            if (Character.isLetterOrDigit(ch) || ch == '_') {
                end++;
                continue;
            }
            break;
        }
        if (end == 0) {
            return null;
        }
        return definition.substring(0, end);
    }

    private List<String> splitStatements(String sql) {
        return splitTopLevel(sql, ';');
    }

    private List<String> splitTopLevel(String input, char separator) {
        List<String> parts = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        int depth = 0;
        boolean inSingleQuote = false;

        for (int i = 0; i < input.length(); i++) {
            char ch = input.charAt(i);

            if (ch == '\'' && (i == 0 || input.charAt(i - 1) != '\\')) {
                inSingleQuote = !inSingleQuote;
            }

            if (!inSingleQuote) {
                if (ch == '(') {
                    depth++;
                } else if (ch == ')' && depth > 0) {
                    depth--;
                } else if (ch == separator && depth == 0) {
                    parts.add(current.toString());
                    current.setLength(0);
                    continue;
                }
            }

            current.append(ch);
        }

        if (!current.isEmpty()) {
            parts.add(current.toString());
        }
        return parts;
    }

    private boolean tableExists(String tableName) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(1) FROM sqlite_master WHERE type = 'table' AND name = ?",
                Integer.class,
                tableName
        );
        return count != null && count > 0;
    }

    private boolean indexExists(String indexName) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(1) FROM sqlite_master WHERE type = 'index' AND name = ?",
                Integer.class,
                indexName
        );
        return count != null && count > 0;
    }

    private record SchemaDefinition(List<TableDefinition> tables, List<IndexDefinition> indexes) {}

    private record TableDefinition(String name, String createSql, List<ColumnDefinition> columns) {}

    private record ColumnDefinition(String name, String definition) {}

    private record IndexDefinition(String name, String createSql) {}
}
