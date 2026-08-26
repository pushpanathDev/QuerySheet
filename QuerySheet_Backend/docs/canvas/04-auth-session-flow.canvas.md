# DIAGRAM 4 — Complete Auth & Session Security Flow

**IMPLEMENTATION STATUS:** Registration, login, session validation, and lockout fully implemented. Email sending is stubbed. `reset-password` expects `passwordResetTokens` but `forgot-password` does not populate it.

**DEVIATIONS FROM DOC:**
- Registration does not auto-login — verify email then login required
- Google OAuth bypasses session cookie
- Login validates bcrypt locally; optional `x-firebase-id-token` for session hash
- `sendVerificationEmail` logs only — no real email provider

---

## Flow A — Email/Password Registration

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant R as auth.routes
    participant V as validateBody
    participant AC as authController
    participant AS as authService
    participant FA as Firebase Admin
    participant FS as Firestore
    participant BC as bcrypt

    C->>R: POST /api/v1/auth/register
    R->>R: authLimiter → 429 if exceeded
    R->>V: registerBodySchema
    alt Zod fail
        V-->>C: 422 Validation failed
    end
    V->>AC: register(req)
    AC->>AS: registerUser(email, password, displayName)
    AS->>FS: READ users WHERE email
    alt Email exists
        AS-->>C: 409 Email already registered
    end
    AS->>FA: createUser emailVerified=false
    AS->>BC: hash password rounds=12
    AS->>FS: BATCH WRITE users credentials profile
    alt Batch fails
        AS->>FA: deleteUser rollback
        AS-->>C: 500
    end
    AS->>FA: generateEmailVerificationLink
    Note over AS: sendVerificationEmail STUB — logs only
    AC-->>C: 201 uid email displayName — NO cookie

    Note over C: Verify email via Firebase client SDK
    Note over C: POST /auth/login → cookie → protected route
```

---

## Flow B — Login with Single-Session Enforcement

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant AC as authController
    participant AS as authService
    participant FS as Firestore
    participant BC as bcrypt

    C->>AC: POST /api/v1/auth/login
    AC->>AS: loginUser(email, password, deviceInfo)
    AS->>FS: READ users by email
    alt Not found
        AS-->>C: 401 Invalid credentials
    end
    alt account inactive or deleted
        AS-->>C: 403 Account not active
    end
    AS->>FS: READ userCredentials
    alt lockedUntil > now
        AS-->>C: 423 Account locked
    end
    AS->>BC: compare password
    alt Wrong password
        AS->>FS: failedLoginCount++ lock at 5
        AS-->>C: 401 Invalid credentials
    end
    AS->>FS: RESET failedLoginCount lockedUntil
    AS->>FS: UPDATE users lastLoginAt
    AS->>FS: BATCH invalidate all active sessions new_login
    AS->>FS: WRITE new authSessions doc expiresAt +1hr
    AC->>C: Set-Cookie sessionId httpOnly signed
    AC-->>C: 200 uid email displayName — NO sessionId in body
```

---

## Flow C — Protected Request Validation

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant AM as authMiddleware
    participant FA as Firebase Admin
    participant FS as Firestore

    C->>AM: Protected request Bearer JWT + sessionId cookie
    alt No token
        AM-->>C: 401 Authorization missing
    end
    AM->>FA: verifyIdToken checkRevoked=true
    Note over AM,FA: BOUNDARY 1 — JWT verified
    alt expired or invalid
        AM-->>C: 401
    end
    alt email_verified !== true
        AM-->>C: 403 Email not verified
    end
    AM->>AM: sessionId = req.signedCookies.sessionId
    alt No cookie + google.com provider
        AM->>AM: req.user set — skip session
        AM->>C: next()
    else No cookie
        AM-->>C: 401 Session cookie missing
    end
    AM->>FS: GET authSessions/sessionId
    Note over AM,FS: BOUNDARY 2 — Session validated
    alt invalid expired or userId mismatch
        AM-->>C: 401 Session invalid
    end
    AM->>AM: req.user populated
    AM->>FS: UPDATE lastActivityAt async
    AM->>C: next() handler runs
```

---

## Flow D — Account Lockout

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant AS as authService
    participant FS as Firestore
    participant BC as bcrypt

    Note over C,FS: THRESHOLD=5 WINDOW=15min

    loop Attempts 1-4 wrong password
        C->>AS: loginUser
        AS->>BC: compare false
        AS->>FS: failedLoginCount=N
        AS-->>C: 401
    end

    C->>AS: Attempt 5 wrong
    AS->>FS: failedLoginCount=5 lockedUntil=now+15min
    AS-->>C: 401

    C->>AS: Login while locked
    AS-->>C: 423 Account locked

    Note over FS: 15 minutes pass

    C->>AS: Correct password after unlock
    AS->>BC: compare true
    AS->>FS: reset counters + new session
    AS-->>C: 200 + cookie
```

---

## KEY INSIGHTS

- **Two-factor session** for email/password: Firebase JWT plus Firestore session doc.
- Registration returns **no session** — 403 on protected routes until email verified and login completes.
- Lockout is credential-level: 5 failures → 15-minute lock in `userCredentials`.
