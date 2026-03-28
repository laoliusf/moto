# Docker 部署说明

## 1. 当前 Dockerfile 行为

当前 `backend/Dockerfile` 使用两阶段构建：

1. 使用 Maven 镜像打包 Spring Boot Jar
2. 使用 JRE 镜像运行应用

当前 Dockerfile 还会把数据库文件复制进镜像：

```dockerfile
COPY moto.db /app/moto.db
```

这意味着：

- 如果容器启动时没有挂载外部数据库
- 应用会直接使用镜像内置的 `moto.db`
- 测试数据有可能随镜像一起发布到线上

因此正式环境必须使用外部数据库文件挂载。

## 2. 构建镜像

在 `backend` 目录执行：

```powershell
docker build -t moto-app:latest .
```

## 3. 本地运行

### 3.1 推荐方式

把数据库文件从宿主机挂载进容器：

```powershell
docker run -d `
  --name moto-app `
  -p 12813:18080 `
  -v D:\Docker\moto\moto.db:/app/moto.db `
  moto-app:latest
```

访问地址：

- `http://127.0.0.1:12813`

### 3.2 不推荐方式

```powershell
docker run -d --name moto-app -p 12813:18080 moto-app:latest
```

风险：

- 会直接使用镜像内数据库
- 重新发布镜像可能覆盖预期数据来源

## 4. 常用命令

查看容器：

```powershell
docker ps
```

查看日志：

```powershell
docker logs -f moto-app
```

停止容器：

```powershell
docker stop moto-app
```

删除容器：

```powershell
docker rm -f moto-app
```

查看镜像：

```powershell
docker images
```

## 5. 生产建议

推荐最少做到以下几点：

1. 删除 Dockerfile 里的 `COPY moto.db /app/moto.db`
2. 通过 volume 明确挂载数据库文件
3. 备份宿主机数据库文件
4. 把镜像与数据分离管理
5. 发布前确认使用的是生产库而不是测试库
