# 数据库结构说明

## 1. 基本信息

- 数据库：SQLite
- 默认文件：`backend/moto.db`
- 初始化脚本：`backend/src/main/resources/schema.sql`

当前系统采用单文件数据库，适合轻量场景和个人部署。

## 2. 表结构

### 2.1 users

用于保存用户账号。

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

字段说明：

- `id`：主键
- `username`：登录名，唯一
- `password_hash`：密码哈希
- `created_at`：创建时间
- `updated_at`：更新时间

### 2.2 vehicles

用于保存车辆档案。

```sql
CREATE TABLE vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    brand TEXT DEFAULT '',
    model TEXT DEFAULT '',
    displacement TEXT DEFAULT '',
    purchase_date TEXT DEFAULT '',
    current_mileage INTEGER DEFAULT 0,
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
);
```

字段说明：

- `user_id`：所属用户
- `name`：车辆名称
- `brand`：品牌
- `model`：型号
- `displacement`：排量
- `purchase_date`：购入日期
- `current_mileage`：当前或初始基准里程
- `notes`：备注

### 2.3 fuel_records

用于保存加油记录。

```sql
CREATE TABLE fuel_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    vehicle_id INTEGER,
    date TEXT NOT NULL,
    mileage INTEGER NOT NULL,
    liters REAL NOT NULL,
    price_per_liter REAL NOT NULL,
    total_cost REAL NOT NULL,
    is_full_tank INTEGER DEFAULT 1,
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(vehicle_id) REFERENCES vehicles(id)
);
```

字段说明：

- `vehicle_id`：关联车辆
- `date`：加油日期
- `mileage`：加油时里程
- `liters`：升数
- `price_per_liter`：单价
- `total_cost`：总价
- `is_full_tank`：是否满油，0/1
- `notes`：备注

### 2.4 maintenance_records

用于保存保养记录。

```sql
CREATE TABLE maintenance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    vehicle_id INTEGER,
    title TEXT NOT NULL,
    cost REAL DEFAULT 0,
    mileage INTEGER DEFAULT 0,
    next_maintenance_mileage INTEGER DEFAULT 0,
    date TEXT NOT NULL,
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(vehicle_id) REFERENCES vehicles(id)
);
```

字段说明：

- `vehicle_id`：关联车辆
- `title`：保养项目标题
- `cost`：费用
- `mileage`：本次保养里程
- `next_maintenance_mileage`：下次保养里程
- `date`：保养日期
- `notes`：备注

## 3. 索引

当前脚本中核心索引包括：

```sql
CREATE INDEX idx_vehicles_user_id ON vehicles(user_id);
CREATE INDEX idx_fuel_user_id_date ON fuel_records(user_id, date DESC, id DESC);
CREATE INDEX idx_fuel_vehicle_id_date ON fuel_records(vehicle_id, date DESC, id DESC);
CREATE INDEX idx_maintenance_user_id_date ON maintenance_records(user_id, date DESC, id DESC);
CREATE INDEX idx_maintenance_vehicle_id_date ON maintenance_records(vehicle_id, date DESC, id DESC);
```

作用：

- 按用户查询车辆
- 按用户或车辆倒序查询加油记录
- 按用户或车辆倒序查询保养记录

## 4. 关系说明

逻辑关系如下：

- 一个 `user` 可以有多台 `vehicle`
- 一个 `user` 可以有多条 `fuel_record`
- 一个 `user` 可以有多条 `maintenance_record`
- 一台 `vehicle` 可以关联多条 `fuel_record`
- 一台 `vehicle` 可以关联多条 `maintenance_record`

## 5. 业务约束

### 5.1 删除车辆限制

后端删除车辆前会检查：

- 是否存在关联加油记录
- 是否存在关联保养记录

只要有关联记录，就不允许删除车辆。

### 5.2 默认车辆不入库

“默认车辆”这个状态目前不在数据库中，而是前端保存在浏览器本地存储里。

### 5.3 统计依赖记录质量

油耗和费用统计强依赖这些字段质量：

- `mileage`
- `liters`
- `total_cost`
- `next_maintenance_mileage`

如果历史数据异常，统计结果也会跟着偏移。

## 6. 迁移与运维注意事项

- 生产环境不要依赖镜像内置的 `moto.db`
- 迁移时优先直接复制 SQLite 文件
- 备份时建议先停写，再复制数据库文件

备份示例：

```powershell
Copy-Item backend\\moto.db D:\\backup\\moto-20260328.db
```
