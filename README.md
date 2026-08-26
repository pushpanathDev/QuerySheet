# BizPulseAI Documentation

This documentation set was generated from the implementation in `BizPulseAI_Backend/` and `BizPulseAI_Frontend/`. It is organized for onboarding, architecture review, portfolio discussion, and future maintenance.

## Documents

| File | Purpose |
|---|---|
| [01-overview.md](01-overview.md) | Product purpose, users, workflows, stack, and system diagrams. |
| [02-repository-structure.md](02-repository-structure.md) | Repository tree, folder responsibilities, source/config files, and scalability notes. |
| [03-backend-architecture.md](03-backend-architecture.md) | Server startup, middleware, routing, services, models, utilities, AI orchestration, and lifecycle diagrams. |
| [04-api-and-database.md](04-api-and-database.md) | Endpoint-by-endpoint API documentation and Firestore data model. |
| [05-security-architecture.md](05-security-architecture.md) | Authentication, authorization, validation, sanitization, rate limiting, CORS, headers, cookies, and hardening analysis. |
| [06-frontend-architecture.md](06-frontend-architecture.md) | React routing, state, API integration, auth flow, pages, components, parsing, and rendering behavior. |
| [07-features-ai-performance.md](07-features-ai-performance.md) | Feature documentation, AI pipeline, request lifecycle, data flow, performance, and deployment diagrams. |
| [08-developer-guide-and-improvements.md](08-developer-guide-and-improvements.md) | Setup, scripts, environment variables, testing, debugging, CRUD comparison, and staff-level improvement review. |

## Important Accuracy Notes

The repository does not contain `.env.example`, Docker files, Next.js, Webpack, Prettier config, TypeScript config, or a persistent external cache such as Redis. Those items are documented as absent where relevant.

The project names differ in some UI copy. The folders and backend README call the system `BizPulseAI`, while multiple frontend components render `DataPulse AI`. This appears to be a branding inconsistency in the current implementation.

The backend contains an existing historical document at `BizPulseAI_Backend/docs/PROJECT_MASTER_DOCUMENTATION.md`. This new documentation set complements it and reflects the code inspected in the current repository.

