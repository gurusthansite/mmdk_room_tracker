import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { getNextAllocationNumber } from '../utils/allocationNumber';
import { 
  AllocationStatus, 
  AllocationItemStatus, 
  RegistrationStatus, 
  ActionType, 
  GenderCategory, 
  GenderPreference,
  Gender,
  UnitType, 
  UnitStatus, 
  RoomStatus, 
  StayStatus 
} from '@prisma/client';

// ----------------------------------------------------------------------------
// ZOD SCHEMAS
// ----------------------------------------------------------------------------

export const checkAvailabilitySchema = z.object({
  entryDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  exitDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  genderCategory: z.nativeEnum(GenderCategory).optional(),
  unitType: z.nativeEnum(UnitType).optional(),
  building: z.string().trim().optional(),
  roomCategory: z.nativeEnum(GenderPreference).optional(),
  excludeAllocationId: z.string().optional(), // For reallocations/editing
  hotelId: z.string().trim().optional(),
});

export const createAllocationSchema = z.object({
  registrationId: z.string().trim().min(1, 'Registration ID is required'),
  entryDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  exitDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  unitIds: z.array(z.string().uuid('Invalid unit UUID')).min(1, 'At least one bed or mat unit must be selected'),
  status: z.nativeEnum(AllocationStatus).default(AllocationStatus.TENTATIVE),
  notes: z.string().trim().optional(),
  participantAssignments: z.array(z.object({
    participantId: z.string(),
    unitId: z.string(),
  })).optional(),
});

export const updateAllocationSchema = z.object({
  status: z.nativeEnum(AllocationStatus).optional(),
  entryDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
  exitDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
  unitIds: z.array(z.string().uuid()).min(1).optional(),
  notes: z.string().trim().optional().nullable(),
});

export const cancelAllocationSchema = z.object({
  reason: z.string().trim().optional().default('Cancelled by administrative staff'),
});

// ----------------------------------------------------------------------------
// CONTROLLER HANDLERS
// ----------------------------------------------------------------------------

/**
 * 1. Check Unit & Room Availability for Given Date Window
 * Queries inventory and identifies which beds/mats are free vs occupied.
 */
export async function checkAvailability(req: Request, res: Response) {
  try {
    const parsed = checkAvailabilitySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid availability parameters',
        errors: parsed.error.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
      });
    }

    const { entryDate, exitDate, genderCategory, unitType, building, roomCategory, excludeAllocationId, hotelId } = parsed.data;
    const start = new Date(entryDate);
    const end = new Date(exitDate);

    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: 'Exit date must be strictly after entry date',
      });
    }

  // 1. Fetch active conflicting allocation items in range [start, end)
  const conflictingAllocations = await prisma.allocationItem.findMany({
    where: {
      status: { in: [AllocationItemStatus.TENTATIVE, AllocationItemStatus.CONFIRMED] },
      entryDate: { lt: end },
      exitDate: { gt: start },
      ...(excludeAllocationId ? { allocationId: { not: excludeAllocationId } } : {}),
    },
    include: {
      allocation: {
        select: {
          id: true,
          allocationNumber: true,
          status: true,
          entryDate: true,
          exitDate: true,
          notes: true,
          registration: {
            select: {
              id: true,
              registrationId: true,
              primaryName: true,
              mobile: true,
              totalMembers: true,
              participants: {
                where: { isArchived: false },
                select: {
                  id: true,
                  fullName: true,
                  gender: true,
                  age: true,
                  isPrimary: true,
                  checkInStatus: true,
                  aadhaarRecord: {
                    select: { lastFourDigits: true },
                  },
                },
              },
            },
          },
          items: {
            where: {
              status: { in: [AllocationItemStatus.TENTATIVE, AllocationItemStatus.CONFIRMED] },
            },
            include: {
              unit: {
                include: { room: true },
              },
              stayRecords: {
                where: {
                  status: { in: [StayStatus.CHECKED_IN, StayStatus.EXTENDED] },
                  actualCheckOut: null,
                },
                include: {
                  participant: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const conflictedUnitMap = new Map<string, any>();
  conflictingAllocations.forEach((item) => {
    conflictedUnitMap.set(item.unitId, {
      type: 'ALLOCATION',
      allocationId: item.allocation.id,
      allocationNumber: item.allocation.allocationNumber,
      status: item.allocation.status,
      registrationId: item.allocation.registration.registrationId,
      regDbId: item.allocation.registration.id,
      primaryName: item.allocation.registration.primaryName,
      mobile: item.allocation.registration.mobile,
      totalMembers: item.allocation.registration.totalMembers,
      entryDate: item.entryDate,
      exitDate: item.exitDate,
      allUnits: item.allocation.items.map((it) => ({
        itemId: it.id,
        unitId: it.unit.id,
        unitNumber: it.unit.unitNumber,
        unitType: it.unit.type,
        genderCategory: it.unit.genderCategory,
        roomNumber: it.unit.room.roomNumber,
        building: it.unit.room.building,
        status: it.status,
        stayRecordId: it.stayRecords[0]?.id || null,
        participantName: it.stayRecords[0]?.participant.fullName || null,
      })),
      participants: item.allocation.registration.participants,
    });
  });

  // 2. Fetch active stay records (checked in)
  const conflictingStays = await prisma.stayRecord.findMany({
    where: {
      status: { in: [StayStatus.CHECKED_IN, StayStatus.EXTENDED] },
      actualCheckIn: { lt: end },
      OR: [
        { actualCheckOut: null },
        { actualCheckOut: { gt: start } },
      ],
    },
    include: {
      unit: { include: { room: true } },
      participant: { select: { id: true, fullName: true, gender: true, age: true } },
      registration: {
        select: {
          id: true,
          registrationId: true,
          primaryName: true,
          mobile: true,
          totalMembers: true,
          stayRecords: {
            where: {
              status: { in: [StayStatus.CHECKED_IN, StayStatus.EXTENDED] },
              actualCheckOut: null,
            },
            include: {
              unit: { include: { room: true } },
              participant: true,
            },
          },
        },
      },
    },
  });

  conflictingStays.forEach((stay) => {
    conflictedUnitMap.set(stay.unitId, {
      type: 'OCCUPIED',
      stayRecordId: stay.id,
      participantId: stay.participant.id,
      participantName: stay.participant.fullName,
      registrationId: stay.registration.registrationId,
      regDbId: stay.registration.id,
      primaryName: stay.registration.primaryName,
      mobile: stay.registration.mobile,
      actualCheckIn: stay.actualCheckIn,
      allUnits: stay.registration.stayRecords.map((sr) => ({
        stayRecordId: sr.id,
        unitId: sr.unit.id,
        unitNumber: sr.unit.unitNumber,
        unitType: sr.unit.type,
        genderCategory: sr.unit.genderCategory,
        roomNumber: sr.unit.room.roomNumber,
        building: sr.unit.room.building,
        participantName: sr.participant.fullName,
        participantId: sr.participant.id,
        status: 'OCCUPIED',
      })),
    });
  });

  // 3. Query all rooms and units matching filters
  const roomWhere: any = {};
  if (hotelId && hotelId !== 'ALL') {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(hotelId);
    let targetHotel: { id: string; name: string } | null = null;
    try {
      if (isUuid) {
        targetHotel = await prisma.hotel.findUnique({
          where: { id: hotelId },
          select: { id: true, name: true },
        });
      }
      if (!targetHotel) {
        targetHotel = await prisma.hotel.findFirst({
          where: { name: { equals: hotelId, mode: 'insensitive' } },
          select: { id: true, name: true },
        });
      }
    } catch (e) {
      console.warn('Error querying target hotel:', e);
    }

    const matchedHotelId = targetHotel ? targetHotel.id : (isUuid ? hotelId : undefined);
    const matchedHotelName = targetHotel ? targetHotel.name : hotelId;

    const orConditions: any[] = [];
    if (matchedHotelId) {
      orConditions.push({ hotelId: matchedHotelId });
    }
    if (matchedHotelName) {
      orConditions.push({ building: { equals: matchedHotelName, mode: 'insensitive' } });
    }

    if (orConditions.length > 0) {
      roomWhere.OR = orConditions;
    }
  }
  if (building && building !== 'ALL') {
    roomWhere.building = { equals: building, mode: 'insensitive' };
  }
  if (roomCategory && (roomCategory as any) !== 'ALL' && (roomCategory as any) !== 'ANY') {
    roomWhere.genderPreference = roomCategory;
  }

  const rooms = await prisma.room.findMany({
    where: roomWhere,
    include: {
      hotel: {
        select: { id: true, name: true },
      },
      units: {
        where: {
          ...(genderCategory ? { genderCategory } : {}),
          ...(unitType ? { type: unitType } : {}),
        },
        orderBy: { unitNumber: 'asc' },
      },
    },
  });

  // 4. Build room availability structure
  let totalUnitsInScope = 0;
  let availableUnitsInScope = 0;
  let occupiedUnitsInScope = 0;

  const roomAvailability = rooms.map((room) => {
    const isRoomMaintenance = room.status === RoomStatus.MAINTENANCE;

    const unitsWithState = room.units.map((unit) => {
      totalUnitsInScope++;
      const conflict = conflictedUnitMap.get(unit.id);
      const isUnitMaintenance = unit.status === UnitStatus.MAINTENANCE || unit.status === UnitStatus.INACTIVE || isRoomMaintenance;

      let isAvailable = false;
      let state: 'AVAILABLE' | 'ALLOCATED' | 'CONFIRMED' | 'OCCUPIED' | 'MAINTENANCE' = 'AVAILABLE';

      if (isUnitMaintenance) {
        state = 'MAINTENANCE';
      } else if (conflict) {
        if (conflict.type === 'OCCUPIED') state = 'OCCUPIED';
        else if (conflict.status === AllocationStatus.CONFIRMED) state = 'CONFIRMED';
        else state = 'ALLOCATED';
      } else {
        isAvailable = true;
        availableUnitsInScope++;
      }

      if (!isAvailable && !isUnitMaintenance) {
        occupiedUnitsInScope++;
      }

      return {
        id: unit.id,
        unitNumber: unit.unitNumber,
        type: unit.type,
        genderCategory: unit.genderCategory,
        status: unit.status,
        isAvailable,
        state,
        conflict: conflict || null,
        notes: unit.notes,
      };
    });

    const roomAvailableCount = unitsWithState.filter((u) => u.isAvailable).length;
    const availableBeds = unitsWithState.filter((u) => u.isAvailable && u.type === UnitType.BED).length;
    const availableMats = unitsWithState.filter((u) => u.isAvailable && u.type === UnitType.MAT).length;
    const totalBeds = room.units.filter((u) => u.type === UnitType.BED).length;
    const totalMats = room.units.filter((u) => u.type === UnitType.MAT).length;
    const totalUnitsCount = room.units.length;
    const occupiedCount = totalUnitsCount - roomAvailableCount;
    const occupancyPercentage = totalUnitsCount > 0 ? Math.round((occupiedCount / totalUnitsCount) * 100) : 0;

    const resolvedHotelName = room.hotel?.name || room.building || 'Main Property';
    const resolvedBuilding = room.building || room.hotel?.name || 'Main Block';

    return {
      id: room.id,
      hotelId: room.hotelId,
      hotelName: resolvedHotelName,
      hotel: room.hotel ? { ...room.hotel, name: resolvedHotelName } : { id: room.hotelId || 'main', name: resolvedHotelName },
      roomNumber: room.roomNumber,
      building: resolvedBuilding,
      floor: room.floor,
      genderPreference: room.genderPreference,
      status: room.status,
      totalUnitsInRoom: totalUnitsCount,
      availableCount: roomAvailableCount,
      occupancyPercentage,
      availableBeds,
      availableMats,
      totalBeds,
      totalMats,
      units: unitsWithState,
    };
  });

  // Natural numeric sort for room numbers (e.g. 13, 14, ... 104, 105)
  roomAvailability.sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true, sensitivity: 'base' }));

  const summaryAvailableBeds = roomAvailability.reduce((sum, r) => sum + (r.availableBeds || 0), 0);
  const summaryTotalBeds = roomAvailability.reduce((sum, r) => sum + (r.totalBeds || 0), 0);
  const summaryAvailableMats = roomAvailability.reduce((sum, r) => sum + (r.availableMats || 0), 0);
  const summaryTotalMats = roomAvailability.reduce((sum, r) => sum + (r.totalMats || 0), 0);
  const occupancyRate = totalUnitsInScope > 0 ? Math.round((occupiedUnitsInScope / totalUnitsInScope) * 100) : 0;

  // Category breakdown for Reception desk clarity
  const categoryBreakdown: Record<string, { totalRooms: number; availableBeds: number; availableMats: number; availableUnits: number }> = {
    MALE: { totalRooms: 0, availableBeds: 0, availableMats: 0, availableUnits: 0 },
    FEMALE: { totalRooms: 0, availableBeds: 0, availableMats: 0, availableUnits: 0 },
    FAMILY: { totalRooms: 0, availableBeds: 0, availableMats: 0, availableUnits: 0 },
    GUEST: { totalRooms: 0, availableBeds: 0, availableMats: 0, availableUnits: 0 },
  };

  roomAvailability.forEach((r) => {
    const cat = r.genderPreference || 'ANY';
    if (!categoryBreakdown[cat]) {
      categoryBreakdown[cat] = { totalRooms: 0, availableBeds: 0, availableMats: 0, availableUnits: 0 };
    }
    categoryBreakdown[cat].totalRooms += 1;
    categoryBreakdown[cat].availableBeds += (r.availableBeds || 0);
    categoryBreakdown[cat].availableMats += (r.availableMats || 0);
    categoryBreakdown[cat].availableUnits += (r.availableCount || 0);
  });

  return res.json({
    success: true,
    data: {
      searchWindow: {
        entryDate: start.toISOString(),
        exitDate: end.toISOString(),
      },
      summary: {
        totalRooms: rooms.length,
        totalUnits: totalUnitsInScope,
        availableUnits: availableUnitsInScope,
        occupiedUnits: occupiedUnitsInScope,
        occupancyRate,
        availableBeds: summaryAvailableBeds,
        totalBeds: summaryTotalBeds,
        availableMats: summaryAvailableMats,
        totalMats: summaryTotalMats,
        categoryBreakdown,
      },
      rooms: roomAvailability,
    },
  });
  } catch (err: any) {
    console.error('Error in checkAvailability:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Error checking unit availability',
    });
  }
}

/**
 * 2. List Allocations with Filters, Search & Metrics
 */
export async function listAllocations(req: Request, res: Response) {
  const { 
    page = '1', 
    limit = '10', 
    q, 
    status, 
    startDate, 
    endDate, 
    roomId,
    registrationId 
  } = req.query;

  const pageNum = Math.max(1, parseInt(page as string) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 10));
  const skip = (pageNum - 1) * limitNum;

  const whereClause: any = {
    isArchived: false,
  };

  // Search by Allocation number, Registration ID, Primary Name, or Mobile
  if (typeof q === 'string' && q.trim()) {
    const search = q.trim();
    whereClause.OR = [
      { allocationNumber: { contains: search, mode: 'insensitive' } },
      { registration: { registrationId: { contains: search, mode: 'insensitive' } } },
      { registration: { primaryName: { contains: search, mode: 'insensitive' } } },
      { registration: { mobile: { contains: search } } },
    ];
  }

  // Filter by status
  if (typeof status === 'string' && Object.values(AllocationStatus).includes(status as AllocationStatus)) {
    whereClause.status = status as AllocationStatus;
  }

  // Filter by registration
  if (typeof registrationId === 'string' && registrationId.trim()) {
    whereClause.OR = [
      { registrationId: registrationId.trim() },
      { registration: { registrationId: registrationId.trim() } },
    ];
  }

  // Filter by room
  if (typeof roomId === 'string' && roomId.trim()) {
    whereClause.items = {
      some: {
        unit: {
          roomId: roomId.trim(),
        },
      },
    };
  }

  // Date range
  if (typeof startDate === 'string' && startDate.trim()) {
    whereClause.entryDate = { gte: new Date(startDate.trim()) };
  }
  if (typeof endDate === 'string' && endDate.trim()) {
    const end = new Date(endDate.trim());
    end.setHours(23, 59, 59, 999);
    whereClause.exitDate = { lte: end };
  }

  const [allocations, totalCount, statusCounts] = await Promise.all([
    prisma.allocation.findMany({
      where: whereClause,
      include: {
        registration: {
          select: {
            id: true,
            registrationId: true,
            primaryName: true,
            mobile: true,
            totalMembers: true,
            city: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        items: {
          include: {
            unit: {
              select: {
                id: true,
                unitNumber: true,
                type: true,
                genderCategory: true,
                room: {
                  select: {
                    id: true,
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
      skip,
      take: limitNum,
    }),
    prisma.allocation.count({ where: whereClause }),
    prisma.allocation.groupBy({
      by: ['status'],
      where: { isArchived: false },
      _count: { status: true },
    }),
  ]);

  // Aggregate metrics
  const metrics: Record<string, number> = {
    totalAllocations: 0,
    TENTATIVE: 0,
    CONFIRMED: 0,
    CANCELLED: 0,
    COMPLETED: 0,
    totalUnitsAllocated: 0,
  };

  statusCounts.forEach((sc) => {
    metrics[sc.status] = sc._count.status;
    metrics.totalAllocations += sc._count.status;
  });

  const formatted = allocations.map((alc) => {
    const unitList = alc.items.map((i) => ({
      unitId: i.unitId,
      unitNumber: i.unit.unitNumber,
      unitType: i.unit.type,
      genderCategory: i.unit.genderCategory,
      roomId: i.unit.room.id,
      roomNumber: i.unit.room.roomNumber,
      building: i.unit.room.building,
      floor: i.unit.room.floor,
    }));

    // Group units by room for display
    const roomSummaries: Record<string, { roomNumber: string; building: string | null; beds: number; mats: number }> = {};
    unitList.forEach((u) => {
      if (!roomSummaries[u.roomNumber]) {
        roomSummaries[u.roomNumber] = { roomNumber: u.roomNumber, building: u.building, beds: 0, mats: 0 };
      }
      if (u.unitType === UnitType.BED) roomSummaries[u.roomNumber].beds++;
      else roomSummaries[u.roomNumber].mats++;
    });

    return {
      id: alc.id,
      allocationNumber: alc.allocationNumber,
      registrationId: alc.registration.registrationId,
      primaryName: alc.registration.primaryName,
      mobile: alc.registration.mobile,
      totalMembers: alc.registration.totalMembers,
      city: alc.registration.city,
      status: alc.status,
      entryDate: alc.entryDate,
      exitDate: alc.exitDate,
      totalUnits: alc.items.length,
      roomsSummary: Object.values(roomSummaries),
      units: unitList,
      createdByName: alc.createdBy.name,
      notes: alc.notes,
      createdAt: alc.createdAt,
    };
  });

  return res.json({
    success: true,
    data: formatted,
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
 * 3. Get Single Allocation Dossier
 */
export async function getAllocationById(req: Request, res: Response) {
  const { id } = req.params;

  const allocation = await prisma.allocation.findFirst({
    where: {
      OR: [
        { id },
        { allocationNumber: id },
      ],
    },
    include: {
      registration: {
        include: {
          participants: {
            where: { isArchived: false },
            select: {
              id: true,
              fullName: true,
              gender: true,
              age: true,
              relationToPrimary: true,
              isPrimary: true,
            },
          },
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
      items: {
        include: {
          unit: {
            include: {
              room: true,
            },
          },
          participant: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      },
      parentAllocation: {
        select: {
          id: true,
          allocationNumber: true,
        },
      },
    },
  });

  if (!allocation) {
    return res.status(404).json({
      success: false,
      message: `Allocation not found: ${id}`,
    });
  }

  return res.json({
    success: true,
    data: allocation,
  });
}

/**
 * 4. Create Manual Allocation (Atomic Transaction + Concurrency Safety)
 */
export async function createAllocation(req: Request, res: Response) {
  const parsed = createAllocationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed for allocation creation',
      errors: parsed.error.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
    });
  }

  const { registrationId, entryDate, exitDate, unitIds, status, notes } = parsed.data;
  const start = new Date(entryDate);
  const end = new Date(exitDate);

  if (start >= end) {
    return res.status(400).json({
      success: false,
      message: 'Exit date must be strictly after entry date',
    });
  }

  const currentUserId = (req as any).user?.id;
  if (!currentUserId) {
    return res.status(401).json({ success: false, message: 'Unauthenticated user context' });
  }

  // 1. Verify Registration
  const registration = await prisma.registration.findFirst({
    where: {
      OR: [{ id: registrationId }, { registrationId }],
      isArchived: false,
    },
    include: {
      participants: {
        where: { isArchived: false },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      },
    },
  });

  if (!registration) {
    return res.status(404).json({
      success: false,
      message: `Active registration not found with identifier: ${registrationId}`,
    });
  }

  // 2. Concurrency-Safe Sequential Allocation Number
  const nextAllocationNumber = await getNextAllocationNumber();

  // 2.1 Production Hardening: Verify requested units exist and are ACTIVE
  const requestedUnits = await prisma.accommodationUnit.findMany({
    where: { id: { in: unitIds } },
    include: {
      room: {
        select: {
          id: true,
          roomNumber: true,
          genderPreference: true,
          status: true,
        },
      },
    },
  });

  const unavailableUnit = requestedUnits.find((u) => u.status !== UnitStatus.ACTIVE || u.room.status !== RoomStatus.ACTIVE);
  if (unavailableUnit) {
    return res.status(400).json({
      success: false,
      message: `Unit ${unavailableUnit.unitNumber} (Room ${unavailableUnit.room.roomNumber}) is currently in maintenance or inactive and cannot be allocated.`,
    });
  }

  // 2.2 Category & Gender Allocation Rules Validation
  const combinedNotesUpper = `${notes || ''} ${registration.notes || ''}`.toUpperCase();
  const isFamily = combinedNotesUpper.includes('FAMILY');
  const isGuest = combinedNotesUpper.includes('GUEST');

  const maleParticipants = registration.participants.filter(p => p.gender === Gender.MALE);
  const femaleParticipants = registration.participants.filter(p => p.gender === Gender.FEMALE);
  const maleCount = maleParticipants.length;
  const femaleCount = femaleParticipants.length;

  const maleRoomUnits = requestedUnits.filter(u => u.room.genderPreference === GenderPreference.MALE);
  const femaleRoomUnits = requestedUnits.filter(u => u.room.genderPreference === GenderPreference.FEMALE);
  const familyRoomUnits = requestedUnits.filter(u => u.room.genderPreference === GenderPreference.FAMILY);
  const guestRoomUnits = requestedUnits.filter(u => u.room.genderPreference === GenderPreference.GUEST);

  if (isFamily) {
    // Family allocations: allow Family rooms (or mixed selection when requested)
  } else if (isGuest) {
    // Guest allocations: allow Guest rooms
  } else {
    // Rule 1: All male group -> Assign to Male room only
    if (maleCount > 0 && femaleCount === 0) {
      if (femaleRoomUnits.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Category Mismatch: All ${maleCount} members are Male. Male members cannot be allocated to Female Room(s) (Room ${femaleRoomUnits[0].room.roomNumber}). Please allocate to Male Room only.`,
        });
      }
    }

    // Rule 2: All female group -> Assign to Female room only
    if (femaleCount > 0 && maleCount === 0) {
      if (maleRoomUnits.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Category Mismatch: All ${femaleCount} members are Female. Female members cannot be allocated to Male Room(s) (Room ${maleRoomUnits[0].room.roomNumber}). Please allocate to Female Room only.`,
        });
      }
    }

    // Rule 3: Mixed group (e.g. 2 male and 2 female) -> Assign according to room category only
    if (maleCount > 0 && femaleCount > 0) {
      if (femaleRoomUnits.length === 0 && maleRoomUnits.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Category Mismatch: Group has ${maleCount} Male and ${femaleCount} Female members. Female members cannot be placed in a Male Room. Please allocate ${maleCount} bed(s) in Male Room and ${femaleCount} bed(s) in Female Room, or allocate to a Family Room.`,
        });
      }
      if (maleRoomUnits.length === 0 && femaleRoomUnits.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Category Mismatch: Group has ${maleCount} Male and ${femaleCount} Female members. Male members cannot be placed in a Female Room. Please allocate ${maleCount} bed(s) in Male Room and ${femaleCount} bed(s) in Female Room, or allocate to a Family Room.`,
        });
      }
      if (maleRoomUnits.length > maleCount) {
        return res.status(400).json({
          success: false,
          message: `Category Mismatch: Selected ${maleRoomUnits.length} beds in Male Room(s), but group only has ${maleCount} Male members.`,
        });
      }
      if (femaleRoomUnits.length > femaleCount) {
        return res.status(400).json({
          success: false,
          message: `Category Mismatch: Selected ${femaleRoomUnits.length} beds in Female Room(s), but group only has ${femaleCount} Female members.`,
        });
      }
    }
  }

  try {
    // 3. Execute in Atomic Transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create master allocation
      const alc = await tx.allocation.create({
        data: {
          allocationNumber: nextAllocationNumber,
          registrationId: registration.id,
          status,
          entryDate: start,
          exitDate: end,
          notes: notes || null,
          createdById: currentUserId,
        },
      });

      // Build participant-to-unit mapping
      const explicitAssignments = new Map((parsed.data.participantAssignments || []).map(pa => [pa.unitId, pa.participantId]));
      const assignedParticipantIds = new Set<string>();
      const unitParticipantMap = new Map<string, string>();

      for (const [uId, pId] of explicitAssignments.entries()) {
        unitParticipantMap.set(uId, pId);
        assignedParticipantIds.add(pId);
      }

      const remainingMale = maleParticipants.filter(p => !assignedParticipantIds.has(p.id));
      const remainingFemale = femaleParticipants.filter(p => !assignedParticipantIds.has(p.id));
      const remainingOther = registration.participants.filter(p => !assignedParticipantIds.has(p.id) && p.gender !== Gender.MALE && p.gender !== Gender.FEMALE);

      for (const unit of requestedUnits) {
        if (!unitParticipantMap.has(unit.id)) {
          if (unit.room.genderPreference === GenderPreference.MALE && remainingMale.length > 0) {
            const p = remainingMale.shift()!;
            unitParticipantMap.set(unit.id, p.id);
            assignedParticipantIds.add(p.id);
          } else if (unit.room.genderPreference === GenderPreference.FEMALE && remainingFemale.length > 0) {
            const p = remainingFemale.shift()!;
            unitParticipantMap.set(unit.id, p.id);
            assignedParticipantIds.add(p.id);
          } else if (remainingMale.length > 0) {
            const p = remainingMale.shift()!;
            unitParticipantMap.set(unit.id, p.id);
            assignedParticipantIds.add(p.id);
          } else if (remainingFemale.length > 0) {
            const p = remainingFemale.shift()!;
            unitParticipantMap.set(unit.id, p.id);
            assignedParticipantIds.add(p.id);
          } else if (remainingOther.length > 0) {
            const p = remainingOther.shift()!;
            unitParticipantMap.set(unit.id, p.id);
            assignedParticipantIds.add(p.id);
          }
        }
      }

      // Create individual allocation items for each unit
      // If any unit conflicts in [start, end), PostgreSQL exclusion constraint throws 23P01!
      const itemCreationPromises = unitIds.map((uId) =>
        tx.allocationItem.create({
          data: {
            allocationId: alc.id,
            unitId: uId,
            participantId: unitParticipantMap.get(uId) || null,
            entryDate: start,
            exitDate: end,
            status: status === AllocationStatus.CONFIRMED ? AllocationItemStatus.CONFIRMED : AllocationItemStatus.TENTATIVE,
          },
        })
      );
      await Promise.all(itemCreationPromises);

      // Update Registration status to ALLOCATED (or CONFIRMED)
      if (registration.status === RegistrationStatus.REGISTERED) {
        await tx.registration.update({
          where: { id: registration.id },
          data: { status: status === AllocationStatus.CONFIRMED ? RegistrationStatus.CONFIRMED : RegistrationStatus.ALLOCATED },
        });
      }

      // Record Activity Log
      await tx.activityLog.create({
        data: {
          entityType: 'Allocation',
          entityId: alc.id,
          action: ActionType.ALLOCATE,
          details: {
            allocationNumber: alc.allocationNumber,
            registrationId: registration.registrationId,
            unitsCount: unitIds.length,
            status,
            entryDate: start.toISOString(),
            exitDate: end.toISOString(),
          },
          userId: currentUserId,
          ipAddress: req.ip || '127.0.0.1',
        },
      });

      return alc;
    });

    return res.status(201).json({
      success: true,
      message: `Allocation ${result.allocationNumber} reserved successfully with ${unitIds.length} units`,
      data: result,
    });
  } catch (err: any) {
    // Catch PostgreSQL exclusion violation (Code: 23P01 or constraint no_overlapping_active_allocations)
    if (err.message && (err.message.includes('no_overlapping_active_allocations') || err.message.includes('23P01'))) {
      return res.status(409).json({
        success: false,
        message: 'Conflict: One or more selected units are already reserved for overlapping dates by another allocation. Double booking prevented by database constraint.',
      });
    }
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to create accommodation allocation',
    });
  }
}

/**
 * 5. Update Allocation (Dates, Units, or Status)
 */
export async function updateAllocation(req: Request, res: Response) {
  const { id } = req.params;
  const parsed = updateAllocationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed for allocation update',
      errors: parsed.error.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
    });
  }

  const currentUserId = (req as any).user?.id;

  const existing = await prisma.allocation.findFirst({
    where: { OR: [{ id }, { allocationNumber: id }] },
    include: { items: true },
  });

  if (!existing) {
    return res.status(404).json({
      success: false,
      message: `Allocation not found: ${id}`,
    });
  }

  if (existing.status === AllocationStatus.CANCELLED) {
    return res.status(400).json({
      success: false,
      message: 'Cannot modify a cancelled allocation. Please create a new allocation.',
    });
  }

  const newEntry = parsed.data.entryDate ? new Date(parsed.data.entryDate) : existing.entryDate;
  const newExit = parsed.data.exitDate ? new Date(parsed.data.exitDate) : existing.exitDate;

  if (newEntry >= newExit) {
    return res.status(400).json({
      success: false,
      message: 'Exit date must be strictly after entry date',
    });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // 1. If unitIds changed, delete old items and create new items
      if (parsed.data.unitIds) {
        await tx.allocationItem.deleteMany({
          where: { allocationId: existing.id },
        });

        const newItems = parsed.data.unitIds.map((uId) =>
          tx.allocationItem.create({
            data: {
              allocationId: existing.id,
              unitId: uId,
              entryDate: newEntry,
              exitDate: newExit,
              status: (parsed.data.status || existing.status) === AllocationStatus.CONFIRMED 
                ? AllocationItemStatus.CONFIRMED 
                : AllocationItemStatus.TENTATIVE,
            },
          })
        );
        await Promise.all(newItems);
      } else if (parsed.data.entryDate || parsed.data.exitDate || parsed.data.status) {
        // Update dates & status on existing items
        await tx.allocationItem.updateMany({
          where: { allocationId: existing.id },
          data: {
            entryDate: newEntry,
            exitDate: newExit,
            status: (parsed.data.status || existing.status) === AllocationStatus.CONFIRMED 
              ? AllocationItemStatus.CONFIRMED 
              : AllocationItemStatus.TENTATIVE,
          },
        });
      }

      // 2. Update master allocation
      const alc = await tx.allocation.update({
        where: { id: existing.id },
        data: {
          status: parsed.data.status || existing.status,
          entryDate: newEntry,
          exitDate: newExit,
          notes: parsed.data.notes !== undefined ? parsed.data.notes : existing.notes,
        },
      });

      // 3. Log audit
      if (currentUserId) {
        await tx.activityLog.create({
          data: {
            entityType: 'Allocation',
            entityId: alc.id,
            action: ActionType.UPDATE,
            details: {
              allocationNumber: alc.allocationNumber,
              changes: parsed.data,
            },
            userId: currentUserId,
            ipAddress: req.ip || '127.0.0.1',
          },
        });
      }

      return alc;
    });

    return res.json({
      success: true,
      message: `Allocation ${updated.allocationNumber} updated successfully`,
      data: updated,
    });
  } catch (err: any) {
    if (err.message && (err.message.includes('no_overlapping_active_allocations') || err.message.includes('23P01'))) {
      return res.status(409).json({
        success: false,
        message: 'Conflict: Unit is already reserved by another allocation for overlapping dates.',
      });
    }
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to update allocation',
    });
  }
}

/**
 * 6. Cancel Allocation (Releases Capacity Immediately)
 */
export async function cancelAllocation(req: Request, res: Response) {
  const { id } = req.params;
  const parsed = cancelAllocationSchema.safeParse(req.body);
  const reason = parsed.success ? parsed.data.reason : 'Cancelled by staff';

  const currentUserId = (req as any).user?.id;

  const existing = await prisma.allocation.findFirst({
    where: { OR: [{ id }, { allocationNumber: id }] },
    include: { items: true },
  });

  if (!existing) {
    return res.status(404).json({
      success: false,
      message: `Allocation not found: ${id}`,
    });
  }

  if (existing.status === AllocationStatus.CANCELLED) {
    return res.status(400).json({
      success: false,
      message: `Allocation ${existing.allocationNumber} is already cancelled`,
    });
  }

  const cancelled = await prisma.$transaction(async (tx) => {
    // 1. Cancel all items (releases exclusion constraint immediately!)
    await tx.allocationItem.updateMany({
      where: { allocationId: existing.id },
      data: { status: AllocationItemStatus.CANCELLED },
    });

    // 2. Mark master allocation as CANCELLED
    const alc = await tx.allocation.update({
      where: { id: existing.id },
      data: {
        status: AllocationStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: reason,
      },
    });

    // 3. Check if registration has any other active allocations; if not, revert status
    const remainingActive = await tx.allocation.count({
      where: {
        registrationId: existing.registrationId,
        id: { not: existing.id },
        status: { in: [AllocationStatus.TENTATIVE, AllocationStatus.CONFIRMED] },
      },
    });

    if (remainingActive === 0) {
      await tx.registration.update({
        where: { id: existing.registrationId },
        data: { status: RegistrationStatus.REGISTERED },
      });
    }

    // 4. Log audit
    if (currentUserId) {
      await tx.activityLog.create({
        data: {
          entityType: 'Allocation',
          entityId: alc.id,
          action: ActionType.CANCEL,
          details: {
            allocationNumber: alc.allocationNumber,
            reason,
            releasedUnitsCount: existing.items.length,
          },
          userId: currentUserId,
          ipAddress: req.ip || '127.0.0.1',
        },
      });
    }

    return alc;
  });

  return res.json({
    success: true,
    message: `Allocation ${cancelled.allocationNumber} cancelled and ${existing.items.length} units released`,
    data: cancelled,
  });
}
