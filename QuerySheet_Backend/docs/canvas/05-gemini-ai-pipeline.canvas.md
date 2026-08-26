# DIAGRAM 5 — Gemini AI Pipeline & Data Flow

**IMPLEMENTATION STATUS:** Full analyze pipeline with async jobs, insight cache, multi-sheet support, Groq/Gemini routing, chat with metadata bypass and streaming.

**DEVIATIONS FROM DOC:**
- Groq primary (`LLM_PRIMARY_PROVIDER=groq`), Gemini fallback
- Up to 30 `sampleRows` per sheet sent to LLM — doc says columnStats only
- Authenticated analyze is async 202 + poll GET
- In-memory RPM gate and Q&A cache not in doc

---

## Analyze Pipeline

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant AC as analyzeController
    participant AS as analyzeService
    participant CS as cacheService
    participant LLM as llmService
    participant GR as groqService
    participant GM as geminiService
    participant PB as promptBuilder
    participant RM as responseMapper
    participant FS as Firestore

    C->>AC: POST /api/v1/analyze
    Note over AC: auth + aiLimiter + Zod validate

    rect rgb(240,248,255)
        Note over AS: Step 1 — Input Validation
        AC->>AS: enqueueAnalysis or runAnalysis anonymous
        AS->>AS: validateAndPrepare sheets rows limits
    end

    rect rgb(240,255,240)
        Note over AS: Step 2 — Column Stats
        AS->>AS: buildColumnStats + sampleRows 0..30
        Note over AS: SECURITY: full CSV stays server-side<br/>DIFFERS: 30 sample rows go to LLM
    end

    alt Authenticated
        AS->>FS: WRITE analyses status=processing
        AS-->>C: 202 analysisId status processing
        AS->>AS: setImmediate processAnalysisJob
    else Anonymous
        Note over AS: Sync path no persist
    end

    rect rgb(255,250,240)
        Note over AS,CS: Step 3 — Cache Lookup
        AS->>CS: getCachedInsights uid dataHash
        CS->>FS: GET insightCache/hash
        alt hit 24h TTL
            CS-->>AS: cached insights
        else miss
            CS-->>AS: INSIGHT_CACHE_MISS
        end
    end

    rect rgb(255,240,255)
        Note over AS,PB: Step 4 — Prompt Build
        AS->>PB: buildAnalysisPrompt
        PB-->>AS: columnStats + sampleRows + schema
    end

    rect rgb(240,240,255)
        Note over LLM,GM: Step 5 — LLM + Retry
        AS->>LLM: generateInsights
        alt Groq primary
            LLM->>GR: generateInsightsRaw
            alt fallback needed
                LLM->>GM: generateInsights callWithRetry
            end
        else Gemini
            LLM->>GM: reserveGeminiSlot + callWithRetry
            Note over GM: Rate limit 61s backoff<br/>Transient exp 1s 2s 4s 8s<br/>400 fail fast
        end
    end

    rect rgb(255,255,240)
        Note over GM: Step 6 — Output Validation
        GM->>GM: parseGeminiJson + geminiOutputSchema Zod
    end

    rect rgb(240,255,255)
        Note over RM: Step 7 — Response Map
        AS->>RM: mapInsightsToResponse
    end

    rect rgb(255,240,240)
        Note over CS,FS: Step 8 — Firestore Write
        AS->>CS: setCachedInsights + updateAnalysis completed
    end

    rect rgb(240,240,240)
        Note over AS,FS: Step 9 — Profile Stats
        AS->>FS: TRANSACTION profile analysisCount++
    end

    C->>AC: GET /analyze/:id poll
    AC-->>C: 200 completed analysis
```

---

## Chat AI Flow

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant CH as chatController
    participant CSvc as chatService
    participant CS as cacheService
    participant GT as geminiThrottle
    participant LLM as llmService
    participant FS as Firestore

    C->>CH: POST /api/v1/chat
    CH->>CSvc: sendMessage(uid, analysisId, message)
    CSvc->>CS: getAnalysis + getChatHistory

    alt Metadata question
        CSvc->>CSvc: answerFromMetadata — no LLM
    else Q&A cache hit 5min
        CSvc->>GT: getCachedChatAnswer
    else Cache miss
        CSvc->>CSvc: last 5 messages + buildChatContext
        CSvc->>LLM: generateChatResponse Groq/Gemini
        CSvc->>GT: setCachedChatAnswer
    end

    CSvc->>CS: saveChatMessage user + assistant
    CS->>FS: WRITE messages x2
    CSvc-->>C: 200 reply messageId timestamp
```

---

## KEY INSIGHTS

- Raw CSV never appears in API responses, but **up to 30 sample rows per sheet** are sent to the LLM.
- Authenticated analysis is **async** — client polls until `status=completed` or `failed`.
- LLM routing: Groq Llama 3.3 70B default, Gemini 2.5 Flash fallback with separate retry/throttle.
