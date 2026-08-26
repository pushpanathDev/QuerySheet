# DIAGRAM 2 — API Route Map with Security and Rate Limit Layers

**IMPLEMENTATION STATUS:** All documented auth/analyze/chat/user routes implemented. Extra routes: `GET /health`, `GET /api/v1/status`, `GET /api/v1/chat/stream`. `listAnalyses` has no route. `health.controller.js` is unused.

**DEVIATIONS FROM DOC:**
- User routes: `/user/me`, `/user/preferences`, `DELETE /user/me` (not flat `/user`)
- Authenticated `POST /analyze` returns **202** async job
- Groq primary LLM, Gemini fallback
- Chat SSE streaming not in master doc

---

```mermaid
graph LR
    subgraph APP["app.js"]
        H1["GET /health<br/>MW: global only<br/>Response: status timestamp version"]
        H2["GET /api/v1/status<br/>MW: global + auth<br/>FS: _healthcheck<br/>Response: firestore gemini session"]
    end

    subgraph AUTH["/api/v1/auth — authLimiter on router"]
        AR1["POST /register<br/>MW: authLimiter validate<br/>Ctrl: authController.register<br/>Svc: authService.registerUser<br/>FS WRITE: users userCredentials profile<br/>Response: uid email displayName — 201"]
        AR2["POST /login<br/>MW: authLimiter validate<br/>Ctrl: authController.login<br/>Svc: authService.loginUser<br/>FS: authSessions users credentials<br/>Cookie SET sessionId<br/>Response: uid email displayName — 200"]
        AR3["POST /logout<br/>MW: auth<br/>Svc: invalidateSession<br/>Cookie CLEAR<br/>Response: message — 200"]
        AR4["POST /forgot-password<br/>MW: authLimiter validate<br/>Svc: forgotPassword<br/>Response: message — 200"]
        AR5["POST /reset-password<br/>MW: authLimiter validate<br/>Svc: resetPassword<br/>FS: passwordResetTokens credentials<br/>Response: message — 200"]
    end

    subgraph ANALYZE["/api/v1/analyze"]
        AN1["POST /<br/>MW: auth aiLimiter validate<br/>Svc: enqueueAnalysis / runAnalysis<br/>FS: analyses insightCache profile<br/>LLM: llmService<br/>Response: 202 processing or 201 anonymous"]
        AN2["GET /:analysisId<br/>MW: auth<br/>Svc: getAnalysis<br/>FS READ: analyses<br/>Response: analysis doc — 200"]
        AN3["DELETE /:analysisId<br/>MW: auth<br/>Svc: deleteAnalysis<br/>FS DELETE: analyses + messages<br/>Response: 204"]
    end

    subgraph CHAT["/api/v1/chat"]
        CH1["POST /<br/>MW: auth chatLimiter validate<br/>Svc: sendMessage<br/>FS: analyses messages<br/>Response: reply messageId — 200"]
        CH2["GET /history/:analysisId<br/>MW: auth<br/>Svc: getHistory<br/>Response: analysisId history — 200"]
        CH3["GET /stream<br/>MW: auth chatLimiter<br/>Svc: streamMessage SSE<br/>[DIFFERS FROM DOC]<br/>Response: text/event-stream"]
    end

    subgraph USER["/api/v1/user"]
        UR1["GET /me<br/>MW: auth<br/>Svc: getProfile<br/>FS READ: users/uid<br/>Response: profile — 200"]
        UR2["POST /preferences<br/>MW: auth validate<br/>Svc: updatePreferences<br/>FS WRITE: users/uid<br/>Response: profile — 200"]
        UR3["DELETE /me<br/>MW: auth<br/>Svc: deleteAccount<br/>FS DELETE cascade<br/>Response: message — 200"]
    end

    subgraph PLANNED["PLANNED — NOT IMPLEMENTED"]
        P1["GET /analyze list all<br/>listAnalyses in service, no route"]
    end
```

---

## KEY INSIGHTS

- **Data isolation** via path scoping `users/{uid}/...` rather than `.where('userId')` on every query.
- Rate limits layer: global 200/15min → auth 20/15min → ai 10/min or chat 5/min.
- Login **sets** httpOnly cookie; logout clears it; protected routes **read** it in authMiddleware.
