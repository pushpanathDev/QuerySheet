# DIAGRAM 1 — Middleware Chain & Request Lifecycle

**IMPLEMENTATION STATUS:** Fully built. Global middleware matches master doc plus `express.urlencoded`. Route-level auth/rate-limit/validate fully implemented. `health.controller.js` is unused (health is inline in `app.js`).

**DEVIATIONS FROM DOC:**
- `express.urlencoded` added after `express.json`
- Google OAuth bypasses session cookie in `auth.middleware.js`
- JWT also accepted via `?authToken=` query param
- Debug `console.log` of token in auth middleware

---

```mermaid
flowchart TD
    START([HTTP Request]) --> RID

    subgraph GLOBAL["Global Stack — every request (src/app.js)"]
        RID["1 requestIdMiddleware<br/>src/middleware/requestId.middleware.js<br/>Sets req.requestId + X-Request-ID header<br/>Always next()"]
        HEL["2 helmet — src/app.js inline<br/>CSP, HSTS, X-Frame-Options<br/>Always next()"]
        COR["3 corsMiddleware<br/>src/middleware/cors.middleware.js<br/>Checks Origin vs ALLOWED_ORIGINS<br/>Pass: next() | Fail: 403 via errorMiddleware"]
        CKP["4 cookieParser(SESSION_SECRET)<br/>src/app.js<br/>Parses signed cookies → req.signedCookies<br/>Always next()"]
        JSON["5 express.json limit 10mb<br/>Bad JSON → 400 via errorMiddleware"]
        URL["6 express.urlencoded<br/>[DIFFERS FROM DOC]<br/>Always next()"]
        SAN["7 sanitizeMiddleware<br/>Trims, blocks proto keys, SQL pattern<br/>Pass: next() | Fail: 400 or 413"]
        MORG["8 morgan — access log<br/>Always next()"]
        GRL["9 globalRateLimiter<br/>200 req / 15 min per IP<br/>Fail: 429"]
    end

    RID --> HEL --> COR --> CKP --> JSON --> URL --> SAN --> MORG --> GRL
    GRL --> ROUTE{Route match?}

    ROUTE -->|GET /health| HEALTH["Inline handler — no auth<br/>200 status ok"]
    ROUTE -->|GET /api/v1/status| AUTH_STATUS["authMiddleware then Firestore probe<br/>200 or 401/403"]
    ROUTE -->|/api/v1/*| V1["v1Router"]

    subgraph PATH_A["Path A — POST /api/v1/auth/login (PUBLIC)"]
        V1 --> A1["authLimiter — 20/15min<br/>Fail: 429"]
        A1 --> A2["validateBody(loginBodySchema)<br/>Fail: 422"]
        A2 --> A3["authController.login<br/>Sets httpOnly signed sessionId cookie<br/>200 uid email displayName — NO sessionId in body"]
    end

    subgraph PATH_B["Path B — POST /api/v1/analyze (PROTECTED)"]
        V1 --> B1["🔒 authMiddleware — SECURITY BOUNDARY"]
        B1 --> B1A{Bearer or authToken?}
        B1A -->|No| B401["401 Authorization missing"]
        B1A -->|Yes| B1B["verifyIdToken — JWT VERIFIED<br/>Fail: 401"]
        B1B --> B1C{email_verified?}
        B1C -->|No| B403["403 Email not verified"]
        B1C -->|Yes| B1D{sessionId cookie?}
        B1D -->|No + google.com| BGOOG["Google OAuth bypass<br/>Skip session doc"]
        B1D -->|No| B401B["401 Session cookie missing"]
        B1D -->|Yes| B1E["GET authSessions/sessionId<br/>SESSION DOC VALIDATED<br/>Fail: 401"]
        B1E --> B1F["req.user set, lastActivityAt async<br/>next()"]
        BGOOG --> B1F
        B1F --> B2["aiLimiter — 10/min<br/>Fail: 429"]
        B2 --> B3["validateBody(analyzeBodySchema)<br/>Fail: 422"]
        B3 --> B4["analyzeController.analyze<br/>Anonymous: 201 sync | Auth: 202 async"]
    end

    A3 --> ERR["errorMiddleware — 400/403/422/401/500"]
    B4 --> ERR
    HEALTH --> RESP([Response Sent])
    AUTH_STATUS --> RESP
    ERR --> RESP
```

---

## KEY INSIGHTS

- **Security boundary** for protected routes is `authMiddleware` — JWT verification plus Firestore session validation for email/password users.
- Global middleware runs identically for public and protected routes; auth/rate-limit/validate stack after the global chain.
- Google OAuth is an exception: Firebase JWT alone suffices with no Firestore session lookup.
