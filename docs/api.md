# 服务端 API

Base URL：`/api`。请求与响应均为 JSON。除 `/api/auth/*` 外的接口都需要 `Authorization: Bearer <accessToken>`。

错误响应统一为：

```json
{ "error": "EMAIL_TAKEN", "message": "该邮箱已注册" }
```

常见错误码：`VALIDATION_FAILED`(400)、`INVALID_CREDENTIALS`(401)、`UNAUTHORIZED`(401)、`INVALID_TOKEN`(400)、`FORBIDDEN`(403)、`NOT_FOUND`(404)、`METHOD_NOT_ALLOWED`(405)、`EMAIL_TAKEN`(409)、`RATE_LIMITED`(429，含 AI 每日限额用尽)、`INTERNAL_ERROR`(500)、`AI_FAILED`(502，上游出错或输出不可用，不计入限额)、`AI_DISABLED`(503)。

`/api/auth/*` 会忽略 `Authorization` 头，过期的 access token 不会影响登录与刷新。

## 认证

### `POST /api/auth/register`

```json
{ "email": "a@b.com", "password": "至少 8 位" }
```

→ `201` 返回 `AuthResponse`，同时发送邮箱验证邮件。

### `POST /api/auth/login`

```json
{ "email": "a@b.com", "password": "..." }
```

→ `200` `AuthResponse`

### `POST /api/auth/refresh`

```json
{ "refreshToken": "..." }
```

→ `200` `AuthResponse`（refresh token 轮换，旧的立即失效）。令牌无效、过期或已被轮换时返回 `401 UNAUTHORIZED`，客户端应视为登出。

### `POST /api/auth/logout`

```json
{ "refreshToken": "..." }
```

→ `204`

### `POST /api/auth/verify-email`

```json
{ "token": "邮件中的令牌" }
```

→ `204`

### `POST /api/auth/forgot-password`

```json
{ "email": "a@b.com" }
```

→ `204`（无论邮箱是否存在都返回 204，避免枚举）

### `POST /api/auth/reset-password`

```json
{ "token": "邮件中的令牌", "password": "新密码" }
```

→ `204`，并使该用户全部 refresh token 失效，同时将邮箱标记为已验证。

密码规则：至少 8 个字符、UTF-8 不超过 72 字节（BCrypt 限制），否则 `VALIDATION_FAILED`。暂无“重发验证邮件”接口。

### AuthResponse

```json
{
  "accessToken": "jwt",
  "refreshToken": "opaque",
  "expiresIn": 900,
  "user": { "id": "uuid", "email": "a@b.com", "emailVerified": false }
}
```

## 用户

### `GET /api/me`

→ `200` `{ "id", "email", "emailVerified", "createdAt" }`（`createdAt` 为 ISO-8601 字符串）

## 同步

### `POST /api/sync`

```json
{
  "since": 0,
  "changes": [
    {
      "type": "card",
      "id": "uuid",
      "updatedAt": 1760000000000,
      "deleted": false,
      "data": { "...": "客户端自定义，服务端不解析" }
    }
  ]
}
```

- `type` ∈ `card | customWord | reviewLog | setting`
- 单次最多 500 条 changes；`data` 序列化后单条不超过 16KB；`id` 为不超过 64 字符的任意字符串；`data` 可为 null，原样存储返回。
- 任一条校验失败则整个请求不写入。
- 合并规则：`(userId, type, id)` 不存在，或 `incoming.updatedAt >= stored.updatedAt` 时写入，并赋予该用户新的递增 `version`。

→ `200`

```json
{
  "version": 42,
  "changes": [ /* 所有 version > since 的记录，按 version 升序，最多 1000 条 */ ],
  "hasMore": false
}
```

`hasMore` 为 true 时，客户端以返回的 `version` 作为 `since` 再次调用（`changes` 为空）直到 false。

## AI

### `POST /api/ai/sentence-exercises`

```json
{ "lang": "en", "words": ["theme", "progress"], "locale": "zh-CN" }
```

→ `200`

```json
{
  "exercises": [
    {
      "word": "theme",
      "kind": "cloze",
      "prompt": "The ___ of the conference was sustainability.",
      "answer": "theme",
      "explanation": "theme 表示主题"
    }
  ]
}
```

`kind` ∈ `cloze | usage | mistake`。服务端代理 OpenAI 兼容的 Chat Completions 接口，未配置 `WREADT_AI_API_KEY` 时返回 `503 AI_DISABLED`。每用户每天限额（默认 50 次）。
