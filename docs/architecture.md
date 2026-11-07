# System Architecture & Technical Design (v3.0 - Phase 3 Admin Authentication)

## 1. Architectural Principles
1. **Decoupled Architecture**: Independent Frontend (Next.js 14 App Router) and Backend (Node.js/Express) services with distinct build and deployment pipelines.
2. **RESTful API Boundary**: All data interchange occurs over typed JSON REST endpoints. The frontend possesses zero direct database access.
3. **Database Single Source of Truth**: PostgreSQL managed exclusively through Prisma ORM with versioned schema migrations (`prisma/migrations/`).
4. **PostgreSQL-Level Conflict Protection**: Exclusion constraints (`EXCLUDE USING gist`) enforce unit uniqueness during date windows `[entryDate, exitDate)` directly at the database engine level.
5. **Inventory Capacity Integrity**: Database trigger (`trigger_sync_room_capacity`) maintains automated synchronization between `AccommodationUnit` inventory and `Room` capacity.
6. **Stateless JWT with HttpOnly Cookie Security**: Browser sessions use secure `HttpOnly` cookies (`auth_token`) to eliminate XSS token theft. No tokens or credentials stored in `localStorage`.
7. **Brute-Force Defense**: In-memory rate limiting blocks abusive login attempts (HTTP 429 after 5 failed tries).
8. **Role-Based Access Control (RBAC)**: Middleware enforcement (`requireRole`) supporting `SUPER_ADMIN`, `ALLOCATION_MANAGER`, `RECEPTION_STAFF`, and `VIEWER`.
9. **Defense in Depth**: Application-level AES-256-GCM encryption for sensitive identifiers (Aadhaar), bcrypt password hashing, and immutable activity auditing.

```
┌────────────────────────────────────────────────────────┐
│               Frontend: Next.js 14 (App Router)        │
│  - /login: React Hook Form + Zod Login Interface       │
│  - /dashboard: Protected Layout & Route Guard          │
│  - AuthContext: HttpOnly Session State Management      │
│  - Central Typed REST API Client (credentials: include)│
└───────────────────────────┬────────────────────────────┘
                            │ REST API (JSON + HttpOnly Cookies)
                            ▼
┌────────────────────────────────────────────────────────┐
│             Backend: Node.js + Express + TypeScript    │
│  - POST /api/auth/login (Rate limited, Zod validated)  │
│  - POST /api/auth/logout (Clears HttpOnly cookie)      │
│  - GET  /api/auth/me (requireAuth session verification)│
│  - requireAuth & requireRole RBAC Guard Middleware     │
│  - AES-256-GCM Encryption Utility for Aadhaar          │
│  - Activity Logging Subsystem                          │
└───────────────────────────┬────────────────────────────┘
                            │ Prisma Client ORM
                            ▼
┌────────────────────────────────────────────────────────┐
│               PostgreSQL Database                      │
│  - 12 Relational Models with Foreign Keys & Indexes    │
│  - Migration 1: 20261105000000_init_complete           │
│  - Migration 2: 20261105010000_database_hardening     │
│  - PostgreSQL Exclusion Constraints (btree_gist)       │
│  - Automated Trigger for Room Capacity Sync            │
└────────────────────────────────────────────────────────┘
```

## 2. Authentication & Authorization Specifications

### 2.1. Cookie Configuration
- **Cookie Name**: `auth_token`
- **HttpOnly**: `true` (Inaccessible to client-side scripts)
- **Secure**: `true` in production (enforces HTTPS)
- **SameSite**: `'lax'` (mitigates CSRF while enabling standard navigation)
- **Path**: `'/'`
- **Max-Age**: 7 days (`604,800,000` ms)

### 2.2. Rate Limiting Policy
- **Endpoint**: `POST /api/auth/login`
- **Window**: 15 minutes
- **Max Failed Attempts**: 5 attempts per IP address
- **Penalty**: HTTP 429 Too Many Requests with `retryAfterSeconds` indicator.

### 2.3. Role Hierarchy & Access Matrix
| Role | Permissions Overview |
|---|---|
| `SUPER_ADMIN` | Unrestricted access: user management, room configuration, allocation, reception overrides, reporting |
| `ALLOCATION_MANAGER` | Room capacity planning, manual unit allocation, reallocation, reports |
| `RECEPTION_STAFF` | Participant arrival verification, encrypted Aadhaar recording, stay checking-in/out |
| `VIEWER` | Read-only inspection of dashboard metrics and reports |

### 2.4. Reception & Occupancy Integrity Controls (Phase 8 & 8.1 Audit)
- **Double Occupancy Prevention**: Dual PostgreSQL `btree_gist` exclusion constraints enforce hardware-level isolation:
  - `no_overlapping_active_stays` on `accommodation_units(id)` during `[actualCheckIn, COALESCE(actualCheckOut, 'infinity'))`.
  - `no_overlapping_participant_stays` on `participants(id)` preventing a single participant from being checked into multiple physical units concurrently.
- **Check-In Authorization Gate**: Check-in requires pre-confirmation (`checkInStatus === 'CONFIRMED'`). Inactive and maintenance units are rejected.
- **Stay Extension Conflict Probing**: Future extensions check actively for overlapping allocations (`[now, newExitDate)`). Overlaps trigger HTTP 409 `EXTENSION_CONFLICT` without modifying records.
- **Room Transfer Audit Trail**: Prior stay is closed at transfer time, new stay is created referencing `previousStayRecordId`, preserving operator identity and transfer reason.
- **Aadhaar Privacy Isolation**: AES-256-GCM encryption with keys restricted to server environment (`AADHAAR_ENCRYPTION_KEY`). Unencrypted Aadhaar is never written to disk, returned in API payloads, logged in `ActivityLog`, or exported to Excel. Display format strictly masked (`XXXX-XXXX-1234`). Statutory retention consent is recorded.

---

## 3. Directory Structure
```
accommodation-management/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/login/    # Phase 3 Login Screen
│   │   │   ├── dashboard/       # Protected Dashboard Layout & Home
│   │   │   │   ├── registrations/ # Phase 5 Registration Management
│   │   │   │   │   ├── [id]/      # Detailed Registration Dossier
│   │   │   │   │   └── page.tsx   # Registration Directory, Filter, Import/Export
│   │   │   │   ├── allocate/        # Phase 6 Manual Accommodation Allocation Workbench
│   │   │   │   │   └── page.tsx   # Multi-room & Unit Basket Allocation Engine
│   │   │   │   ├── rooms/       # Phase 4 Room & Inventory Management
│   │   │   │   ├── reception/   # Phase 8 Reception Desk & Actual Occupancy
│   │   │   │   ├── activity/    # Phase 9 Operational Audit Trail & Insights
│   │   │   │   ├── reports/     # Phase 10 Operational Reports & Analytics Dashboard
│   │   │   │   ├── layout.tsx   # Dashboard Shell with Sidebar & Header
│   │   │   │   └── page.tsx     # Executive Dashboard
│   │   │   ├── globals.css
│   │   │   ├── layout.tsx       # Root layout wrapping AuthProvider
│   │   │   └── page.tsx         # Root portal page
│   │   ├── context/
│   │   │   └── AuthContext.tsx  # React Context for HttpOnly authentication
│   │   ├── components/
│   │   │   └── GlobalSearch.tsx # Phase 9 Header global search popover component
│   │   ├── lib/
│   │   │   └── api.ts           # REST API client (credentials: 'include')
│   │   └── types/
│   ├── public/
│   ├── .env.example
│   ├── .env.local
│   ├── package.json
│   ├── tsconfig.json
│   └── tailwind.config.ts
├── backend/
│   ├── src/
│   │   ├── config/              # Central configuration & Prisma client
│   │   ├── controllers/
│   │   │   ├── auth.controller.ts # Login, logout, me handlers
│   │   │   ├── room.controller.ts # Room & unit inventory CRUD & visual states
│   │   │   ├── registration.controller.ts # Registration CRUD, multi-member, Excel I/O
│   │   │   ├── allocation.controller.ts # Manual allocation, availability, conflict checks
│   │   │   ├── whatsapp.controller.ts   # WhatsApp Click-to-Chat, MessageLog transitions, history
│   │   │   ├── reception.controller.ts  # Reception desk, partial arrivals, bed mapping, check-in, transfers
│   │   │   ├── search.controller.ts     # Global search across registrations, allocations, rooms, units, participants
│   │   │   ├── activity.controller.ts   # Operational audit logs, insights, staff list & Excel export
│   │   │   └── report.controller.ts     # Operational reports, occupancy analytics, Excel & PDF exports
│   │   ├── middlewares/
│   │   │   ├── auth.ts          # requireAuth & requireRole RBAC middleware
│   │   │   ├── rateLimiter.ts   # Brute-force rate limiter
│   │   │   └── errorHandler.ts  # Formatted Zod & system error handler
│   │   ├── routes/
│   │   │   ├── auth.ts          # Authentication routes
│   │   │   ├── health.ts        # Database health probe
│   │   │   ├── room.ts          # Room & Unit routes with RBAC
│   │   │   ├── registration.ts  # Registration routes with RBAC
│   │   │   ├── allocation.ts    # Allocation routes with RBAC
│   │   │   ├── whatsapp.ts      # WhatsApp notification routes with RBAC
│   │   │   ├── reception.ts     # Reception desk & occupancy routes with RBAC
│   │   │   ├── search.ts        # Global search routes with RBAC
│   │   │   ├── activity.ts      # Operational audit logs & Excel export with RBAC
│   │   │   ├── report.ts        # Operational reports, analytics & PDF/Excel exports with RBAC
│   │   │   └── index.ts         # Master API router
│   │   ├── services/
│   │   ├── utils/
│   │   │   ├── encryption.ts    # AES-256-GCM Aadhaar encryption
│   │   │   ├── token.ts         # JWT signer & verifier
│   │   │   ├── registrationId.ts # Concurrency-safe PostgreSQL sequence ID generator
│   │   │   ├── allocationNumber.ts # Concurrency-safe PostgreSQL sequence ALC generator
│   │   │   ├── whatsappTemplate.ts # Non-API wa.me generator with mandatory tentative disclaimer
│   │   │   └── pdfGenerator.ts  # PDFKit streaming PDF report builder
│   │   ├── test/
│   │   │   ├── database-verification.ts # Phase 2.1 DB test suite (28 tests)
│   │   │   ├── auth-verification.ts     # Phase 3 Auth test suite (21 tests)
│   │   │   ├── room-verification.ts     # Phase 4 Room test suite (27 tests)
│   │   │   ├── registration-verification.ts # Phase 5 Registration suite (10 subsystems)
│   │   │   ├── allocation-verification.ts # Phase 6 Allocation suite (10 subsystems)
│   │   │   ├── whatsapp-verification.ts   # Phase 7 WhatsApp suite (10 subsystems)
│   │   │   ├── reception-verification.ts  # Phase 8 Reception suite (11 subsystems)
│   │   │   ├── activity-verification.ts   # Phase 9 Search & Audit suite (10 subsystems)
│   │   │   ├── report-verification.ts     # Phase 10 Reports & Analytics suite (10 subsystems)
│   │   │   └── production-hardening-verification.ts # Phase 11 Hardening & Concurrency suite (10 tests)
│   │   ├── app.ts               # Express factory with CORS, security headers, rate limiting & error masking
│   │   └── server.ts            # Server bootstrap
│   ├── scripts/
│   │   ├── backup.ps1           # Automated PostgreSQL backup script (PowerShell)
│   │   └── backup.sh            # Automated PostgreSQL backup script (Linux/Bash)
│   ├── prisma/
│   │   ├── schema.prisma        # Canonical database schema (12 models)
│   │   ├── migrations/          # Versioned migrations
│   │   └── seed.ts              # Idempotent seed script
│   ├── .env.example
│   ├── .env
│   ├── package.json
│   └── tsconfig.json
├── docs/
│   ├── reference/
│   │   └── accommodation-dashboard.png
│   ├── disaster-recovery.md     # Production Disaster Recovery Runbook & PITR
│   ├── requirements.md
│   ├── architecture.md
│   ├── database-design.md
│   └── development-phases.md
└── README.md
```

## 3. Production Hardening & Security Architecture (Phase 11)

### 3.1. HTTP Security Headers
- **X-Content-Type-Options: nosniff**: Defends against MIME sniffing exploits.
- **X-Frame-Options: DENY**: Blocks all framing/iframing of the application to prevent clickjacking.
- **X-XSS-Protection: 1; mode=block**: Instructs legacy browser engines to block page execution if reflected XSS is identified.
- **Referrer-Policy: strict-origin-when-cross-origin**: Prevents URL leaks to third-party domains.
- **Strict-Transport-Security**: In production (`NODE_ENV=production`), enforces 1-year HSTS with subdomain inclusion.
- **Fingerprint Obfuscation**: Explicitly calls `app.disable('x-powered-by')` to deny banner grab discovery.

### 3.2. Rate Limiting Multi-Tier Architecture
1. **Login Endpoint Rate Limiter**: 5 failed login attempts per 15 minutes per IP (`loginRateLimiter`).
2. **General API Rate Limiter**: 600 requests per minute per IP across `/api` routes (`generalApiRateLimiter`), preventing resource exhaustion while keeping high-velocity reception and room visualizer operations fluid.

### 3.3. Information Disclosure & Error Masking
- Centralized error handler masks stack traces and internal PostgreSQL errors (`23P01`, `P2002`) when `NODE_ENV=production`.
- Returns client-safe messages with unique timestamps for support correlation.
- Development mode preserves stack traces for rapid local diagnosis.

### 3.4. Concurrency Safety & Double-Booking Guarantees
- **Sequential Registration Generation**: Handled via PostgreSQL atomic sequences (`registration_id_seq`) - zero race conditions or collisions under parallel requests.
- **Allocation Double-Booking Guard**: Powered by PostgreSQL `btree_gist` exclusion constraint `no_overlapping_active_allocations`. Concurrent simultaneous allocations for the same bed/mat on overlapping dates strictly produce 1 winner (`HTTP 201`) and 1 conflict (`HTTP 409`).
- **Physical Check-In Guard**: Powered by PostgreSQL `btree_gist` exclusion constraint `no_overlapping_participant_stays`. Concurrent simultaneous check-ins into the same unit strictly produce 1 winner (`HTTP 200`) and 1 conflict (`HTTP 409`).
- **Maintenance State Guard**: Units under `MAINTENANCE` or `INACTIVE` status cannot be tentatively allocated or checked into.

### 3.5. Automated Backup & Disaster Recovery Architecture
- Scheduled database backups via `backup.ps1` and `backup.sh`.
- Multi-tier retention: 7 daily snapshots, 4 weekly snapshots, 12 monthly archives.
- Point-in-Time Recovery (PITR) ready using PostgreSQL Write-Ahead Logs (WAL).
- Automated integrity verification using test restorations.
- Complete runbook provided in `docs/disaster-recovery.md`.
