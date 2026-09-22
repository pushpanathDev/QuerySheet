# QuerySheet

> Turn spreadsheets into decisions.

QuerySheet is a full-stack AI analytics workspace for exploring CSV and Excel data without writing SQL or building dashboards by hand. Upload a dataset, inspect its structure, receive statistical and AI-generated insights, and ask follow-up questions against the same analysis context.

The repository is intentionally split into a browser application and a cloud-ready API:

```text
QuerySheet_Frontend  ->  QuerySheet_Backend  ->  Firestore / Firebase Auth
																			|
																			+-> Groq (primary, optional)
																			+-> Google Gemini (fallback)
```

## Product Surface

- **Multi-sheet ingestion** for CSV, XLS, and XLSX files
- **Client-side parsing and preview** before data is submitted
- **Data profiling** with inferred column types, null counts, cardinality, distributions, and numeric statistics
- **AI analysis** covering trends, anomalies, correlations, charts, and recommended actions
- **Persistent analysis history** grouped by dataset signature
- **Context-aware chat** for each saved analysis
- **Streaming responses** through Server-Sent Events, with a non-streaming fallback
- **Email/password and Google authentication** through Firebase
- **Protected persistence** for users, sessions, analyses, and chat messages in Firestore

## How It Works

```mermaid
flowchart LR
		U[User] --> P[React upload flow]
		P --> F[CSV/XLS/XLSX parser]
		F --> A[POST /api/v1/analyze]
		A --> V[Validation and sanitization]
		V --> S[Server-side profiling]
		S --> L[Groq or Gemini]
		L --> M[Validated insight mapping]
		M --> D[Firestore analysis document]
		D --> R[Dashboard and charts]
		R --> C[Analysis-scoped chat]
		C --> E[SSE or JSON response]
```

For authenticated users, analysis is submitted as a background job: the API immediately stores a `processing` document, the frontend polls the analysis resource, and the backend updates it when the AI pipeline completes. Anonymous/demo requests use a stricter row limit and do not persist an analysis.

## Architecture

### Frontend

`QuerySheet_Frontend` is a React 19 single-page application built with Vite.

| Area | Responsibility |
| --- | --- |
| `src/pages` | Login, registration, upload, dashboard, history, and chat screens |
| `src/components` | Layout, route protection, upload, insight, chart, and chat components |
| `src/api` | Axios API client, auth token injection, response unwrapping, and SSE chat transport |
| `src/store` | Zustand auth and analysis state, including session-backed history |
| `src/hooks` | Firebase auth subscription and asynchronous analysis polling |
| `src/utils/fileParser.util.js` | CSV and workbook parsing, cleanup, and multi-sheet normalization |

### Backend

`QuerySheet_Backend` is an Express 5 API using a layered design:

```text
HTTP request
	-> security middleware
	-> versioned routes
	-> controllers
	-> services
	-> models and utilities
	-> Firebase / Firestore / LLM providers
```

| Area | Responsibility |
| --- | --- |
| `src/config` | Environment validation and Firebase/AI client initialization |
| `src/middleware` | Auth, CORS, Helmet, request IDs, sanitization, validation, rate limits, and errors |
| `src/routes/v1` | Versioned API route composition |
| `src/controllers` | HTTP translation layer with thin request handlers |
| `src/services` | Authentication, analysis, chat, user, persistence, and LLM orchestration |
| `src/models` | Firestore document factories |
| `src/schemas` | Zod request contracts |
| `src/utils` | Prompt construction, response mapping, logging, throttling, and response envelopes |

## Authentication and Security

QuerySheet treats uploaded data and identity as server-owned concerns:

- Firebase Admin verifies bearer ID tokens with revocation checks.
- Email/password accounts use bcrypt password hashes and signed, HTTP-only session cookies.
- New email/password logins invalidate previous active sessions.
- Five failed password attempts trigger a temporary lockout.
- CORS uses an explicit origin allowlist and credentials are enabled deliberately.
- Helmet applies security headers, including CSP and frame protections.
- Zod validates request bodies before business logic runs.
- Input sanitization rejects dangerous keys, null bytes, and suspicious payload patterns.
- Global, authentication, AI, and chat rate limits protect expensive endpoints.
- AI output is parsed and schema-validated before it reaches the UI.
- Firestore access is scoped to the authenticated user and sensitive writes are backend-managed.

## API Overview

The API is versioned under `/api/v1` and returns a consistent response envelope.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness check for deployment platforms |
| `POST` | `/api/v1/auth/register` | Create an account |
| `POST` | `/api/v1/auth/login` | Authenticate and create a session |
| `POST` | `/api/v1/auth/logout` | Invalidate the current session |
| `POST` | `/api/v1/auth/forgot-password` | Start a non-enumerating reset flow |
| `POST` | `/api/v1/auth/reset-password` | Complete a password reset |
| `POST` | `/api/v1/analyze` | Submit a dataset for analysis |
| `GET` | `/api/v1/analyze` | List saved analyses |
| `GET` | `/api/v1/analyze/:analysisId` | Read analysis status or result |
| `DELETE` | `/api/v1/analyze/:analysisId` | Delete an analysis and its chat history |
| `POST` | `/api/v1/chat` | Send a normal chat request |
| `GET` | `/api/v1/chat/stream` | Stream an analysis-scoped chat response |
| `GET` | `/api/v1/chat/history/:analysisId` | Read saved conversation history |
| `GET` | `/api/v1/user/me` | Read the current profile |
| `POST` | `/api/v1/user/preferences` | Update user preferences |
| `DELETE` | `/api/v1/user/me` | Delete the current account |

## Technology Stack

**Frontend:** React 19, Vite, React Router, Zustand, Tailwind CSS, Recharts, Firebase Web SDK, Papa Parse, SheetJS, Axios, React Markdown.

**Backend:** Node.js 18+, Express 5, Firebase Admin SDK, Firestore, Zod, bcryptjs, Helmet, CORS, Morgan, express-rate-limit, Jest, and Supertest.

**AI and deployment:** Groq SDK, Google Generative AI SDK, Render-compatible service configuration, and Firebase infrastructure.

## Local Development

### Prerequisites

- Node.js 18 or newer
- A Firebase project with Authentication and Firestore enabled
- A Gemini API key
- A Groq API key if Groq is the preferred provider

### 1. Install dependencies

```powershell
cd QuerySheet_Backend
npm install

cd ..\QuerySheet_Frontend
npm install
```

### 2. Configure the backend

Create `QuerySheet_Backend/.env`:

```env
PORT=8080
NODE_ENV=development
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GEMINI_API_KEY=your-gemini-key
GROQ_API_KEY=your-groq-key
LLM_PRIMARY_PROVIDER=groq
ALLOWED_ORIGINS=http://localhost:5173
JWT_AUDIENCE=querysheet-backend
SESSION_SECRET=use-a-long-random-secret-at-least-32-characters
```

### 3. Configure the frontend

Create `QuerySheet_Frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8080/api/v1
VITE_FIREBASE_API_KEY=your-firebase-web-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

### 4. Start both applications

In separate terminals:

```powershell
# Terminal 1
cd QuerySheet_Backend
npm run dev

# Terminal 2
cd QuerySheet_Frontend
npm run dev
```

Open the Vite URL shown in the frontend terminal, normally `http://localhost:5173`.

## Quality Checks

```powershell
# Backend
cd QuerySheet_Backend
npm test
npm run lint

# Frontend
cd ..\QuerySheet_Frontend
npm run lint
npm run build
```

The backend contains focused Jest coverage for authentication, analysis helpers, and prompt construction. Frontend automated tests are not currently included.

## Deployment Shape

The backend is configured for Render through `QuerySheet_Backend/render.yaml`. The deployment platform should expose `/health` as its liveness check and provide all backend environment variables through managed secrets. The frontend can be deployed as a static Vite build on a platform such as Vercel or Render Static Sites.

Before production use, replace the password-reset email stub, add a real `.env.example`, complete deletion of every user-owned Firestore artifact, and move process-local caches/rate gates to shared infrastructure for multi-instance deployments.

## Repository Hygiene

`docs/` and `QuerySheet_Arch/` are internal documentation and architecture artifacts. They are ignored by Git so the public repository presents the product source and this README without exposing internal design material.

