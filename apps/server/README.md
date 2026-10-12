# Wreadt Server

Spring Boot 4.1 + Java 21（JDK 21 及以上均可运行）。负责账号、数据同步与 AI 代理，接口见 [`docs/api.md`](../../docs/api.md)。

## 运行

无需安装 Maven 或数据库：

```bash
cd apps/server
./mvnw spring-boot:run        # 默认 dev profile，监听 http://localhost:8080
./mvnw test                   # 运行测试（test profile，内存 H2）
./mvnw package                # 打包为 target/server-0.0.1-SNAPSHOT.jar
```

- `dev`（默认）：H2 文件库 `./data/wreadt`（PostgreSQL 兼容模式，已 gitignore），删除该目录即可重置数据。
- 未配置 SMTP 时，验证邮件 / 重置密码邮件会直接打印到控制台日志，复制其中的链接即可。
- 健康检查：`GET /actuator/health`。

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `SPRING_PROFILES_ACTIVE` | `dev` | `dev` / `prod`（`test` 仅供测试） |
| `WREADT_JWT_SECRET` | dev 内置值；prod **必填** | HS256 密钥，至少 32 字节 |
| `WREADT_CORS_ORIGINS` | `http://localhost:25173` | 允许跨域的前端地址，逗号分隔 |
| `WREADT_APP_URL` | `http://localhost:25173` | 前端地址，用于拼接邮件中的 `/verify-email`、`/reset-password` 链接 |
| `WREADT_MAIL_FROM` | `Wreadt <no-reply@wreadt.local>` | 发件人 |
| `SPRING_MAIL_HOST` / `SPRING_MAIL_PORT` / `SPRING_MAIL_USERNAME` / `SPRING_MAIL_PASSWORD` | 空 | SMTP 配置；未设置 host 时邮件只写日志 |
| `WREADT_AI_BASE_URL` | `https://api.deepseek.com` | OpenAI 兼容接口地址（不含 `/v1`，服务端请求 `${base}/v1/chat/completions`） |
| `WREADT_AI_API_KEY` | 空 | 为空时 AI 接口返回 `503 AI_DISABLED` |
| `WREADT_AI_MODEL` | `deepseek-chat` | 模型名 |
| `WREADT_AI_DAILY_LIMIT` | `50` | 每用户每天 AI 调用次数（北京时间零点重置） |
| `DATABASE_URL` / `DATABASE_USERNAME` / `DATABASE_PASSWORD` | — | 仅 prod，JDBC 连接串 |

SMTP 需要 STARTTLS / SSL 时，可通过 `--spring.mail.properties.mail.smtp.starttls.enable=true` 等启动参数补充。

## 连接 PostgreSQL

```bash
createdb wreadt
export SPRING_PROFILES_ACTIVE=prod
export DATABASE_URL=jdbc:postgresql://localhost:5432/wreadt   # 注意是 JDBC 格式，不是 postgres://
export DATABASE_USERNAME=postgres
export DATABASE_PASSWORD=postgres
export WREADT_JWT_SECRET=$(openssl rand -base64 48)
./mvnw spring-boot:run
# 或：java -jar target/server-0.0.1-SNAPSHOT.jar
```

表结构由 Flyway 在启动时自动迁移（`src/main/resources/db/migration`），迁移脚本同时兼容 PostgreSQL 与 H2 的 PG 模式，新增迁移时请避免 `jsonb` 等 PG 专有语法。

## 实现要点

- 密码 BCrypt；邮箱统一小写。Access Token 为 15 分钟的 JWT（`sub` = 用户 id），Refresh Token 为 30 天的随机串，库中只存 SHA-256，刷新时轮换；重置密码会使该用户全部 Refresh Token 失效。
- `/api/auth/*` 会忽略 `Authorization` 头，过期的 access token 不会影响登录 / 刷新。
- 登录、注册、找回密码按「IP + 邮箱」每分钟 10 次限流（进程内存，单实例有效）。部署在反向代理之后时，需要配置 `server.forward-headers-strategy` 以取得真实 IP。
- 同步：每个用户一行 `user_sync_state` 保存递增版本号，同步时加行锁，保证同一用户并发同步的版本号单调不重复。
- AI 提示词在 `src/main/resources/prompts/sentence-exercises.txt`。
