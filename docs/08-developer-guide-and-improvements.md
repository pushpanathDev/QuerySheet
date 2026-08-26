# Developer Guide, CRUD Comparison, And Improvement Review

## Installation

Backend:

```bash
cd BizPulseAI_Backend
npm install
```

Frontend:

```bash
cd BizPulseAI_Frontend
npm install
```

## Environment Setup

The backend requires a `.env` file for local development because the `dev` script uses `node --env-file .env`.

Backend variables required by `env.config.js`:

```env
PORT=8080
NODE_ENV=development
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GEMINI_API_KEY=...
GROQ_API_KEY=...
LLM_PRIMARY_PROVIDER=groq
ALLOWED_ORIGINS=http://localhost:5173
JWT_AUDIENCE=bizpulse-backend
SESSION_SECRET=at-least-32-characters
```

`GROQ_API_KEY` is optional. `LLM_PRIMARY_PROVIDER` defaults to `groq`. If Groq is selected but not configured, the LLM router falls back to Gemini.

Frontend variables used by `firebase.client.js` and `api/client.js`:

```env
VITE_API_BASE_URL=http://localhost:8080/api/v1
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

No `.env.example` file exists in the current repository.

## Running Locally

Backend development:

```bash
cd BizPulseAI_Backend
npm run dev
```

Backend production-style:

```bash
cd BizPulseAI_Backend
npm start
```

Frontend development:

```bash
cd BizPulseAI_Frontend
npm run dev
```

Frontend build:

```bash
cd BizPulseAI_Frontend
npm run build
```

## Scripts

Backend `package.json`:

| Script | Command | Purpose |
|---|---|---|
| `start` | `node server.js` | Run backend. |
| `dev` | `nodemon --exec "node --env-file .env" server.js` | Local auto-reload with env file. |
| `test` | `jest` | Run Jest tests. |
| `lint` | `eslint src/` | Lint backend source. |

Frontend `package.json`:

| Script | Command | Purpose |
|---|---|---|
| `dev` | `vite` | Run frontend dev server. |
| `build` | `vite build` | Build static bundle. |
| `lint` | `eslint .` | Lint frontend source. |
| `preview` | `vite preview` | Preview production bundle. |

## Development Workflow

Recommended workflow:

1. Start backend with valid Firebase/Gemini env vars.
2. Start frontend with `VITE_API_BASE_URL` pointing to backend `/api/v1`.
3. Register/login through frontend.
4. Upload a small CSV/XLSX.
5. Watch backend logs for request IDs and analysis job state.
6. Use History to verify persistence.
7. Use Chat to verify message persistence and streaming.

## Debugging

Backend:

- Use `X-Request-ID` from responses to find matching JSON logs.
- Inspect Firestore paths under `users/{uid}/analyses`.
- Check `authSessions/{sessionId}` for session activity/expiry issues.
- Check `passwordResetTokens/{tokenHash}` only through admin tooling; plaintext token is not stored.
- For LLM issues, inspect logs from `llm.service.js`, `groq.service.js`, and `gemini.service.js`.

Frontend:

- Dev logger scopes appear in browser console.
- API client logs request/response summaries in development.
- Auth state comes from Firebase; check session storage and Firebase user state.
- Current analysis/history state is persisted in `sessionStorage` under `bizpulse-analysis`.

## Testing

Backend tests exist for:

- Auth service registration/login edge cases.
- Analysis service column stat behavior.
- Prompt builder utility.

Run:

```bash
cd BizPulseAI_Backend
npm test
```

Important test gap: some tests appear stale against the current multi-sheet implementation. For example, `analyze.service.test.js` mocks `gemini.service.js`, while `analyze.service.js` now imports `llm.service.js`, and the tests inspect older argument shapes. Update tests before relying on them as a full regression suite.

Frontend has no test script or test files in the inspected repository.

## Configuration Files

| File | Present | Notes |
|---|---:|---|
| Backend `package.json` | Yes | Scripts/dependencies. |
| Backend `render.yaml` | Yes | Render deployment. |
| Backend `firestore.rules` | Yes | Firestore client access policy. |
| Backend `firestore.indexes.json` | Yes | Composite indexes. |
| Backend ESLint config | No | Backend has lint script but no visible ESLint config in backend folder. |
| Frontend `package.json` | Yes | Scripts/dependencies. |
| Frontend `vite.config.js` | Yes | React and Tailwind plugins. |
| Frontend `eslint.config.js` | Yes | Flat ESLint config. |
| Frontend `index.html` | Yes | Vite HTML entry. |
| Docker/Compose | No | Not present. |
| TypeScript config | No | Project uses JavaScript/JSX. |
| Next/Webpack config | No | Vite app, not Next/Webpack. |
| Prettier config | No | Not present. |
| Firebase client config file | Yes | In `firebase.client.js`, from Vite env vars. |

## Compare Against Basic CRUD App With No Security

| Area | Basic CRUD With No Security | BizPulseAI Implementation |
|---|---|---|
| Authentication | Often absent or simple username check. | Firebase ID token verification plus backend sessions. |
| Authorization | Direct record IDs may be exposed. | Firestore paths scoped by `req.user.uid`; rules enforce owner reads. |
| Password storage | Plaintext or weak hash in poor apps. | bcrypt hash with 12 salt rounds. |
| Sessions | Unsigned cookie or no session. | Signed `httpOnly` cookie plus Firestore session doc. |
| Token validation | None. | Firebase Admin verifies ID token and revocation. |
| Password reset | Often missing or leaks account existence. | Non-enumerating response, hashed reset tokens, session invalidation. |
| API exposure | Public endpoints. | Protected routes use auth middleware. |
| Request validation | Manual or missing. | Zod body schemas. |
| Input sanitization | Missing. | Recursive sanitizer for strings and dangerous keys. |
| Database protection | Client can write directly. | Firestore rules deny sensitive client writes. |
| Middleware | Minimal. | Request ID, Helmet, CORS, cookies, body limits, sanitizer, logging, rate limits. |
| Logging | Console strings. | JSON logger and Morgan HTTP logs. |
| Monitoring | Usually none. | Request IDs and health endpoint, but no external monitoring integration. |
| Error handling | Stack traces to clients. | Central error middleware with generic 500. |
| Secrets | Hardcoded in poor apps. | Required env validation. |
| Deployment | Manual command. | Render config with health check. |
| Scalability | Single synchronous CRUD path. | Async analysis jobs, caching, provider fallback; still process-local in parts. |
| Maintainability | Mixed route/database logic. | Layered route/controller/service/model/util design. |
| Performance | No limits/caching. | Body limits, AI rate limits, insight cache, history cache. |
| Developer experience | Sparse docs/scripts. | Clear scripts, existing docs, but env examples and tests need work. |
| Security maturity | Beginner. | Intermediate production-oriented baseline with known hardening tasks. |

How this project evolves from a beginner CRUD application into a production-ready backend.

It moves beyond simple create/read/update/delete handlers by adding identity, session validation, request contracts, centralized error handling, secure headers, rate limiting, backend-owned persistence, asynchronous AI workflows, and provider fallback. The architecture separates HTTP, business logic, persistence, and AI concerns, making it easier to maintain and discuss in production engineering terms.

## Strengths

- Clear backend layering.
- Strong startup env validation.
- Secure hybrid auth/session model for email/password users.
- Firestore rules align with backend-owned writes.
- Async analysis avoids long HTTP timeout exposure.
- LLM output validation is treated seriously.
- Chat metadata fast path reduces AI cost.
- Frontend state cleanup on account switch prevents cross-user leakage.
- SSE implementation uses `fetch` to keep Authorization headers.

## Weaknesses And Technical Debt

- Password reset email is a logging stub.
- Account deletion does not fully delete all user-related collections.
- Route params and stream query params are not fully validated.
- Some frontend and backend brand names differ: `BizPulseAI` vs `DataPulse AI`.
- Backend tests are likely stale against current service imports and multi-sheet shapes.
- No frontend tests.
- No pagination for analysis history or chat history at the database query level.
- In-memory caches and rate gates are process-local.
- Async jobs run inside the API process instead of a worker/queue.
- Backend lint script exists but backend ESLint config was not found.
- `JWT_AUDIENCE` is required but unused.
- `health.controller.js` exists but `/health` is implemented inline in `app.js`.

## Security Improvements

- Replace password reset stub with SendGrid, Resend, SES, or Firebase email flow.
- Stop logging plaintext reset tokens outside local development.
- Enforce password complexity consistently on reset.
- Add `validateParams` for all `:analysisId` routes.
- Add `validateQuery` for `/chat/stream`.
- Consider short-lived stream tokens instead of long Firebase token in query support.
- Ensure account deletion deletes credentials, sessions, reset tokens, profile subdocs, and insight cache.
- Add audit logs for login, logout, reset, account deletion, and repeated failed auth.
- Add dependency scanning in CI.
- Add frontend hosting security headers.

## Performance Improvements

- Add cursor pagination to `GET /analyze`.
- Query chat history with `limitToLast(50)` equivalent instead of fetching all and slicing in memory.
- Move LLM jobs to a queue/worker model.
- Move Q&A cache and rate-limit counters to Redis or Firestore with TTL for multi-instance deployments.
- Add compression for JSON responses if appropriate.
- Consider storing compact analysis summaries separately from full chart/insight payloads for history lists.
- Use content-based hashing over sampled/normalized data if repeated uploads need stronger duplicate detection.

## Scalability Improvements

- Introduce job queue with statuses and retry metadata.
- Add idempotency keys for analysis submissions.
- Add distributed locks or job ownership for background workers.
- Extract provider interfaces for AI services.
- Add data retention policies and scheduled cleanup for expired sessions/reset tokens/insight cache.

## Code Quality Improvements

- Split large frontend pages into smaller components.
- Normalize timestamp handling across backend writes.
- Remove unused or stale files, such as `health.controller.js`, or wire them in.
- Resolve branding inconsistency.
- Add backend ESLint config or adjust lint script.
- Add OpenAPI documentation generated from route/schema definitions.

## Testing Improvements

- Fix stale backend tests.
- Add middleware integration tests with Supertest.
- Add auth/session end-to-end tests.
- Mock LLM provider router in analysis/chat tests.
- Add frontend component tests for protected routing, upload flow, history actions, and chat streaming fallback.
- Add contract tests for response envelopes and frontend API unwrapping.

## Production Readiness Improvements

- Add `.env.example` files.
- Add CI for lint/test/build.
- Add dependency audit checks.
- Add observability: error tracking, metrics, request latency, AI provider latency, cache hit rate.
- Add explicit retention and deletion documentation.
- Add deployment docs for frontend host and Firebase rules/index deployment.

