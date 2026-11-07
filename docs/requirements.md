# Accommodation Management System - Requirements Specification

## 1. System Overview
The Accommodation Management System is a production-grade enterprise platform designed to manage participant accommodation for large-scale events, conferences, and retreats. The system oversees registrations, room/unit inventory, manual bed and mat allocations, reception confirmation with mandatory Aadhaar collection, check-in, check-out, WhatsApp notifications, and administrative reporting.

## 2. Core Functional Modules

### Module 1: Admin & Staff Authentication
- Secure authentication with bcrypt password hashing and JWT/session management.
- Initial Super Admin account with role architecture structured for staff roles (`SUPER_ADMIN`, `RECEPTION_STAFF`, `ALLOCATION_MANAGER`, `VIEWER`).
- Route guards and protected API endpoints with granular permissions.

### Module 2: Room & Unit Inventory Management
- Physical room creation: Room ID/Number, Building/Block, total beds, total mats, status (`ACTIVE`, `MAINTENANCE`, `INACTIVE`), gender assignment, notes.
- Granular Unit Inventory: Each physical bed (`B1`, `B2`, etc.) and mat (`M1`, `M2`, etc.) is tracked as an individual entity (`AccommodationUnit`).
- Category attributes: Bed vs. Mat, Male vs. Female vs. Any, Active vs. Inactive.
- Support for multi-registration room sharing.

### Module 3: Registration Management
- Unique human-readable Registration ID (`REG-0001`, `REG-0002`, etc.).
- Primary registrant details: Full Name, Mobile Number, Total Registered Members, Registration Date, Status, Special Notes.
- Manual registration creation and bulk Excel import/export.
- Full search, filter, and pagination support.

### Module 4: Manual Accommodation Allocation Engine
- Complete manual administrative control over unit assignment (no blind automated assignments).
- Unit-level assignment to prevent accidental overbooking or room mismatch.
- Support for complex scenarios:
  - Single registration spanning multiple rooms (e.g. 3 beds in R-101, 2 beds in R-102).
  - Multiple registrations sharing the same room.
  - Heterogeneous units (combination of beds and mats).
  - Segregated gender allocation.
  - Distinct entry and exit date windows.
- Database transactions with concurrency locks to prevent race conditions / double booking.
- Tentative allocation state reservations (distinct from confirmed occupancy).

### Module 5: WhatsApp Notification System
- Direct Click-to-Chat integration (desktop & mobile compatible, no vendor API locking).
- Personalized notification templates including Registrant Name, Reg ID, Allocated Room(s), Unit Breakdown, Date Range, Reception instructions, and Aadhaar requirement reminder.
- Prominent disclaimer: `"TENTATIVE ACCOMMODATION ALLOCATION – NOT CONFIRMED"`.
- Three-state message tracking: `PREPARED`, `OPENED`, `STAFF_CONFIRMED_SENT`.
- Zero credential requirements; works on any staff device.

### Module 6: Reception & Mandatory Aadhaar Confirmation
- Rapid search by Reg ID, Primary Name, Mobile, or Room Number.
- Display tentative allocation vs. actual arrivals.
- Individual participant detail collection at reception: Full Name, Gender, Age, Relation.
- Mandatory 12-digit Aadhaar collection for Primary Registrant and eligible accompanying members.
- Compliance and security: AES-256 application-level encryption, masking in UI (`XXXX-XXXX-1234`), audit trail of recording staff, zero UIDAI external transmission, strictly excluded from WhatsApp messages and general exports.
- Capacity confirmation only for arrived members.

### Module 7: Reception Modifications & Re-allocations
- Flexibility to change room, transfer occupants, swap beds and mats, adjust quantities, extend or reduce stay dates.
- Atomic availability verification before committing modifications.
- Complete immutable audit logging of prior allocations, modification timestamp, reason, and actor.

### Module 8: Check-In & Check-Out Tracking
- Actual check-in timestamp and actual departure recording.
- Immediate capacity release only upon formal checkout or authorized cancellation.
- Scheduled exit dates do not auto-release capacity to prevent premature eviction of staying guests.

### Module 9: Executive Dashboard
- Visual KPIs matching the reference dashboard:
  - Total Rooms, Total Beds, Total Mats, Registered Members.
  - Tentative Allocations, Confirmed Members, Currently Checked In (Staying), Checked Out, Available Capacity.
- Donut chart for Occupancy Overview.
- Today's Summary metrics (New Allocations, Confirmations, Check-ins, Check-outs, Date Modifications).
- Interactive Room Layout Visualizer with color-coded unit statuses (Available [Green], Allocated [Blue], Confirmed [Amber], Checked In [Purple]).

### Module 10: Reports & Data Export
- Room Occupancy Report.
- Registration & Allocation Report.
- Confirmed Participants Report.
- Currently Staying Report.
- Check-in / Check-out Report.
- Male/Female Accommodation Breakdown.
- Date-wise Capacity & Availability Report.
- Excel spreadsheet export (.xlsx) with masked Aadhaar compliance.

## 3. Non-Functional Requirements
- **Security**: AES-256 encryption for sensitive identifiers, bcrypt password hashing, secure JWT cookies/headers, CORS isolation, rate limiting.
- **Reliability & Concurrency**: PostgreSQL transactional isolation (`SERIALIZABLE` or pessimistic locking where unit collisions may occur).
- **Usability**: High-throughput reception speed, responsive mobile and desktop UI, keyboard-friendly data entry.
- **Maintainability**: Strict decoupling of Frontend and Backend, Prisma schema as single database source of truth, modular layered architecture.
