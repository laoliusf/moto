# 生成 Docker 镜像说明

本文档说明如何为当前项目构建 Docker 镜像并运行。

## 前置条件

- 已安装 Docker（Windows / Linux / macOS 均可）

## 构建镜像

Dockerfile 位于 `backend` 目录，请在该目录下执行构建：

```bash
cd backend
docker build -t moto-app:latest .
```

构建完成后，可用以下命令确认镜像：

```bash
docker images | findstr moto-app
```

## 运行容器

应用默认端口为 `18080`，可直接映射到宿主机：

```bash
docker run -d --name moto-app -p 18080:18080 moto-app:latest
```

访问地址：

```
http://localhost:18080
```

## 数据持久化（可选）

项目使用 SQLite 数据库文件 `/app/moto.db`。若需要持久化数据，可将宿主机文件挂载进去：

```bash
docker run -d --name moto-app -p 18080:18080 `
  -v /absolute/path/moto.db:/app/moto.db `
  moto-app:latest
```

## 常用命令

停止容器：

```bash
docker stop moto-app
```

删除容器：

```bash
docker rm moto-app
```

删除镜像：

```bash
docker rmi moto-app:latest
```
