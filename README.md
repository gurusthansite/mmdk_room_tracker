# Accommodation Management System

A production-ready Accommodation Management System designed for managing registrations, room inventory, manual bed/mat allocation, reception confirmation with Aadhaar compliance, check-in/checkout, WhatsApp communications, and reporting.

## Visual Design Reference
Refer to `docs/reference/accommodation-dashboard.png` for visual styling and operational workflow layouts.

## Architecture & Technology Stack
- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Lucide Icons, Recharts, React Hook Form, Zod.
- **Backend**: Node.js, Express.js, TypeScript, Prisma ORM, Zod, bcryptjs, jsonwebtoken, cookie-parser, crypto (AES-256-GCM).
- **Database**: PostgreSQL 18 with `btree_gist` exclusion constraints and automated capacity synchronization triggers.
- **Deployment**: Frontend to Vercel, Backend and PostgreSQL to Railway.

## Current Project Status
- **Phase 1: Project Foundation** - COMPLETED
- **Phase 2: Database Architecture** - COMPLETED
- **Phase 2.1: Database Hardening** - COMPLETED
- **Phase 3: Admin Authentication** - COMPLETED (Secure HttpOnly cookies, bcrypt hashing, rate limiting, RBAC middleware, 21/21 auth tests passed)
- **Phase 4: Room & Inventory Management** - COMPLETED (Beds/Mats breakdown, live visual occupancy grid, trigger synchronization, 27/27 room tests passed)
- **Phase 5: Registration Management** - COMPLETED (Concurrency-safe sequence IDs, multi-member groups, Excel import/export, soft delete, 10/10 test subsystems passed)
- **Phase 6: Manual Accommodation Allocation Engine** - COMPLETED (Sequential ALC-XXXX numbering, multi-room/heterogeneous units, PostgreSQL exclusion double-booking protection, status lifecycle, 10/10 test subsystems passed)
- **Phase 7: WhatsApp Click-to-Chat Integration** - COMPLETED (Standard wa.me non-API deep links, mandatory tentative disclaimer, zero Aadhaar disclosure, idempotency & staff confirmation workflow, 10/10 tests passed)
- **Phase 8: Reception Desk & Actual Occupancy Management** - COMPLETED (Partial group arrivals, bed mapping, AES-256-GCM Aadhaar compliance, live check-in/checkout, room transfers, 11/11 tests passed)
- **Phase 8.1: Reception Final Security & Workflow Audit** - COMPLETED (Check-in authorization hardening, stay extension conflict checking, transfer chaining, zero Aadhaar leak verification, full regression passed)
- **Phase 9: Search, Audit Trail & Activity Logging** - COMPLETED (Debounced global search, immutable activity audit trail, change diffs, operational insights, sanitized Excel export, 10/10 tests passed)
- **Phase 10: Reports, Analytics & Operational Exports** - COMPLETED (Interactive charts, room & bed occupancy utilization, registration demographics, daily turnover timeline, multi-sheet Excel & PDF exports, 10/10 tests passed)
- **Phase 11: Production Hardening, Performance & Security Audit** - COMPLETED (HTTP security headers, general API rate limiter, production error masking, race condition double-booking exclusions, backup scripts & DR runbook, 10/10 tests passed)
- **Phase 12: Production Deployment Preparation** - UPCOMING (Awaiting approval)

## Quick Start (Development)

### Prerequisites
- Node.js v20+ / v22+
- npm v10+
- PostgreSQL v16+ / v18+ (configured on port 5433 for local dev cluster)

### 1. Database Setup & Migrations
```bash
cd backend
npm install
npx prisma migrate deploy
npm run prisma:seed
```

### 2. Run Test Suites
```bash
cd backend
# Database Architecture & Hardening Tests (28 tests)
npx tsx src/test/database-verification.ts

# Admin Authentication & RBAC Tests (21 tests)
npx tsx src/test/auth-verification.ts

# Room & Inventory Management Tests (27 tests)
npx tsx src/test/room-verification.ts

# Registration Management Tests (10 subsystems)
npx tsx src/test/registration-verification.ts

# Manual Accommodation Allocation Engine Tests (10 subsystems)
npx tsx src/test/allocation-verification.ts

# WhatsApp Click-to-Chat Integration Tests (10 subsystems)
npx tsx src/test/whatsapp-verification.ts

# Reception Desk & Occupancy Management Tests (11 subsystems)
npx tsx src/test/reception-verification.ts

# Global Search, Audit Trail & Activity Logging Tests (10 subsystems)
npx tsx src/test/activity-verification.ts

# Reports, Analytics & Operational Exports Tests (10 subsystems)
npx tsx src/test/report-verification.ts

# Production Hardening, Concurrency & Security Tests (10 tests)
npx tsx src/test/production-hardening-verification.ts
```

### 3. Backend Setup
```bash
cd backend
npm run dev
```
Backend API will listen on `http://localhost:5000/api`.

### 4. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Access the application at `http://localhost:3000`. Navigate to `/login` to sign in using the development admin account:
- Email: `admin@accommodation.local`
- Password: `Admin@123`
*(Note: rotate password before production deployment)*
