# 数据库模式文档

## 概述

项目使用 **SQLite** 作为数据库，存储用户信息、加油记录、维护记录和车辆信息。

| 项目 | 值 |
|------|-----|
| **数据库类型** | SQLite 3 |
| **文件位置** | `./data.db` |
| **初始化** | 自动（首次运行时创建表） |
| **字符集** | UTF-8 |

---

## 表结构

### 1. users - 用户表

用户账户信息。

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT | 用户 ID，自增 |
| `username` | TEXT | UNIQUE NOT NULL | 用户名，唯一 |
| `password_hash` | TEXT | NOT NULL | 密码哈希值 (PBKDF2) |
| `created_at` | TEXT | DEFAULT CURRENT_TIMESTAMP | 创建时间 |

**密码哈希格式**: `{salt}${hash_hex}`
- salt: 16 字节十六进制字符串
- hash_hex: PBKDF2-HMAC-SHA256 输出的十六进制

**示例**:
```
a1b2c3d4e5f6g7h8|5e8a9f2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9
```

---

### 2. fuel_records - 加油记录表

每次加油的记录。

```sql
CREATE TABLE fuel_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    mileage INTEGER NOT NULL,
    liters REAL NOT NULL,
    price_per_liter REAL NOT NULL,
    total_cost REAL NOT NULL,
    is_full_tank INTEGER DEFAULT 1,
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_fuel_user_date ON fuel_records(user_id, date DESC);
```

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INTEGER | PRIMARY KEY | 记录 ID |
| `user_id` | INTEGER | NOT NULL, FK | 所有者用户 ID |
| `date` | TEXT | NOT NULL | 加油日期 (YYYY-MM-DD) |
| `mileage` | INTEGER | NOT NULL | 加油时的里程 (km) |
| `liters` | REAL | NOT NULL | 加油升数 |
| `price_per_liter` | REAL | NOT NULL | 单位油价 (元/升) |
| `total_cost` | REAL | NOT NULL | 总费用 (元) |
| `is_full_tank` | INTEGER | DEFAULT 1 | 是否满箱 (0/1) |
| `notes` | TEXT | DEFAULT '' | 备注信息 |
| `created_at` | TEXT | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| `updated_at` | TEXT | DEFAULT CURRENT_TIMESTAMP | 修改时间 |

**索引**: `(user_id, date DESC)` - 加快用户加油记录按日期倒序的查询

**示例记录**:
```
id: 1
user_id: 1
date: 2025-03-09
mileage: 5000
liters: 3.5
price_per_liter: 8.5
total_cost: 29.75
is_full_tank: 1
notes: "高速路段"
created_at: 2025-03-09 10:30:45
updated_at: 2025-03-09 10:30:45
```

---

### 3. maintenance_records - 维护记录表

摩托车维护保养记录。

```sql
CREATE TABLE maintenance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    mileage INTEGER NOT NULL,
    type TEXT NOT NULL,
    cost REAL DEFAULT 0,
    next_due_mileage INTEGER,
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_maint_user_date ON maintenance_records(user_id, date DESC);
```

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INTEGER | PRIMARY KEY | 记录 ID |
| `user_id` | INTEGER | NOT NULL, FK | 所有者用户 ID |
| `date` | TEXT | NOT NULL | 维护日期 (YYYY-MM-DD) |
| `mileage` | INTEGER | NOT NULL | 维护时的里程 (km) |
| `type` | TEXT | NOT NULL | 维护类型 (换油、链条等) |
| `cost` | REAL | DEFAULT 0 | 维护费用 (元) |
| `next_due_mileage` | INTEGER | - | 下次保养里程 (km，可为 null) |
| `notes` | TEXT | DEFAULT '' | 备注信息 |
| `created_at` | TEXT | DEFAULT CURRENT_TIMESTAMP | 创建时间 |

**索引**: `(user_id, date DESC)` - 加快用户维护记录查询

**常见 type 值**:
- 换油
- 链条保养
- 轮胎检查
- 火花塞更换
- 空气滤芯更换
- 制动液检查
- 定期检查

**示例记录**:
```
id: 1
user_id: 1
date: 2025-03-05
mileage: 4800
type: "换油"
cost: 50.0
next_due_mileage: 5800
notes: "使用 SAE 10W-40 矿物油"
created_at: 2025-03-05 14:20:10
```

---

### 4. vehicle_info - 车辆信息表

用户的车辆基本信息。

```sql
CREATE TABLE vehicle_info (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    name TEXT DEFAULT '豪爵UHR150',
    purchase_date TEXT,
    tank_capacity REAL DEFAULT 4.5,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INTEGER | PRIMARY KEY | 记录 ID |
| `user_id` | INTEGER | UNIQUE NOT NULL, FK | 用户 ID (一一对应) |
| `name` | TEXT | DEFAULT '豪爵UHR150' | 车型名称 |
| `purchase_date` | TEXT | - | 购车日期 (YYYY-MM-DD) |
| `tank_capacity` | REAL | DEFAULT 4.5 | 油箱容量 (升) |
| `updated_at` | TEXT | DEFAULT CURRENT_TIMESTAMP | 修改时间 |

**示例记录**:
```
id: 1
user_id: 1
name: "豪爵UHR150"
purchase_date: "2024-01-15"
tank_capacity: 4.5
updated_at: 2025-03-09 10:00:00
```

---

## 关系图

```
┌─────────────────┐
│     users       │
├─────────────────┤
│ id (PK)         │
│ username (UQ)   │
│ password_hash   │
│ created_at      │
└────────┬────────┘
         │ 1
         │
         │ N
    ┌────┴─────────────────────────────────────┐
    │                                           │
    ▼                                           ▼
┌──────────────────────┐  ┌────────────────────────────┐
│  fuel_records        │  │ maintenance_records        │
├──────────────────────┤  ├────────────────────────────┤
│ id (PK)              │  │ id (PK)                    │
│ user_id (FK)         │  │ user_id (FK)               │
│ date                 │  │ date                       │
│ mileage              │  │ mileage                    │
│ liters               │  │ type                       │
│ price_per_liter      │  │ cost                       │
│ total_cost           │  │ next_due_mileage           │
│ is_full_tank         │  │ notes                      │
│ notes                │  │ created_at                 │
│ created_at           │  │                            │
│ updated_at           │  │                            │
└──────────────────────┘  └────────────────────────────┘

    │                              │
    │                              │
    └────────────┬─────────────────┘
                 │
         ┌───────▼────────────┐
         │  vehicle_info      │
         ├────────────────────┤
         │ id (PK)            │
         │ user_id (FK, UQ)   │
         │ name               │
         │ purchase_date      │
         │ tank_capacity      │
         │ updated_at         │
         └────────────────────┘
```

---

## 数据流与约束

### 创建用户流程
1. 用户注册
   - 插入到 `users` 表
   - 自动为该用户创建默认 `vehicle_info` 记录

### 新增加油记录流程
1. 用户认证（检查 token）
2. 插入到 `fuel_records` 表，绑定 user_id
3. 同时更新 `updated_at` 字段

### 删除用户的影响
> **注意**: 当前实现未提供删除用户端点
> 如果要删除用户，需在数据库级别删除相关记录：
> - `DELETE FROM fuel_records WHERE user_id = ?`
> - `DELETE FROM maintenance_records WHERE user_id = ?`
> - `DELETE FROM vehicle_info WHERE user_id = ?`
> - `DELETE FROM users WHERE id = ?`

---

## 查询优化

### 常见查询

**获取用户的所有加油记录**
```sql
SELECT * FROM fuel_records
WHERE user_id = ?
ORDER BY date DESC, id DESC;
```
✅ 利用索引 `(user_id, date DESC)` 加速

**获取用户的最近加油记录**
```sql
SELECT * FROM fuel_records
WHERE user_id = ?
ORDER BY date DESC, id DESC
LIMIT 5;
```
✅ 同样利用索引

**获取用户的维护记录**
```sql
SELECT * FROM maintenance_records
WHERE user_id = ?
ORDER BY date DESC, id DESC;
```
✅ 利用索引 `(user_id, date DESC)` 加速

**查找下次保养的提醒**
```sql
SELECT * FROM maintenance_records
WHERE user_id = ? AND next_due_mileage IS NOT NULL
ORDER BY next_due_mileage ASC
LIMIT 1;
```
⚠️ 建议添加索引优化：`(user_id, next_due_mileage)`

---

## 备份与恢复

### 备份方法

**1. 文件复制 (最简单)**
```bash
cp data.db data.db.backup
```

**2. 导出为 SQL**
```bash
sqlite3 data.db ".dump" > backup.sql
```

**3. 导出为 JSON (通过应用)**
- 使用前端的 "导出为 JSON" 功能

### 恢复方法

**1. 从文件恢复**
```bash
cp data.db.backup data.db
```

**2. 从 SQL 恢复**
```bash
sqlite3 data.db < backup.sql
```

**3. 从 JSON 恢复**
- 使用前端的 "导入 JSON" 功能

---

## 性能考虑

### 索引效率

| 操作 | 复杂度 | 说明 |
|------|--------|------|
| 按 user_id + date 查询 | O(log n) | ✅ 有索引 |
| 按 user_id + next_due_mileage 查询 | O(n) | ⚠️ 无索引 |
| 删除记录 | O(log n) | ✅ 快 |
| 添加记录 | O(log n) | ✅ 快 |

### 预期容量

| 场景 | 预期记录数 | 性能 |
|------|-----------|------|
| 单辆车，1 年 | ~300-500 条 | ✅ 优秀 |
| 单用户，10 年 | ~3000-5000 条 | ✅ 良好 |
| 多用户场景 | 数万条 | ⚠️ 考虑迁移到 PostgreSQL |

---

## 数据类型说明

### TEXT (日期和时间)
```
格式: YYYY-MM-DD HH:MM:SS
示例: 2025-03-09 10:30:45
```
使用 SQLite 的 `CURRENT_TIMESTAMP` 自动生成

### REAL (浮点数)
```
存储精度: 15 位有效数字
示例:
  liters: 3.5
  price_per_liter: 8.499999
  total_cost: 29.75
```

### INTEGER (整数)
```
范围: -9223372036854775808 到 9223372036854775807
示例:
  mileage: 5000
  is_full_tank: 0 或 1
  next_due_mileage: 5800
```

---

## 常见操作

### 查看数据库统计

**查看表大小**
```sql
SELECT
    name as table_name,
    (SELECT COUNT(*) FROM {table}) as row_count
FROM sqlite_master
WHERE type='table';
```

**计算特定用户的统计**
```sql
SELECT
    user_id,
    COUNT(*) as fuel_count,
    SUM(total_cost) as total_spent,
    AVG(price_per_liter) as avg_price
FROM fuel_records
GROUP BY user_id;
```

**计算油耗**
```sql
SELECT
    f1.date,
    (f1.mileage - f2.mileage) as distance,
    SUM(f3.liters) as liters_used,
    ROUND(SUM(f3.liters) / (f1.mileage - f2.mileage) * 100, 2) as consumption_l_100km
FROM fuel_records f1
JOIN fuel_records f2 ON f1.user_id = f2.user_id
  AND f1.is_full_tank = 1 AND f2.is_full_tank = 1
  AND f1.id = (SELECT MAX(id) FROM fuel_records WHERE user_id = f1.user_id
              AND is_full_tank = 1 AND id < f1.id)
LEFT JOIN fuel_records f3 ON f3.user_id = f1.user_id
  AND f3.date > f2.date AND f3.date <= f1.date
GROUP BY f1.id;
```

---

## 数据验证规则

| 字段 | 验证规则 |
|------|---------|
| `username` | 3-20 字符，字母数字下划线 |
| `password` | 至少 6 字符 |
| `date` | 有效的日期格式 (YYYY-MM-DD) |
| `mileage` | 正整数，递增 |
| `liters` | 正数，通常 0.1 - 10 升 |
| `price_per_liter` | 正数，范围 5 - 20 元 |
| `total_cost` | 正数，= liters * price_per_liter |
| `tank_capacity` | 正数，范围 2 - 30 升 |

---

## 故障排查

### 数据库损坏

**症状**: 应用无法启动，日志显示 SQLite 错误

**解决方案**:
1. 停止应用
2. 备份 data.db
3. 运行 SQLite 修复：
   ```bash
   sqlite3 data.db "PRAGMA integrity_check;"
   ```
4. 如无法修复，从备份恢复

### 磁盘空间不足

**症状**: 写入操作失败，日志显示 "disk I/O error"

**解决方案**:
1. 清理无用文件
2. 考虑压缩数据库：
   ```bash
   sqlite3 data.db "VACUUM;"
   ```

### 并发写入冲突

**症状**: "database is locked" 错误

**说明**: SQLite 单线程，高并发场景建议迁移到 PostgreSQL

---

## 扩展建议

当数据增长时，考虑迁移到关系型数据库：

### 迁移到 PostgreSQL
```python
import psycopg2

conn = psycopg2.connect(
    host="localhost",
    database="motorcycle",
    user="admin",
    password="secret"
)
```

### 关键变更
- 日期类型改用 `DATE` 和 `TIMESTAMP`
- 使用 `SERIAL` 代替 `AUTOINCREMENT`
- 增加连接池支持
- 启用数据库级别的加密

