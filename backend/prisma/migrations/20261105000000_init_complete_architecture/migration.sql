-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ALLOCATION_MANAGER', 'RECEPTION_STAFF', 'VIEWER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "GenderPreference" AS ENUM ('MALE', 'FEMALE', 'ANY', 'FAMILY');

-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('BED', 'MAT');

-- CreateEnum
CREATE TYPE "GenderCategory" AS ENUM ('MALE', 'FEMALE', 'ANY');

-- CreateEnum
CREATE TYPE "UnitStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('REGISTERED', 'ALLOCATED', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('REGISTERED', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'NO_SHOW', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AllocationStatus" AS ENUM ('TENTATIVE', 'CONFIRMED', 'CANCELLED', 'MODIFIED');

-- CreateEnum
CREATE TYPE "AllocationItemStatus" AS ENUM ('TENTATIVE', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "StayStatus" AS ENUM ('CHECKED_IN', 'CHECKED_OUT', 'EXTENDED', 'EARLY_DEPARTURE');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('WHATSAPP_ALLOCATION_TENTATIVE', 'WHATSAPP_RECEPTION_CONFIRMATION', 'SMS_NOTIFICATION');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('PREPARED', 'OPENED', 'STAFF_CONFIRMED_SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "AadhaarComplianceStatus" AS ENUM ('COLLECTED', 'VERIFIED', 'EXEMPTED', 'DELETED');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'ALLOCATE', 'CONFIRM', 'CHECK_IN', 'CHECK_OUT', 'CANCEL', 'TRANSFER', 'STATUS_CHANGE');

-- DropTableIfExists
DROP TABLE IF EXISTS "SystemCheck";
DROP TABLE IF EXISTS "system_checks";

-- CreateTable
CREATE TABLE "system_checks" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'HEALTHY',
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'RECEPTION_STAFF',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "phone" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "roomNumber" TEXT NOT NULL,
    "building" TEXT,
    "floor" INTEGER,
    "totalBeds" INTEGER NOT NULL DEFAULT 0,
    "totalMats" INTEGER NOT NULL DEFAULT 0,
    "status" "RoomStatus" NOT NULL DEFAULT 'ACTIVE',
    "genderPreference" "GenderPreference" NOT NULL DEFAULT 'ANY',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accommodation_units" (
    "id" TEXT NOT NULL,
    "unitNumber" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "type" "UnitType" NOT NULL DEFAULT 'BED',
    "genderCategory" "GenderCategory" NOT NULL DEFAULT 'ANY',
    "status" "UnitStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accommodation_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registrations" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "primaryName" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "email" TEXT,
    "city" TEXT,
    "state" TEXT,
    "totalMembers" INTEGER NOT NULL DEFAULT 1,
    "registrationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'REGISTERED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participants" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "gender" "Gender" NOT NULL DEFAULT 'MALE',
    "age" INTEGER,
    "relationToPrimary" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "checkInStatus" "ParticipantStatus" NOT NULL DEFAULT 'REGISTERED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allocations" (
    "id" TEXT NOT NULL,
    "allocationNumber" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "status" "AllocationStatus" NOT NULL DEFAULT 'TENTATIVE',
    "entryDate" TIMESTAMP(3) NOT NULL,
    "exitDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "parentAllocationId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allocation_items" (
    "id" TEXT NOT NULL,
    "allocationId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "exitDate" TIMESTAMP(3) NOT NULL,
    "status" "AllocationItemStatus" NOT NULL DEFAULT 'TENTATIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "allocation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aadhaar_records" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "encryptedAadhaar" TEXT NOT NULL,
    "aadhaarIv" TEXT NOT NULL,
    "aadhaarAuthTag" TEXT NOT NULL,
    "lastFourDigits" VARCHAR(4) NOT NULL,
    "complianceStatus" "AadhaarComplianceStatus" NOT NULL DEFAULT 'COLLECTED',
    "retentionConsent" BOOLEAN NOT NULL DEFAULT true,
    "recordedById" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aadhaar_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stay_records" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "participantId" TEXT,
    "unitId" TEXT,
    "actualCheckIn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualCheckOut" TIMESTAMP(3),
    "status" "StayStatus" NOT NULL DEFAULT 'CHECKED_IN',
    "notes" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stay_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_logs" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "recipientMobile" TEXT NOT NULL,
    "messageType" "MessageType" NOT NULL DEFAULT 'WHATSAPP_ALLOCATION_TENTATIVE',
    "templateContent" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'PREPARED',
    "sentByUserId" TEXT,
    "sentAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" "ActionType" NOT NULL,
    "details" JSONB,
    "userId" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "admin_users_email_idx" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "admin_users_role_status_idx" ON "admin_users"("role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_roomNumber_key" ON "rooms"("roomNumber");

-- CreateIndex
CREATE INDEX "rooms_roomNumber_idx" ON "rooms"("roomNumber");

-- CreateIndex
CREATE INDEX "rooms_building_floor_idx" ON "rooms"("building", "floor");

-- CreateIndex
CREATE INDEX "rooms_status_idx" ON "rooms"("status");

-- CreateIndex
CREATE INDEX "accommodation_units_roomId_idx" ON "accommodation_units"("roomId");

-- CreateIndex
CREATE INDEX "accommodation_units_type_genderCategory_status_idx" ON "accommodation_units"("type", "genderCategory", "status");

-- CreateIndex
CREATE UNIQUE INDEX "accommodation_units_roomId_unitNumber_key" ON "accommodation_units"("roomId", "unitNumber");

-- CreateIndex
CREATE UNIQUE INDEX "registrations_registrationId_key" ON "registrations"("registrationId");

-- CreateIndex
CREATE INDEX "registrations_registrationId_idx" ON "registrations"("registrationId");

-- CreateIndex
CREATE INDEX "registrations_primaryName_idx" ON "registrations"("primaryName");

-- CreateIndex
CREATE INDEX "registrations_mobile_idx" ON "registrations"("mobile");

-- CreateIndex
CREATE INDEX "registrations_status_idx" ON "registrations"("status");

-- CreateIndex
CREATE INDEX "registrations_registrationDate_idx" ON "registrations"("registrationDate");

-- CreateIndex
CREATE INDEX "participants_registrationId_idx" ON "participants"("registrationId");

-- CreateIndex
CREATE INDEX "participants_fullName_idx" ON "participants"("fullName");

-- CreateIndex
CREATE INDEX "participants_checkInStatus_idx" ON "participants"("checkInStatus");

-- CreateIndex
CREATE UNIQUE INDEX "allocations_allocationNumber_key" ON "allocations"("allocationNumber");

-- CreateIndex
CREATE INDEX "allocations_registrationId_idx" ON "allocations"("registrationId");

-- CreateIndex
CREATE INDEX "allocations_status_idx" ON "allocations"("status");

-- CreateIndex
CREATE INDEX "allocations_entryDate_exitDate_idx" ON "allocations"("entryDate", "exitDate");

-- CreateIndex
CREATE INDEX "allocations_parentAllocationId_idx" ON "allocations"("parentAllocationId");

-- CreateIndex
CREATE INDEX "allocation_items_unitId_entryDate_exitDate_status_idx" ON "allocation_items"("unitId", "entryDate", "exitDate", "status");

-- CreateIndex
CREATE INDEX "allocation_items_allocationId_idx" ON "allocation_items"("allocationId");

-- CreateIndex
CREATE UNIQUE INDEX "aadhaar_records_participantId_key" ON "aadhaar_records"("participantId");

-- CreateIndex
CREATE INDEX "aadhaar_records_lastFourDigits_idx" ON "aadhaar_records"("lastFourDigits");

-- CreateIndex
CREATE INDEX "aadhaar_records_complianceStatus_idx" ON "aadhaar_records"("complianceStatus");

-- CreateIndex
CREATE INDEX "aadhaar_records_recordedById_idx" ON "aadhaar_records"("recordedById");

-- CreateIndex
CREATE INDEX "stay_records_registrationId_idx" ON "stay_records"("registrationId");

-- CreateIndex
CREATE INDEX "stay_records_participantId_idx" ON "stay_records"("participantId");

-- CreateIndex
CREATE INDEX "stay_records_unitId_idx" ON "stay_records"("unitId");

-- CreateIndex
CREATE INDEX "stay_records_status_idx" ON "stay_records"("status");

-- CreateIndex
CREATE INDEX "stay_records_actualCheckIn_actualCheckOut_idx" ON "stay_records"("actualCheckIn", "actualCheckOut");

-- CreateIndex
CREATE INDEX "message_logs_registrationId_idx" ON "message_logs"("registrationId");

-- CreateIndex
CREATE INDEX "message_logs_recipientMobile_idx" ON "message_logs"("recipientMobile");

-- CreateIndex
CREATE INDEX "message_logs_status_idx" ON "message_logs"("status");

-- CreateIndex
CREATE INDEX "message_logs_messageType_idx" ON "message_logs"("messageType");

-- CreateIndex
CREATE INDEX "activity_logs_entityType_entityId_idx" ON "activity_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "activity_logs_action_idx" ON "activity_logs"("action");

-- CreateIndex
CREATE INDEX "activity_logs_userId_idx" ON "activity_logs"("userId");

-- CreateIndex
CREATE INDEX "activity_logs_createdAt_idx" ON "activity_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "accommodation_units" ADD CONSTRAINT "accommodation_units_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_parentAllocationId_fkey" FOREIGN KEY ("parentAllocationId") REFERENCES "allocations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocation_items" ADD CONSTRAINT "allocation_items_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "allocations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocation_items" ADD CONSTRAINT "allocation_items_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "accommodation_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aadhaar_records" ADD CONSTRAINT "aadhaar_records_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aadhaar_records" ADD CONSTRAINT "aadhaar_records_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stay_records" ADD CONSTRAINT "stay_records_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stay_records" ADD CONSTRAINT "stay_records_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stay_records" ADD CONSTRAINT "stay_records_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "accommodation_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stay_records" ADD CONSTRAINT "stay_records_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
