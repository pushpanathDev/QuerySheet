## Merged Files List
- 1. 01-overview.md (6.6 KB)
- 2. 02-repository-structure.md (9.5 KB)
- 3. 03-backend-architecture.md (11.3 KB)
- 4. 04-api-and-database.md (15.4 KB)
- 5. 05-security-architecture.md (10.7 KB)
- 6. 06-frontend-architecture.md (10.1 KB)
- 7. 07-features-ai-performance.md (10 KB)
- 8. 08-developer-guide-and-improvements.md (11.2 KB)


## 1. 01-overview.md

```md
# High-Level Overview

## What The Application Is

BizPulseAI is a spreadsheet-to-insights web application. Users upload CSV or Excel datasets, the frontend parses the file into tabular rows and sheet metadata, and the backend computes column statistics, generates AI insights, persists the analysis, and enables follow-up chat about the uploaded data.

The implemented system has two deployable applications:

- `BizPulseAI_Backend`: Node.js 18+, Express 5 API, Firebase Admin SDK, Firestore persistence, Firebase Auth integration, Groq and Gemini LLM providers.
- `BizPulseAI_Frontend`: React 19, Vite, Tailwind CSS v4, Zustand, Firebase Client SDK, Recharts, Papa Parse, SheetJS/XLSX.

## Business Problem

The app reduces the effort needed to inspect business data. Instead of asking users to write SQL, configure dashboards, or manually inspect spreadsheets, it accepts familiar file formats and produces:

- Column statistics and data quality summaries.
- AI-generated trends, anomalies, correlations, and recommendations.
- Suggested chart configurations and Recharts visualizations.
- Conversational follow-up analysis scoped to the persisted dataset.

## Intended Users

The implementation is built for authenticated business users who need quick interpretation of spreadsheet data. The UI supports email/password and Google sign-in, and the backend supports an anonymous Firebase provider path for token-authenticated anonymous users, with a stricter analysis row limit.

## Primary Use Cases

- Register or log in.
- Upload CSV, XLS, or XLSX files up to 5 MB from the frontend.
- Preview parsed rows and submit a dataset for analysis.
- Poll for asynchronous analysis completion.
- View charts, AI insights, data quality notes, and recommended actions.
- Browse prior analyses grouped by dataset hash.
- Chat with a selected analysis, including streaming Server-Sent Events responses.
- Delete an analysis and its chat messages.
- Update user preferences.
- Delete an account.
- Request and complete password reset using backend-generated reset tokens.

## Overall Workflow

```mermaid
flowchart TD
    U[User] --> FE[React Frontend]
    FE --> PARSE[Client-side file parsing]
    PARSE --> API[Express API]
    API --> AUTH[Firebase token + Firestore session validation]
    AUTH --> STATS[Server-side sheet summaries and column stats]
    STATS --> LLM[Groq primary / Gemini fallback]
    LLM --> MAP[Response mapper]
    MAP --> FS[Firestore analysis document]
    FS --> DASH[Dashboard charts and insights]
    DASH --> CHAT[Contextual chat]
    CHAT --> FSMSG[Persisted messages]
```

## Technology Stack

| Layer | Technologies | Where Used | Why It Fits |
|---|---|---|---|
| Frontend runtime | React 19, Vite | `BizPulseAI_Frontend/src` | Component-driven SPA with fast local builds. |
| Frontend routing | React Router DOM | `src/App.jsx` | Route guards and nested protected layout. |
| Frontend state | Zustand, immer, persist middleware | `src/store` | Small global stores for auth and analysis history without Redux boilerplate. |
| Styling | Tailwind CSS v4 | `src/index.css`, JSX class names | Design tokens and utility styling across pages. |
| Charts | Recharts | `Dashboard.page.jsx` | Declarative React chart rendering from backend chart data. |
| File parsing | Papa Parse, SheetJS/XLSX | `fileParser.util.js` | CSV and multi-sheet Excel parsing before API submission. |
| Auth client | Firebase Client SDK | `firebase.client.js` | Browser Firebase session, ID token generation, Google popup login. |
| API server | Node.js 18+, Express 5 | `server.js`, `src/app.js` | REST API, middleware pipeline, route/controller/service layering. |
| Validation | Zod | `src/schemas`, `env.config.js`, `gemini.service.js` | Runtime validation for env vars, request bodies, and LLM output. |
| Persistence | Firebase Firestore | `cache.service.js`, service modules | Per-user document hierarchy, admin SDK access, simple serverless storage. |
| Auth admin | Firebase Admin SDK | `firebase.config.js`, `auth.middleware.js`, `auth.service.js` | User creation, token verification, custom token issuance, account deletion. |
| Password hashing | bcryptjs | `auth.service.js` | Salted password hashing for backend-owned credentials. |
| AI providers | Groq SDK, Google Generative AI SDK | `llm.service.js`, `groq.service.js`, `gemini.service.js` | Groq primary route for throughput, Gemini fallback and JSON/text model instances. |
| Security middleware | Helmet, CORS, cookie-parser, express-rate-limit | `src/app.js`, `src/middleware` | Headers, origin allowlist, signed cookies, request throttling. |
| Logging | Morgan, custom JSON logger | `src/app.js`, `logger.util.js` | HTTP logs and structured app logs with request IDs. |
| Tests | Jest, Supertest dependency | `__tests__` | Unit tests for auth, analysis helpers, and prompt builder. |
| Deployment | Render | `render.yaml` | Web service deployment with health check and managed env vars. |

## System Architecture

```mermaid
graph TB
    subgraph Browser["Browser"]
        UI[React UI]
        FirebaseClient[Firebase Client SDK]
        Stores[Zustand Stores]
    end

    subgraph API["Express Backend"]
        App[app.js]
        Middleware[Request ID / Helmet / CORS / Cookies / JSON / Sanitize / Morgan / Rate Limit]
        Routes[/api/v1 routes]
        Controllers[Controllers]
        Services[Services]
        Utils[Utilities and schemas]
    end

    subgraph Firebase["Firebase"]
        Auth[Firebase Auth]
        Firestore[Firestore]
    end

    subgraph AI["LLM Providers"]
        Groq[Groq Llama 4 Scout]
        Gemini[Gemini 2.5 Flash]
    end

    UI --> Stores
    UI --> FirebaseClient
    UI -->|Bearer ID token + signed cookie| Middleware
    Middleware --> Routes --> Controllers --> Services
    Services --> Utils
    Services --> Firestore
    Services --> Auth
    Services --> Groq
    Services --> Gemini
    FirebaseClient --> Auth
```

## High-Level Design Decisions

- The backend owns email/password credential validation and server-side sessions, while Firebase Client SDK still owns browser auth state through custom tokens.
- Analyses for authenticated users are asynchronous. The API returns a `processing` document quickly and the dashboard polls until completion.
- Chat can stream via SSE using `fetch`, because standard `EventSource` cannot attach the Firebase bearer token.
- Firestore writes are backend-managed for sensitive records. Firestore rules deny client writes to credentials, sessions, analyses, messages, and insight cache.
- LLM output is treated as untrusted. Structured insights are parsed, normalized, and Zod-validated before being mapped to frontend response shapes.

```

## 2. 02-repository-structure.md

```md
# Repository Structure

## Actual Top-Level Layout

The repository root contains two application directories:

```text
BizPulseAI/
|-- BizPulseAI_Backend/
|-- BizPulseAI_Frontend/
`-- docs/
```

The user prompt described `frontend/` and `backend/`, but the actual folders are named `BizPulseAI_Frontend/` and `BizPulseAI_Backend/`.

## Repository Tree

Generated from source inspection, excluding generated bundle internals and lockfile contents:

```text
BizPulseAI_Backend/
|-- __tests__/
|   |-- analyze.service.test.js
|   |-- auth.service.test.js
|   `-- promptBuilder.util.test.js
|-- docs/
|   |-- PROJECT_MASTER_DOCUMENTATION.md
|   `-- canvas/
|-- src/
|   |-- app.js
|   |-- config/
|   |   |-- env.config.js
|   |   |-- firebase.config.js
|   |   |-- gemini.config.js
|   |   `-- groq.config.js
|   |-- controllers/
|   |   |-- analyze.controller.js
|   |   |-- auth.controller.js
|   |   |-- chat.controller.js
|   |   |-- health.controller.js
|   |   `-- user.controller.js
|   |-- middleware/
|   |   |-- auth.middleware.js
|   |   |-- cors.middleware.js
|   |   |-- error.middleware.js
|   |   |-- rateLimit.middleware.js
|   |   |-- requestId.middleware.js
|   |   |-- sanitize.middleware.js
|   |   `-- validate.middleware.js
|   |-- models/
|   |   |-- analysis.model.js
|   |   |-- chat.model.js
|   |   |-- credential.model.js
|   |   |-- session.model.js
|   |   `-- user.model.js
|   |-- routes/
|   |   `-- v1/
|   |       |-- analyze.routes.js
|   |       |-- auth.routes.js
|   |       |-- chat.routes.js
|   |       |-- index.js
|   |       `-- user.routes.js
|   |-- schemas/
|   |   |-- analyze.schema.js
|   |   |-- auth.schema.js
|   |   |-- chat.schema.js
|   |   `-- user.schema.js
|   |-- services/
|   |   |-- analyze.service.js
|   |   |-- auth.service.js
|   |   |-- cache.service.js
|   |   |-- chat.service.js
|   |   |-- gemini.service.js
|   |   |-- groq.service.js
|   |   |-- llm.service.js
|   |   `-- user.service.js
|   `-- utils/
|       |-- geminiThrottle.util.js
|       |-- logger.util.js
|       |-- promptBuilder.util.js
|       |-- response.util.js
|       `-- responseMapper.util.js
|-- firestore.indexes.json
|-- firestore.rules
|-- package.json
|-- package-lock.json
|-- README.md
|-- render.yaml
`-- server.js

BizPulseAI_Frontend/
|-- dist/
|-- public/
|   |-- favicon.svg
|   `-- icons.svg
|-- src/
|   |-- api/
|   |   |-- ApiError.js
|   |   |-- analyze.api.js
|   |   |-- auth.api.js
|   |   |-- chat.api.js
|   |   `-- client.js
|   |-- assets/
|   |-- components/
|   |   |-- auth/AuthBrandPanel.jsx
|   |   |-- chat/MessageBubble.jsx
|   |   |-- chat/TypingIndicator.jsx
|   |   |-- common/AppLayout.jsx
|   |   |-- common/ErrorBoundary.jsx
|   |   |-- common/Loader.jsx
|   |   |-- common/ProtectedRoute.jsx
|   |   |-- dashboard/HeroWelcome.jsx
|   |   |-- dashboard/InsightCard.jsx
|   |   `-- upload/FileDropZone.jsx
|   |-- hooks/
|   |   |-- useAnalysisPoller.js
|   |   `-- useAuth.js
|   |-- lib/
|   |   `-- firebase.client.js
|   |-- pages/
|   |   |-- Chat.page.jsx
|   |   |-- Dashboard.page.jsx
|   |   |-- ForgotPassword.page.jsx
|   |   |-- History.page.jsx
|   |   |-- Login.page.jsx
|   |   |-- Register.page.jsx
|   |   |-- ResetPassword.page.jsx
|   |   `-- Upload.page.jsx
|   |-- store/
|   |   |-- analysis.store.js
|   |   `-- auth.store.js
|   |-- utils/
|   |   |-- fileParser.util.js
|   |   `-- logger.util.js
|   |-- App.jsx
|   |-- index.css
|   `-- main.jsx
|-- eslint.config.js
|-- index.html
|-- package.json
|-- package-lock.json
|-- README.md
`-- vite.config.js
```

## Backend Folders

| Folder | Purpose | Responsibilities | Relationships | Scalability Notes |
|---|---|---|---|---|
| `src/config` | Runtime configuration and external clients. | Validates env vars, initializes Firebase Admin, configures Gemini and Groq SDK clients. | Imported by middleware and services. | New providers or deployment config should be added here with validation in `env.config.js`. |
| `src/middleware` | Cross-cutting HTTP controls. | Request IDs, auth, CORS, errors, validation, sanitization, rate limits. | Mounted globally in `app.js` or per-route in route files. | Middleware is modular; new concerns like compression or audit logging can be inserted without changing controllers. |
| `src/routes/v1` | Versioned route declarations. | Maps URL paths to middleware and controllers. | Imports controllers, schemas, auth/rate-limit middleware. | Versioned structure supports future `/api/v2`. |
| `src/controllers` | HTTP translation layer. | Reads request fields, delegates to services, sends response envelopes. | Calls service modules and `sendSuccess`/`sendError`. | Thin controllers keep behavior testable in services. |
| `src/services` | Business logic and orchestration. | Auth workflows, analysis pipeline, chat, user profile, Firestore access wrapper, LLM routing. | Uses config, models, utilities, Firestore, AI SDKs. | This is the highest-change layer for product features. It would benefit from interface boundaries if persistence grows. |
| `src/models` | Firestore document factories. | Creates consistent document shapes for users, credentials, sessions, analyses, chat messages. | Used by services before Firestore writes. | Add schema versions here when documents evolve. |
| `src/schemas` | Request validation contracts. | Zod schemas for auth, analysis, chat, user preferences. | Used by `validate.middleware.js`. | Expanding endpoint validation is straightforward. Param schemas are not currently used for route params. |
| `src/utils` | Shared helpers. | Response envelopes, JSON logger, prompt building, insight mapping, Gemini throttle/cache. | Imported by services and middleware. | Pure utilities are easy to test; in-memory throttle should move to Redis for multi-instance deployment. |
| `__tests__` | Jest tests. | Unit tests around auth service, analysis service, prompt builder. | Uses Jest module mocks. | Some tests appear stale against current multi-sheet signatures; see improvement notes. |
| `docs` | Existing historical architecture docs. | Master documentation and canvas markdown diagrams. | Separate from generated root `docs/`. | Keep historical notes but update when architecture changes. |

## Backend Files

| File | Importance |
|---|---|
| `server.js` | Process entry point. Starts Express, logs startup, handles `SIGTERM`/`SIGINT`, and calls `db.terminate()` on shutdown. |
| `src/app.js` | Express application assembly: security headers, CORS, cookies, body parsing, sanitization, logging, rate limiters, health/status routes, v1 router, error handler. |
| `package.json` | Runtime scripts and dependencies. `dev` uses Node `--env-file .env` with nodemon. |
| `render.yaml` | Render web service definition with Singapore region, build/start commands, `/health` check, and env var declarations. |
| `firestore.rules` | Client-side Firestore access policy. Most writes are backend-only. |
| `firestore.indexes.json` | Composite index definitions for sessions, analyses, and messages collection groups. |

## Frontend Folders

| Folder | Purpose | Responsibilities | Relationships | Scalability Notes |
|---|---|---|---|---|
| `src/api` | API client layer. | Axios setup, request/response interceptors, endpoint wrappers, SSE fetch for chat stream, ApiError normalization. | Uses auth store for ID tokens and environment base URL. | Good boundary for adding retries, telemetry, or OpenAPI-generated clients. |
| `src/store` | Global state. | Auth state and current analysis/history cache. | Used by routes, layout, API interceptors, hooks. | Separate stores keep responsibilities clear; more domain stores can be added. |
| `src/hooks` | Cross-component behavior. | Firebase auth state listener and analysis polling. | Called from `App.jsx` and `Dashboard.page.jsx`. | Polling could evolve to WebSockets/SSE when backend supports job events. |
| `src/lib` | External client setup. | Firebase browser SDK config and auth helper exports. | Used by auth pages and layout sign-out. | Keep service SDK code here. |
| `src/pages` | Route-level screens. | Auth pages, dashboard, upload wizard, chat, history. | Mounted in `App.jsx`. | Some pages are large and could be split into subcomponents for maintainability. |
| `src/components` | Reusable UI. | Layout, loaders, protected route, auth panel, file drop zone, charts/insights, chat bubbles. | Imported by pages. | Components are domain-organized and can be expanded. |
| `src/utils` | Frontend helpers. | File parser and dev-only logger. | Used by upload and API/page logging. | Parser is a critical client-side data boundary. |
| `public` | Static public assets. | Favicon and icons. | Served by Vite. | Suitable for stable non-bundled assets. |
| `dist` | Build output. | Generated production bundle. | Not source. | Do not edit manually. |

## Frontend Files

| File | Importance |
|---|---|
| `src/main.jsx` | React root mount with `StrictMode`. |
| `src/App.jsx` | Browser router, public/protected routes, route-level error boundaries, root redirects. |
| `src/index.css` | Tailwind v4 import, theme tokens, base typography, animation utilities, reduced-motion behavior. |
| `vite.config.js` | Vite plugins for React and Tailwind. |
| `eslint.config.js` | Flat ESLint config; ignores `dist`. |
| `package.json` | Scripts and dependencies. |

## Generated And Configuration Files

- `package-lock.json` files lock dependency versions. They were not manually decoded line-by-line because the dependency source of truth for documentation is `package.json`, but they are important for reproducible installs.
- `BizPulseAI_Frontend/dist` is generated by `vite build`.
- No Dockerfile, Compose file, Next config, Webpack config, TypeScript config, or Prettier config is present.

```

## 3. 03-backend-architecture.md

```md
# Backend Architecture

## Backend Summary

The backend is an Express 5 application with layered structure:

```text
server.js -> src/app.js -> middleware -> routes -> controllers -> services -> models/utils/config -> Firestore/Auth/LLMs
```

The backend is the architectural center of the project. It owns:

- Environment validation and process startup.
- Firebase Admin initialization.
- Security middleware and response envelopes.
- Email/password registration and login.
- Firestore session validation.
- Dataset analysis orchestration.
- AI provider routing and fallback.
- Chat history and streaming chat persistence.
- User profile and account deletion.

## Server Initialization

`server.js` imports the Express app, validated `env`, Firestore `db`, and the JSON logger. It calls `app.listen(env.PORT)` and logs process metadata. Startup errors are caught and terminate the process with exit code `1`.

The same file handles `SIGTERM` and `SIGINT`. On shutdown it closes the HTTP server, calls `db.terminate()`, logs graceful shutdown, and exits.

```mermaid
sequenceDiagram
    participant Node as Node Process
    participant Server as server.js
    participant App as src/app.js
    participant Env as env.config.js
    participant DB as Firestore

    Node->>Server: node server.js
    Server->>Env: import validated env
    Server->>App: import configured Express app
    Server->>DB: import db
    Server->>App: app.listen(PORT)
    App-->>Server: HTTP server
    Server->>Server: log startup
    Node-->>Server: SIGTERM/SIGINT
    Server->>Server: server.close()
    Server->>DB: db.terminate()
    Server->>Node: process.exit()
```

## Application Assembly

`src/app.js` creates the Express app and mounts middleware in this order:

1. `requestIdMiddleware`
2. `helmet`
3. `corsMiddleware`
4. `cookieParser(env.SESSION_SECRET)`
5. `express.json({ limit: "50mb" })`
6. `express.urlencoded({ extended: false, limit: "50mb" })`
7. `sanitizeMiddleware`
8. `morgan`
9. `globalRateLimiter`
10. `/health`
11. `/api/v1/status` with `authMiddleware`
12. `/api/v1` router
13. `errorMiddleware`

```mermaid
flowchart LR
    REQ[Incoming request] --> RID[requestId]
    RID --> HELMET[Helmet headers]
    HELMET --> CORS[CORS allowlist]
    CORS --> COOKIES[Signed cookie parser]
    COOKIES --> BODY[JSON/urlencoded 50mb]
    BODY --> SAN[Sanitize body/query/params]
    SAN --> LOG[Morgan]
    LOG --> RL[Global rate limit]
    RL --> ROUTE[Health/status/v1 routes]
    ROUTE --> ERR[Error middleware]
```

## Configuration Loading

`src/config/env.config.js` uses Zod to validate required environment variables at import time. It normalizes escaped newlines in `FIREBASE_PRIVATE_KEY`, freezes the resulting config object, and exits the process if validation fails.

Validated variables:

- `PORT`, default `"8080"`.
- `NODE_ENV`, one of `development`, `production`, `test`.
- `FIREBASE_PROJECT_ID`.
- `FIREBASE_CLIENT_EMAIL`.
- `FIREBASE_PRIVATE_KEY`.
- `GEMINI_API_KEY`.
- `GROQ_API_KEY`, optional.
- `LLM_PRIMARY_PROVIDER`, default `groq`.
- `ALLOWED_ORIGINS`, comma-separated valid URLs.
- `JWT_AUDIENCE`.
- `SESSION_SECRET`, minimum 32 characters.

`JWT_AUDIENCE` is validated as required but is not used elsewhere in the current implementation. Firebase Admin token verification is delegated to `adminAuth.verifyIdToken(token, true)`.

## Firebase Initialization

`src/config/firebase.config.js` builds a service account from env vars and uses `getApps()` to avoid duplicate initialization. It exports:

- `adminApp`.
- `db`, a Firestore instance.
- `adminAuth`, a Firebase Admin Auth instance.

## Dependency Injection Pattern

There is no formal dependency injection container. Dependencies are imported directly as ES modules. Test files use `jest.unstable_mockModule` to replace imports. This keeps runtime simple but couples modules to concrete implementations. If the codebase grows, service factories or explicit interfaces would improve testability.

## Routes And Controllers

The v1 router mounts feature routers:

```mermaid
graph TD
    V1[src/routes/v1/index.js] --> AUTH[/auth]
    V1 --> ANALYZE[/analyze]
    V1 --> CHAT[/chat]
    V1 --> USER[/user]
    AUTH --> AuthController[auth.controller.js]
    ANALYZE --> AnalyzeController[analyze.controller.js]
    CHAT --> ChatController[chat.controller.js]
    USER --> UserController[user.controller.js]
```

Controllers are intentionally thin. They validate request-level preconditions, call service methods, and send standardized success/error responses.

## Middleware Pipeline

```mermaid
flowchart TD
    A[Request] --> B[requestIdMiddleware attaches req.requestId]
    B --> C[Helmet writes security headers]
    C --> D[corsMiddleware checks origin]
    D --> E[cookieParser verifies signed cookies]
    E --> F[Express parses JSON/urlencoded body]
    F --> G[sanitizeMiddleware trims strings and blocks dangerous keys/patterns]
    G --> H[Morgan logs HTTP request]
    H --> I[globalRateLimiter]
    I --> J[Route-specific auth/rate-limit/validation]
    J --> K[Controller]
    K --> L[Service]
    L --> M[sendSuccess or sendError]
    J --> N[errorMiddleware on thrown errors]
```

## Validation

`validate.middleware.js` exports `validateBody`, `validateQuery`, and `validateParams`. The current route files use `validateBody` for auth, analysis, chat, and preferences.

Request schemas:

- `auth.schema.js`: login, register, forgot password, reset password.
- `analyze.schema.js`: multi-sheet `sheets` payload or legacy `headers` + `rows`.
- `chat.schema.js`: `message` max 500 characters and UUID `analysisId`.
- `user.schema.js`: preferences fields.

Param validation helpers exist but route params such as `:analysisId` are not currently validated by `validateParams`.

## Error Handling

`error.middleware.js` logs unhandled errors and maps known cases:

- Invalid JSON body -> `400`.
- CORS policy violation -> `403`.
- Zod validation errors -> `422` with issue details.
- Expired Firebase token -> `401`.
- Unknown errors -> `500` with generic message.

Service-specific errors, such as `AuthServiceError`, are caught in controllers and mapped before reaching the global handler.

## Logging

- `logger.util.js` writes JSON lines to stdout.
- Debug logs are suppressed in production.
- Development logs are pretty-printed.
- `requestId` is passed by many service/controller logs to correlate events.
- `morgan` provides HTTP access logs.

The password reset email stub logs the plain reset token for development. This is explicitly a placeholder and must be replaced before production email delivery.

## Services

### `auth.service.js`

Responsibilities:

- Find user by normalized email.
- Register Firebase Auth user and Firestore user/credential/profile docs.
- Hash passwords with bcrypt salt rounds `12`.
- Generate Firebase email verification link.
- Generate custom tokens for frontend bridge login.
- Validate login password and lock accounts after 5 failed attempts for 15 minutes.
- Enforce single active session by invalidating existing sessions on new login.
- Store session docs in `authSessions`.
- Create and verify password reset tokens via SHA-256 hashes.
- Invalidate sessions after password reset.

### `analyze.service.js`

Responsibilities:

- Normalize legacy and multi-sheet payloads.
- Validate non-empty rows.
- Enforce anonymous demo limit of 100 total rows.
- Compute column stats: type, null count, unique count, numeric min/max/mean/stdDev, categorical top values.
- Skip columns with more than 50 percent null-like values.
- Compute data hashes.
- Check 24-hour insight cache.
- Generate insights through `llm.service.js`.
- Save `processing`, `completed`, or `failed` analysis documents.
- Increment profile analysis count.
- List, fetch, and delete analyses through `cache.service.js`.

### `chat.service.js`

Responsibilities:

- Fetch analysis context.
- Answer simple metadata questions without LLM calls.
- Cache repeat chat answers in memory for 5 minutes.
- Build compact multi-sheet chat context.
- Generate non-streaming or streaming LLM responses.
- Persist user and assistant messages with shared `turnId` and `turnIndex`.
- Update parent analysis `lastMessageAt` and `messageCount`.

### `llm.service.js`

Provider router:

- Uses Groq first when `LLM_PRIMARY_PROVIDER === "groq"` and `GROQ_API_KEY` is configured.
- Falls back to Gemini for recoverable Groq failures: not configured, rate limited, transient, invalid output.
- Reuses Gemini parsing and validation for structured insight output.

### `gemini.service.js`

Responsibilities:

- Generate structured JSON insights.
- Generate non-streaming chat replies.
- Generate streaming chat responses.
- Retry transient Gemini errors with backoff.
- Fail fast on local RPM gate errors for chat.
- Parse raw JSON defensively and validate against Zod schema.
- Sanitize chat replies that are accidentally JSON-wrapped.

### `groq.service.js`

Responsibilities:

- Convert Gemini-style string prompts into OpenAI-style chat completion messages.
- Generate raw JSON-mode insights.
- Generate raw chat text.
- Stream chat deltas.
- Normalize SDK errors into project error codes.

### `cache.service.js`

Despite its name, this is both Firestore persistence and insight-cache access:

- Save/update/get/delete analysis docs.
- Delete chat messages when deleting an analysis.
- List analyses ordered by `createdAt desc`.
- Save chat messages.
- Fetch chat history ordered by `createdAt asc`.
- Store and retrieve per-user `insightCache/{dataHash}` docs with 24-hour expiry.

### `user.service.js`

Responsibilities:

- Get root user document.
- Update root user preferences.
- Delete analysis messages, analysis docs, user doc, and Firebase Auth account.

Limitations: account deletion does not delete `userCredentials`, `authSessions`, `passwordResetTokens`, or `insightCache` documents in the current code.

## AI Pipeline

```mermaid
sequenceDiagram
    participant Controller as analyze.controller
    participant Service as analyze.service
    participant Cache as cache.service
    participant LLM as llm.service
    participant Groq as groq.service
    participant Gemini as gemini.service
    participant DB as Firestore

    Controller->>Service: enqueueAnalysis(uid, body)
    Service->>Service: normalize sheets and compute stats
    Service->>DB: save analysis status=processing
    Service-->>Controller: 202 processing payload
    Service->>Service: setImmediate processAnalysisJob
    Service->>Cache: getCachedInsights(uid, dataHash)
    alt cache hit
        Cache-->>Service: cached insights
    else cache miss
        Service->>LLM: generateInsights(sheetSummaries)
        alt Groq primary enabled
            LLM->>Groq: JSON-mode completion
            Groq-->>LLM: rawText
            LLM->>Gemini: parseAndValidateInsights(rawText)
        else fallback
            LLM->>Gemini: generateInsights
        end
        LLM-->>Service: validated output
        Service->>Cache: setCachedInsights
    end
    Service->>Service: mapInsightsToResponse
    Service->>DB: update analysis status=completed
```

## Application Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Booting
    Booting --> EnvValidated
    EnvValidated --> FirebaseInitialized
    FirebaseInitialized --> Listening
    Listening --> HandlingRequests
    HandlingRequests --> Listening
    Listening --> ShuttingDown: SIGTERM/SIGINT
    ShuttingDown --> FirestoreTerminated
    FirestoreTerminated --> [*]
    Booting --> Failed: env/startup error
    Failed --> [*]
```

```

## 4. 04-api-and-database.md

```md
# API And Database Documentation

## Response Envelope

Successful responses use `sendSuccess` from `src/utils/response.util.js`:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "uuid",
    "timestamp": "ISO-8601",
    "version": "1.0"
  }
}
```

Errors use `sendError` or `error.middleware.js`:

```json
{
  "success": false,
  "error": {
    "code": 401,
    "message": "Invalid or expired token"
  },
  "meta": {
    "requestId": "uuid",
    "timestamp": "ISO-8601"
  }
}
```

The frontend Axios client unwraps successful envelopes so page code receives `response.data.data` directly.

## Common Headers

Protected endpoints require:

| Header/Cookie | Required | Purpose |
|---|---:|---|
| `Authorization: Bearer <Firebase ID token>` | Yes | Verified by `auth.middleware.js`. |
| Signed `sessionId` cookie | Yes for backend email/password sessions | Validates active Firestore session. |
| `Content-Type: application/json` | For JSON bodies | Required by Express body parser. |
| `Accept: text/event-stream` | For chat stream | Used by frontend `fetch` stream client. |

Google OAuth users can pass auth with a valid Firebase token even without the backend `sessionId` cookie because `auth.middleware.js` allows `firebase.sign_in_provider === "google.com"` through.

## Endpoint Summary

| Method | Path | Auth | Rate Limit | Controller |
|---|---|---:|---|---|
| `GET` | `/health` | No | None | Inline in `app.js` |
| `GET` | `/api/v1/status` | Yes | Global | Inline in `app.js` |
| `POST` | `/api/v1/auth/register` | No | Auth limiter | `auth.controller.register` |
| `POST` | `/api/v1/auth/login` | No | Auth limiter | `auth.controller.login` |
| `POST` | `/api/v1/auth/logout` | Yes | Auth limiter + global | `auth.controller.logout` |
| `POST` | `/api/v1/auth/forgot-password` | No | Auth limiter | `auth.controller.forgotPassword` |
| `POST` | `/api/v1/auth/reset-password` | No | Auth limiter | `auth.controller.resetPassword` |
| `GET` | `/api/v1/analyze` | Yes | Global | `analyze.controller.listAnalyses` |
| `POST` | `/api/v1/analyze` | Yes | AI limiter | `analyze.controller.analyze` |
| `GET` | `/api/v1/analyze/:analysisId` | Yes | Global | `analyze.controller.getAnalysis` |
| `DELETE` | `/api/v1/analyze/:analysisId` | Yes | Global | `analyze.controller.deleteAnalysis` |
| `POST` | `/api/v1/chat` | Yes | Chat limiter | `chat.controller.chat` |
| `GET` | `/api/v1/chat/history/:analysisId` | Yes | Global | `chat.controller.getHistory` |
| `GET` | `/api/v1/chat/stream` | Yes | Chat limiter | `chat.controller.stream` |
| `GET` | `/api/v1/user/me` | Yes | Global | `user.controller.getProfile` |
| `POST` | `/api/v1/user/preferences` | Yes | Global | `user.controller.updatePreferences` |
| `DELETE` | `/api/v1/user/me` | Yes | Global | `user.controller.deleteAccount` |

## Auth Endpoints

### `POST /api/v1/auth/register`

Purpose: Create a Firebase Auth user, Firestore user document, credential document, profile subdocument, generate verification link, and return a Firebase custom token.

Request body:

```json
{
  "email": "user@example.com",
  "password": "Password123",
  "displayName": "Demo User"
}
```

Validation:

- `email`: valid email, lowercased and trimmed.
- `password`: 8-128 characters, at least one uppercase letter and one number.
- `displayName`: 2-100 characters, trimmed.

Response `201`:

```json
{
  "uid": "firebase-uid",
  "email": "user@example.com",
  "displayName": "Demo User",
  "firebaseCustomToken": "jwt"
}
```

Errors:

- `409 EMAIL_ALREADY_EXISTS`.
- `422` validation failure.
- `500` for Firebase/Firestore failures after rollback attempt.

Security considerations:

- Password is stored only as bcrypt hash in `userCredentials`.
- Backend returns a custom token so the frontend can establish Firebase client auth state immediately.
- Email verification link generation is attempted, but sending is a stub.

### `POST /api/v1/auth/login`

Purpose: Validate backend password credentials, create a Firestore session, set signed `sessionId` cookie, and return a Firebase custom token.

Request body:

```json
{
  "email": "user@example.com",
  "password": "Password123"
}
```

Optional header:

- `x-firebase-id-token`: included in session token hash if present; otherwise a random UUID is hashed.

Response `200` sets cookie:

```http
Set-Cookie: sessionId=<signed>; HttpOnly; SameSite=Strict; Max-Age=3600
```

Response data:

```json
{
  "uid": "firebase-uid",
  "email": "user@example.com",
  "displayName": "Demo User",
  "firebaseCustomToken": "jwt"
}
```

Errors:

- `401 INVALID_CREDENTIALS`.
- `403 ACCOUNT_INACTIVE`.
- `423 ACCOUNT_LOCKED`.
- `422` validation failure.

Business logic:

- Failed password increments `failedLoginCount`.
- Five failures locks the credential for 15 minutes.
- Successful login resets failure counters.
- New login invalidates prior active sessions.

### `POST /api/v1/auth/logout`

Purpose: Invalidate current session and clear cookie.

Auth: Firebase bearer token plus signed session cookie.

Response `200`:

```json
{ "message": "Logged out" }
```

Edge case: Google OAuth users use `sessionId: "google-oauth-session"` in `req.user`. Calling logout with that synthetic value is harmless because `invalidateSession` returns when no Firestore doc exists.

### `POST /api/v1/auth/forgot-password`

Purpose: Generate a 64-character reset token for existing accounts and store only its SHA-256 hash in Firestore.

Request:

```json
{ "email": "user@example.com" }
```

Response always returns `200`:

```json
{ "message": "If the account exists, a reset email has been sent." }
```

Security:

- Non-enumerating response.
- Plain token is logged by the current development stub. A real email provider is not implemented.

### `POST /api/v1/auth/reset-password`

Purpose: Hash a new password, update `userCredentials/{uid}`, delete reset token, and invalidate active sessions.

Request:

```json
{
  "token": "64-char-hex-token",
  "newPassword": "NewPassword123"
}
```

Validation:

- `token`: exactly 64 characters.
- `newPassword`: 8-128 characters.

Response:

```json
{ "message": "Password reset successful" }
```

Errors:

- `400 INVALID_TOKEN`.
- `400 EXPIRED_TOKEN`.
- `422` validation failure.

Current limitation: reset schema does not enforce uppercase/number complexity on `newPassword`, unlike registration.

## Analysis Endpoints

### `GET /api/v1/analyze`

Purpose: List authenticated user's analyses ordered by `createdAt desc`.

Response:

```json
[
  {
    "analysisId": "uuid",
    "datasetName": "sales",
    "status": "completed",
    "rowCount": 1200,
    "sheetCount": 2,
    "messageCount": 4
  }
]
```

Dependencies: `cache.service.getAllAnalyses`.

### `POST /api/v1/analyze`

Purpose: Submit parsed dataset for AI analysis.

Request body, preferred multi-sheet shape:

```json
{
  "datasetName": "sales",
  "sheets": [
    {
      "name": "Sheet1",
      "headers": ["region", "revenue"],
      "rows": [
        { "region": "APAC", "revenue": 1000 }
      ]
    }
  ]
}
```

Legacy shape:

```json
{
  "datasetName": "sales",
  "headers": ["region", "revenue"],
  "rows": [
    { "region": "APAC", "revenue": 1000 }
  ]
}
```

Validation:

- `datasetName`: 1-100 chars.
- `sheets`: 1-20 sheets.
- sheet `name`: 1-200 chars.
- headers: 1-100 strings, each 1-200 chars.
- rows: 1-50,000 per sheet.
- Must provide either `sheets` or both `headers` and `rows`.

Authenticated user response: `202`.

```json
{
  "analysisId": "uuid",
  "status": "processing",
  "datasetName": "sales",
  "rowCount": 1200,
  "sheetCount": 2,
  "sheets": [
    { "name": "Sheet1", "headers": ["region"], "rowCount": 1200 }
  ]
}
```

Anonymous user response: `201` with full analysis data, because there is no persisted job to poll.

Business logic:

- Computes stats server-side.
- Authenticated flow persists initial `processing` doc and starts background job via `setImmediate`.
- Background job updates doc to `completed` or `failed`.
- Anonymous flow is synchronous and limited to 100 total rows.

Performance considerations:

- Body parser allows 50 MB JSON.
- Sanitizer caps total string length at 25 million characters.
- Insight cache avoids repeat LLM calls for identical user/data hash within 24 hours.

### `GET /api/v1/analyze/:analysisId`

Purpose: Fetch one analysis document for the authenticated user.

Response `200`: Firestore analysis document. During async analysis it may have `status: "processing"`, empty `insights`, empty `chartData`, and no `completedAt`.

Errors:

- `404 Analysis not found`.

Security: The UID comes from `req.user.uid`, so users can only read their own subcollection path.

### `DELETE /api/v1/analyze/:analysisId`

Purpose: Delete one analysis and its `messages` subcollection.

Response: `204 No Content`.

Current behavior: deleting a nonexistent doc does not throw in Firestore. The endpoint can return `204` even if the analysis did not exist.

## Chat Endpoints

### `POST /api/v1/chat`

Purpose: Ask a non-streaming question about a saved analysis.

Request:

```json
{
  "analysisId": "uuid",
  "message": "Which region had the highest revenue?"
}
```

Validation:

- `analysisId`: UUID.
- `message`: 1-500 chars.

Response:

```json
{
  "reply": "The APAC region had the highest revenue...",
  "content": "The APAC region had the highest revenue...",
  "answer": "The APAC region had the highest revenue...",
  "messageId": "uuid",
  "turnId": "uuid",
  "role": "assistant",
  "timestamp": "ISO-8601"
}
```

Business logic:

- Fetches analysis.
- Answers metadata questions locally when possible.
- Uses in-memory Q&A cache for repeated questions.
- Calls LLM otherwise.
- Persists user and assistant messages.

### `GET /api/v1/chat/history/:analysisId`

Purpose: Return the last 50 normalized chat messages for an analysis.

Response:

```json
{
  "analysisId": "uuid",
  "history": [
    {
      "messageId": "uuid",
      "role": "user",
      "turnId": "uuid",
      "turnIndex": 0,
      "reply": "Question",
      "content": "Question",
      "createdAt": "ISO-8601"
    }
  ]
}
```

Current limitation: `analysisId` route param is not validated as UUID in this route.

### `GET /api/v1/chat/stream`

Purpose: Stream assistant response through Server-Sent Events.

Query params:

- `analysisId`.
- `message`.
- `authToken` is accepted by auth middleware, but frontend uses `Authorization` header through `fetch`.

Response headers:

```http
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

Frames:

```text
data: {"content":"partial text"}

data: [DONE]
```

Current validation: controller checks only that `analysisId` and `message` query params exist. It does not apply `chatBodySchema` to query params.

## User Endpoints

### `GET /api/v1/user/me`

Purpose: Fetch root user profile document.

Fallback: if the document does not exist, returns `{ uid, preferences: {} }`.

### `POST /api/v1/user/preferences`

Request:

```json
{
  "preferredChartType": "bar",
  "timezone": "UTC",
  "bio": "Analyst"
}
```

Validation:

- `preferredChartType`: `bar`, `line`, or `pie`.
- `timezone`: max 50 chars.
- `bio`: max 500 chars.

Current behavior: writes preferences into the root `users/{uid}` document with `updatedAt` as an ISO string, while model factories use Firestore server timestamps elsewhere.

### `DELETE /api/v1/user/me`

Purpose: Delete account data and Firebase Auth user.

Current deletion scope:

- Deletes chat messages under each analysis.
- Deletes analysis docs.
- Deletes root user doc.
- Deletes Firebase Auth user.

Not deleted in current code:

- `userCredentials/{uid}`.
- `authSessions` documents for the user.
- `passwordResetTokens`.
- `users/{uid}/insightCache`.
- `users/{uid}/profile/data` explicitly, unless root delete removes subcollections in the deployed Firestore behavior. Firestore document deletion does not automatically delete subcollections.

## Database Technology

The database is Firebase Firestore, accessed from the backend through Firebase Admin SDK. The frontend Firebase client can read a limited set of owner-owned documents based on Firestore rules, but most writes are backend-only.

## Firestore Collections And Documents

```mermaid
erDiagram
    USERS ||--|| USER_PROFILE : has
    USERS ||--o{ ANALYSES : owns
    USERS ||--o{ INSIGHT_CACHE : caches
    ANALYSES ||--o{ MESSAGES : contains
    USERS ||--|| USER_CREDENTIALS : authenticates
    USERS ||--o{ AUTH_SESSIONS : opens
    USERS ||--o{ PASSWORD_RESET_TOKENS : requests

    USERS {
        string uid
        string email
        string displayName
        string provider
        string accountStatus
        boolean isDeleted
        map preferences
        timestamp createdAt
        timestamp updatedAt
        timestamp lastLoginAt
        number schemaVersion
    }

    USER_CREDENTIALS {
        string userId
        string passwordHash
        number failedLoginCount
        timestamp lockedUntil
        timestamp lastPasswordChangeAt
        timestamp passwordExpiresAt
    }

    AUTH_SESSIONS {
        string sessionId
        string userId
        string idTokenHash
        map deviceInfo
        boolean isActive
        timestamp expiresAt
        timestamp lastActivityAt
    }

    ANALYSES {
        string analysisId
        string userId
        string datasetName
        array sheets
        number sheetCount
        array headers
        number rowCount
        map columnStats
        array insights
        map chartData
        map aiSummary
        string dataHash
        string status
        number messageCount
    }

    MESSAGES {
        string messageId
        string userId
        string analysisId
        string role
        string turnId
        number turnIndex
        string content
        timestamp createdAt
    }

    INSIGHT_CACHE {
        string dataHash
        map insights
        timestamp expiresAt
        number hitCount
    }
```

## Physical Firestore Paths

```text
authSessions/{sessionId}
userCredentials/{uid}
passwordResetTokens/{tokenHash}
users/{uid}
users/{uid}/profile/data
users/{uid}/analyses/{analysisId}
users/{uid}/analyses/{analysisId}/messages/{messageId}
users/{uid}/insightCache/{dataHash}
```

## Indexes

`firestore.indexes.json` defines composite indexes for:

- `authSessions`: `userId + isActive`, `userId + isActive + expiresAt`, `userId + createdAt desc`.
- `analyses` collection group: `isDeleted + createdAt desc`, `status + createdAt desc`.
- `messages` collection group: `isDeleted + createdAt asc`.

Some defined indexes target fields that the current implementation does not consistently write (`isDeleted` on analyses/messages). They may be reserved for planned soft-delete behavior.

## Query Patterns

- Find user by email: `users.where("email", "==", normalizedEmail).limit(1)`.
- Find active sessions: `authSessions.where("userId", "==", uid).where("isActive", "==", true)`.
- List analyses: `users/{uid}/analyses.orderBy("createdAt", "desc")`.
- Chat history: `users/{uid}/analyses/{analysisId}/messages.orderBy("createdAt", "asc")`.
- Cache lookup: `users/{uid}/insightCache/{dataHash}`.

## Database Performance And Scalability

Strengths:

- Per-user subcollections keep most reads scoped to one user's partition.
- Analysis list and chat history use ordered queries.
- Insight cache reduces LLM calls for repeated identical datasets.

Limitations:

- Deleting subcollections is done with simple loops/batches and is not paginated for very large histories.
- `getAllAnalyses` has no pagination.
- Chat history fetches the entire message subcollection and slices in memory to last 50 in `chat.service.js`.
- In-memory Q&A cache and Gemini RPM gate are process-local and will not coordinate across multiple backend instances.

```

## 5. 05-security-architecture.md

```md
# Security Architecture

## Security Model Summary

The project implements layered security:

- Firebase ID token verification on protected API routes.
- Backend-managed signed session cookies for email/password users.
- Firestore session documents with active/expired checks.
- Email verification requirement.
- Firestore rules that prevent client writes to sensitive backend-owned data.
- Password hashing with bcrypt.
- Account lockout on repeated password failures.
- Strict request validation with Zod.
- Sanitization against dangerous object keys, null bytes, and one SQL-like pattern.
- CORS allowlist with credentials support.
- Helmet security headers.
- Tiered rate limiting.
- Structured error responses with generic production-safe messages.

## Authentication Flow

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant BE as Backend
    participant FA as Firebase Auth
    participant FS as Firestore

    FE->>BE: POST /auth/login { email, password }
    BE->>FS: find users by email
    BE->>FS: read userCredentials/{uid}
    BE->>BE: bcrypt.compare(password, hash)
    BE->>FS: invalidate active sessions
    BE->>FS: create authSessions/{sessionId}
    BE->>FA: createCustomToken(uid)
    BE-->>FE: Set signed httpOnly sessionId cookie + firebaseCustomToken
    FE->>FA: signInWithCustomToken
    FA-->>FE: Firebase user + ID token
    FE->>BE: Protected request with Bearer ID token + signed cookie
    BE->>FA: verifyIdToken(token, true)
    BE->>FS: validate authSessions/{sessionId}
    BE-->>FE: Protected response
```

## Authorization Flow

```mermaid
flowchart TD
    REQ[Protected request] --> TOKEN{Bearer token present?}
    TOKEN -->|No| QTOKEN{authToken query param?}
    TOKEN -->|Yes| VERIFY[Firebase Admin verifyIdToken with revocation check]
    QTOKEN -->|Yes| VERIFY
    QTOKEN -->|No| E401[401 malformed/missing auth]
    VERIFY --> EMAIL{email_verified true?}
    EMAIL -->|No| E403[403 Email not verified]
    EMAIL -->|Yes| COOKIE{signed sessionId cookie?}
    COOKIE -->|No| GOOGLE{provider google.com?}
    GOOGLE -->|Yes| ALLOW_GOOGLE[Allow Firebase-token-only Google OAuth request]
    GOOGLE -->|No| E401C[401 session cookie missing]
    COOKIE -->|Yes| SESSION[Read authSessions/sessionId]
    SESSION --> VALID{userId matches, active, expiresAt future?}
    VALID -->|No| E401S[401 invalid/expired session]
    VALID -->|Yes| ALLOW[req.user set; next]
```

Authorization is ownership-based rather than role-based. There are no admin roles or role-based access control rules in the current code. Every data operation scopes Firestore paths by `req.user.uid`.

## JWT Handling

`auth.middleware.js` expects a Firebase ID token in `Authorization: Bearer ...` or, for stream compatibility, `authToken` query param. It calls `adminAuth.verifyIdToken(token, true)`, which validates token signature and checks revocation.

The code validates `JWT_AUDIENCE` as an environment variable but does not explicitly use it in token verification.

## Session Handling

Email/password login creates a Firestore document in `authSessions/{sessionId}` and sets a signed cookie:

- `httpOnly: true`
- `secure: true` only in production
- `sameSite: "strict"`
- `maxAge: 1 hour`
- `signed: true`

Session validation checks:

- Firestore session doc exists.
- `sessionData.userId === firebaseUser.uid`.
- `isActive === true`.
- `expiresAt` exists.
- `expiresAt` is in the future.

The middleware implements a sliding session window. If the session is older than 30 minutes, it extends expiry by 1 hour and reissues the cookie.

Limitation: age is calculated from `createdAt`, not `lastActivityAt`, so after the first 30 minutes every request refreshes the session rather than refreshing only after 30 minutes since last refresh.

## Password Storage And Lockout

`auth.service.js` hashes passwords with bcryptjs at 12 salt rounds. It stores hashes in `userCredentials/{uid}`.

Failed login policy:

- Failed passwords increment `failedLoginCount`.
- After 5 failures, `lockedUntil` is set 15 minutes into the future.
- Successful login resets failed count and lock.

Password reset:

- Generates 32 random bytes as 64 hex chars.
- Stores only SHA-256 token hash.
- Token expires after 1 hour.
- Resets password hash, deletes reset token, invalidates sessions.

Production issue: the email provider is a stub and logs reset tokens. Replace this before production use.

## Input Validation

Zod schemas validate:

- Registration, login, forgot-password, reset-password bodies.
- Analysis dataset name, sheet arrays, headers, rows.
- Chat message and analysis ID for `POST /chat`.
- User preferences.

Missing validation:

- `GET /chat/stream` query params are checked for presence but not Zod-validated.
- Route params such as `:analysisId` are not currently validated.
- Reset password complexity is weaker than registration complexity.

## Sanitization

`sanitize.middleware.js` recursively sanitizes body, query, and params:

- Removes object keys `__proto__`, `constructor`, and `prototype`.
- Trims strings.
- Removes null bytes.
- Blocks strings matching `/['"\\;].*--/`.
- Tracks total string length and rejects payloads over 25,000,000 characters with `413`.

Attacks addressed:

- Prototype pollution.
- Null byte injection.
- Some SQL comment-style injection payloads.
- Oversized string payloads.

Limitations:

- Firestore is not SQL, so SQL injection protection is mostly defensive rather than central.
- The SQL pattern is narrow and should not be treated as comprehensive injection prevention.
- Sanitization cannot replace schema validation and safe database APIs.

## CORS

`cors.middleware.js` builds `allowedOrigins` from `ALLOWED_ORIGINS` and appends localhost Vite dev/preview origins in development.

Settings:

- Methods: `GET`, `POST`, `DELETE`, `OPTIONS`.
- Headers: `Content-Type`, `Authorization`.
- Credentials: `true`.
- Preflight cache max age: 86400 seconds.

Security benefit: cross-origin credentialed API use is restricted to known frontend origins.

## Helmet And Security Headers

Helmet configuration in `app.js` includes:

- Content Security Policy.
- `crossOriginEmbedderPolicy: true`.
- `crossOriginOpenerPolicy: same-origin`.
- `referrerPolicy: no-referrer`.
- HSTS in production for one year with subdomains.
- `X-Frame-Options: DENY`.
- `X-Content-Type-Options`.

The API primarily returns JSON, so frontend CSP enforcement for browser-rendered pages depends on the frontend hosting configuration as well.

## Rate Limiting

`rateLimit.middleware.js` defines:

| Limiter | Window | Max | Key | Used By |
|---|---:|---:|---|---|
| Global | 15 minutes | 200 | IP | All routes after middleware mount. |
| Auth | 15 minutes | 20 | IP | All `/auth` routes. |
| AI | 1 minute | 10 | `req.user.uid` or IP | `POST /analyze`. |
| Chat | 1 minute | 5 | `req.user.uid` or IP | `/chat` POST and stream. |

Security benefit: reduces brute force, high-cost AI abuse, and request flooding.

Limitation: express-rate-limit default store is process-local. Multi-instance deployments need shared storage.

## Firestore Rules

`firestore.rules`:

- Denies all client reads/writes to `authSessions` and `userCredentials`.
- Allows verified owner reads of root `users/{userId}`.
- Denies root user writes.
- Allows constrained owner update of `users/{uid}/profile/data`.
- Allows verified owner reads of analyses and messages.
- Denies client writes to analyses, messages, and insight cache.

This complements the backend API by ensuring a malicious client cannot write analysis or credential documents directly through Firebase Client SDK.

## API Protection

Protected routes use `authMiddleware`, then service methods use `req.user.uid` as the Firestore path root. This prevents cross-user access even if a user guesses another `analysisId`, because reads go to `users/{currentUid}/analyses/{analysisId}`.

## XSS And CSRF Considerations

XSS:

- React escapes text by default.
- Chat assistant responses render Markdown through `react-markdown`; raw HTML is not enabled in the inspected code.
- Helmet sets API CSP headers, but SPA HTML security headers are controlled by frontend hosting.

CSRF:

- Cookies use `SameSite=Strict`.
- Protected routes also require a valid Firebase bearer token, which third-party sites cannot normally attach.
- No explicit CSRF token is implemented. Given the bearer-token requirement and strict same-site cookie, risk is reduced.

## Replay Attack Considerations

- Firebase token verification includes revocation checks.
- Sessions have expiry and active flags.
- Password reset tokens are single-use because reset deletes the token doc.
- There is no nonce or request signing for ordinary API requests.

## DOS Protection

Implemented:

- Global request rate limit.
- AI/chat rate limits.
- Body parser 50 MB limit.
- Sanitizer total string cap.
- Frontend upload file size max 5 MB.
- Gemini local RPM gate at 12 RPM.

Limitations:

- No distributed rate-limit store.
- No queue worker isolation for analysis jobs.
- Fire-and-forget analysis jobs run in the same process as HTTP handling.

## Error Exposure

The global error middleware returns generic `Internal server error` for unknown failures. Stack traces are logged only in development for global unhandled errors.

Auth service errors expose controlled codes/messages. Validation errors return field issue details, which is useful for clients but should be monitored to ensure no sensitive internals appear.

## File Upload Security

The frontend validates file extension and 5 MB size in `FileDropZone.jsx`. Files are parsed in-browser and sent as JSON; the backend does not receive multipart uploads or store raw files.

Supported extensions:

- `.csv`
- `.xlsx`
- `.xls`

Limitations:

- Frontend file checks can be bypassed by direct API calls; backend relies on JSON schema/size/sanitization rather than file MIME checks.
- Large parsed JSON can still be expensive within allowed limits.

## Dependency Security

No automated dependency audit configuration is present in the repository. `package-lock.json` exists for both apps, enabling reproducible installs. Recommended production workflow should include `npm audit`, Dependabot/Renovate, and CI gating for critical vulnerabilities.

## Production Hardening Checklist

Implemented:

- Fail-fast environment validation.
- Secure cookies in production.
- HSTS in production.
- CORS allowlist.
- Firebase token revocation checks.
- Password hashing.
- Lockout.
- Rate limiting.
- Firestore rules.

Needs improvement:

- Replace password reset logging stub with real email provider.
- Delete all user-related documents on account deletion.
- Add shared rate-limit/cache store for scaling.
- Validate route params and streaming query params.
- Add production frontend security headers.
- Add dependency scanning.
- Add audit logging policy for security-sensitive events.
- Consider disabling token-in-query auth or limiting it to SSE-only with short-lived stream tokens.

```

## 6. 06-frontend-architecture.md

```md
# Frontend Architecture

## Frontend Summary

The frontend is a React 19 single-page application built with Vite. It handles authentication UI, Firebase browser auth state, file parsing, API calls, dashboard rendering, analysis history, and streaming chat.

## Application Entry And Routing

`src/main.jsx` mounts `<App />` into `#root` inside React `StrictMode`.

`src/App.jsx` defines:

- Root redirect from `/` to `/dashboard` or `/login`.
- Public-only routes: `/login`, `/register`, `/forgot-password`.
- Reset route: `/reset-password`.
- Protected routes under `ProtectedRoute` and `AppLayout`: `/dashboard`, `/upload`, `/history`, `/chat`.
- Route-level `ErrorBoundary` wrappers.
- `NotFoundPage`.

```mermaid
graph TD
    APP[App.jsx] --> USEAUTH[useAuth]
    APP --> ROUTER[BrowserRouter]
    ROUTER --> ROOT[/]
    ROUTER --> PUBLIC[PublicOnlyRoute]
    PUBLIC --> LOGIN[/login]
    PUBLIC --> REGISTER[/register]
    PUBLIC --> FORGOT[/forgot-password]
    ROUTER --> RESET[/reset-password]
    ROUTER --> PROTECTED[ProtectedRoute]
    PROTECTED --> LAYOUT[AppLayout]
    LAYOUT --> DASH[/dashboard]
    LAYOUT --> UPLOAD[/upload]
    LAYOUT --> HISTORY[/history]
    LAYOUT --> CHAT[/chat]
```

## Authentication State

`src/hooks/useAuth.js` registers `onAuthStateChanged(auth, callback)` once from `App.jsx`. It:

- Reads the Firebase ID token when a user is present.
- Updates `auth.store`.
- Clears analysis state/history on sign-out.
- Clears analysis state/history on UID change to prevent data leakage between accounts.

`src/store/auth.store.js` holds:

- `user`
- `idToken`
- `isLoading`
- `setUser`
- `clearUser`
- `getIdToken`
- selectors such as `selectAuthStatus`

`getIdToken` refreshes through Firebase user methods and clears the user after repeated token failure.

## Firebase Client

`src/lib/firebase.client.js` initializes Firebase from Vite env vars:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

It exports:

- `auth`
- `signInWithGoogle`
- `signInWithEmail`
- `signInWithToken`
- `registerWithEmail`
- `signOut`

The app sets Firebase persistence to `browserSessionPersistence`, so browser auth state is session-only.

## API Integration

`src/api/client.js` creates an Axios instance:

- `baseURL: import.meta.env.VITE_API_BASE_URL`
- `timeout: 15000`
- `withCredentials: true`

Request interceptor:

- Calls `auth.store.getIdToken()`.
- Adds `Authorization: Bearer <token>` when available.
- Logs request metadata in development.

Response interceptor:

- Logs responses.
- Unwraps backend envelope `{ success, data, meta }`.
- Converts errors into `ApiError`.
- On `401`, retries once after token refresh; if refresh fails, clears user and redirects to `/login`.

```mermaid
sequenceDiagram
    participant Page as Page/API wrapper
    participant Axios as apiClient
    participant Store as auth.store
    participant BE as Backend

    Page->>Axios: apiClient request
    Axios->>Store: getIdToken()
    Store-->>Axios: token or null
    Axios->>BE: HTTP request with Authorization and credentials
    BE-->>Axios: envelope response
    Axios->>Axios: unwrap data or normalize error
    Axios-->>Page: plain data or ApiError
```

## API Modules

| Module | Responsibilities |
|---|---|
| `auth.api.js` | Login, register, logout, forgot password, reset password. |
| `analyze.api.js` | Submit analysis, get analysis, list analyses, delete analysis. |
| `chat.api.js` | Non-streaming chat, history fetch, SSE streaming chat through `fetch`. |
| `ApiError.js` | Uniform client error class and conversion helper. |

## State Management

### Auth Store

Authentication store is not persisted. It mirrors Firebase session state and token state.

### Analysis Store

`src/store/analysis.store.js` uses Zustand with `persist`, `createJSONStorage`, `sessionStorage`, and `immer`.

It stores:

- Current analysis fields: `analysisId`, `datasetName`, `rowCount`, `headers`, `insights`, `chartData`, `aiSummary`, `createdAt`, `status`.
- History cache: `historyList`, `historyFetchedAt`.

Actions:

- `setAnalysis`
- `clearAnalysis`
- `setHistory`
- `removeFromHistory`
- `invalidateHistory`
- `clearHistory`

The store is cleared on sign-out and account switch by `useAuth`.

## Protected Routes

`ProtectedRoute.jsx` reads `selectAuthStatus`:

- `loading`: renders full-screen restoring-session spinner.
- not authed: redirects to `/login`.
- authed: renders `<Outlet />`.

`PublicOnlyRoute` in `App.jsx` prevents authenticated users from visiting login/register/forgot password pages.

## Page Architecture

### Login Page

Supports:

- Google popup sign-in via Firebase client.
- Email/password login through backend `/auth/login`.
- Custom token bridge via `signInWithToken(firebaseCustomToken)`.
- User-friendly lockout errors.

### Register Page

Supports:

- Google sign-up.
- Backend `/auth/register` email/password registration.
- Immediate Firebase client sign-in with custom token.

Frontend validation is less strict than backend validation: it checks password length and confirmation, while the backend also requires uppercase and number.

### Forgot Password Page

Calls backend forgot-password endpoint and always shows non-enumerating success copy when the request succeeds.

### Reset Password Page

Reads `token` query param, validates 64 hex characters client-side, submits `token` and `newPassword` to backend, and redirects user to login after success.

### Upload Page

Three-step wizard:

1. Upload file through `FileDropZone`.
2. Parse and preview first 10 rows.
3. Submit for analysis.

It sends:

```js
{
  datasetName: file.name without extension,
  sheets: parsedData.sheets,
  rows: parsedData.rows,
  headers: parsedData.headers
}
```

The legacy `rows` and `headers` fields are included for backward compatibility.

After submit:

- `setAnalysis(result)`.
- `invalidateHistory()`.
- Navigate to `/dashboard`.

### Dashboard Page

Dashboard reads current analysis from `analysis.store`. If none exists, it renders `HeroWelcome`.

If an analysis exists, it renders:

- Analysis context bar and switch dataset dropdown.
- Summary cards.
- Processing banner while `status === "processing"`.
- Column statistics chart from `chartData.barStats`.
- LLM-generated charts from `chartData.charts`.
- Optional time-series chart if `chartData.timeSeries` exists.
- Insight cards.
- Recommended actions.

It uses `useAnalysisPoller` to fetch `GET /analyze/:analysisId` every 4 seconds while processing, stopping after 30 attempts.

### History Page

History cache is considered fresh for 5 minutes.

Behavior:

- If no cache and stale: show page loader.
- If cache exists and stale: render stale cache and background refresh.
- Group analyses by `dataHash`.
- Each card supports Chat, Dashboard, and Delete actions.
- Delete optimistically removes from cache and clears current analysis if it was deleted.

### Chat Page

Features:

- Loads persisted history on mount.
- Adds optimistic user and assistant placeholder messages.
- Streams chat from `/chat/stream` with `fetch`.
- Falls back to `POST /chat` if streaming fails.
- Allows aborting an active stream.
- Renders assistant Markdown with `react-markdown` and `remark-gfm`.
- Enforces 500-character input limit on the client.

```mermaid
sequenceDiagram
    participant User
    participant ChatPage
    participant API as chat.api
    participant Backend

    User->>ChatPage: Enter message
    ChatPage->>ChatPage: Add user bubble + streaming placeholder
    ChatPage->>API: streamChatMessage
    API->>Backend: GET /chat/stream with token and cookie
    Backend-->>API: SSE content frames
    API-->>ChatPage: onToken(delta)
    ChatPage->>ChatPage: Append delta
    Backend-->>API: [DONE]
    API-->>ChatPage: full text
    ChatPage->>ChatPage: Finalize assistant bubble
```

## Component Relationships

```mermaid
graph TD
    App --> ProtectedRoute
    ProtectedRoute --> AppLayout
    AppLayout --> DashboardPage
    AppLayout --> UploadPage
    AppLayout --> HistoryPage
    AppLayout --> ChatPage
    LoginPage --> AuthBrandPanel
    RegisterPage --> AuthBrandPanel
    ForgotPasswordPage --> AuthBrandPanel
    ResetPasswordPage --> AuthBrandPanel
    UploadPage --> FileDropZone
    UploadPage --> Loader
    DashboardPage --> HeroWelcome
    DashboardPage --> InsightCard
    DashboardPage --> Loader
    ChatPage --> MessageBubble
    ChatPage --> TypingIndicator
```

## File Parser

`src/utils/fileParser.util.js`:

- CSV: Papa Parse with `header: true`, `skipEmptyLines: true`, `dynamicTyping: true`.
- Excel: FileReader + SheetJS `XLSX.read`, then `sheet_to_json` for each worksheet.
- Cleanup removes fully empty columns, removes rows with more than 80 percent nulls, trims strings, and converts missing values to `null`.
- Returns `{ sheets, rows, headers }`, where `rows` and `headers` represent the first non-empty sheet.

```mermaid
flowchart TD
    File[Uploaded File] --> Ext{Extension}
    Ext -->|csv| Papa[Papa.parse]
    Ext -->|xlsx/xls| XLSX[XLSX.read]
    Papa --> Clean[cleanRows]
    XLSX --> Sheets[Parse each worksheet]
    Sheets --> Clean
    Clean --> Output[{ sheets, rows, headers }]
```

## Build Process

Frontend scripts:

- `npm run dev`: Vite dev server.
- `npm run build`: Vite production build into `dist`.
- `npm run lint`: ESLint.
- `npm run preview`: Preview built app.

The app has no explicit test script in the frontend package.

## Rendering Strategy

The frontend is a client-rendered SPA. There is no SSR, Next.js, or server component system. Auth state is restored client-side through Firebase.

## Performance Optimizations

Implemented:

- Client-side file parsing avoids raw file upload storage.
- Session storage persistence avoids re-fetching current analysis on navigation.
- History cache has 5-minute freshness window.
- Dashboard poller stops after bounded attempts.
- Recharts render from compact chart data, not full raw datasets.
- File size is limited to 5 MB.
- Dev logger compiles to no-ops in production builds through `import.meta.env.DEV`.

Potential improvements:

- Split very large page components.
- Use virtualization for large history lists.
- Add abort control for analysis polling requests.
- Add route-level code splitting.
- Add frontend automated tests.

```

## 7. 07-features-ai-performance.md

```md
# Features, AI, Request Lifecycle, Performance, And Deployment

## Implemented Features

| Feature | Backend Implementation | Frontend Implementation | Database Involvement |
|---|---|---|---|
| Email/password registration | `auth.service.registerUser`, `auth.controller.register` | `Register.page.jsx`, `auth.api.registerUser`, `signInWithToken` | `users`, `userCredentials`, `users/{uid}/profile/data`, Firebase Auth |
| Email/password login | `auth.service.loginUser`, sessions | `Login.page.jsx`, `auth.api.loginWithEmailPassword` | `authSessions`, `userCredentials`, `users` |
| Google sign-in | `auth.middleware` allows Google provider without session cookie | `signInWithGoogle` on login/register pages | Firebase Auth |
| Password reset | `forgotPassword`, `resetPassword` | Forgot/reset password pages | `passwordResetTokens`, `userCredentials`, `authSessions` |
| Protected API access | `auth.middleware` | Axios interceptor attaches Firebase ID token and cookies | `authSessions` |
| File upload and parsing | Backend receives parsed JSON | `FileDropZone`, `fileParser.util.js`, `Upload.page.jsx` | None before submit |
| Multi-sheet analysis | `analyze.schema`, `analyze.service.normalizeSheets` | XLSX parser returns all sheets | `users/{uid}/analyses` |
| Async analysis jobs | `enqueueAnalysis`, `processAnalysisJob` | `useAnalysisPoller` | `analyses/{analysisId}` status updates |
| AI insights | `llm.service`, `groq.service`, `gemini.service`, `responseMapper` | Dashboard insight cards and charts | `analyses`, `insightCache` |
| History | `GET /analyze`, `cache.service.getAllAnalyses` | `History.page.jsx`, cached in Zustand | `analyses` |
| Chat | `chat.service.sendMessage` | `Chat.page.jsx` | `messages`, parent analysis activity fields |
| Streaming chat | `chat.controller.stream`, `chat.service.streamMessage` | `streamChatMessage` using `fetch` | `messages` after stream completes |
| Analysis deletion | `cache.service.deleteAnalysis` | History delete flow | Deletes analysis doc and messages |
| User preferences | `user.service.updatePreferences` | API wrapper exists indirectly through backend route; no dedicated inspected page uses it | `users/{uid}` |
| Account deletion | `user.service.deleteAccount` | API route exists; no inspected frontend page calls it | Deletes some user data and Firebase Auth user |

## Request Lifecycle

```mermaid
sequenceDiagram
    participant Browser
    participant FE as React Frontend
    participant API as API Client
    participant MW as Express Middleware
    participant Auth as Auth Middleware
    participant Ctrl as Controller
    participant Svc as Service
    participant DB as Firestore
    participant LLM as LLM Provider

    Browser->>FE: User action
    FE->>API: Call endpoint wrapper
    API->>API: Get Firebase ID token
    API->>MW: HTTP request + Authorization + credentials
    MW->>MW: requestId, headers, CORS, body parse, sanitize, rate limit
    MW->>Auth: Protected route auth
    Auth->>Auth: verify Firebase ID token
    Auth->>DB: validate session when required
    Auth->>Ctrl: next()
    Ctrl->>Svc: service call
    Svc->>DB: read/write documents
    opt AI endpoint
        Svc->>LLM: generate insights or chat
        LLM-->>Svc: response
    end
    Svc-->>Ctrl: result
    Ctrl-->>API: success/error envelope
    API-->>FE: unwrapped data or ApiError
    FE-->>Browser: Render state
```

## API Lifecycle For Async Analysis

```mermaid
sequenceDiagram
    participant FE as Upload/Dashboard
    participant API as Express API
    participant AS as analyze.service
    participant FS as Firestore
    participant LLM as LLM

    FE->>API: POST /api/v1/analyze
    API->>AS: enqueueAnalysis
    AS->>AS: compute sheet summaries and dataHash
    AS->>FS: save status=processing document
    AS-->>API: pending payload
    API-->>FE: 202 processing
    FE->>FE: setAnalysis + navigate dashboard
    FE->>API: GET /api/v1/analyze/:id every 4s
    AS->>LLM: background generate insights
    LLM-->>AS: validated output
    AS->>FS: update status=completed
    API-->>FE: completed document on next poll
    FE->>FE: render charts and insights
```

## Data Flow

```mermaid
flowchart TD
    File[CSV/XLS/XLSX] --> Parser[Frontend parser]
    Parser --> Sheets[{ sheets, rows, headers }]
    Sheets --> AnalyzeAPI[POST /analyze]
    AnalyzeAPI --> Stats[Backend stats builder]
    Stats --> Prompt[Prompt builder]
    Prompt --> Provider[Groq or Gemini]
    Provider --> Validate[JSON parse + Zod validation]
    Validate --> Mapper[Response mapper]
    Mapper --> Firestore[Analysis document]
    Firestore --> Dashboard[Charts/Insights]
    Firestore --> ChatContext[Chat context builder]
    ChatContext --> ChatLLM[Chat LLM]
    ChatLLM --> Messages[Messages subcollection]
```

## AI Components

### LLM Integration

Implemented providers:

- Groq SDK with model `meta-llama/llama-4-scout-17b-16e-instruct`.
- Google Generative AI SDK with `gemini-2.5-flash`.

Provider routing:

- `llm.service.js` uses Groq first when configured and primary.
- Gemini is fallback for recoverable Groq errors.
- If Groq is disabled, Gemini is used directly.

### Prompt Construction

Analysis prompts are built by `buildAnalysisPrompt` in `promptBuilder.util.js`. The prompt includes:

- System instruction requiring valid JSON only.
- Dataset name.
- Sheet count.
- Per-sheet row count, column count, computed column stats, and sample rows.
- Required output schema.
- Instruction to generate exactly 5 insights.
- Enum constraints for severity and type.
- Sheet-name/header correctness instructions.

Chat prompts are built by `buildChatPrompt` in `gemini.service.js`. They include:

- Senior analytics assistant persona.
- Response rules for concise Markdown.
- Multi-sheet instructions when applicable.
- Compressed dataset context.
- Last 5 conversation messages.
- User question.

### Embeddings, Vector DB, RAG

Not present. The repository does not implement embeddings, vector search, hybrid retrieval, RAG citations, or citation generation. Chat context is built directly from persisted analysis summaries and recent messages.

### Context Building

`chat.service.buildChatContext` prefers multi-sheet context:

- Dataset name.
- Sheet count.
- Total row count.
- For each sheet: name, row count, column count, column stats, up to 5 sample rows.

`gemini.service.compressChatContext` trims sample rows to 3 in the prompt.

### Fallback Logic

Recoverable Groq failures fall back to Gemini:

- `GROQ_NOT_CONFIGURED`
- `GROQ_RATE_LIMITED`
- `GROQ_TRANSIENT`
- `LLM_INVALID_OUTPUT`

Gemini itself retries transient and rate-limited errors with controlled behavior. Chat rate limits fail fast rather than waiting long cooldowns.

### Caching

- Per-user Firestore insight cache: `users/{uid}/insightCache/{dataHash}`, 24-hour TTL.
- Process-local chat Q&A cache: 5-minute TTL, max 500 entries.
- Process-local Gemini RPM gate: caps at 12 calls/minute.

### Token Optimization

Implemented:

- Analysis sends summaries and sample rows rather than full raw data.
- Chat compresses context and keeps recent history to last 5 messages.
- Groq insights max tokens reduced to 4096.
- Chat responses capped to 2048 output tokens.

### Evaluation Strategy

No formal LLM evaluation suite is present. Existing tests cover some prompt and service behavior but not output quality, regression scoring, hallucination rate, or provider fallback in integration.

## Feature Workflows

### Upload And Analysis

Problem solved: turn uploaded spreadsheets into actionable insights.

Backend:

- Validates dataset shape.
- Computes deterministic stats.
- Uses cache/LLM.
- Persists status transitions.

Frontend:

- Validates file extension/size.
- Parses client-side.
- Shows preview.
- Submits and polls.

Security:

- Protected route.
- Body validation and sanitization.
- Rate limited.
- Anonymous row cap.

Limitations:

- No server-side file scanning because files are not uploaded as files.
- No queue system for background jobs.
- No pagination for very large history.

### Chat With Data

Problem solved: natural-language follow-up on a dataset.

Backend:

- Builds context from analysis.
- Uses metadata fast path.
- Streams provider output.
- Persists turns.

Frontend:

- Restores history.
- Streams token deltas.
- Renders Markdown.
- Falls back to non-streaming POST.

Security:

- Auth protected.
- Chat body validation on POST.
- Chat limiter.

Limitations:

- Streaming query validation is minimal.
- Prompt context is not backed by retrieval over raw rows.

### History

Problem solved: return to previous analyses and conversations.

Backend:

- Lists Firestore analysis docs.
- Deletes analysis and messages.

Frontend:

- Caches history for 5 minutes.
- Groups by `dataHash`.
- Optimistically removes deleted entries.

Limitations:

- No pagination.
- Hash is based on sheet names, headers, and row counts, not full content.

## Performance Architecture

Implemented techniques:

- Client-side file parsing.
- Body size limits.
- Sanitizer total string cap.
- Async analysis for authenticated users.
- Analysis polling instead of long request wait.
- Firestore insight cache.
- Chat metadata fast path.
- In-memory chat answer cache.
- Gemini local RPM gate.
- Frontend history cache.
- Session storage for current analysis.

Not implemented:

- Redis or distributed cache.
- Worker queue.
- Horizontal rate-limit coordination.
- Response compression middleware.
- Cursor pagination.
- Batch processing queue.
- Raw-row aggregation for time-series charts.

## Deployment Architecture

```mermaid
flowchart TD
    User[Browser] --> FrontendHost[Frontend static host, not defined in repo]
    FrontendHost --> User
    User --> Render[Render Web Service: bizpulse-backend]
    Render --> FirebaseAuth[Firebase Auth]
    Render --> Firestore[Firestore]
    Render --> Groq[Groq API]
    Render --> Gemini[Gemini API]
```

`render.yaml` defines the backend service:

- Type: web.
- Runtime: Node.
- Region: Singapore.
- Plan: free.
- Build command: `npm install`.
- Start command: `node server.js`.
- Health check: `/health`.

The repository does not include frontend deployment config. The backend README mentions Vercel as a likely frontend host, but no `vercel.json` is present.

```

## 8. 08-developer-guide-and-improvements.md

```md
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

```
