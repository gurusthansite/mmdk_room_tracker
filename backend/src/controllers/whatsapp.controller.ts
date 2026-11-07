import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import {
  generateAllocationMessage,
  buildWhatsAppClickToChatUrl,
  formatPhoneNumberForWhatsApp,
  AllocatedRoomDetail,
} from '../utils/whatsappTemplate';
import { MessageStatus, MessageType, ActionType } from '@prisma/client';

// ----------------------------------------------------------------------------
// ZOD VALIDATION SCHEMAS
// ----------------------------------------------------------------------------

export const prepareWhatsAppMessageSchema = z.object({
  allocationId: z.string().uuid('Invalid allocation UUID'),
  helpdeskContact: z.string().trim().optional(),
  customNotes: z.string().trim().optional(),
});

export const confirmSentSchema = z.object({
  notes: z.string().trim().optional(),
});

export const recordFailedSchema = z.object({
  reason: z.string().trim().min(3, 'Failure reason must be at least 3 characters'),
});

export const listMessageLogsSchema = z.object({
  registrationId: z.string().optional(),
  allocationId: z.string().optional(),
  status: z.nativeEnum(MessageStatus).optional(),
  page: z.string().regex(/^\d+$/).default('1'),
  limit: z.string().regex(/^\d+$/).default('20'),
});

// ----------------------------------------------------------------------------
// CONTROLLER HANDLERS
// ----------------------------------------------------------------------------

/**
 * Prepares a WhatsApp Click-to-Chat message for a specific accommodation allocation.
 * Generates the URL and records or updates a PREPARED MessageLog idempotently.
 */
export async function prepareAllocationMessage(req: Request, res: Response): Promise<void> {
  try {
    const validated = prepareWhatsAppMessageSchema.parse(req.body);

    const allocation = await prisma.allocation.findUnique({
      where: { id: validated.allocationId },
      include: {
        registration: true,
        items: {
          include: {
            unit: {
              include: {
                room: true,
              },
            },
          },
        },
      },
    });

    if (!allocation) {
      res.status(404).json({
        success: false,
        message: `Allocation with ID '${validated.allocationId}' not found.`,
      });
      return;
    }

    if (allocation.status === 'CANCELLED') {
      res.status(400).json({
        success: false,
        message: 'Cannot prepare WhatsApp message for a cancelled allocation.',
      });
      return;
    }

    if (!allocation.registration.mobile) {
      res.status(400).json({
        success: false,
        message: 'Primary registrant does not have a recorded mobile number.',
      });
      return;
    }

    // Format recipient mobile safely
    let normalizedPhone: string;
    try {
      normalizedPhone = formatPhoneNumberForWhatsApp(allocation.registration.mobile);
    } catch (err: any) {
      res.status(400).json({
        success: false,
        message: `Invalid recipient phone number: ${err.message}`,
      });
      return;
    }

    // Aggregate room details for message template
    const roomMap = new Map<string, AllocatedRoomDetail>();

    for (const item of allocation.items) {
      if (item.status === 'CANCELLED') continue;

      const room = item.unit.room;
      if (!roomMap.has(room.id)) {
        roomMap.set(room.id, {
          roomNumber: room.roomNumber,
          building: room.building,
          floor: room.floor,
          units: [],
        });
      }

      roomMap.get(room.id)!.units.push({
        unitNumber: item.unit.unitNumber,
        type: item.unit.type,
      });
    }

    const roomDetails = Array.from(roomMap.values());

    // Generate formatted message text
    const messageText = generateAllocationMessage({
      organizationName: 'Accommodation Management Desk',
      registrationId: allocation.registration.registrationId,
      primaryName: allocation.registration.primaryName,
      totalMembers: allocation.registration.totalMembers,
      allocationNumber: allocation.allocationNumber,
      rooms: roomDetails,
      entryDate: allocation.entryDate,
      exitDate: allocation.exitDate,
      helpdeskContact: validated.helpdeskContact,
      customNotes: validated.customNotes,
    });

    const whatsappUrl = buildWhatsAppClickToChatUrl(normalizedPhone, messageText);

    // Idempotency check: see if a PREPARED log already exists for this registration and allocation
    const existingLog = await prisma.messageLog.findFirst({
      where: {
        registrationId: allocation.registrationId,
        status: MessageStatus.PREPARED,
        notes: {
          contains: allocation.allocationNumber,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    let messageLog;
    if (existingLog) {
      // Reuse existing prepared log and update template content
      messageLog = await prisma.messageLog.update({
        where: { id: existingLog.id },
        data: {
          recipientMobile: normalizedPhone,
          templateContent: messageText,
        },
      });
    } else {
      // Create new PREPARED message log
      messageLog = await prisma.messageLog.create({
        data: {
          registrationId: allocation.registrationId,
          recipientMobile: normalizedPhone,
          messageType: MessageType.WHATSAPP_ALLOCATION_TENTATIVE,
          templateContent: messageText,
          status: MessageStatus.PREPARED,
          notes: `Allocation: ${allocation.allocationNumber} (ID: ${allocation.id})`,
        },
      });

      // Audit trail
      await prisma.activityLog.create({
        data: {
          entityType: 'MESSAGE_LOG',
          entityId: messageLog.id,
          action: ActionType.CREATE,
          userId: req.user?.id,
          details: {
            allocationId: allocation.id,
            allocationNumber: allocation.allocationNumber,
            recipientMobile: normalizedPhone,
            status: MessageStatus.PREPARED,
          },
        },
      });
    }

    res.status(200).json({
      success: true,
      message: 'WhatsApp message prepared successfully.',
      data: {
        messageLogId: messageLog.id,
        allocationId: allocation.id,
        allocationNumber: allocation.allocationNumber,
        registrationId: allocation.registration.registrationId,
        recipientName: allocation.registration.primaryName,
        recipientMobile: normalizedPhone,
        templateContent: messageText,
        whatsappUrl,
        status: messageLog.status,
        createdAt: messageLog.createdAt,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: 'Validation failed.',
        errors: error.errors,
      });
      return;
    }

    console.error('Error preparing WhatsApp message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to prepare WhatsApp message.',
      error: error.message,
    });
  }
}

/**
 * Records that staff opened the WhatsApp Click-to-Chat deep link.
 * Transitions status from PREPARED to OPENED.
 * CRITICAL: Does NOT mark as sent and leaves sentAt/sentByUserId NULL.
 */
export async function recordWhatsAppOpened(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const log = await prisma.messageLog.findUnique({
      where: { id },
    });

    if (!log) {
      res.status(404).json({
        success: false,
        message: `Message log with ID '${id}' not found.`,
      });
      return;
    }

    // Only transition if in PREPARED state. If already OPENED or STAFF_CONFIRMED_SENT, preserve.
    let updatedLog = log;
    if (log.status === MessageStatus.PREPARED) {
      updatedLog = await prisma.messageLog.update({
        where: { id },
        data: {
          status: MessageStatus.OPENED,
        },
      });

      await prisma.activityLog.create({
        data: {
          entityType: 'MESSAGE_LOG',
          entityId: id,
          action: ActionType.STATUS_CHANGE,
          userId: req.user?.id,
          details: {
            previousStatus: MessageStatus.PREPARED,
            newStatus: MessageStatus.OPENED,
          },
        },
      });
    }

    res.status(200).json({
      success: true,
      message: 'WhatsApp link opened recorded.',
      data: updatedLog,
    });
  } catch (error: any) {
    console.error('Error recording WhatsApp opened:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record WhatsApp opened.',
      error: error.message,
    });
  }
}

/**
 * Staff explicitly confirms that they pressed Send in WhatsApp.
 * Transitions status to STAFF_CONFIRMED_SENT and records sentByUserId and sentAt.
 */
export async function confirmWhatsAppSent(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const validated = confirmSentSchema.parse(req.body);

    const log = await prisma.messageLog.findUnique({
      where: { id },
    });

    if (!log) {
      res.status(404).json({
        success: false,
        message: `Message log with ID '${id}' not found.`,
      });
      return;
    }

    if (log.status === MessageStatus.STAFF_CONFIRMED_SENT) {
      res.status(200).json({
        success: true,
        message: 'Message was already confirmed as sent.',
        data: log,
      });
      return;
    }

    const updatedLog = await prisma.messageLog.update({
      where: { id },
      data: {
        status: MessageStatus.STAFF_CONFIRMED_SENT,
        sentByUserId: req.user?.id,
        sentAt: new Date(),
        notes: validated.notes
          ? `${log.notes ? log.notes + ' | ' : ''}Staff Note: ${validated.notes}`
          : log.notes,
      },
      include: {
        sentByUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    await prisma.activityLog.create({
      data: {
        entityType: 'MESSAGE_LOG',
        entityId: id,
        action: ActionType.CONFIRM,
        userId: req.user?.id,
        details: {
          previousStatus: log.status,
          newStatus: MessageStatus.STAFF_CONFIRMED_SENT,
          sentByUserId: req.user?.id,
          sentAt: updatedLog.sentAt,
          staffNotes: validated.notes,
        },
      },
    });

    res.status(200).json({
      success: true,
      message: 'Message sending confirmed successfully by staff.',
      data: updatedLog,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: 'Validation failed.',
        errors: error.errors,
      });
      return;
    }

    console.error('Error confirming WhatsApp sent:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm WhatsApp sent.',
      error: error.message,
    });
  }
}

/**
 * Staff reports that sending the message failed or was cancelled.
 * Transitions status to FAILED and logs failure reason.
 */
export async function recordWhatsAppFailed(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const validated = recordFailedSchema.parse(req.body);

    const log = await prisma.messageLog.findUnique({
      where: { id },
    });

    if (!log) {
      res.status(404).json({
        success: false,
        message: `Message log with ID '${id}' not found.`,
      });
      return;
    }

    const updatedLog = await prisma.messageLog.update({
      where: { id },
      data: {
        status: MessageStatus.FAILED,
        notes: `${log.notes ? log.notes + ' | ' : ''}Failure Reason: ${validated.reason}`,
      },
    });

    await prisma.activityLog.create({
      data: {
        entityType: 'MESSAGE_LOG',
        entityId: id,
        action: ActionType.STATUS_CHANGE,
        userId: req.user?.id,
        details: {
          previousStatus: log.status,
          newStatus: MessageStatus.FAILED,
          reason: validated.reason,
        },
      },
    });

    res.status(200).json({
      success: true,
      message: 'Message failure recorded.',
      data: updatedLog,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: 'Validation failed.',
        errors: error.errors,
      });
      return;
    }

    console.error('Error recording WhatsApp failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record WhatsApp failure.',
      error: error.message,
    });
  }
}

/**
 * Retrieves message logs with filtering by registration, allocation, status, and pagination.
 */
export async function listMessageLogs(req: Request, res: Response): Promise<void> {
  try {
    const query = listMessageLogsSchema.parse(req.query);
    const page = parseInt(query.page, 10);
    const limit = parseInt(query.limit, 10);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.registrationId) {
      where.registrationId = query.registrationId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.allocationId) {
      where.notes = {
        contains: query.allocationId,
      };
    }

    const [total, logs] = await Promise.all([
      prisma.messageLog.count({ where }),
      prisma.messageLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          registration: {
            select: {
              id: true,
              registrationId: true,
              primaryName: true,
              mobile: true,
            },
          },
          sentByUser: {
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

    res.status(200).json({
      success: true,
      data: {
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error: any) {
    console.error('Error listing message logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list message logs.',
      error: error.message,
    });
  }
}
