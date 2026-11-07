# Accommodation Management System - Development Phases & Status Tracking

## Development Methodology
The project strictly follows a phased roadmap. Each phase must be completed, tested, and documented before transitioning to subsequent phases.

---

### Phase Status Overview

| Phase | Description | Status | Completion Date |
|---|---|---|---|
| **Phase 1** | Project Foundation, Workspace Setup, TypeScript, DB Connectivity, Initial API | **COMPLETED** | 05-Nov-2026 |
| **Phase 2** | Database Architecture, Complete Prisma Schema, Migrations, Seed Data | **COMPLETED** | 05-Nov-2026 |
| **Phase 2.1** | Database Hardening: Exclusion Constraints, Gender Flexibility, Trigger Sync, Archival | **COMPLETED** | 05-Nov-2026 |
| **Phase 3** | Admin Authentication: JWT, HttpOnly Cookies, RBAC Middleware, Login Page | **COMPLETED** | 05-Nov-2026 |
| **Phase 4** | Room & Unit Inventory Management (Beds, Mats, Gender Categories) | **COMPLETED** | 05-Nov-2026 |
| **Phase 5** | Registration Management, Search, Filters, Excel Import | **COMPLETED** | 05-Nov-2026 |
| **Phase 6** | Manual Accommodation Allocation Engine, Date Ranges, Concurrency Locks | **COMPLETED** | 05-Nov-2026 |
| **Phase 7** | WhatsApp Click-to-Chat Integration & Message Activity Tracking | **COMPLETED** | 05-Nov-2026 |
| **Phase 8** | Reception Workbench, Actual Participant Details, Encrypted Aadhaar Collection | **COMPLETED** | 05-Nov-2026 |
| **Phase 8.1** | Reception Final Security & Workflow Audit | **COMPLETED** | 05-Nov-2026 |
| **Phase 9** | Global Search, Audit Trail & Activity Logging | **COMPLETED** | 05-Nov-2026 |
| **Phase 10** | Reports, Analytics & Operational Exports (Excel & PDF) | **COMPLETED** | 05-Nov-2026 |
| **Phase 11** | Production Hardening, Performance & Security Audit | **COMPLETED** | 06-Nov-2026 |
| **Phase 12** | Production Deployment Preparation (Vercel Frontend, Railway Backend & PostgreSQL) | PENDING | - |

---

### Phase 3 Checklist (Admin Authentication)
- [x] Implement `POST /api/auth/login` validating against `AdminUser` in PostgreSQL via bcrypt.
- [x] Configure secure `HttpOnly`, `SameSite: lax`, `path: /` session cookie (`auth_token`).
- [x] Eliminate `localStorage` credential/token storage on frontend (`credentials: 'include'`).
- [x] Implement in-memory IP brute-force rate limiting (HTTP 429 after 5 failed attempts).
- [x] Validate all auth request bodies with Zod.
- [x] Implement `requireAuth` authentication middleware verifying JWT cookies and bearer fallback.
- [x] Implement `requireRole` role-based authorization middleware supporting `UserRole` enums.
- [x] Implement `POST /api/auth/logout` invalidating session cookie.
- [x] Implement `GET /api/auth/me` returning sanitized active user details.
- [x] Log successful logins into PostgreSQL `ActivityLog`.
- [x] Build frontend Login page (`/login`) matching reference styling with Zod + React Hook Form.
- [x] Build protected Dashboard Layout (`/dashboard`) with navigation sidebar, header profile, and route guard.
- [x] Preserve default seeded Super Admin account (`admin@accommodation.local`).
- [x] Execute automated auth test suite (`backend/src/test/auth-verification.ts`) with 21/21 passing tests.
- [x] Verify backend TypeScript compilation (`npx tsc --noEmit` -> 0 errors).
- [x] Verify frontend production build (`next build` -> 0 errors, 4 static routes generated).
- [x] Update documentation: `docs/architecture.md`, `docs/development-phases.md`, and `README.md`.

---

### Phase 4 Checklist (Room & Unit Inventory Management)
- [x] Implement room listing endpoint `GET /api/rooms` with search (`q`), building, status, and gender filters.
- [x] Calculate detailed room breakdowns: Beds (M), Beds (F), Mats (M), Mats (F), and total capacity matching reference dashboard.
- [x] Implement single room details endpoint `GET /api/rooms/:id` computing dynamic `visualState` (`AVAILABLE`, `ALLOCATED`, `CONFIRMED`, `CHECKED_IN`, `MAINTENANCE`) and occupant details.
- [x] Implement room creation endpoint `POST /api/rooms` with automated bed (`B1`..`Bn`) and mat (`M1`..`Mn`) unit provisioning.
- [x] Implement room update endpoint `PUT /api/rooms/:id` for modifying building, floor, gender preference, status, and notes.
- [x] Implement unit addition endpoint `POST /api/rooms/:id/units` and unit update endpoint `PUT /api/rooms/:id/units/:unitId`.
- [x] Implement room deletion endpoint `DELETE /api/rooms/:id` with foreign-key protection preventing deletion of allocated rooms.
- [x] Enforce RBAC permissions: mutation routes restricted to `SUPER_ADMIN` and `ALLOCATION_MANAGER`; `RECEPTION_STAFF` restricted to inventory viewing and maintenance note updates.
- [x] Verify PostgreSQL capacity synchronization trigger `trigger_sync_room_capacity` on `accommodation_units`.
- [x] Build frontend Room Management page (`/dashboard/rooms`) matching reference layout (`accommodation-dashboard.png`):
  - Top 4 KPI metric cards (Total Rooms, Total Beds, Total Mats, Total Units).
  - Search and multi-filter toolbar (search by room/building/notes, building select, status select, gender select).
  - Rooms Directory table with breakdown columns, badges, active row highlight, and actions.
  - Interactive Room Layout Visualizer with 5 color-coded statuses (Available, Allocated, Confirmed, Checked In, Maintenance).
  - Individual Bed & Mat unit cards with icons, gender badges, occupant details, and click-to-edit modal.
  - Modals for Add Room (with live auto-provisioning calculator), Edit Room, Add Unit, Edit Unit, and Delete Room confirmation.
- [x] Execute automated room test suite (`backend/src/test/room-verification.ts`) with 27/27 passing tests.
- [x] Verify backend TypeScript compilation (`npx tsc --noEmit` -> 0 errors).
- [x] Verify frontend production build (`npm run build` -> 0 errors, `/dashboard/rooms` 10.9 kB static route generated).

---

### Phase 5 Checklist (Registration Management)
- [x] Create concurrency-safe PostgreSQL sequence `registration_id_seq` and stored function `generate_next_registration_id()`.
- [x] Apply database migration `20261105020000_concurrency_safe_registration_id`.
- [x] Implement registration listing endpoint `GET /api/registrations` with search (`q` on ID, Name, Phone, City), status, date range, archival filter, and pagination.
- [x] Implement single registration endpoint `GET /api/registrations/:id` returning participants, allocation summary, stay records, and message logs with strict Aadhaar data masking.
- [x] Implement registration creation `POST /api/registrations` with atomic transaction, primary participant generation, optional accompanying members, and activity logging.
- [x] Implement registration update `PUT /api/registrations/:id` preserving audit trail in `ActivityLog`.
- [x] Implement soft deletion / archival `DELETE /api/registrations/:id` (`isArchived: true`, `deletedAt`) preventing destructive cascade deletion.
- [x] Implement registration restore `POST /api/registrations/restore/:id`.
- [x] Implement downloadable `.xlsx` registration import template `GET /api/registrations/template`.
- [x] Implement Excel preview & validation `POST /api/registrations/import/preview` with duplicate detection against existing database and within batch.
- [x] Implement atomic batch Excel import `POST /api/registrations/import` generating concurrency-safe IDs.
- [x] Implement filtered registration Excel export `GET /api/registrations/export` with strict Aadhaar exclusion.
- [x] Build frontend Registration Directory page (`/dashboard/registrations`) with metrics, search/filters, table, modals, and client-side Excel preview/import.
- [x] Build frontend Registration Detail page (`/dashboard/registrations/[id]`) with dossier view, group participants, allocation summary, and stay history.
- [x] Enforce backend RBAC: `SUPER_ADMIN` and `ALLOCATION_MANAGER` can create, edit, archive, and import; `RECEPTION_STAFF` and `VIEWER` have read-only access.
- [x] Execute automated verification test suite (`backend/src/test/registration-verification.ts`) with 10/10 passing subsystems.
- [x] Verify zero regressions on prior suites: `room-verification.ts` (27/27), `auth-verification.ts` (21/21), `database-verification.ts` (28/28).
- [x] Verify backend TypeScript compilation (`npx tsc --noEmit` -> 0 errors).
- [x] Verify frontend production build (`npm run build` -> 0 errors, `/dashboard/registrations` and `/dashboard/registrations/[id]` generated).

---

### Phase 6 Checklist (Manual Accommodation Allocation Engine)
- [x] Create concurrency-safe PostgreSQL sequence `allocation_number_seq` and stored generator function `generate_next_allocation_number()`.
- [x] Apply database migration `20261105030000_concurrency_safe_allocation_number`.
- [x] Implement inventory availability query `GET /api/allocations/availability` calculating real-time free vs occupied units for date window `[entryDate, exitDate)`.
- [x] Implement allocations listing `GET /api/allocations` with search, status filter, date range, pagination, and room summaries.
- [x] Implement allocation details `GET /api/allocations/:id` with registration and unit breakdown.
- [x] Implement manual allocation creation `POST /api/allocations` supporting multi-room and heterogeneous bed/mat assignments.
- [x] Protect against double booking via PostgreSQL exclusion constraint `no_overlapping_active_allocations` (`23P01`).
- [x] Support multi-registration room sharing (different registrations allocating separate units in the same room).
- [x] Implement allocation updates `PUT /api/allocations/:id` (dates, unit reassignments, status transitions `TENTATIVE` -> `CONFIRMED`).
- [x] Implement allocation cancellation `POST /api/allocations/:id/cancel` and `DELETE /api/allocations/:id` releasing capacity immediately.
- [x] Build frontend Allocation Workbench (`/dashboard/allocate`) with:
  - Step 1: Searchable registration selector.
  - Step 2: Stay date window picker with night calculator.
  - Step 3: Interactive unit availability explorer with color-coded badges and click-to-basket selection.
  - Live Selected Basket Tray and Status selector (`TENTATIVE` vs `CONFIRMED`).
  - Active Allocations Directory tab with search, filters, table, and cancel dialog.
- [x] Enforce RBAC: `SUPER_ADMIN` and `ALLOCATION_MANAGER` can create/update/cancel; `RECEPTION_STAFF` and `VIEWER` have read-only access.
- [x] Execute automated verification test suite (`backend/src/test/allocation-verification.ts`) with 10/10 passing subsystems.
- [x] Verify zero regressions on prior suites: `registration-verification.ts`, `room-verification.ts`, `auth-verification.ts`, `database-verification.ts`.
- [x] Verify backend TypeScript compilation (`npx tsc --noEmit` -> 0 errors).
- [x] Verify frontend production build (`npm run build` -> 0 errors, `/dashboard/allocate` 7.09 kB static route generated).

---

### Phase 7 Checklist (WhatsApp Click-to-Chat Integration)
- [x] Implement isolated template generation utility `backend/src/utils/whatsappTemplate.ts`.
- [x] Implement robust Indian phone number normalizer `formatPhoneNumberForWhatsApp` (10-digit, 0 prefix, +91, special characters).
- [x] Implement standard non-API URL generation `https://wa.me/<phone>?text=<encoded>`.
- [x] Enforce mandatory tentative disclaimer: `TENTATIVE ACCOMMODATION ALLOCATION – NOT CONFIRMED`.
- [x] Enforce zero Aadhaar/KYC disclosure security checks across message generators.
- [x] Implement `POST /api/whatsapp/prepare` with idempotency safeguards (prevent duplicate logs when re-previewing).
- [x] Implement `PATCH /api/whatsapp/messages/:id/open` recording `OPENED` state while strictly leaving `sentAt` and `sentByUserId` as `null`.
- [x] Implement `PATCH /api/whatsapp/messages/:id/confirm-sent` recording `STAFF_CONFIRMED_SENT`, `sentByUserId`, `sentAt`, and staff notes.
- [x] Implement `PATCH /api/whatsapp/messages/:id/failed` recording `FAILED` and failure reasons in audit logs.
- [x] Implement `GET /api/whatsapp/messages` listing and querying message history with pagination.
- [x] Enforce RBAC: `SUPER_ADMIN`, `ALLOCATION_MANAGER`, and `RECEPTION_STAFF` can prepare/open/confirm messages; `VIEWER` is read-only.
- [x] Build frontend WhatsApp modal in `/dashboard/allocate` with:
  - Phone chat mockup preview with pre-wrap formatted text and end-to-end encryption badge.
  - One-click launch button opening `wa.me` in a new window.
  - Copy formatted text button.
  - Step-by-step Staff Confirmation workflow with explicit "Confirm Message Sent" vs "Report Failed" actions.
  - Communication History tab with live status badges (`PREPARED`, `OPENED`, `STAFF_CONFIRMED_SENT`, `FAILED`), timestamps, and staff details.
- [x] Add WhatsApp action buttons to Allocations Table and View Dossier dialog.
- [x] Execute automated verification test suite (`backend/src/test/whatsapp-verification.ts`) with 10/10 passing tests.
- [x] Verify zero regressions on prior suites: `allocation-verification.ts`, `registration-verification.ts`, `room-verification.ts`, `auth-verification.ts`, `database-verification.ts`.
- [x] Verify backend TypeScript compilation (`npm run build` -> 0 errors).
- [x] Verify frontend production build (`npm run build` -> 0 errors, `/dashboard/allocate` 10.7 kB static route generated).

---

### Phase 8 Checklist (Reception Desk & Actual Occupancy Management)
- [x] Apply database hardening migration `20261105040000_participant_stay_exclusion` adding PostgreSQL exclusion constraint `no_overlapping_participant_stays` on `stay_records`.
- [x] Implement reception overview and live queue counters `GET /api/reception/overview` (today's arrivals, tentative awaiting, in-house, departures, checked-out).
- [x] Implement fast reception search and lookup `GET /api/reception/lookup` (by registration ID, allocation number, mobile, guest name).
- [x] Implement comprehensive reception dossier `GET /api/reception/dossier/:id` calculating capacity breakdown and returning masked Aadhaar details.
- [x] Implement actual arriving participant recording `POST /api/reception/participants` supporting partial family arrivals and adding unlisted arrivals.
- [x] Implement secure Aadhaar collection `POST /api/reception/aadhaar` with AES-256-GCM encryption, statutory consent recording, and strictly masked UI display.
- [x] Implement reception review and allocation confirmation `POST /api/reception/confirm` mapping arriving members to allocated units with partial confirmation support.
- [x] Implement physical check-in activation `POST /api/reception/check-in` creating live `StayRecord` entries with double occupancy (`23P01`) prevention.
- [x] Implement room/bed/mat transfer `POST /api/reception/transfer` preserving prior stay record, transfer reason, and timestamp in audit history.
- [x] Implement physical checkout `POST /api/reception/check-out` and authorized stay extension `POST /api/reception/extend-stay` with immediate capacity release.
- [x] Enforce RBAC permissions: `SUPER_ADMIN`, `ALLOCATION_MANAGER`, and `RECEPTION_STAFF` can operate reception workflows; `VIEWER` has read-only access.
- [x] Build reception dashboard at `/dashboard/reception`:
  - Quick Search bar with debounced dropdown results.
  - KPI summary metric cards (Today's Arrivals, Tentative, In-House, Departures, Checked Out).
  - Queue tabs (Today's Arrivals, Tentative Queue, In-House Stays, Checked Out).
  - Interactive Reception Desk Dossier modal with arriving group management, bed mapping, and check-in/checkout actions.
  - Aadhaar Compliance & Encrypted Collection dialog with statutory notice and consent checkbox.
  - Room Transfer modal with destination unit selector and reason capture.
- [x] Execute automated verification test suite (`backend/src/test/reception-verification.ts`) with 11/11 passing tests.
- [x] Verify zero regressions on prior suites: `whatsapp-verification.ts`, `allocation-verification.ts`, `registration-verification.ts`, `room-verification.ts`, `auth-verification.ts`, `database-verification.ts`.
- [x] Verify backend TypeScript compilation (`npm run build` -> 0 errors).
- [x] Verify frontend production build (`npm run build` -> 0 errors, `/dashboard/reception` 10.4 kB static route generated).

---

### Phase 8.1 Checklist (Reception Final Security & Workflow Audit)
- [x] **Partial Confirmation Audit**:
  - Confirmed 3 of 5 arriving group members without advancing or auto-confirming the remaining 2 unarrived members.
  - Verified unused allocated units remain reserved or are cleanly released back to inventory.
  - Verified registration, allocation, and participant statuses maintain relational integrity throughout partial flows.
- [x] **Check-in Authorization Hardening**:
  - Enforced mandatory `CONFIRMED` participant status check before check-in activation (unconfirmed check-ins rejected with HTTP 400).
  - Enforced valid participant ID and assigned physical unit existence before committing stay records.
  - Blocked check-in into units under `MAINTENANCE` or `INACTIVE` status with descriptive rejection.
  - Hardened participant re-occupancy checks (attempts to re-check in an already `CHECKED_IN` participant throw `23P01` -> HTTP 409 `OCCUPANCY_CONFLICT`).
  - Preserved actual check-in timestamp (`actualCheckIn`) across all stay operations.
- [x] **Stay Extension Conflict Hardening**:
  - Validated target exit date must be strictly in the future.
  - Added proactive conflict check against overlapping active allocation items on the unit during `[now, extensionTargetDate)`.
  - Conflicting extensions rejected with HTTP 409 `EXTENSION_CONFLICT` without modifying stay records.
  - Preserved original planned dates in `stayRecord.notes` and `ActivityLog.details.originalPlannedExit` as immutable audit entries.
- [x] **Room Transfer Audit & Integrity**:
  - Verified prior stay record is terminated (`CHECKED_OUT`) precisely at the transfer timestamp.
  - Verified destination unit availability and rejected transfers into occupied units with HTTP 409 `OCCUPANCY_CONFLICT`.
  - Verified historical chaining: new `StayRecord` links back to old stay via `previousStayRecordId`.
  - Preserved operating staff member ID (`recordedById`), transfer reason, and timestamps in both `StayRecord` and `ActivityLog`.
- [x] **Aadhaar Security & Compliance Audit**:
  - Confirmed AES-256-GCM encryption keys (`AADHAAR_ENCRYPTION_KEY`) are loaded strictly from secure environment variables (`.env`).
  - Confirmed zero plaintext Aadhaar leakage across all API endpoints, log files, `ActivityLog`, WhatsApp templates, and Excel exports.
  - Verified Aadhaar display is strictly masked (`XXXX-XXXX-1234`) across all client interfaces.
  - Verified statutory retention consent checkbox (`retentionConsent`) and documented Indian legal/policy assumptions.
- [x] **Phase 5 Deliverable Verification**:
  - Concurrency-safe sequential Registration ID generation (`REG-XXXX` via PostgreSQL sequence).
  - Manual registration creation and editing with multi-member groups.
  - Search by Registration ID, name, mobile; status and date filters; pagination.
  - Excel template download, Excel bulk import with duplicate preview check, and Excel export with zero Aadhaar leakage.
- [x] **Regression & Typecheck Suite**:
  - All 7 verification test suites passing (reception 11/11, whatsapp 10/10, allocation, registration, room 27/27, auth 21/21, database 28/28).
  - Backend TypeScript compilation: 0 errors (`npm run build`).
  - Frontend TypeScript verification: 0 errors (`npx tsc --noEmit`).

---

### Phase 9 Checklist (Global Search, Audit Trail & Activity Logging)
- [x] Implement fast global search backend `GET /api/search` with input validation, limit bounding, and entity identification (`REGISTRATION`, `ALLOCATION`, `ROOM`, `UNIT`, `PARTICIPANT`).
- [x] Enforce zero Aadhaar exposure: strictly omit full and encrypted Aadhaar fields from search queries, indexes, and responses.
- [x] Implement operational activity log endpoint `GET /api/activity` supporting pagination, date range filtering, action filtering, entity type filtering, staff filtering, and keyword search.
- [x] Implement sensitive field redaction engine scrubbing credentials, passwords, session tokens, and encrypted blobs from audit detail JSON.
- [x] Enforce audit log immutability: zero `POST`, `PUT`, `PATCH`, or `DELETE` endpoints exposed; historical audit entries cannot be mutated or deleted via standard APIs.
- [x] Implement operational insights endpoint `GET /api/activity/insights` querying real-time database records for today's registrations, allocations, check-ins, checkouts, active in-house participants, and recent room transfers.
- [x] Implement staff directory endpoint `GET /api/activity/staff` populating staff filter options for authorized administrative users.
- [x] Implement audit log Excel export `GET /api/activity/export` generating formatted `.xlsx` spreadsheets, protected by strict RBAC (`SUPER_ADMIN` and `ALLOCATION_MANAGER` only).
- [x] Build frontend `GlobalSearch` header component in `/dashboard/layout.tsx` with hotkey shortcut (`⌘K` / `Ctrl+K`), debounced lookup, categorized badges, and one-click navigation to records.
- [x] Build `/dashboard/activity` page with operational summary KPI metric cards, multi-facet filter bar, responsive audit table, formatted change viewer modal, and Excel download action.
- [x] Execute automated verification test suite (`backend/src/test/activity-verification.ts`) with 10/10 passing tests.
- [x] Verify zero regressions on prior suites: `reception-verification.ts` (11/11), `whatsapp-verification.ts` (10/10), `allocation-verification.ts`, `registration-verification.ts`, `room-verification.ts` (27/27), `auth-verification.ts` (21/21), `database-verification.ts` (28/28).
- [x] Verify backend TypeScript compilation (`npm run build` -> 0 errors).
- [x] Verify frontend TypeScript build (`npx tsc --noEmit` -> 0 errors).

---

### Phase 10 Checklist (Reports, Analytics & Operational Exports)
- [x] Implement executive report overview backend `GET /api/reports/overview` with capacity calculations, bed vs mat breakdown, active stays, and registration status distribution.
- [x] Implement room & bed occupancy utilization backend `GET /api/reports/occupancy` with building/floor grouping and room-by-room utilization rosters.
- [x] Implement registration analytics backend `GET /api/reports/registrations` with status breakdown, group size distribution, top cities/states, and daily registration velocity.
- [x] Implement participant demographics & statutory compliance backend `GET /api/reports/participants` with gender, age groups, primary vs accompanying ratio, and Aadhaar compliance rates.
- [x] Implement daily operational timeline backend `GET /api/reports/operational-daily` with date range filtering comparing expected arrivals/departures vs actual check-ins/check-outs and transfers.
- [x] Implement multi-sheet Excel export `GET /api/reports/export/excel` generating formatted `.xlsx` workbooks across Executive Summary, Room Utilization, Active In-House Roster, and Registrations.
- [x] Implement binary PDF executive briefing generator `GET /api/reports/export/pdf` using PDFKit with headers, KPI grids, building tables, and statutory privacy disclaimers.
- [x] Enforce RBAC security: all authenticated administrative roles can view reports; Excel and PDF exports strictly restricted to `SUPER_ADMIN` and `ALLOCATION_MANAGER`.
- [x] Enforce zero sensitive Aadhaar leakage across all report JSON outputs, Excel sheets, and PDF pages.
- [x] Build interactive reports dashboard at `/dashboard/reports` with quick date presets ("All Time", "Today", "Past 7 Days", "Past 30 Days", "Custom Range"), Recharts visual charts, room utilization breakdown with expandable occupant drawers, and direct export actions.
- [x] Execute automated verification test suite (`backend/src/test/report-verification.ts`) with 10/10 passing tests.
- [x] Verify zero regressions on prior suites: `activity-verification.ts` (10/10), `reception-verification.ts` (11/11), `whatsapp-verification.ts` (10/10), `allocation-verification.ts`, `registration-verification.ts`, `room-verification.ts` (27/27), `auth-verification.ts` (21/21), `database-verification.ts` (28/28).
- [x] Verify backend TypeScript compilation (`npm run build` -> 0 errors).
- [x] Verify frontend TypeScript verification (`npx tsc --noEmit` -> 0 errors).

---

### Phase 11 Checklist (Production Hardening, Performance & Security Audit)
- [x] **HTTP Security Headers & Server Hardening**:
  - `X-Content-Type-Options: nosniff` preventing MIME confusion attacks.
  - `X-Frame-Options: DENY` preventing clickjacking and UI redressing.
  - `X-XSS-Protection: 1; mode=block` enforcing browser XSS mitigation.
  - `Referrer-Policy: strict-origin-when-cross-origin` preventing referrer leaks.
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains` (production).
  - Server fingerprint masking: disabled `x-powered-by` header across all Express endpoints.
- [x] **API Rate Limiting & Denial-of-Service Defense**:
  - Global IP rate limiter (`generalApiRateLimiter`: 600 req/min per IP) applied to `/api` routes.
  - Brute-force auth rate limiter (`loginRateLimiter`: 5 failed attempts per 15 min per IP) on `/api/auth/login`.
- [x] **Production Error Masking & Information Leakage Defense**:
  - Hardened centralized error handler (`errorHandler.ts`): zero internal database errors, SQL fragments, or stack traces leaked to clients in production mode (`NODE_ENV=production`).
- [x] **Concurrency & Race Condition Hardening**:
  - Sequential `REG-XXXX` generation: race-condition free under simultaneous load via PostgreSQL atomic sequences.
  - Simultaneous duplicate allocation attempt: exclusion constraint `no_overlapping_active_allocations` (`23P01`) cleanly yields 1 success (201) and 1 rejection (409 `DOUBLE_BOOKING_CONFLICT`).
  - Simultaneous duplicate physical check-in: exclusion constraint `no_overlapping_participant_stays` (`23P01`) cleanly yields 1 success (200) and 1 rejection (409 `OCCUPANCY_CONFLICT`).
  - Unit status guard: units marked `MAINTENANCE` or `INACTIVE` rejected at allocation time and check-in time with HTTP 400.
- [x] **System Health & Telemetry Probes**:
  - `/api/health` enhanced with database connection status, latency benchmark (ms), process uptime (seconds), and memory usage telemetry (RSS & Heap in MB).
- [x] **Backup & Disaster Recovery Procedures**:
  - Automated PowerShell backup script `backend/scripts/backup.ps1` utilizing `pg_dump` with gzip compression.
  - Automated Bash backup script `backend/scripts/backup.sh` utilizing `pg_dump` with gzip compression.
  - Complete Disaster Recovery Runbook `docs/disaster-recovery.md` covering automated scheduling (cron / Task Scheduler), retention tiers (daily/weekly/monthly), Point-in-Time Recovery (PITR), and integrity verification protocols.
- [x] **Sensitive Data & Aadhaar Privacy Audit**:
  - Zero plaintext Aadhaar exposure across all endpoints, search results, activity logs, reports, and export files.
  - AES-256-GCM encryption verified for all stored Aadhaar records.
  - Masked UI format (`XXXX-XXXX-1234`) enforced everywhere.
- [x] **Automated Verification & Regression**:
  - Dedicated Phase 11 verification suite (`backend/src/test/production-hardening-verification.ts`) with 10/10 tests passing.
  - Complete full regression passing across all prior modules:
    - Phase 10 Reports: 10/10 passing (`report-verification.ts`)
    - Phase 9 Search & Activity: 10/10 passing (`activity-verification.ts`)
    - Phase 8 Reception Desk: 11/11 passing (`reception-verification.ts`)
    - Phase 7 WhatsApp Click-to-Chat: 10/10 passing (`whatsapp-verification.ts`)
    - Phase 6 Allocation Engine: 10/10 passing (`allocation-verification.ts`)
    - Phase 5 Registration Management: 10/10 passing (`registration-verification.ts`)
    - Phase 4 Room Inventory: 27/27 passing (`room-verification.ts`)
    - Phase 3 Authentication & RBAC: 21/21 passing (`auth-verification.ts`)
    - Phase 2.1 Database Hardening: 28/28 passing (`database-verification.ts`)
- [x] **Build & Static Analysis**:
  - Backend TypeScript compilation: 0 errors (`npm run build`).
  - Frontend TypeScript verification: 0 errors (`npx tsc --noEmit`).
