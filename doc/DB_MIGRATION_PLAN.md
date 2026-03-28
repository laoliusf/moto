# 数据库升级方案

## 1. 目标

当前项目的数据库升级策略调整为：

- `schema.sql` 永远保存最新、完整、可新建的数据库结构
- 应用启动时自动读取 `schema.sql`
- 如果发现旧数据库已存在，就把“当前库结构”和“schema.sql 目标结构”做比对
- 自动执行缺失的建表、加列、建索引 SQL

第一阶段只处理三类变更：

- 缺表
- 缺列
- 缺索引

## 2. 为什么这样设计

因为你不希望以后每次改库结构时，还要手写一段 Java 迁移代码去补某个字段。

现在这套方案里：

- 改表结构时，主要维护一份 [schema.sql](E:\workspace\javaspace\moto\backend\src\main\resources\schema.sql)
- 应用自己根据 `schema.sql` 去识别旧库缺什么
- 自动补齐旧库到最新版本

这样“新库初始化”和“旧库升级”都围绕同一份 `schema.sql` 工作。

## 3. 当前实现

启动迁移入口：

- [DatabaseMigrationRunner.java](E:\workspace\javaspace\moto\backend\src\main\java\com\moto\app\config\DatabaseMigrationRunner.java)

工作流程：

1. 读取 `classpath:schema.sql`
2. 解析其中的 `CREATE TABLE` 和 `CREATE INDEX`
3. 查询当前 SQLite 的表、列、索引
4. 对比差异
5. 自动执行以下 SQL：
   - 缺表：执行整条 `CREATE TABLE`
   - 缺列：执行 `ALTER TABLE ... ADD COLUMN ...`
   - 缺索引：执行 `CREATE INDEX ...`

## 4. 当前适用范围

### 4.1 自动处理

当前会自动处理：

- 老库缺少整张表
- 老库已有表，但少了某些字段
- 老库已有表和字段，但缺了索引

### 4.2 暂不自动处理

当前第一阶段不处理：

- 字段类型变化
- 删除字段
- 字段重命名
- 主键/外键约束变化
- 复杂表重建

这些属于下一阶段能力。

## 5. 实际示例

这次你遇到的问题：

```text
no such column: 'next_maintenance_mileage'
```

在这套方案下，程序会自动发现：

- `schema.sql` 里有 `maintenance_records.next_maintenance_mileage`
- 旧库里没有这个字段

然后自动执行：

```sql
ALTER TABLE maintenance_records
ADD COLUMN next_maintenance_mileage INTEGER DEFAULT 0
```

用户不需要手工改库。

## 6. 日常开发规则

以后你改数据库结构时，第一阶段只需要遵守这条规则：

1. 修改 [schema.sql](E:\workspace\javaspace\moto\backend\src\main\resources\schema.sql)
2. 发布新版本
3. 启动后让程序自动升级旧库

也就是说：

- 新增表：只改 `schema.sql`
- 新增列：只改 `schema.sql`
- 新增索引：只改 `schema.sql`

不需要再额外手写某个字段的 Java 迁移逻辑。

## 7. 上线升级步骤

推荐流程：

1. 备份旧数据库文件
2. 停掉旧应用
3. 部署新版本
4. 用旧数据库文件启动新版本
5. 应用启动时自动完成升级
6. 检查日志与关键页面

## 8. 备份示例

Windows：

```powershell
Copy-Item D:\Docker\moto\moto.db D:\Docker\moto\moto.db.bak-20260328
```

Linux：

```bash
cp /data/moto.db /data/moto.db.bak-20260328
```

## 9. 第二阶段规划

等你确认第一阶段稳定后，第二阶段再扩展：

- 字段类型变更识别
- 安全类型转换自动执行
- 高风险类型变化阻断并提示人工确认
- 必要时自动重建表
