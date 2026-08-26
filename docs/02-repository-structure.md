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

