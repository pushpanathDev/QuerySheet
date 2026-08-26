# QuerySheet Backend

QuerySheet Backend is a production-grade Node.js + Express API that powers authentication, analysis, conversational insights, and secure data storage for the QuerySheet platform. It runs on Render, stores user/session/analysis data in Firebase Firestore, and integrates with Gemini for AI-generated analytics and chat responses.

The backend is designed with layered architecture, strict request validation, secure session handling, and structured observability for reliable cloud deployment.

## Architecture

```text
[Browser / Frontend]
        |
      HTTPS
        |
[Express API on Render]
   |               |
   |               +--> [Gemini API]
   |
   +--> [Firebase Firestore]
```

## API Endpoints

| Method | Path                               | Auth Required | Rate Limit    | Description                                                  |
| ------ | ---------------------------------- | ------------- | ------------- | ------------------------------------------------------------ |
| POST   | `/api/v1/auth/register`            | No            | `authLimiter` | Register user and create profile/credential/session records. |
| POST   | `/api/v1/auth/login`               | No            | `authLimiter` | Login with email/password and set signed `sessionId` cookie. |
| POST   | `/api/v1/auth/logout`              | Yes           | Global        | Invalidate current session and clear cookie.                 |
| POST   | `/api/v1/auth/forgot-password`     | No            | `authLimiter` | Trigger password reset flow (non-enumerating response).      |
| POST   | `/api/v1/auth/reset-password`      | No            | `authLimiter` | Complete password reset using token + new password.          |
| GET    | `/api/v1/analyze/:analysisId`      | Yes           | Global        | Fetch previously saved analysis.                             |
| POST   | `/api/v1/analyze`                  | Yes           | `aiLimiter`   | Run dataset analysis and return mapped AI insights.          |
| DELETE | `/api/v1/analyze/:analysisId`      | Yes           | Global        | Delete analysis and related chat history.                    |
| POST   | `/api/v1/chat`                     | Yes           | `aiLimiter`   | Send a chat message scoped to one analysis context.          |
| GET    | `/api/v1/chat/history/:analysisId` | Yes           | Global        | Get chat history for an analysis session.                    |
| GET    | `/api/v1/chat/stream`              | Yes           | `aiLimiter`   | SSE streaming chat response endpoint.                        |
| GET    | `/api/v1/user/me`                  | Yes           | Global        | Get current user profile.                                    |
| POST   | `/api/v1/user/preferences`         | Yes           | Global        | Update user preferences.                                     |
| DELETE | `/api/v1/user/me`                  | Yes           | Global        | GDPR delete for profile, analyses, chat, and auth account.   |
| GET    | `/health`                          | No            | None          | Render liveness probe endpoint.                              |
| GET    | `/api/v1/status`                   | Yes           | Global        | Protected backend dependency status check.                   |

## Environment Variables

| Key                     | Description                                         | Example                                                           |
| ----------------------- | --------------------------------------------------- | ----------------------------------------------------------------- |
| `PORT`                  | API server port                                     | `8080`                                                            |
| `NODE_ENV`              | Runtime mode                                        | `production`                                                      |
| `FIREBASE_PROJECT_ID`   | Firebase project ID                                 | `bizpulse-prod`                                                   |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account client email               | `firebase-adminsdk@bizpulse-prod.iam.gserviceaccount.com`         |
| `FIREBASE_PRIVATE_KEY`  | Firebase service account private key (`\n` escaped) | `"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"` |
| `GEMINI_API_KEY`        | Gemini API key                                      | `AIza...`                                                         |
| `ALLOWED_ORIGINS`       | Comma-separated frontend origins                    | `https://bizpulse-ai.vercel.app`                                  |
| `JWT_AUDIENCE`          | JWT audience claim for auth validation              | `querysheet-backend`                                              |
| `SESSION_SECRET`        | Cookie signing secret (min 32 chars)                | `e31b...long-random-hex...`                                       |

## Local Setup

1. Clone the repository.
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env`
4. Fill all required environment variable values.
5. Start development server: `npm run dev`

## Security Features

1. Zod-validated environment boot checks with fail-fast startup.
2. Strict CORS allowlist (no wildcard with credentials).
3. Full Helmet hardening (CSP, HSTS in production, frame/object restrictions).
4. Signed, `httpOnly`, strict-samesite session cookie.
5. Firebase ID token verification with revocation checks.
6. Session-document validation (`authSessions`) on every protected request.
7. Request-level UUID tracing via `X-Request-ID`.
8. Structured JSON logging for security/audit observability.
9. Input validation with schema-driven middleware (`validateBody`, `validateQuery`).
10. Sanitization against prototype pollution, null-byte payloads, and SQL-like injection patterns.
11. Tiered rate limiting (global, auth endpoints, AI endpoints).
12. Password hashing with bcrypt and lockout policy for repeated failures.
13. Anonymous demo-mode restrictions (row limit + non-persistent analysis behavior).

## Folder Architecture

The backend uses a layered architecture:

- `src/config` initializes and validates runtime dependencies and SDK clients.
- `src/middleware` handles cross-cutting concerns (auth, security headers, CORS, validation, sanitization, rate limiting, error handling).
- `src/routes` defines endpoint mappings only.
- `src/controllers` handles HTTP input/output and delegates to services.
- `src/services` contains business logic and orchestration.
- `src/models` provides document factory functions for Firestore.
- `src/utils` includes pure helpers (prompt building, response mapping, logger, response envelopes).
- `src/schemas` defines request contracts for validation.

## Deployment Notes

- Render free tier can spin down after ~15 minutes of inactivity.
- Keep warm strategy: configure [UptimeRobot](https://uptimerobot.com/) to call `/health` every 5 minutes.
- After frontend deployment on Vercel, set backend `ALLOWED_ORIGINS` to the frontend production URL and redeploy Render.
