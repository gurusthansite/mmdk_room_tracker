import { Request, Response } from 'express';
import { z } from 'zod';
import * as XLSX from 'xlsx';
import { prisma } from '../config/prisma';
import { getNextRegistrationId } from '../utils/registrationId';
import { 
  RegistrationStatus, 
  ActionType, 
  Gender, 
  ParticipantStatus 
} from '@prisma/client';

// ----------------------------------------------------------------------------
// ZOD SCHEMAS & VALIDATION
// ----------------------------------------------------------------------------

const flexibleMobileRegex = /^[+]?[\d\s-]{7,16}$/;
const indianMobileRegex = flexibleMobileRegex;

export const createRegistrationSchema = z.object({
  primaryName: z.string().trim().min(1, 'Primary registrant full name is required'),
  gender: z.nativeEnum(Gender).optional().nullable(),
  primaryGender: z.nativeEnum(Gender).optional().nullable(),
  mobile: z.string().trim().regex(flexibleMobileRegex, 'Valid phone number is required (7-15 digits)'),
  email: z.string().trim().email('Invalid email address').optional().nullable().or(z.literal('')),
  city: z.string().trim().optional().nullable().or(z.literal('')),
  state: z.string().trim().optional().nullable().or(z.literal('')),
  totalMembers: z.number().int().min(1, 'Total members must be at least 1').default(1),
  registrationDate: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
  status: z.nativeEnum(RegistrationStatus).default(RegistrationStatus.REGISTERED),
  notes: z.string().trim().optional().nullable().or(z.literal('')),
  accompanyingMembers: z.array(z.object({
    fullName: z.string().trim().min(1, 'Member name is required'),
    phone: z.string().trim().regex(flexibleMobileRegex, 'Valid phone number is required (7-15 digits)').optional().nullable().or(z.literal('')),
    gender: z.nativeEnum(Gender).optional().nullable(),
    age: z.number().int().min(0).max(120).optional().nullable(),
    relationToPrimary: z.string().trim().optional().nullable(),
  })).optional().default([]),
});

export const updateRegistrationSchema = z.object({
  primaryName: z.string().trim().min(1, 'Primary name is required').optional(),
  gender: z.nativeEnum(Gender).optional().nullable(),
  primaryGender: z.nativeEnum(Gender).optional().nullable(),
  mobile: z.string().trim().regex(flexibleMobileRegex, 'Valid phone number required').optional(),
  email: z.string().trim().email().optional().nullable().or(z.literal('')),
  city: z.string().trim().optional().nullable().or(z.literal('')),
  state: z.string().trim().optional().nullable().or(z.literal('')),
  totalMembers: z.number().int().min(1).optional(),
  status: z.nativeEnum(RegistrationStatus).optional(),
  notes: z.string().trim().optional().nullable().or(z.literal('')),
  isArchived: z.boolean().optional(),
});

export const importBatchSchema = z.object({
  rows: z.array(z.object({
    primaryName: z.string().trim().min(1),
    mobile: z.string().trim().regex(flexibleMobileRegex),
    email: z.string().trim().email().optional().or(z.literal('')).nullable(),
    city: z.string().trim().optional().nullable(),
    state: z.string().trim().optional().nullable(),
    totalMembers: z.number().int().min(1).default(1),
    registrationDate: z.string().optional().nullable(),
    notes: z.string().trim().optional().nullable(),
    accompanyingMembersText: z.string().optional().nullable(),
  })).min(1, 'At least one valid registration row is required for import'),
});

// ----------------------------------------------------------------------------
// CONTROLLER HANDLERS
// ----------------------------------------------------------------------------

/**
 * 1. List Registrations with Search, Filters & Pagination
 */
export async function listRegistrations(req: Request, res: Response) {
  const { 
    page = '1', 
    limit = '10', 
    q, 
    status, 
    startDate, 
    endDate, 
    isArchived = 'false',
    sortBy = 'registrationDate',
    sortOrder = 'desc'
  } = req.query;

  const pageNum = Math.max(1, parseInt(page as string) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 10));
  const skip = (pageNum - 1) * limitNum;

  const whereClause: any = {
    isArchived: isArchived === 'true',
  };

  // Search filter across Registration ID, Primary Name, Mobile
  if (typeof q === 'string' && q.trim()) {
    const search = q.trim();
    whereClause.OR = [
      { registrationId: { contains: search, mode: 'insensitive' } },
      { primaryName: { contains: search, mode: 'insensitive' } },
      { mobile: { contains: search } },
      { city: { contains: search, mode: 'insensitive' } },
    ];
  }

  // Status filter
  if (typeof status === 'string' && Object.values(RegistrationStatus).includes(status as RegistrationStatus)) {
    whereClause.status = status as RegistrationStatus;
  }

  // Date range filter
  if (typeof startDate === 'string' || typeof endDate === 'string') {
    whereClause.registrationDate = {};
    if (typeof startDate === 'string' && startDate.trim()) {
      whereClause.registrationDate.gte = new Date(startDate.trim());
    }
    if (typeof endDate === 'string' && endDate.trim()) {
      const end = new Date(endDate.trim());
      end.setHours(23, 59, 59, 999);
      whereClause.registrationDate.lte = end;
    }
  }

  // Sorting
  const allowedSortFields = ['registrationDate', 'registrationId', 'primaryName', 'totalMembers', 'createdAt'];
  const sortField = allowedSortFields.includes(sortBy as string) ? (sortBy as string) : 'registrationDate';
  const order = sortOrder === 'asc' ? 'asc' : 'desc';

  const [registrations, totalCount, statusCounts] = await Promise.all([
    prisma.registration.findMany({
      where: whereClause,
      include: {
        _count: {
          select: {
            participants: true,
            allocations: true,
            stayRecords: true,
          },
        },
      },
      orderBy: { [sortField]: order },
      skip,
      take: limitNum,
    }),
    prisma.registration.count({ where: whereClause }),
    prisma.registration.groupBy({
      by: ['status'],
      where: { isArchived: isArchived === 'true' },
      _count: { status: true },
      _sum: { totalMembers: true },
    }),
  ]);

  // Aggregate metrics
  let totalMembersSum = 0;
  const metrics: Record<string, number> = {
    totalRegistrations: 0,
    totalMembers: 0,
    REGISTERED: 0,
    ALLOCATED: 0,
    CONFIRMED: 0,
    CHECKED_IN: 0,
    CHECKED_OUT: 0,
    CANCELLED: 0,
  };

  statusCounts.forEach((sc) => {
    metrics[sc.status] = sc._count.status;
    metrics.totalRegistrations += sc._count.status;
    totalMembersSum += sc._sum.totalMembers || 0;
  });
  metrics.totalMembers = totalMembersSum;

  const formattedRegistrations = registrations.map((r) => ({
    id: r.id,
    registrationId: r.registrationId,
    primaryName: r.primaryName,
    mobile: r.mobile,
    email: r.email,
    city: r.city,
    state: r.state,
    totalMembers: r.totalMembers,
    registrationDate: r.registrationDate,
    status: r.status,
    isArchived: r.isArchived,
    notes: r.notes,
    participantsCount: r._count.participants,
    allocationsCount: r._count.allocations,
    stayRecordsCount: r._count.stayRecords,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));

  return res.json({
    success: true,
    data: formattedRegistrations,
    pagination: {
      page: pageNum,
      limit: limitNum,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum) || 1,
    },
    metrics,
  });
}

/**
 * 2. Get Single Registration with Full Associated Details
 * Security: Strictly excludes raw Aadhaar numbers.
 */
export async function getRegistrationById(req: Request, res: Response) {
  const { id } = req.params;

  const registration = await prisma.registration.findFirst({
    where: {
      OR: [
        { id },
        { registrationId: id },
      ],
    },
    include: {
      participants: {
        where: { isArchived: false },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          fullName: true,
          phone: true,
          gender: true,
          age: true,
          relationToPrimary: true,
          isPrimary: true,
          checkInStatus: true,
          notes: true,
          createdAt: true,
          aadhaarRecord: {
            select: {
              lastFourDigits: true,
              complianceStatus: true,
              retentionConsent: true,
            },
          },
        },
      },
      allocations: {
        include: {
          items: {
            include: {
              unit: {
                select: {
                  unitNumber: true,
                  type: true,
                  genderCategory: true,
                  room: {
                    select: {
                      roomNumber: true,
                      building: true,
                      floor: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      stayRecords: {
        include: {
          participant: {
            select: {
              fullName: true,
              gender: true,
              age: true,
            },
          },
          unit: {
            select: {
              unitNumber: true,
              type: true,
              room: {
                select: {
                  roomNumber: true,
                  building: true,
                },
              },
            },
          },
        },
        orderBy: { actualCheckIn: 'desc' },
      },
      messageLogs: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!registration) {
    return res.status(404).json({
      success: false,
      message: `Registration not found with identifier: ${id}`,
    });
  }

  // Format allocation summary
  const allocationSummary = registration.allocations.map((a) => ({
    id: a.id,
    allocationNumber: a.allocationNumber,
    status: a.status,
    entryDate: a.entryDate,
    exitDate: a.exitDate,
    totalUnits: a.items.length,
    units: a.items.map((item) => ({
      unitId: item.unitId,
      unitNumber: item.unit.unitNumber,
      unitType: item.unit.type,
      genderCategory: item.unit.genderCategory,
      roomNumber: item.unit.room.roomNumber,
      building: item.unit.room.building,
      floor: item.unit.room.floor,
      status: item.status,
    })),
  }));

  // Format stay records summary
  const staySummary = registration.stayRecords.map((s) => ({
    id: s.id,
    participantName: s.participant.fullName,
    participantGender: s.participant.gender,
    roomNumber: s.unit.room.roomNumber,
    unitNumber: s.unit.unitNumber,
    unitType: s.unit.type,
    actualCheckIn: s.actualCheckIn,
    actualCheckOut: s.actualCheckOut,
    status: s.status,
    transferReason: s.transferReason,
  }));

  return res.json({
    success: true,
    data: {
      ...registration,
      allocationSummary,
      staySummary,
    },
  });
}

/**
 * 3. Create Registration (with Concurrency-Safe Sequential ID)
 */
export async function createRegistration(req: Request, res: Response) {
  const parsed = createRegistrationSchema.safeParse(req.body);
  if (!parsed.success) {
    const errorDetails = parsed.error.errors.map((e) => e.message).join(', ');
    return res.status(400).json({
      success: false,
      message: errorDetails || 'Validation failed for registration data',
      errors: parsed.error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  const { 
    primaryName, 
    gender,
    primaryGender,
    mobile, 
    email, 
    city, 
    state, 
    totalMembers, 
    registrationDate, 
    status, 
    notes, 
    accompanyingMembers 
  } = parsed.data;

  // Concurrency-safe ID generation using PostgreSQL sequence
  const nextRegId = await getNextRegistrationId();

  const currentUserId = (req as any).user?.id;

  // Resolve Primary Registrant Gender
  const resolvedPrimaryGender = primaryGender || gender || (notes?.toUpperCase().includes('FEMALE GROUP') ? Gender.FEMALE : Gender.MALE);

  // Execute in an atomic database transaction
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create Master Registration Record
    const reg = await tx.registration.create({
      data: {
        registrationId: nextRegId,
        primaryName,
        mobile,
        email: email || null,
        city: city || null,
        state: state || null,
        totalMembers,
        registrationDate: registrationDate ? new Date(registrationDate) : new Date(),
        status,
        notes: notes || null,
      },
    });

    // 2. Create primary registrant participant record
    await tx.participant.create({
      data: {
        registrationId: reg.id,
        fullName: primaryName,
        phone: mobile,
        gender: resolvedPrimaryGender,
        relationToPrimary: 'Self',
        isPrimary: true,
        checkInStatus: ParticipantStatus.REGISTERED,
      },
    });

    // 3. Create any accompanying members supplied during registration
    if (accompanyingMembers && accompanyingMembers.length > 0) {
      for (const m of accompanyingMembers) {
        await tx.participant.create({
          data: {
            registrationId: reg.id,
            fullName: m.fullName,
            phone: m.phone || null,
            gender: m.gender || null,
            age: m.age || null,
            relationToPrimary: m.relationToPrimary || 'Accompanying',
            isPrimary: false,
            checkInStatus: ParticipantStatus.REGISTERED,
          },
        });
      }
    }

    // 4. Record audit activity
    if (currentUserId) {
      await tx.activityLog.create({
        data: {
          entityType: 'Registration',
          entityId: reg.id,
          action: ActionType.CREATE,
          details: {
            registrationId: reg.registrationId,
            primaryName: reg.primaryName,
            totalMembers: reg.totalMembers,
            accompanyingCount: accompanyingMembers?.length || 0,
          },
          userId: currentUserId,
          ipAddress: req.ip || '127.0.0.1',
        },
      });
    }

    return reg;
  });

  return res.status(201).json({
    success: true,
    message: `Registration ${result.registrationId} created successfully`,
    data: result,
  });
}

/**
 * 4. Update Registration Details
 */
export async function updateRegistration(req: Request, res: Response) {
  const { id } = req.params;
  const parsed = updateRegistrationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed for registration update',
      errors: parsed.error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  const existing = await prisma.registration.findFirst({
    where: {
      OR: [{ id }, { registrationId: id }],
    },
    include: {
      _count: { select: { participants: true } },
    },
  });

  if (!existing) {
    return res.status(404).json({
      success: false,
      message: `Registration not found: ${id}`,
    });
  }

  const updateData: any = {};
  const currentUserId = (req as any).user?.id;

  if (parsed.data.primaryName !== undefined) updateData.primaryName = parsed.data.primaryName;
  if (parsed.data.mobile !== undefined) updateData.mobile = parsed.data.mobile;
  if (parsed.data.email !== undefined) updateData.email = parsed.data.email || null;
  if (parsed.data.city !== undefined) updateData.city = parsed.data.city || null;
  if (parsed.data.state !== undefined) updateData.state = parsed.data.state || null;
  if (parsed.data.totalMembers !== undefined) {
    updateData.totalMembers = parsed.data.totalMembers;
  }
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
  if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes || null;
  if (parsed.data.isArchived !== undefined) {
    updateData.isArchived = parsed.data.isArchived;
    updateData.deletedAt = parsed.data.isArchived ? new Date() : null;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const reg = await tx.registration.update({
      where: { id: existing.id },
      data: updateData,
    });

    // Update primary participant name or gender if changed
    if (parsed.data.primaryName || parsed.data.gender || parsed.data.primaryGender) {
      await tx.participant.updateMany({
        where: { registrationId: existing.id, isPrimary: true },
        data: {
          ...(parsed.data.primaryName ? { fullName: parsed.data.primaryName } : {}),
          ...(parsed.data.gender || parsed.data.primaryGender ? { gender: parsed.data.primaryGender || parsed.data.gender } : {}),
        },
      });
    }

    if (currentUserId) {
      await tx.activityLog.create({
        data: {
          entityType: 'Registration',
          entityId: reg.id,
          action: ActionType.UPDATE,
          details: {
            changes: updateData,
            priorValues: {
              primaryName: existing.primaryName,
              totalMembers: existing.totalMembers,
              status: existing.status,
            },
          },
          userId: currentUserId,
          ipAddress: req.ip || '127.0.0.1',
        },
      });
    }

    return reg;
  });

  return res.json({
    success: true,
    message: `Registration ${updated.registrationId} updated successfully`,
    data: updated,
  });
}

/**
 * 5. Archive / Soft-delete Registration
 * Historical preservation: Never deletes actual rows; marks isArchived=true.
 */
export async function archiveRegistration(req: Request, res: Response) {
  const { id } = req.params;
  const currentUserId = (req as any).user?.id;

  const existing = await prisma.registration.findFirst({
    where: { OR: [{ id }, { registrationId: id }] },
  });

  if (!existing) {
    return res.status(404).json({
      success: false,
      message: `Registration not found: ${id}`,
    });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const reg = await tx.registration.update({
      where: { id: existing.id },
      data: {
        isArchived: true,
        deletedAt: new Date(),
      },
    });

    if (currentUserId) {
      await tx.activityLog.create({
        data: {
          entityType: 'Registration',
          entityId: reg.id,
          action: ActionType.DELETE,
          details: {
            archived: true,
            registrationId: reg.registrationId,
            reason: 'Archived via admin action',
          },
          userId: currentUserId,
          ipAddress: req.ip || '127.0.0.1',
        },
      });
    }

    return reg;
  });

  return res.json({
    success: true,
    message: `Registration ${updated.registrationId} archived successfully`,
    data: updated,
  });
}

/**
 * 6. Restore Archived Registration
 */
export async function restoreRegistration(req: Request, res: Response) {
  const { id } = req.params;
  const currentUserId = (req as any).user?.id;

  const existing = await prisma.registration.findFirst({
    where: { OR: [{ id }, { registrationId: id }] },
  });

  if (!existing) {
    return res.status(404).json({
      success: false,
      message: `Registration not found: ${id}`,
    });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const reg = await tx.registration.update({
      where: { id: existing.id },
      data: {
        isArchived: false,
        deletedAt: null,
      },
    });

    if (currentUserId) {
      await tx.activityLog.create({
        data: {
          entityType: 'Registration',
          entityId: reg.id,
          action: ActionType.UPDATE,
          details: {
            restored: true,
            registrationId: reg.registrationId,
          },
          userId: currentUserId,
          ipAddress: req.ip || '127.0.0.1',
        },
      });
    }

    return reg;
  });

  return res.json({
    success: true,
    message: `Registration ${updated.registrationId} restored successfully`,
    data: updated,
  });
}

/**
 * 7. Download Excel Import Template (.xlsx)
 */
export async function downloadImportTemplate(req: Request, res: Response) {
  const templateData = [
    {
      'Primary Name*': 'Rajesh Sharma',
      'Mobile Number*': '9876543210',
      'Email': 'rajesh.sharma@example.com',
      'City': 'Mumbai',
      'State': 'Maharashtra',
      'Total Members*': 3,
      'Registration Date': '2026-11-10',
      'Special Notes': 'Ground floor preferred for senior citizen',
      'Accompanying Member Names (Comma-separated)': 'Sunita Sharma, Amit Sharma',
    },
    {
      'Primary Name*': 'Pooja Verma',
      'Mobile Number*': '9812345678',
      'Email': 'pooja.v@example.com',
      'City': 'Bengaluru',
      'State': 'Karnataka',
      'Total Members*': 2,
      'Registration Date': '2026-11-10',
      'Special Notes': 'Arriving by train in evening',
      'Accompanying Member Names (Comma-separated)': 'Aarav Verma',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateData);
  // Set column widths
  worksheet['!cols'] = [
    { wch: 22 }, // Primary Name
    { wch: 16 }, // Mobile
    { wch: 26 }, // Email
    { wch: 16 }, // City
    { wch: 18 }, // State
    { wch: 16 }, // Total Members
    { wch: 18 }, // Date
    { wch: 35 }, // Notes
    { wch: 40 }, // Accompanying
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Registrations_Template');

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="registration_import_template.xlsx"');
  return res.send(buffer);
}

/**
 * 8. Preview Excel Import Rows (Validation & Duplicate Detection)
 */
export async function previewExcelImport(req: Request, res: Response) {
  let rowsToValidate: any[] = [];

  // Support JSON parsed rows OR base64 file payload
  if (Array.isArray(req.body.rows)) {
    rowsToValidate = req.body.rows;
  } else if (req.body.fileBase64) {
    try {
      const buffer = Buffer.from(req.body.fileBase64, 'base64');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      rowsToValidate = XLSX.utils.sheet_to_json(worksheet);
    } catch (e: any) {
      return res.status(400).json({
        success: false,
        message: 'Failed to parse Excel file. Please ensure it is a valid .xlsx file.',
      });
    }
  } else {
    return res.status(400).json({
      success: false,
      message: 'Missing rows or fileBase64 in request body',
    });
  }

  if (rowsToValidate.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Excel sheet is empty. Please provide at least one data row.',
    });
  }

  // Fetch existing mobile numbers in database to detect duplicates
  const existingRegistrations = await prisma.registration.findMany({
    where: { isArchived: false },
    select: { mobile: true, registrationId: true, primaryName: true },
  });
  const existingMobileMap = new Map<string, { registrationId: string; primaryName: string }>();
  existingRegistrations.forEach((r) => existingMobileMap.set(r.mobile, { registrationId: r.registrationId, primaryName: r.primaryName }));

  const seenMobilesInBatch = new Set<string>();
  const validatedRows: any[] = [];
  let validCount = 0;
  let invalidCount = 0;
  let duplicateCount = 0;

  rowsToValidate.forEach((rawRow, index) => {
    const rowNum = index + 2; // Row 1 is header in Excel
    const errors: string[] = [];
    const warnings: string[] = [];

    // Normalize keys (support template header keys and lowercase keys)
    const primaryName = (rawRow['Primary Name*'] || rawRow['Primary Name'] || rawRow['primaryName'] || rawRow['Name'] || '').toString().trim();
    const rawMobile = (rawRow['Mobile Number*'] || rawRow['Mobile Number'] || rawRow['mobile'] || rawRow['Phone'] || '').toString().trim();
    const mobile = rawMobile.replace(/\D/g, '').slice(-10); // Extract 10 digits
    const email = (rawRow['Email'] || rawRow['email'] || '').toString().trim();
    const city = (rawRow['City'] || rawRow['city'] || '').toString().trim();
    const state = (rawRow['State'] || rawRow['state'] || '').toString().trim();
    const totalMembersRaw = rawRow['Total Members*'] || rawRow['Total Members'] || rawRow['totalMembers'] || 1;
    const totalMembers = parseInt(totalMembersRaw.toString(), 10) || 1;
    const registrationDateRaw = rawRow['Registration Date'] || rawRow['registrationDate'];
    const notes = (rawRow['Special Notes'] || rawRow['Notes'] || rawRow['notes'] || '').toString().trim();
    const accompanyingMembersText = (rawRow['Accompanying Member Names (Comma-separated)'] || rawRow['Accompanying Members'] || rawRow['accompanyingMembersText'] || '').toString().trim();

    // 1. Validate Primary Name
    if (!primaryName || primaryName.length < 2) {
      errors.push('Primary name is required (min 2 characters)');
    }

    // 2. Validate Mobile Number
    if (!mobile || !indianMobileRegex.test(mobile)) {
      errors.push(`Invalid mobile number "${rawMobile}". Must be a valid 10-digit Indian phone number`);
    }

    // 3. Validate Total Members
    if (isNaN(totalMembers) || totalMembers < 1) {
      errors.push('Total members must be an integer >= 1');
    }

    // 4. Duplicate Check
    let isDuplicate = false;
    let duplicateInfo: string | null = null;
    if (mobile && indianMobileRegex.test(mobile)) {
      if (existingMobileMap.has(mobile)) {
        isDuplicate = true;
        duplicateCount++;
        const dup = existingMobileMap.get(mobile)!;
        duplicateInfo = `Mobile already registered to ${dup.primaryName} (${dup.registrationId})`;
        warnings.push(duplicateInfo);
      } else if (seenMobilesInBatch.has(mobile)) {
        isDuplicate = true;
        duplicateCount++;
        duplicateInfo = 'Duplicate mobile number in this batch upload';
        errors.push(duplicateInfo);
      } else {
        seenMobilesInBatch.add(mobile);
      }
    }

    const isValid = errors.length === 0;
    if (isValid) validCount++;
    else invalidCount++;

    validatedRows.push({
      rowIndex: rowNum,
      data: {
        primaryName,
        mobile,
        email: email || null,
        city: city || null,
        state: state || null,
        totalMembers,
        registrationDate: registrationDateRaw ? new Date(registrationDateRaw).toISOString() : new Date().toISOString(),
        notes: notes || null,
        accompanyingMembersText: accompanyingMembersText || null,
      },
      isValid,
      isDuplicate,
      errors,
      warnings,
    });
  });

  return res.json({
    success: true,
    data: {
      totalRows: rowsToValidate.length,
      validRows: validCount,
      invalidRows: invalidCount,
      duplicateRows: duplicateCount,
      canImport: validCount > 0,
      rows: validatedRows,
    },
  });
}

/**
 * 9. Execute Confirmed Excel Import (Safe Atomic Batch)
 */
export async function executeExcelImport(req: Request, res: Response) {
  const parsed = importBatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed for batch import data',
      errors: parsed.error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  const { rows } = parsed.data;
  const currentUserId = (req as any).user?.id;

  // Process rows atomically inside a transaction
  const importedRegistrations = await prisma.$transaction(async (tx) => {
    const results = [];

    for (const row of rows) {
      // Generate concurrency-safe monotonic ID
      const regId = await getNextRegistrationId();

      const reg = await tx.registration.create({
        data: {
          registrationId: regId,
          primaryName: row.primaryName,
          mobile: row.mobile,
          email: row.email || null,
          city: row.city || null,
          state: row.state || null,
          totalMembers: row.totalMembers,
          registrationDate: row.registrationDate ? new Date(row.registrationDate) : new Date(),
          status: RegistrationStatus.REGISTERED,
          notes: row.notes || null,
        },
      });

      // Primary participant
      await tx.participant.create({
        data: {
          registrationId: reg.id,
          fullName: row.primaryName,
          relationToPrimary: 'Self',
          isPrimary: true,
          checkInStatus: ParticipantStatus.REGISTERED,
        },
      });

      // Parse comma-separated accompanying members if present
      if (row.accompanyingMembersText && row.accompanyingMembersText.trim()) {
        const names = row.accompanyingMembersText
          .split(',')
          .map((n) => n.trim())
          .filter((n) => n.length > 0);

        for (const name of names) {
          await tx.participant.create({
            data: {
              registrationId: reg.id,
              fullName: name,
              relationToPrimary: 'Accompanying',
              isPrimary: false,
              checkInStatus: ParticipantStatus.REGISTERED,
            },
          });
        }
      }

      results.push({
        id: reg.id,
        registrationId: reg.registrationId,
        primaryName: reg.primaryName,
        mobile: reg.mobile,
        totalMembers: reg.totalMembers,
      });
    }

    if (currentUserId) {
      await tx.activityLog.create({
        data: {
          entityType: 'Registration',
          entityId: results[0]?.id || 'BATCH_IMPORT',
          action: ActionType.CREATE,
          details: {
            batchImport: true,
            importedCount: results.length,
            ids: results.map((r) => r.registrationId),
          },
          userId: currentUserId,
          ipAddress: req.ip || '127.0.0.1',
        },
      });
    }

    return results;
  });

  return res.status(201).json({
    success: true,
    message: `Successfully imported ${importedRegistrations.length} registrations`,
    data: {
      importedCount: importedRegistrations.length,
      registrations: importedRegistrations,
    },
  });
}

/**
 * 10. Export Filtered Registrations to Excel (.xlsx)
 * Security: Strictly excludes any Aadhaar data.
 */
export async function exportRegistrations(req: Request, res: Response) {
  const { q, status, startDate, endDate, isArchived = 'false' } = req.query;

  const whereClause: any = {
    isArchived: isArchived === 'true',
  };

  if (typeof q === 'string' && q.trim()) {
    const search = q.trim();
    whereClause.OR = [
      { registrationId: { contains: search, mode: 'insensitive' } },
      { primaryName: { contains: search, mode: 'insensitive' } },
      { mobile: { contains: search } },
      { city: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (typeof status === 'string' && Object.values(RegistrationStatus).includes(status as RegistrationStatus)) {
    whereClause.status = status as RegistrationStatus;
  }

  if (typeof startDate === 'string' || typeof endDate === 'string') {
    whereClause.registrationDate = {};
    if (typeof startDate === 'string' && startDate.trim()) {
      whereClause.registrationDate.gte = new Date(startDate.trim());
    }
    if (typeof endDate === 'string' && endDate.trim()) {
      const end = new Date(endDate.trim());
      end.setHours(23, 59, 59, 999);
      whereClause.registrationDate.lte = end;
    }
  }

  const registrations = await prisma.registration.findMany({
    where: whereClause,
    orderBy: { registrationId: 'asc' },
    include: {
      participants: {
        select: { fullName: true, isPrimary: true },
      },
    },
  });

  const exportData = registrations.map((r) => {
    const accompanyingNames = r.participants
      .filter((p) => !p.isPrimary)
      .map((p) => p.fullName)
      .join(', ');

    return {
      'Registration ID': r.registrationId,
      'Primary Registrant': r.primaryName,
      'Mobile Number': r.mobile,
      'Email': r.email || '',
      'City': r.city || '',
      'State': r.state || '',
      'Total Members': r.totalMembers,
      'Registration Date': r.registrationDate ? new Date(r.registrationDate).toLocaleDateString() : '',
      'Status': r.status,
      'Special Notes': r.notes || '',
      'Accompanying Members': accompanyingNames || 'None recorded yet',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  worksheet['!cols'] = [
    { wch: 18 }, // Reg ID
    { wch: 24 }, // Primary Name
    { wch: 16 }, // Mobile
    { wch: 24 }, // Email
    { wch: 16 }, // City
    { wch: 16 }, // State
    { wch: 16 }, // Total Members
    { wch: 18 }, // Date
    { wch: 16 }, // Status
    { wch: 30 }, // Notes
    { wch: 35 }, // Accompanying
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Registrations');

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  const timestamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="registrations_export_${timestamp}.xlsx"`);
  return res.send(buffer);
}
