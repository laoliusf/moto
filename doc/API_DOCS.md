# API 文档

## 1. 基本信息

- 基础路径：`/api`
- 认证方式：`Authorization: Bearer <token>`
- 响应格式：JSON

匿名可访问：

- `POST /api/auth/register`
- `POST /api/auth/login`

其余接口都需要登录。

## 2. 认证接口

### 2.1 注册

`POST /api/auth/register`

请求体：

```json
{
  "username": "admin",
  "password": "456852"
}
```

响应示例：

```json
{
  "token": "jwt-token",
  "user": {
    "id": 1,
    "username": "admin"
  }
}
```

### 2.2 登录

`POST /api/auth/login`

请求体：

```json
{
  "username": "admin",
  "password": "456852"
}
```

响应示例：

```json
{
  "token": "jwt-token",
  "user": {
    "id": 1,
    "username": "admin"
  }
}
```

### 2.3 当前用户

`GET /api/auth/me`

响应示例：

```json
{
  "id": 1,
  "username": "admin",
  "isAdmin": true
}
```

### 2.4 修改自己的密码

`POST /api/auth/change-password`

请求体：

```json
{
  "currentPassword": "456852",
  "newPassword": "newpass123",
  "confirmPassword": "newpass123"
}
```

响应示例：

```json
{
  "message": "密码已更新"
}
```

### 2.5 管理员重置用户密码

`POST /api/auth/admin-reset-password`

请求体：

```json
{
  "username": "targetUser"
}
```

响应示例：

```json
{
  "message": "密码已重置为 moto123",
  "username": "targetUser"
}
```

说明：

- 只有 `admin` 账号允许调用
- 重置后的密码固定为 `moto123`

## 3. 车辆接口

### 3.1 查询车辆列表

`GET /api/vehicle`

响应示例：

```json
[
  {
    "id": 1,
    "userId": 1,
    "name": "豪爵UHR150",
    "brand": "豪爵",
    "model": "UHR150",
    "displacement": "150cc",
    "purchaseDate": "2026-03-06",
    "currentMileage": 13600,
    "notes": ""
  }
]
```

### 3.2 新增车辆

`POST /api/vehicle`

请求体：

```json
{
  "name": "豪爵UHR150",
  "brand": "豪爵",
  "model": "UHR150",
  "displacement": "150cc",
  "purchaseDate": "2026-03-06",
  "currentMileage": 13600,
  "notes": ""
}
```

### 3.3 更新车辆

`PUT /api/vehicle/{id}`

请求体同新增。

### 3.4 删除车辆

`DELETE /api/vehicle/{id}`

说明：

- 如果该车存在加油或保养记录，会返回冲突错误，不能删除

## 4. 加油记录接口

### 4.1 查询加油记录

`GET /api/fuel`

可选查询参数：

- `vehicleId`
- `from`
- `to`

响应示例：

```json
[
  {
    "id": 1,
    "userId": 1,
    "vehicleId": 1,
    "date": "2026-03-08",
    "mileage": 200,
    "liters": 6.0,
    "pricePerLiter": 7.0,
    "totalCost": 42.0,
    "isFullTank": true,
    "notes": ""
  }
]
```

### 4.2 新增加油记录

`POST /api/fuel`

请求体：

```json
{
  "vehicleId": 1,
  "date": "2026-03-08",
  "mileage": 200,
  "liters": 6.0,
  "pricePerLiter": 7.0,
  "totalCost": 42.0,
  "isFullTank": true,
  "notes": ""
}
```

### 4.3 更新加油记录

`PUT /api/fuel/{id}`

请求体同新增。

### 4.4 删除加油记录

`DELETE /api/fuel/{id}`

成功时返回 `204 No Content`。

## 5. 保养记录接口

### 5.1 查询保养记录

`GET /api/maintenance`

可选查询参数：

- `vehicleId`

响应示例：

```json
[
  {
    "id": 1,
    "userId": 1,
    "vehicleId": 1,
    "title": "购入 / 机油 / 机滤",
    "cost": 13600.0,
    "mileage": 0,
    "nextMaintenanceMileage": 1000,
    "date": "2026-03-06",
    "notes": ""
  }
]
```

### 5.2 新增保养记录

`POST /api/maintenance`

请求体：

```json
{
  "vehicleId": 1,
  "title": "机油 / 机滤",
  "cost": 120.0,
  "mileage": 1500,
  "nextMaintenanceMileage": 2500,
  "date": "2026-03-28",
  "notes": ""
}
```

### 5.3 更新保养记录

`PUT /api/maintenance/{id}`

请求体同新增。

### 5.4 删除保养记录

`DELETE /api/maintenance/{id}`

成功时返回 `204 No Content`。

## 6. 统计接口

### 6.1 汇总统计

`GET /api/stats/summary`

响应示例：

```json
{
  "totalCost": 10091.5,
  "totalFuelCost": 91.5,
  "totalMaintenanceCost": 10000.0,
  "totalMileage": 197.0,
  "averageConsumption": 3.0456852791878175,
  "averagePrice": 7.038461538461538,
  "monthCost": 10091.5,
  "monthFuelCost": 91.5,
  "monthMaintenanceCost": 10000.0,
  "historicalAverageConsumption": 3.0456852791878175
}
```

### 6.2 加油趋势

`GET /api/stats/fuel-trend?limit=20`

响应示例：

```json
[
  {
    "date": "2026-03-08",
    "value": 6.0,
    "cost": 42.0
  }
]
```

### 6.3 费用分布

`GET /api/stats/cost-breakdown`

响应示例：

```json
{
  "fuel": 91.5,
  "maintenance": 10000.0
}
```

## 7. 错误响应

统一返回结构：

```json
{
  "error": "message"
}
```

常见状态码：

- `400 Bad Request`
- `401 Unauthorized`
- `404 Not Found`
- `409 Conflict`
- `500 Internal Server Error`
