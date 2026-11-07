import { Request, Response } from 'express';
import { z } from 'zod';
import * as XLSX from 'xlsx';
import { prisma } from '../config/prisma';
import { ActionType, Prisma, StayStatus } from '@prisma/client';

// Helper to remove any sensitive fields from details JSON
function sanitizeAuditDetails(details: any): any {
  if (!details || typeof details !== 'object') return details;
  const sanitized = JSON.parse(JSON.stringify(details));
  const sensitiveKeys = [
    'password',
    'passwordHash',
    'token',
    'authToken',
    'encryptedAadhaar',
    'aadhaarIv',
    'aadhaarAuthTag',
    'secret',
  ];

  function recurse(obj: any) {
    if (!obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
      if (sensitiveKeys.includes(key) || /aadhaar.*(number|data|plain)/i.test(key)) {
        obj[key] = '[REDACTED_SECURITY]';
      } else if (typeof obj[key] === 'object') {
        recurse(obj[key]);
      }
    }
  }
  recurse(sanitized);
  return sanitized;
}

// Validation query schema for listing activity logs
const listActivitySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().optional(),
  entityType: z.string().trim().optional(),
  action: z.nativeEnum(ActionType).optional(),
  userId: z.string().uuid().optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
});

export async function getActivityLogs(req: Request, res: Response) {
  const parseResult = listActivitySchema.safeParse(req.query);
  if (!parseResult.success) {
    return res.status(400).json({
      success: false,
      message: 'Invalid activity filter parameters.',
      errors: parseResult.error.flatten().fieldErrors,
    });
  }

  const { page, limit, q, entityType, action, userId, startDate, endDate } = parseResult.data;
  const skip = (page - 1) * limit;

  // Build Prisma where conditions
  const where: Prisma.ActivityLogWhereInput = {};

  if (entityType && entityType !== 'ALL') {
    where.entityType = { equals: entityType, mode: 'insensitive' };
  }

  if (action) {
    where.action = action;
  }

  if (userId && userId !== 'ALL') {
    where.userId = userId;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      where.createdAt.gte = start;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  if (q) {
    const searchPattern = q.trim();
    where.OR = [
      { entityId: { contains: searchPattern, mode: 'insensitive' } },
      { entityType: { contains: searchPattern, mode: 'insensitive' } },
      { ipAddress: { contains: searchPattern } },
      { user: { name: { contains: searchPattern, mode: 'insensitive' } } },
      { user: { email: { contains: searchPattern, mode: 'insensitive' } } },
    ];
  }

  try {
    const [total, logs] = await Promise.all([
      prisma.activityLog.count({ where }),
      prisma.activityLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      }),
    ]);

    // Format logs with sanitized details
    const sanitizedLogs = logs.map((log: any) => ({
      ...log,
      details: sanitizeAuditDetails(log.details),
    }));

    return res.json({
      success: true,
      data: sanitizedLogs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Error fetching activity logs:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve activity audit logs.',
      error: error.message,
    });
  }
}

export async function getActivityInsights(req: Request, res: Response) {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      todayRegistrations,
      todayAllocations,
      todayCheckIns,
      todayCheckOuts,
      currentInHouse,
      recentTransfers,
      recentAllocationChanges,
      recentStaffActivity,
    ] = await Promise.all([
      // Today's registrations
      prisma.registration.count({
        where: {
          createdAt: { gte: startOfToday, lte: endOfToday },
          isArchived: false,
        },
      }),

      // Today's allocations
      prisma.allocation.count({
        where: {
          createdAt: { gte: startOfToday, lte: endOfToday },
          isArchived: false,
        },
      }),

      // Today's check-ins
      prisma.stayRecord.count({
        where: {
          actualCheckIn: { gte: startOfToday, lte: endOfToday },
        },
      }),

      // Today's checkouts
      prisma.stayRecord.count({
        where: {
          actualCheckOut: { gte: startOfToday, lte: endOfToday },
          status: 'CHECKED_OUT',
        },
      }),

      // Current in-house participants
      prisma.stayRecord.count({
        where: {
          status: { in: [StayStatus.CHECKED_IN, StayStatus.EXTENDED] },
          actualCheckOut: null,
        },
      }),

      // Recent room transfers (past 7 days)
      prisma.stayRecord.count({
        where: {
          previousStayRecordId: { not: null },
          createdAt: { gte: sevenDaysAgo },
        },
      }),

      // Recent allocation modifications/cancellations today
      prisma.activityLog.count({
        where: {
          entityType: 'ALLOCATION',
          action: { in: [ActionType.UPDATE, ActionType.CANCEL, ActionType.CONFIRM] },
          createdAt: { gte: startOfToday, lte: endOfToday },
        },
      }),

      // Recent staff activities (latest 8)
      prisma.activityLog.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },
      }),
    ]);

    return res.json({
      success: true,
      data: {
        todayRegistrations,
        todayAllocations,
        todayCheckIns,
        todayCheckOuts,
        currentInHouse,
        recentTransfers,
        recentAllocationChanges,
        recentStaffActivity: recentStaffActivity.map((log: any) => ({
          id: log.id,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          createdAt: log.createdAt,
          user: log.user,
          detailsSummary:
            log.details && typeof log.details === 'object'
              ? (log.details as any).action ||
                (log.details as any).reason ||
                (log.details as any).registrationId ||
                ''
              : '',
        })),
      },
    });
  } catch (error: any) {
    console.error('Error fetching activity insights:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve operational activity insights.',
      error: error.message,
    });
  }
}

export async function getStaffList(req: Request, res: Response) {
  try {
    const staff = await prisma.adminUser.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
      },
    });

    return res.json({
      success: true,
      data: staff,
    });
  } catch (error: any) {
    console.error('Error fetching staff list for activity log:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve staff users.',
      error: error.message,
    });
  }
}

export async function exportActivityLogs(req: Request, res: Response) {
  const parseResult = listActivitySchema.safeParse(req.query);
  if (!parseResult.success) {
    return res.status(400).json({
      success: false,
      message: 'Invalid filter parameters for export.',
      errors: parseResult.error.flatten().fieldErrors,
    });
  }

  const { q, entityType, action, userId, startDate, endDate } = parseResult.data;

  // Build Prisma where conditions
  const where: Prisma.ActivityLogWhereInput = {};

  if (entityType && entityType !== 'ALL') {
    where.entityType = { equals: entityType, mode: 'insensitive' };
  }

  if (action) {
    where.action = action;
  }

  if (userId && userId !== 'ALL') {
    where.userId = userId;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      where.createdAt.gte = start;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  if (q) {
    const searchPattern = q.trim();
    where.OR = [
      { entityId: { contains: searchPattern, mode: 'insensitive' } },
      { entityType: { contains: searchPattern, mode: 'insensitive' } },
      { ipAddress: { contains: searchPattern } },
      { user: { name: { contains: searchPattern, mode: 'insensitive' } } },
      { user: { email: { contains: searchPattern, mode: 'insensitive' } } },
    ];
  }

  try {
    // Export up to 5000 records for Excel performance & memory safety
    const logs = await prisma.activityLog.findMany({
      where,
      take: 5000,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    // Format rows for Excel sheet
    const rows = logs.map((log: any, index: number) => {
      const sanitizedDetails = sanitizeAuditDetails(log.details);
      let detailsText = '';
      if (sanitizedDetails && typeof sanitizedDetails === 'object') {
        try {
          detailsText = JSON.stringify(sanitizedDetails);
        } catch {
          detailsText = String(sanitizedDetails);
        }
      }

      return {
        'Index': index + 1,
        'Log ID': log.id,
        'Timestamp (UTC)': log.createdAt.toISOString(),
        'Staff Name': log.user?.name || 'System / Automated',
        'Staff Email': log.user?.email || 'N/A',
        'Staff Role': log.user?.role || 'N/A',
        'Action': log.action,
        'Entity Type': log.entityType,
        'Entity ID': log.entityId,
        'IP Address': log.ipAddress || 'Internal',
        'Audit Details': detailsText,
      };
    });

    // Generate Excel Workbook
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Operational Audit Log');

    // Auto-fit column widths
    const columnWidths = [
      { wch: 8 },  // Index
      { wch: 38 }, // Log ID
      { wch: 24 }, // Timestamp
      { wch: 22 }, // Staff Name
      { wch: 28 }, // Staff Email
      { wch: 20 }, // Staff Role
      { wch: 16 }, // Action
      { wch: 18 }, // Entity Type
      { wch: 38 }, // Entity ID
      { wch: 16 }, // IP Address
      { wch: 60 }, // Details
    ];
    worksheet['!cols'] = columnWidths;

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    const filename = `activity-audit-log-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    return res.send(excelBuffer);
  } catch (error: any) {
    console.error('Error exporting activity logs:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to export activity logs.',
      error: error.message,
    });
  }
}
