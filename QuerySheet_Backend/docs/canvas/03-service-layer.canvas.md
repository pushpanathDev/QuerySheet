# DIAGRAM 3 — Service Layer Architecture & Inter-Service Dependencies

**IMPLEMENTATION STATUS:** Six service modules fully implemented. No circular dependencies. `cache.service.js` is the Firestore data-access layer.

**DEVIATIONS FROM DOC:**
- `llm.service.js` + `groq.service.js` not in master doc (Groq primary, Gemini fallback)
- `cache.service.js` handles analyses/messages/insightCache — not pure cache
- In-memory Q&A cache via `geminiThrottle.util.js`

---

```mermaid
graph TD
    subgraph AUTH_SVC["auth.service.js"]
        A1["registerUser → uid email displayName<br/>FS: users credentials profile | bcrypt | adminAuth"]
        A2["loginUser → sessionId user<br/>FS: sessions credentials users | bcrypt"]
        A3["invalidateSession / invalidateUserSessions"]
        A4["forgotPassword / resetPassword"]
        A5["sendVerificationEmail — STUB"]
    end

    subgraph ANALYZE_SVC["analyze.service.js"]
        B1["runAnalysis — sync anonymous"]
        B2["enqueueAnalysis — async 202"]
        B3["getAnalysis / deleteAnalysis / listAnalyses no route"]
        B4["Internal: buildColumnStats buildSheetSummaries incrementAnalysisCount"]
    end

    subgraph CHAT_SVC["chat.service.js"]
        C1["sendMessage → reply messageId"]
        C2["getHistory → messages"]
        C3["streamMessage — async generator"]
    end

    subgraph USER_SVC["user.service.js"]
        D1["getProfile / updatePreferences / deleteAccount"]
    end

    subgraph CACHE_SVC["cache.service.js — Firestore DAL"]
        E1["saveAnalysis updateAnalysis getAnalysis deleteAnalysis"]
        E2["saveChatMessage getChatHistory"]
        E3["getCachedInsights setCachedInsights<br/>users/uid/insightCache/hash"]
    end

    subgraph LLM_SVC["llm.service.js — Provider Router"]
        F1["generateInsights — Groq primary Gemini fallback"]
        F2["generateChatResponse / streamChatResponse"]
        F3["sanitizeChatReply"]
    end

    subgraph GEMINI_SVC["gemini.service.js"]
        G1["generateInsights parseAndValidateInsights"]
        G2["callWithRetry max 4 rate limit 61s cooldown"]
        G3["geminiOutputSchema Zod validation"]
        G4["Ext: GoogleGenerativeAI gemini-2.5-flash"]
    end

    subgraph GROQ_SVC["groq.service.js"]
        H1["generateInsightsRaw generateChatRaw streamChatRaw"]
        H2["Ext: Groq llama-3.3-70b-versatile"]
    end

    ANALYZE_SVC --> CACHE_SVC
    ANALYZE_SVC --> LLM_SVC
    CHAT_SVC --> CACHE_SVC
    CHAT_SVC --> LLM_SVC
    LLM_SVC --> GROQ_SVC
    LLM_SVC --> GEMINI_SVC

    NOTE["No circular dependencies<br/>Flow: controllers → domain services → cache/llm → groq/gemini"]
```

---

## KEY INSIGHTS

- `cache.service.js` is the **single Firestore gateway** for analyses, messages, and insight cache under `users/{uid}/`.
- `llm.service.js` routes to Groq first when `LLM_PRIMARY_PROVIDER=groq`, Gemini on fallback error codes.
- `auth.service.js` is self-contained with no dependency on other domain services.
