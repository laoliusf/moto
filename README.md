# Moto

Moto 是一个面向摩托车日常使用场景的单体 Web 应用，用来管理车辆、加油记录、保养记录和基础费用统计。

## 当前技术栈

- 后端：Java 17、Spring Boot 3.2、Spring Security、Spring JDBC
- 数据库：SQLite
- 前端：原生 HTML + CSS + JavaScript 单页应用
- 认证：JWT Bearer Token
- 部署：Jar 运行或 Docker 部署

## 目录结构

```text
backend/
  src/main/java/com/moto/app/
    auth/           登录、注册、JWT、密码管理
    common/         统一异常与通用响应处理
    config/         安全配置、CORS、过滤链
    fuel/           加油记录
    maintenance/    保养记录
    stats/          仪表盘统计
    user/           用户仓储
    vehicle/        车辆档案
  src/main/resources/
    application.yml
    schema.sql
    static/
      index.html
      api.js
      app.js
doc/
  PROJECT_OVERVIEW.md
  USER_MANUAL.md
  API_DOCS.md
  DATABASE_SCHEMA.md
  DOCKER_IMAGE.md
```

## 运行方式

### 本地运行

```powershell
cd backend
D:\Maven\apache-maven-3.9.9\bin\mvn.cmd spring-boot:run
```

默认访问地址：

- 前后端同域：`http://127.0.0.1:18080`

### Docker

```powershell
cd backend
docker build -t moto-app:latest .
docker run -d --name moto-app -p 12813:18080 -v D:\Docker\moto\moto.db:/app/moto.db moto-app:latest
```

## 文档索引

- 项目总览：`doc/PROJECT_OVERVIEW.md`
- 用户手册：`doc/USER_MANUAL.md`
- 接口说明：`doc/API_DOCS.md`
- 数据库说明：`doc/DATABASE_SCHEMA.md`
- Docker 说明：`doc/DOCKER_IMAGE.md`

## 当前注意事项

- 当前代码里仍存在部分中文乱码字符串，主要影响界面文案和部分后端报错文本，不影响整体架构理解。
- Dockerfile 当前会把 `backend/moto.db` 一并复制进镜像；正式环境建议始终使用外部挂载数据库文件，避免把测试数据带上线。
