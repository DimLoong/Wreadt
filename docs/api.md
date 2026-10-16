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

- `type` ∈ `card | customWord | reviewLog | setting | dictExtra`
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

`kind` ∈ `cloze | usage | mistake`。

### `POST /api/ai/word-examples`

```json
{ "lang": "en", "word": "cancel", "locale": "zh-CN" }
```

→ `200`

```json
{ "examples": [{ "sentence": "We had to cancel the meeting.", "translation": "我们不得不取消会议。" }] }
```

### `POST /api/ai/complete`

通用 AI 任务（新功能都走这个接口）：服务端按 `task` 选择 `prompts/{task}.txt` 作为系统提示词、计入每日限额，把模型输出的 JSON 文本原样返回，由客户端用 `packages/core/src/ai.ts` 校验解析。

```json
{ "task": "analyze-words", "input": { "lang": "en", "locale": "zh-CN", "words": ["deprecated"], "context": "The API is deprecated." } }
```

→ `200` `{ "content": "{\"words\":[...]}" }`

`task` ∈ `sentence-exercises | word-examples | analyze-words | expand-dict | scenario-question | scenario-review | confusable-quiz | interest-feed | micro-reading | word-tips | dictation-sentences`；`input` 序列化后不超过 16KB。

所有 AI 接口共用每日限额。服务端请求 `${WREADT_AI_BASE_URL}/chat/completions`（地址需包含版本路径）。

> 不登录也能用 AI：用户可在设置里填写自己的 API Key，浏览器直接调用模型服务商（预设见 `packages/core/src/ai.ts` 的 `AI_PRESETS`：国内的千问、DeepSeek、豆包、智谱、Kimi、文心、MiniMax、阶跃、硅基流动，国际的 ChatGPT、Claude、Gemini、Grok、Mistral、Groq、OpenRouter，均已确认支持浏览器跨域）。Claude 通过 Anthropic 官方 SDK 调用 Messages 接口，其余为 OpenAI 兼容接口；提示词与解析逻辑见 `packages/core/src/ai.ts`，与服务端 `prompts/*.txt` 保持一致。服务端代理 OpenAI 兼容的 Chat Completions 接口，未配置 `WREADT_AI_API_KEY` 时返回 `503 AI_DISABLED`。每用户每天限额（默认 50 次）。

## 语音合成

### `POST /api/tts`

需要登录。把一句英文合成为音频（阿里云百炼 · 千问 TTS `qwen3-tts-flash`），返回 `audio/wav` 字节。

```json
{ "text": "We need to postpone the meeting.", "voice": "Jennifer" }
```

- `text`：1～300 个字符；`voice`：`Jennifer`、`Cherry`、`Katerina`、`Ryan`、`Ethan`、`Elias` 之一（与 `packages/core/src/tts.ts` 一致）。
- 同样的模型、声音与文本会命中服务端缓存（`tts_cache` 表，所有用户共用），不再请求上游、不计额度。
- 每人每天可合成的字符数由 `WREADT_TTS_DAILY_CHARS` 控制（默认 20000），超出返回 `429 RATE_LIMITED`；上游失败返回 `502 TTS_FAILED` 且不扣额度。
- 未配置 `WREADT_TTS_API_KEY`（百炼 Key）时返回 `503 TTS_DISABLED`，前端会自动改用本机语音。

> 自带千问 Key 的用户不经过服务端：浏览器直接调用 `https://dashscope.aliyuncs.com/api/v1/...`（支持跨域），音频缓存在浏览器的 Cache Storage 中。
