import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { encryptSensitiveData } from '../utils/encryption';
import { parseRoomTokens } from '../utils/roomParser';
import { 
  RoomStatus, 
  GenderPreference, 
  UnitType, 
  GenderCategory, 
  UnitStatus, 
  ActionType,
  AllocationItemStatus,
  StayStatus,
  Gender
} from '@prisma/client';

// ----------------------------------------------------------------------------
// ZOD VALIDATION SCHEMAS
// ----------------------------------------------------------------------------

export const createRoomSchema = z.object({
  roomNumber: z.string().trim().min(1, 'Room number is required'),
  hotelId: z.string().uuid().optional().nullable(),
  building: z.string().trim().optional(),
  floor: z.number().int().optional(),
  genderPreference: z.nativeEnum(GenderPreference).default(GenderPreference.ANY),
  status: z.nativeEnum(RoomStatus).default(RoomStatus.ACTIVE),
  notes: z.string().trim().optional(),
  // Direct bed and mat quantities
  totalBeds: z.number().int().min(0).default(0),
  totalMats: z.number().int().min(0).default(0),
  // Backward compatibility
  maleBeds: z.number().int().min(0).optional().default(0),
  femaleBeds: z.number().int().min(0).optional().default(0),
  anyBeds: z.number().int().min(0).optional().default(0),
  maleMats: z.number().int().min(0).optional().default(0),
  femaleMats: z.number().int().min(0).optional().default(0),
  anyMats: z.number().int().min(0).optional().default(0),
});

export const bulkRoomGroupSchema = z.object({
  roomNumbers: z.union([
    z.array(z.string().trim().min(1)),
    z.string().trim().min(1),
  ]),
  building: z.string().trim().optional().nullable(),
  floor: z.number().int().optional().nullable(),
  genderPreference: z.nativeEnum(GenderPreference).default(GenderPreference.MALE),
  status: z.nativeEnum(RoomStatus).default(RoomStatus.ACTIVE),
  notes: z.string().trim().optional().nullable(),
  totalBeds: z.number().int().min(0).default(0),
  totalMats: z.number().int().min(0).default(0),
});

export const createBulkRoomsSchema = z.object({
  hotelId: z.string().uuid().optional().nullable(),
  groups: z.array(bulkRoomGroupSchema).min(1, 'At least one room group is required'),
});

export const updateRoomSchema = z.object({
  hotelId: z.string().uuid().optional().nullable(),
  building: z.string().trim().optional().nullable(),
  floor: z.number().int().optional().nullable(),
  genderPreference: z.nativeEnum(GenderPreference).optional(),
  status: z.nativeEnum(RoomStatus).optional(),
  notes: z.string().trim().optional().nullable(),
});

export const addUnitSchema = z.object({
  unitNumber: z.string().trim().min(1, 'Unit number is required (e.g. B7, M3)'),
  type: z.nativeEnum(UnitType).default(UnitType.BED),
  genderCategory: z.nativeEnum(GenderCategory).default(GenderCategory.ANY),
  status: z.nativeEnum(UnitStatus).default(UnitStatus.ACTIVE),
  notes: z.string().trim().optional(),
});

export const updateUnitSchema = z.object({
  genderCategory: z.nativeEnum(GenderCategory).optional(),
  status: z.nativeEnum(UnitStatus).optional(),
  notes: z.string().trim().optional().nullable(),
});

export const rewriteUnitStatusSchema = z.object({
  action: z.enum(['CHECK_IN', 'CHECK_OUT', 'RELEASE_ALLOCATION', 'SET_MAINTENANCE', 'SET_ACTIVE']),
  notes: z.string().trim().optional().nullable(),
  checkInDateTime: z.string().optional().nullable(),
  checkOutDateTime: z.string().optional().nullable(),
  participants: z.array(z.object({
    unitId: z.string().uuid().optional(),
    fullName: z.string().trim().min(1),
    gender: z.nativeEnum(Gender).optional().nullable(),
    age: z.number().optional().nullable(),
    aadhaarNumber: z.string().optional().nullable(),
  })).optional(),
});

// ----------------------------------------------------------------------------
// CONTROLLER HANDLERS
// ----------------------------------------------------------------------------

/**
 * List all rooms with aggregated unit breakdown matching reference sheet:
 * Beds (M), Beds (F), Mats (M), Mats (F), Total Capacity, Status.
 */
export async function listRooms(req: Request, res: Response) {
  const { q, building, hotelId, status, genderPreference } = req.query;

  const whereClause: any = {};

  if (typeof q === 'string' && q.trim()) {
    whereClause.OR = [
      { roomNumber: { contains: q.trim(), mode: 'insensitive' } },
      { building: { contains: q.trim(), mode: 'insensitive' } },
      { notes: { contains: q.trim(), mode: 'insensitive' } },
    ];
  }

  if (typeof building === 'string' && building.trim()) {
    whereClause.building = { equals: building.trim(), mode: 'insensitive' };
  }

  if (typeof hotelId === 'string' && hotelId.trim()) {
    whereClause.hotelId = hotelId.trim();
  }

  if (typeof status === 'string' && Object.values(RoomStatus).includes(status as RoomStatus)) {
    whereClause.status = status as RoomStatus;
  }

  if (typeof genderPreference === 'string' && Object.values(GenderPreference).includes(genderPreference as GenderPreference)) {
    whereClause.genderPreference = genderPreference as GenderPreference;
  }

  const rooms = await prisma.room.findMany({
    where: whereClause,
    include: {
      hotel: true,
      units: {
        orderBy: { unitNumber: 'asc' },
      },
    },
    orderBy: { roomNumber: 'asc' },
  });

  // Calculate detailed breakdown matching reference table
  const formattedRooms = rooms.map((r) => {
    let bedsMale = 0;
    let bedsFemale = 0;
    let bedsAny = 0;
    let matsMale = 0;
    let matsFemale = 0;
    let matsAny = 0;

    for (const u of r.units) {
      if (u.type === UnitType.BED) {
        if (u.genderCategory === GenderCategory.MALE) bedsMale++;
        else if (u.genderCategory === GenderCategory.FEMALE) bedsFemale++;
        else bedsAny++;
      } else {
        if (u.genderCategory === GenderCategory.MALE) matsMale++;
        else if (u.genderCategory === GenderCategory.FEMALE) matsFemale++;
        else matsAny++;
      }
    }

    const totalCapacity = bedsMale + bedsFemale + bedsAny + matsMale + matsFemale + matsAny;

    return {
      id: r.id,
      roomNumber: r.roomNumber,
      hotelId: r.hotelId,
      hotel: r.hotel ? { id: r.hotel.id, name: r.hotel.name } : null,
      building: r.building,
      floor: r.floor,
      totalBeds: r.totalBeds,
      totalMats: r.totalMats,
      totalCapacity,
      breakdown: {
        bedsMale,
        bedsFemale,
        bedsAny,
        matsMale,
        matsFemale,
        matsAny,
      },
      genderPreference: r.genderPreference,
      status: r.status,
      notes: r.notes,
      unitCount: r.units.length,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  });

  return res.json({
    success: true,
    data: formattedRooms,
    meta: {
      total: formattedRooms.length,
    },
  });
}

/**
 * Get Room by ID with individual units and their real-time allocation/occupancy status
 * for the visual unit grid (Available, Allocated, Confirmed, Checked In).
 */
export async function getRoomById(req: Request, res: Response) {
  const { id } = req.params;

  try {
    const room = await prisma.room.findUnique({
      where: { id },
      include: {
        hotel: true,
        units: {
          orderBy: { unitNumber: 'asc' },
          include: {
            allocationItems: {
              where: {
                status: { in: [AllocationItemStatus.TENTATIVE, AllocationItemStatus.CONFIRMED] },
              },
              include: {
                allocation: {
                  select: {
                    allocationNumber: true,
                    registrationId: true,
                    status: true,
                    entryDate: true,
                    exitDate: true,
                    registration: {
                      select: {
                        registrationId: true,
                        primaryName: true,
                        mobile: true,
                      },
                    },
                  },
                },
              },
            },
            stayRecords: {
              where: {
                status: { in: [StayStatus.CHECKED_IN, StayStatus.EXTENDED] },
              },
              include: {
                participant: {
                  select: {
                    fullName: true,
                    gender: true,
                    age: true,
                  },
                },
                registration: {
                  select: {
                    registrationId: true,
                    primaryName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found.',
      });
    }

    // Derive visual unit states for the room layout grid:
    // Checked In (Purple) > Confirmed (Amber) > Allocated (Blue) > Available (Green) > Inactive/Maintenance (Slate)
    const unitsWithVisualState = room.units.map((u) => {
      let visualState: 'CHECKED_IN' | 'CONFIRMED' | 'ALLOCATED' | 'AVAILABLE' | 'MAINTENANCE' = 'AVAILABLE';
      let occupantInfo = null;

      if (u.status === UnitStatus.MAINTENANCE || u.status === UnitStatus.INACTIVE) {
        visualState = 'MAINTENANCE';
      } else if (u.stayRecords.length > 0) {
        visualState = 'CHECKED_IN';
        const activeStay = u.stayRecords[0];
        occupantInfo = {
          type: 'CHECKED_IN',
          participantName: activeStay.participant?.fullName || activeStay.registration?.primaryName || 'Guest',
          registrationId: activeStay.registration?.registrationId || 'N/A',
          actualCheckIn: activeStay.actualCheckIn,
        };
      } else if (u.allocationItems.length > 0) {
        const activeItem = u.allocationItems[0];
        if (activeItem.status === AllocationItemStatus.CONFIRMED || activeItem.allocation?.status === 'CONFIRMED') {
          visualState = 'CONFIRMED';
        } else {
          visualState = 'ALLOCATED';
        }
        occupantInfo = {
          type: visualState,
          registrationId: activeItem.allocation?.registration?.registrationId || 'N/A',
          primaryName: activeItem.allocation?.registration?.primaryName || 'Reserved',
          entryDate: activeItem.entryDate,
          exitDate: activeItem.exitDate,
        };
      }

      return {
        id: u.id,
        unitNumber: u.unitNumber,
        type: u.type,
        genderCategory: u.genderCategory,
        status: u.status,
        notes: u.notes,
        visualState,
        occupantInfo,
      };
    });

    return res.json({
      success: true,
      data: {
        ...room,
        units: unitsWithVisualState,
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to retrieve room details',
    });
  }
}

/**
 * Create a new Room with auto-provisioned beds and mats.
 */
export async function createRoom(req: Request, res: Response) {
  const parsed = createRoomSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: parsed.error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  const {
    roomNumber,
    building,
    floor,
    genderPreference,
    status,
    notes,
    maleBeds,
    femaleBeds,
    anyBeds,
    maleMats,
    femaleMats,
    anyMats,
  } = parsed.data;

  // If multiple room numbers or ranges were provided (e.g. "21, 23, 24, 43" or "101-105"), delegate to createBulkRooms
  const tokens = parseRoomTokens(roomNumber);
  if (tokens.length > 1) {
    return createBulkRooms(req, res);
  }

  // Check unique roomNumber
  const existing = await prisma.room.findUnique({
    where: { roomNumber },
  });
  if (existing) {
    return res.status(409).json({
      success: false,
      message: `Room with number '${roomNumber}' already exists.`,
    });
  }

  // Transactionally create room and accommodation units
  const room = await prisma.$transaction(async (tx) => {
    const newRoom = await tx.room.create({
      data: {
        roomNumber,
        hotelId: parsed.data.hotelId || null,
        building: building || null,
        floor: floor !== undefined ? floor : null,
        genderPreference,
        status,
        notes: notes || null,
        totalBeds: 0, // Will be auto-synchronized by PostgreSQL trigger
        totalMats: 0,
      },
    });

    const numBeds = (parsed.data.totalBeds && parsed.data.totalBeds > 0)
      ? parsed.data.totalBeds
      : ((maleBeds || 0) + (femaleBeds || 0) + (anyBeds || 0));

    const numMats = (parsed.data.totalMats && parsed.data.totalMats > 0)
      ? parsed.data.totalMats
      : ((maleMats || 0) + (femaleMats || 0) + (anyMats || 0));

    const unitGender = genderPreference === GenderPreference.MALE
      ? GenderCategory.MALE
      : genderPreference === GenderPreference.FEMALE
      ? GenderCategory.FEMALE
      : GenderCategory.ANY;

    // Auto-generate bed units: B1, B2, B3...
    for (let i = 1; i <= numBeds; i++) {
      await tx.accommodationUnit.create({
        data: {
          roomId: newRoom.id,
          unitNumber: `B${i}`,
          type: UnitType.BED,
          genderCategory: unitGender,
          status: UnitStatus.ACTIVE,
        },
      });
    }

    // Auto-generate mat units: M1, M2, M3...
    for (let i = 1; i <= numMats; i++) {
      await tx.accommodationUnit.create({
        data: {
          roomId: newRoom.id,
          unitNumber: `M${i}`,
          type: UnitType.MAT,
          genderCategory: unitGender,
          status: UnitStatus.ACTIVE,
        },
      });
    }

    await tx.room.update({
      where: { id: newRoom.id },
      data: {
        totalBeds: numBeds,
        totalMats: numMats,
      },
    });

    // Log Activity
    if (req.user) {
      await tx.activityLog.create({
        data: {
          entityType: 'ROOM',
          entityId: newRoom.id,
          action: ActionType.CREATE,
          details: {
            roomNumber,
            building,
            totalUnits: numBeds + numMats,
            beds: numBeds,
            mats: numMats,
          },
          userId: req.user.id,
        },
      });
    }

    return newRoom;
  });

  // Re-fetch room with trigger-synchronized totals and units
  const finalizedRoom = await prisma.room.findUniqueOrThrow({
    where: { id: room.id },
    include: { units: { orderBy: { unitNumber: 'asc' } } },
  });

  return res.status(201).json({
    success: true,
    message: `Room ${finalizedRoom.roomNumber} created with ${finalizedRoom.units.length} units.`,
    data: finalizedRoom,
  });
}

/**
 * Bulk Create Rooms with auto-provisioned beds and mats.
 * Supports multiple rooms at a time (e.g. "21, 23, 24, 43" or ranges like "101-105"),
 * as well as multiple groups with different bed/mat configurations.
 */
export async function createBulkRooms(req: Request, res: Response) {
  try {
    let payload = req.body;

    // Normalization: allow top-level roomNumbers / roomNumber shorthand
    if (!payload.groups && (payload.roomNumbers || payload.roomNumber)) {
      payload = {
        hotelId: payload.hotelId || null,
        groups: [
          {
            roomNumbers: payload.roomNumbers || payload.roomNumber,
            building: payload.building || null,
            floor: payload.floor !== undefined ? Number(payload.floor) : null,
            genderPreference: payload.genderPreference || GenderPreference.MALE,
            status: payload.status || RoomStatus.ACTIVE,
            notes: payload.notes || null,
            totalBeds: Number(payload.totalBeds) || 0,
            totalMats: Number(payload.totalMats) || 0,
          },
        ],
      };
    }

    const parsed = createBulkRoomsSchema.safeParse(payload);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parsed.error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      });
    }

    const { hotelId, groups } = parsed.data;

    // Verify hotel if specified
    if (hotelId) {
      const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
      if (!hotel) {
        return res.status(404).json({
          success: false,
          message: 'Specified hotel facility was not found.',
        });
      }
    }

    interface ResolvedRoomItem {
      roomNumber: string;
      hotelId: string | null;
      building: string | null;
      floor: number | null;
      genderPreference: GenderPreference;
      status: RoomStatus;
      notes: string | null;
      totalBeds: number;
      totalMats: number;
    }

    const itemsToCreate: ResolvedRoomItem[] = [];
    const allRoomNumbers: string[] = [];
    const seenInRequest = new Set<string>();

    for (let gIdx = 0; gIdx < groups.length; gIdx++) {
      const g = groups[gIdx];
      const tokens = Array.isArray(g.roomNumbers)
        ? g.roomNumbers.flatMap((t) => parseRoomTokens(t))
        : parseRoomTokens(g.roomNumbers);

      if (tokens.length === 0) {
        return res.status(400).json({
          success: false,
          message: `Group #${gIdx + 1} has no valid room numbers specified.`,
        });
      }

      for (const tok of tokens) {
        const trimmed = tok.trim();
        if (!trimmed) continue;
        const key = trimmed.toLowerCase();
        if (seenInRequest.has(key)) {
          return res.status(400).json({
            success: false,
            message: `Duplicate room number '${trimmed}' specified in request.`,
          });
        }
        seenInRequest.add(key);
        allRoomNumbers.push(trimmed);

        itemsToCreate.push({
          roomNumber: trimmed,
          hotelId: hotelId || null,
          building: g.building || null,
          floor: g.floor !== undefined ? g.floor : null,
          genderPreference: g.genderPreference,
          status: g.status,
          notes: g.notes || null,
          totalBeds: g.totalBeds,
          totalMats: g.totalMats,
        });
      }
    }

    if (itemsToCreate.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No room numbers provided.',
      });
    }

    // Check database for existing rooms
    const existingRooms = await prisma.room.findMany({
      where: { roomNumber: { in: allRoomNumbers } },
      select: { roomNumber: true },
    });

    if (existingRooms.length > 0) {
      const dupes = existingRooms.map((r) => r.roomNumber).join(', ');
      return res.status(409).json({
        success: false,
        message: `The following room number(s) already exist: ${dupes}. Please remove or change them.`,
      });
    }

    // Transactionally create all rooms and units
    const result = await prisma.$transaction(async (tx) => {
      const createdRooms: any[] = [];
      let totalUnitsCount = 0;

      for (const item of itemsToCreate) {
        const room = await tx.room.create({
          data: {
            roomNumber: item.roomNumber,
            hotelId: item.hotelId,
            building: item.building,
            floor: item.floor,
            genderPreference: item.genderPreference,
            status: item.status,
            notes: item.notes,
            totalBeds: 0,
            totalMats: 0,
          },
        });

        const unitGender =
          item.genderPreference === GenderPreference.MALE
            ? GenderCategory.MALE
            : item.genderPreference === GenderPreference.FEMALE
            ? GenderCategory.FEMALE
            : GenderCategory.ANY;

        // Auto-generate Beds: B1, B2...
        for (let b = 1; b <= item.totalBeds; b++) {
          await tx.accommodationUnit.create({
            data: {
              roomId: room.id,
              unitNumber: `B${b}`,
              type: UnitType.BED,
              genderCategory: unitGender,
              status: UnitStatus.ACTIVE,
            },
          });
          totalUnitsCount++;
        }

        // Auto-generate Floor Mats: M1, M2...
        for (let m = 1; m <= item.totalMats; m++) {
          await tx.accommodationUnit.create({
            data: {
              roomId: room.id,
              unitNumber: `M${m}`,
              type: UnitType.MAT,
              genderCategory: unitGender,
              status: UnitStatus.ACTIVE,
            },
          });
          totalUnitsCount++;
        }

        await tx.room.update({
          where: { id: room.id },
          data: {
            totalBeds: item.totalBeds,
            totalMats: item.totalMats,
          },
        });

        if (req.user) {
          await tx.activityLog.create({
            data: {
              entityType: 'ROOM',
              entityId: room.id,
              action: ActionType.CREATE,
              details: {
                roomNumber: item.roomNumber,
                hotelId: item.hotelId,
                building: item.building,
                beds: item.totalBeds,
                mats: item.totalMats,
                bulkBatch: true,
              },
              userId: req.user.id,
            },
          });
        }

        createdRooms.push(room);
      }

      return { createdRooms, totalUnitsCount };
    });

    return res.status(201).json({
      success: true,
      message: `Successfully created ${result.createdRooms.length} rooms with ${result.totalUnitsCount} total inventory units.`,
      data: {
        createdCount: result.createdRooms.length,
        totalUnits: result.totalUnitsCount,
        rooms: result.createdRooms,
      },
    });
  } catch (err: any) {
    console.error('Error in createBulkRooms:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to create bulk rooms',
    });
  }
}

/**
 * Update Room attributes.
 */
export async function updateRoom(req: Request, res: Response) {
  const { id } = req.params;
  const parsed = updateRoomSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: parsed.error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  const room = await prisma.room.findUnique({ where: { id } });
  if (!room) {
    return res.status(404).json({ success: false, message: 'Room not found.' });
  }

  const updated = await prisma.room.update({
    where: { id },
    data: parsed.data,
    include: { units: true },
  });

  if (req.user) {
    await prisma.activityLog.create({
      data: {
        entityType: 'ROOM',
        entityId: room.id,
        action: ActionType.UPDATE,
        details: parsed.data,
        userId: req.user.id,
      },
    });
  }

  return res.json({
    success: true,
    message: `Room ${updated.roomNumber} updated successfully.`,
    data: updated,
  });
}

/**
 * Add a single Bed or Mat unit to an existing room.
 */
export async function addUnitToRoom(req: Request, res: Response) {
  const { id } = req.params;
  const parsed = addUnitSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: parsed.error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  const room = await prisma.room.findUnique({ where: { id } });
  if (!room) {
    return res.status(404).json({ success: false, message: 'Room not found.' });
  }

  // Check unique unitNumber within room
  const unitNumber = parsed.data.unitNumber.toUpperCase();
  const existingUnit = await prisma.accommodationUnit.findUnique({
    where: {
      roomId_unitNumber: {
        roomId: room.id,
        unitNumber,
      },
    },
  });

  if (existingUnit) {
    return res.status(409).json({
      success: false,
      message: `Unit '${unitNumber}' already exists in room ${room.roomNumber}.`,
    });
  }

  const unit = await prisma.accommodationUnit.create({
    data: {
      roomId: room.id,
      unitNumber,
      type: parsed.data.type,
      genderCategory: parsed.data.genderCategory,
      status: parsed.data.status,
      notes: parsed.data.notes || null,
    },
  });

  // Re-fetch room to verify trigger updated totals
  const updatedRoom = await prisma.room.findUniqueOrThrow({
    where: { id: room.id },
  });

  return res.status(201).json({
    success: true,
    message: `Unit ${unit.unitNumber} added to room ${room.roomNumber}.`,
    data: {
      unit,
      roomTotalBeds: updatedRoom.totalBeds,
      roomTotalMats: updatedRoom.totalMats,
    },
  });
}

/**
 * Update an existing unit (status, gender category, notes).
 */
export async function updateUnit(req: Request, res: Response) {
  const { id, unitId } = req.params;
  const parsed = updateUnitSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: parsed.error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  const unit = await prisma.accommodationUnit.findFirst({
    where: { id: unitId, roomId: id },
  });

  if (!unit) {
    return res.status(404).json({ success: false, message: 'Unit not found in room.' });
  }

  const updatedUnit = await prisma.accommodationUnit.update({
    where: { id: unitId },
    data: parsed.data,
  });

  return res.json({
    success: true,
    message: `Unit ${updatedUnit.unitNumber} updated.`,
    data: updatedUnit,
  });
}

/**
 * Direct Rewrite of Unit Occupancy Status:
 * Check In, Check Out, Release Allocation, or toggle Maintenance/Active.
 */
export async function rewriteUnitStatus(req: Request, res: Response) {
  const { unitId } = req.params;
  const parsed = rewriteUnitStatusSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: parsed.error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  const { action, notes, checkInDateTime, checkOutDateTime, participants } = parsed.data;
  const currentUserId = (req as any).user?.id;

  const unit = await prisma.accommodationUnit.findUnique({
    where: { id: unitId },
    include: { room: true },
  });

  if (!unit) {
    return res.status(404).json({ success: false, message: 'Accommodation unit not found.' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      if (action === 'CHECK_OUT') {
        const checkOutTime = checkOutDateTime ? new Date(checkOutDateTime) : new Date();

        // Find active stay or allocation to get registration
        const activeStay = await tx.stayRecord.findFirst({
          where: {
            unitId: unit.id,
            status: { in: [StayStatus.CHECKED_IN, StayStatus.EXTENDED] },
            actualCheckOut: null,
          },
          include: { participant: true, registration: true },
        });

        let targetRegId = activeStay?.registrationId || null;

        if (!targetRegId) {
          const allocItem = await tx.allocationItem.findFirst({
            where: {
              unitId: unit.id,
              status: { in: [AllocationItemStatus.TENTATIVE, AllocationItemStatus.CONFIRMED] },
            },
            include: { allocation: true },
          });
          targetRegId = allocItem?.allocation.registrationId || null;
        }

        let checkedOutCount = 0;

        if (targetRegId) {
          const allStays = await tx.stayRecord.findMany({
            where: {
              registrationId: targetRegId,
              status: { in: [StayStatus.CHECKED_IN, StayStatus.EXTENDED] },
              actualCheckOut: null,
            },
          });

          for (const s of allStays) {
            await tx.stayRecord.update({
              where: { id: s.id },
              data: {
                actualCheckOut: checkOutTime,
                status: StayStatus.CHECKED_OUT,
                notes: notes ? `${s.notes ? s.notes + ' | ' : ''}Checkout: ${notes}` : s.notes,
              },
            });

            await tx.participant.update({
              where: { id: s.participantId },
              data: { checkInStatus: 'CHECKED_OUT' as any },
            });

            if (s.allocationItemId) {
              await tx.allocationItem.update({
                where: { id: s.allocationItemId },
                data: { status: AllocationItemStatus.COMPLETED },
              });
            }
            checkedOutCount++;
          }

          await tx.registration.update({
            where: { id: targetRegId },
            data: { status: 'CHECKED_OUT' as any },
          });
        } else if (activeStay) {
          await tx.stayRecord.update({
            where: { id: activeStay.id },
            data: {
              actualCheckOut: checkOutTime,
              status: StayStatus.CHECKED_OUT,
              notes: notes || undefined,
            },
          });
          checkedOutCount = 1;
        }

        if (checkedOutCount === 0) {
          throw new Error(`No active checked-in stays found for unit ${unit.unitNumber}.`);
        }

        return {
          unitNumber: unit.unitNumber,
          action: 'CHECK_OUT',
          message: `Successfully checked out ${checkedOutCount} bed(s). All beds are now available!`,
        };
      }

      if (action === 'CHECK_IN') {
        const allocItem = await tx.allocationItem.findFirst({
          where: {
            unitId: unit.id,
            status: { in: [AllocationItemStatus.TENTATIVE, AllocationItemStatus.CONFIRMED] },
          },
          include: {
            allocation: {
              include: {
                registration: {
                  include: {
                    participants: {
                      where: { isArchived: false },
                      orderBy: { isPrimary: 'desc' },
                    },
                  },
                },
                items: {
                  where: { status: { in: [AllocationItemStatus.TENTATIVE, AllocationItemStatus.CONFIRMED] } },
                  include: { unit: { include: { room: true } } },
                },
              },
            },
          },
        });

        if (!allocItem) {
          throw new Error(`No reservation found for unit ${unit.unitNumber} to check in.`);
        }

        const allocation = allocItem.allocation;
        const registration = allocation.registration;
        const checkInTime = checkInDateTime ? new Date(checkInDateTime) : new Date();

        if (allocation.status === 'TENTATIVE') {
          await tx.allocation.update({
            where: { id: allocation.id },
            data: { status: 'CONFIRMED' as any },
          });
        }

        let checkedInCount = 0;

        for (let i = 0; i < allocation.items.length; i++) {
          const item = allocation.items[i];
          const participantInput = participants?.find((p) => p.unitId === item.unitId) || participants?.[i];

          let participant: any = null;

          if (participantInput && participantInput.fullName.trim()) {
            participant = await tx.participant.create({
              data: {
                registrationId: registration.id,
                fullName: participantInput.fullName.trim(),
                gender: participantInput.gender || null,
                age: participantInput.age ? Number(participantInput.age) : null,
                relationToPrimary: i === 0 ? 'Self' : 'Accompanying',
                isPrimary: i === 0,
                checkInStatus: 'CHECKED_IN' as any,
              },
            });

            if (participantInput.aadhaarNumber && participantInput.aadhaarNumber.trim().length >= 4) {
              const encrypted = encryptSensitiveData(participantInput.aadhaarNumber.trim());
              await tx.aadhaarRecord.upsert({
                where: { participantId: participant.id },
                update: {
                  encryptedAadhaar: encrypted.encryptedText,
                  aadhaarIv: encrypted.iv,
                  aadhaarAuthTag: encrypted.authTag,
                  lastFourDigits: encrypted.lastFourDigits,
                  retentionConsent: true,
                  complianceStatus: 'COLLECTED' as any,
                  recordedById: currentUserId,
                },
                create: {
                  participantId: participant.id,
                  encryptedAadhaar: encrypted.encryptedText,
                  aadhaarIv: encrypted.iv,
                  aadhaarAuthTag: encrypted.authTag,
                  lastFourDigits: encrypted.lastFourDigits,
                  retentionConsent: true,
                  complianceStatus: 'COLLECTED' as any,
                  recordedById: currentUserId,
                },
              });
            }
          } else {
            participant = registration.participants[i] || registration.participants[0];
            if (!participant) {
              participant = await tx.participant.create({
                data: {
                  registrationId: registration.id,
                  fullName: registration.primaryName,
                  relationToPrimary: 'Self',
                  isPrimary: true,
                  checkInStatus: 'CHECKED_IN' as any,
                },
              });
            }
          }

          const existingStay = await tx.stayRecord.findFirst({
            where: {
              unitId: item.unitId,
              status: { in: [StayStatus.CHECKED_IN, StayStatus.EXTENDED] },
              actualCheckOut: null,
            },
          });

          if (!existingStay) {
            await tx.stayRecord.create({
              data: {
                registrationId: registration.id,
                participantId: participant.id,
                unitId: item.unitId,
                allocationItemId: item.id,
                actualCheckIn: checkInTime,
                status: StayStatus.CHECKED_IN,
                notes: notes || 'Checked in from room layout',
                recordedById: currentUserId,
              },
            });

            await tx.allocationItem.update({
              where: { id: item.id },
              data: {
                status: AllocationItemStatus.CONFIRMED,
                participantId: participant.id,
              },
            });

            await tx.participant.update({
              where: { id: participant.id },
              data: { checkInStatus: 'CHECKED_IN' as any },
            });

            checkedInCount++;
          }
        }

        await tx.registration.update({
          where: { id: registration.id },
          data: { status: 'CHECKED_IN' as any },
        });

        await tx.activityLog.create({
          data: {
            entityType: 'RECEPTION',
            entityId: allocation.id,
            action: ActionType.CHECK_IN,
            userId: currentUserId,
            details: {
              allocationNumber: allocation.allocationNumber,
              registrationId: registration.registrationId,
              primaryName: registration.primaryName,
              checkedInCount,
            },
          },
        });

        return {
          unitNumber: unit.unitNumber,
          action: 'CHECK_IN',
          message: `Successfully checked in ${checkedInCount} bed(s) for ${registration.primaryName}!`,
        };
      }

      if (action === 'RELEASE_ALLOCATION') {
        const allocItem = await tx.allocationItem.findFirst({
          where: {
            unitId: unit.id,
            status: { in: [AllocationItemStatus.TENTATIVE, AllocationItemStatus.CONFIRMED] },
          },
          include: { allocation: true },
        });

        let targetAllocId = allocItem?.allocationId || null;

        if (targetAllocId) {
          await tx.allocationItem.updateMany({
            where: {
              allocationId: targetAllocId,
              status: { in: [AllocationItemStatus.TENTATIVE, AllocationItemStatus.CONFIRMED] },
            },
            data: { status: AllocationItemStatus.CANCELLED },
          });

          await tx.allocation.update({
            where: { id: targetAllocId },
            data: { status: 'CANCELLED' as any },
          });
        }

        const activeStays = await tx.stayRecord.findMany({
          where: {
            unitId: unit.id,
            status: { in: [StayStatus.CHECKED_IN, StayStatus.EXTENDED] },
            actualCheckOut: null,
          },
        });

        for (const s of activeStays) {
          await tx.stayRecord.update({
            where: { id: s.id },
            data: { actualCheckOut: new Date(), status: StayStatus.CHECKED_OUT, notes: 'Released' },
          });
        }

        return {
          unitNumber: unit.unitNumber,
          action: 'RELEASE_ALLOCATION',
          message: `Reservation cancelled and all linked beds released!`,
        };
      }

      if (action === 'SET_MAINTENANCE') {
        await tx.accommodationUnit.update({
          where: { id: unit.id },
          data: {
            status: UnitStatus.MAINTENANCE,
            notes: notes || 'Marked under maintenance from room view',
          },
        });
        return {
          unitNumber: unit.unitNumber,
          action: 'SET_MAINTENANCE',
          message: `Bed ${unit.room.roomNumber}-${unit.unitNumber} set to Maintenance.`,
        };
      }

      if (action === 'SET_ACTIVE') {
        await tx.accommodationUnit.update({
          where: { id: unit.id },
          data: {
            status: UnitStatus.ACTIVE,
            notes: null,
          },
        });
        return {
          unitNumber: unit.unitNumber,
          action: 'SET_ACTIVE',
          message: `Bed ${unit.room.roomNumber}-${unit.unitNumber} set to Active.`,
        };
      }

      throw new Error('Unsupported action');
    });

    return res.json({
      success: true,
      data: result,
      message: (result as any).message,
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to update unit occupancy status',
    });
  }
}

/**
 * Delete a room (blocked if active allocations exist).
 */
export async function deleteRoom(req: Request, res: Response) {
  const { id } = req.params;

  const room = await prisma.room.findUnique({
    where: { id },
    include: {
      units: {
        include: {
          allocationItems: true,
          stayRecords: true,
        },
      },
    },
  });

  if (!room) {
    return res.status(404).json({ success: false, message: 'Room not found.' });
  }

  // Check if any unit has active allocation items or stay records
  const hasAllocations = room.units.some((u) => u.allocationItems.length > 0 || u.stayRecords.length > 0);
  if (hasAllocations) {
    return res.status(400).json({
      success: false,
      message: `Cannot delete room ${room.roomNumber} because it has historical or active allocations/stays. Mark as INACTIVE instead.`,
    });
  }

  // Transactionally delete units and room
  await prisma.$transaction(async (tx) => {
    await tx.accommodationUnit.deleteMany({ where: { roomId: id } });
    await tx.room.delete({ where: { id } });
  });

  return res.json({
    success: true,
    message: `Room ${room.roomNumber} deleted successfully.`,
  });
}

export const deleteBulkRoomsSchema = z.object({
  roomIds: z.array(z.string().uuid()).min(1, 'At least one room ID must be specified'),
});

/**
 * Bulk delete multiple rooms (safely blocked if active allocations or stays exist).
 */
export async function deleteBulkRooms(req: Request, res: Response) {
  const parsed = deleteBulkRoomsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: parsed.error.errors,
    });
  }

  const { roomIds } = parsed.data;

  // Fetch rooms with units and their active allocation/stay records
  const rooms = await prisma.room.findMany({
    where: { id: { in: roomIds } },
    include: {
      units: {
        include: {
          allocationItems: {
            where: {
              status: { in: [AllocationItemStatus.TENTATIVE, AllocationItemStatus.CONFIRMED] },
            },
          },
          stayRecords: {
            where: {
              status: { in: [StayStatus.CHECKED_IN, StayStatus.EXTENDED] },
            },
          },
        },
      },
    },
  });

  if (rooms.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'No matching rooms found to delete.',
    });
  }

  // Check if any room has active allocations or checked-in occupants
  const blockedRooms = rooms.filter((r) =>
    r.units.some((u) => u.allocationItems.length > 0 || u.stayRecords.length > 0)
  );

  if (blockedRooms.length > 0) {
    const blockedNumbers = blockedRooms.map((r) => r.roomNumber).join(', ');
    return res.status(400).json({
      success: false,
      message: `Cannot delete room(s) [${blockedNumbers}] because they have active allocations or checked-in guests. Please cancel allocations or check out occupants first, or mark as INACTIVE.`,
    });
  }

  const targetIds = rooms.map((r) => r.id);
  const targetRoomNumbers = rooms.map((r) => r.roomNumber);

  // Transactionally delete units and rooms
  await prisma.$transaction(async (tx) => {
    await tx.accommodationUnit.deleteMany({
      where: { roomId: { in: targetIds } },
    });
    await tx.room.deleteMany({
      where: { id: { in: targetIds } },
    });

    if (req.user) {
      await tx.activityLog.create({
        data: {
          entityType: 'ROOM',
          entityId: targetIds[0],
          action: ActionType.DELETE,
          userId: req.user.id,
          details: {
            count: targetIds.length,
            deletedRoomNumbers: targetRoomNumbers,
            bulk: true,
          },
        },
      });
    }
  });

  return res.json({
    success: true,
    message: `Successfully deleted ${targetIds.length} room(s): ${targetRoomNumbers.join(', ')}.`,
    data: {
      deletedCount: targetIds.length,
      deletedRoomNumbers: targetRoomNumbers,
    },
  });
}
