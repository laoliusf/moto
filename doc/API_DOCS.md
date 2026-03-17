# API 文档

## 基本信息

| 项目 | 值 |
|------|-----|
| **基础 URL** | `http://localhost:12813` |
| **版本** | v1 |
| **认证方式** | Bearer Token (Authorization Header) |
| **响应格式** | JSON |

---

## 认证

### 认证方式

所有需要认证的请求必须在 HTTP 头中包含 `Authorization` 字段：

```
Authorization: Bearer {token}
```

### Token 获取

通过注册或登录端点获得 token。

### Token 有效期

- **有效期**: 30 天
- **过期后**: 需重新登录获取新 token

---

## 端点 (Endpoints)

### 1. 认证端点

#### 1.1 用户注册

```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "string",  // 3-20 个字符，字母数字下划线
  "password": "string"   // 至少 6 个字符
}
```

**成功响应 (200)**
```json
{
  "token": "12345|1234567890|abc123|signature...",
  "user": {
    "id": 1,
    "username": "john_doe"
  }
}
```

**错误响应**
```json
// 400 - 用户名或密码为空
{ "error": "用户名和密码不能为空" }

// 400 - 用户已存在
{ "error": "用户已存在" }

// 500 - 服务器错误
{ "error": "注册失败" }
```

---

#### 1.2 用户登录

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "string",
  "password": "string"
}
```

**成功响应 (200)**
```json
{
  "token": "12345|1234567890|abc123|signature...",
  "user": {
    "id": 1,
    "username": "john_doe"
  }
}
```

**错误响应**
```json
// 400 - 用户名或密码为空
{ "error": "用户名和密码不能为空" }

// 401 - 认证失败
{ "error": "用户名或密码错误" }
```

---

#### 1.3 获取当前用户

```http
GET /api/auth/me
Authorization: Bearer {token}
```

**成功响应 (200)**
```json
{
  "user": {
    "id": 1,
    "username": "john_doe"
  }
}
```

**错误响应**
```json
// 401 - 未认证或 token 过期
{ "error": "未授权" }

// 404 - 用户不存在 (token 失效)
{ "error": "用户不存在" }
```

---

### 2. 加油记录端点

#### 2.1 获取所有加油记录

```http
GET /api/fuel
Authorization: Bearer {token}
```

**成功响应 (200)**
```json
[
  {
    "id": 1,
    "date": "2025-03-09",
    "mileage": 5000,
    "liters": 3.5,
    "pricePerLiter": 8.5,
    "totalCost": 29.75,
    "isFullTank": true,
    "notes": "高速路段"
  },
  {
    "id": 2,
    "date": "2025-03-08",
    "mileage": 4800,
    "liters": 2.8,
    "pricePerLiter": 8.45,
    "totalCost": 23.66,
    "isFullTank": false,
    "notes": ""
  }
]
```

**错误响应**
```json
// 401 - 未认证
{ "error": "未授权" }
```

**返回记录按日期倒序排列，最新的记录在最前。**

---

#### 2.2 新增加油记录

```http
POST /api/fuel
Authorization: Bearer {token}
Content-Type: application/json

{
  "date": "2025-03-09",           // ISO 8601 日期格式
  "mileage": 5000,                // 整数，单位 km
  "liters": 3.5,                  // 浮点数，单位升
  "pricePerLiter": 8.5,           // 浮点数，单位元
  "totalCost": 29.75,             // 浮点数，liters * pricePerLiter
  "isFullTank": true,             // 布尔值，是否满箱
  "notes": "高速路段"              // 可选，备注信息
}
```

**成功响应 (201)**
```json
{
  "id": 3
}
```

**错误响应**
```json
// 400 - 请求体无效
{ "error": "请求体无效" }

// 400 - 缺少必需字段
{ "error": "添加失败" }

// 401 - 未认证
{ "error": "未授权" }
```

---

#### 2.3 更新加油记录

```http
PUT /api/fuel/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "date": "2025-03-09",
  "mileage": 5000,
  "liters": 3.5,
  "pricePerLiter": 8.5,
  "totalCost": 29.75,
  "isFullTank": true,
  "notes": "高速路段"
}
```

**路径参数**
| 参数 | 类型 | 说明 |
|------|------|------|
| id | 整数 | 加油记录 ID |

**成功响应 (200)**
```json
{
  "success": true
}
```

**错误响应**
```json
// 400 - 无效的 ID
{ "error": "无效的 ID" }

// 401 - 未认证
{ "error": "未授权" }

// 403 - 无权限（不是所有者）
{ "error": "无权限" }

// 400 - 更新失败
{ "error": "更新失败" }
```

---

#### 2.4 删除加油记录

```http
DELETE /api/fuel/{id}
Authorization: Bearer {token}
```

**路径参数**
| 参数 | 类型 | 说明 |
|------|------|------|
| id | 整数 | 加油记录 ID |

**成功响应 (200)**
```json
{
  "success": true
}
```

**错误响应**
```json
// 400 - 无效的 ID
{ "error": "无效的 ID" }

// 401 - 未认证
{ "error": "未授权" }

// 403 - 无权限（不是所有者）
{ "error": "无权限" }

// 400 - 删除失败
{ "error": "删除失败" }
```

---

### 3. 维护记录端点

#### 3.1 获取所有维护记录

```http
GET /api/maintenance
Authorization: Bearer {token}
```

**成功响应 (200)**
```json
[
  {
    "id": 1,
    "date": "2025-03-05",
    "mileage": 4800,
    "type": "换油",
    "cost": 50.0,
    "nextDueMileage": 5800,
    "notes": "使用 SAE 10W-40"
  },
  {
    "id": 2,
    "date": "2025-02-15",
    "mileage": 4000,
    "type": "链条保养",
    "cost": 30.0,
    "nextDueMileage": null,
    "notes": ""
  }
]
```

**错误响应**
```json
// 401 - 未认证
{ "error": "未授权" }
```

---

#### 3.2 新增维护记录

```http
POST /api/maintenance
Authorization: Bearer {token}
Content-Type: application/json

{
  "date": "2025-03-05",           // ISO 8601 日期格式
  "mileage": 4800,                // 整数，单位 km
  "type": "换油",                  // 字符串，维护类型
  "cost": 50.0,                   // 浮点数，维护费用
  "nextDueMileage": 5800,         // 整数或 null，下次保养里程
  "notes": "使用 SAE 10W-40"      // 可选，备注信息
}
```

**成功响应 (201)**
```json
{
  "id": 3
}
```

**错误响应**
```json
// 400 - 请求体无效
{ "error": "请求体无效" }

// 400 - 缺少必需字段
{ "error": "添加失败" }

// 401 - 未认证
{ "error": "未授权" }
```

---

#### 3.3 删除维护记录

```http
DELETE /api/maintenance/{id}
Authorization: Bearer {token}
```

**路径参数**
| 参数 | 类型 | 说明 |
|------|------|------|
| id | 整数 | 维护记录 ID |

**成功响应 (200)**
```json
{
  "success": true
}
```

**错误响应**
```json
// 400 - 无效的 ID
{ "error": "无效的 ID" }

// 401 - 未认证
{ "error": "未授权" }

// 403 - 无权限（不是所有者）
{ "error": "无权限" }

// 400 - 删除失败
{ "error": "删除失败" }
```

---

### 4. 车辆信息端点

#### 4.1 获取车辆信息

```http
GET /api/vehicle
Authorization: Bearer {token}
```

**成功响应 (200)**
```json
{
  "id": 1,
  "name": "豪爵UHR150",
  "purchaseDate": "2024-01-15",
  "tankCapacity": 4.5
}
```

**错误响应**
```json
// 401 - 未认证
{ "error": "未授权" }

// 404 - 车辆信息不存在
{ "error": "车辆信息不存在" }
```

---

#### 4.2 更新车辆信息

```http
PUT /api/vehicle
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "豪爵UHR150",           // 车型名称
  "purchaseDate": "2024-01-15",  // 购买日期
  "tankCapacity": 4.5             // 油箱容量（升）
}
```

**成功响应 (200)**
```json
{
  "success": true
}
```

**错误响应**
```json
// 400 - 请求体无效
{ "error": "请求体无效" }

// 401 - 未认证
{ "error": "未授权" }

// 400 - 更新失败
{ "error": "更新失败" }
```

**说明**: 如果车辆信息不存在，会自动创建。

---

## 错误处理

### HTTP 状态码

| 状态码 | 说明 | 场景 |
|--------|------|------|
| 200 | OK | 请求成功 |
| 201 | Created | 资源创建成功 |
| 400 | Bad Request | 请求体无效、缺少参数 |
| 401 | Unauthorized | Token 缺失或过期 |
| 403 | Forbidden | 用户无权限访问该资源 |
| 404 | Not Found | 资源不存在、路由不存在 |
| 500 | Internal Server Error | 服务器错误 |

### 通用错误格式

```json
{
  "error": "错误描述信息"
}
```

---

## 使用示例

### 用 curl 的注册示例

```bash
curl -X POST http://localhost:12813/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"john_doe","password":"password123"}'
```

### 用 curl 的新增加油记录示例

```bash
TOKEN="your_token_here"
curl -X POST http://localhost:12813/api/fuel \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "date":"2025-03-09",
    "mileage":5000,
    "liters":3.5,
    "pricePerLiter":8.5,
    "totalCost":29.75,
    "isFullTank":true,
    "notes":"高速路段"
  }'
```

### 用 JavaScript 获取加油记录示例

```javascript
const token = localStorage.getItem('auth_token');

fetch('http://localhost:12813/api/fuel', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(res => res.json())
.then(data => console.log(data))
.catch(err => console.error(err));
```

---

## 字段说明

### 日期格式
- **格式**: ISO 8601 (YYYY-MM-DD)
- **示例**: `2025-03-09`

### 数值字段
- **mileage**: 整数，单位 km
- **liters**: 浮点数，保留 2 位小数，单位升
- **pricePerLiter**: 浮点数，保留 2-4 位，单位元
- **totalCost**: 浮点数，保留 2 位小数，单位元
- **tankCapacity**: 浮点数，单位升

### 布尔值
- **isFullTank**: `true` 或 `false`

### 枚举值
- **type** (维护记录): 自由文本，如 "换油"、"链条保养"、"轮胎更换" 等

---

## 速率限制

目前无速率限制。生产环境建议配置。

---

## API 版本控制

| 版本 | 发布日期 | 说明 |
|------|---------|------|
| v1 | 2025-03 | 初始版本 |

---

## 常见问题 (FAQ)

**Q: Token 过期后如何处理？**
A: 收到 401 响应时，清除本地 token，引导用户重新登录。

**Q: 是否支持批量操作？**
A: 不支持，需逐条操作。

**Q: 是否支持搜索和筛选？**
A: 目前不支持，返回所有数据由前端过滤。

**Q: 可以修改维护记录吗？**
A: 目前不支持编辑，只能删除重新添加。

**Q: 数据同步到云端吗？**
A: 不支持，数据存储在本地 SQLite。

