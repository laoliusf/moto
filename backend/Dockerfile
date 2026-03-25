# ---------- builder ----------
FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /build

# 复制构建所需文件
COPY pom.xml ./
COPY src src

# 构建可执行 jar（使用镜像自带 mvn，包含 repackage）
RUN mvn -q -DskipTests package

# ---------- runtime ----------
FROM eclipse-temurin:17-jre
WORKDIR /app

# copy artifact
COPY --from=build /build/target/moto-app-0.0.1-SNAPSHOT.jar /app/app.jar
# sqlite file + optional schema for init/debug
COPY moto.db /app/moto.db
COPY src/main/resources/schema.sql /app/schema.sql

# align container port with application.yml
EXPOSE 18080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
