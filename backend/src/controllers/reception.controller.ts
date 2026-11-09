import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import {
  encryptSensitiveData,
  formatMaskedAadhaar,
} from '../utils/encryption';
import {
  ParticipantStatus,
  StayStatus,
  AllocationStatus,
  AllocationItemStatus,
  RegistrationStatus,
  ActionType,
  Gender,
  AadhaarComplianceStatus,
  UnitType,
  RoomStatus,
  UnitStatus,
} from '@prisma/client';

// ----------------------------------------------------------------------------
// ZOD SCHEMAS
// ----------------------------------------------------------------------------

export const recordParticipantsSchema = z.object({
  registrationId: z.string().uuid('Invalid registration ID'),
  participants: z.array(
    z.object({
      id: z.string().uuid().optional(),
      fullName: z.string().trim().min(2, 'Name must be at least 2 characters'),
      phone: z.string().trim().optional().nullable(),
      gender: z.nativeEnum(Gender).optional().nullable(),
      age: z.number().int().min(0).max(120).optional().nullable(),
      relationToPrimary: z.string().trim().optional().nullable(),
      isPrimary: z.boolean().default(false),
      notes: z.string().trim().optional().nullable(),
    })
  ).min(1, 'At least one participant must be recorded'),
});

export const collectAadhaarSchema = z.object({
  participantId: z.string().uuid('Invalid participant ID'),
  aadhaarNumber: z.string().regex(/^\d{12}$/, 'Aadhaar must be exactly 12 digits'),
  retentionConsent: z.boolean().default(false),
  complianceStatus: z.nativeEnum(AadhaarComplianceStatus).default(AadhaarComplianceStatus.COLLECTED),
});

export const confirmReceptionSchema = z.object({
  allocationId: z.string().uuid('Invalid allocation ID'),
  participantAssignments: z.array(
    z.object({
      participantId: z.string().uuid('Invalid participant ID'),
      unitId: z.string().uuid('Invalid unit ID'),
      allocationItemId: z.string().uuid().optional(),
    })
  ).min(1, 'At least one participant must be assigned to an allocated unit'),
});

export const checkInSchema = z.object({
  registrationId: z.string().uuid('Invalid registration ID'),
  allocationId: z.string().uuid().optional(),
  checkIns: z.array(
    z.object({
      participantId: z.string().uuid('Invalid participant ID'),
      unitId: z.string().uuid('Invalid unit ID'),
      allocationItemId: z.string().uuid().optional(),
      notes: z.string().trim().optional(),
    })
  ).min(1, 'At least one check-in assignment required'),
});

export const checkOutSchema = z.object({
  stayRecordId: z.string().uuid('Invalid stay record ID'),
  notes: z.string().trim().optional(),
});

export const batchCheckOutSchema = z.object({
  stayRecordIds: z.array(z.string().uuid('Invalid stay record ID')).min(1, 'Please select at least one member to check out'),
  notes: z.string().trim().optional(),
});

export const transferStaySchema = z.object({
  stayRecordId: z.string().uuid('Invalid stay record ID'),
  newUnitId: z.string().uuid('Invalid new unit ID'),
  reason: z.string().trim().min(3, 'Transfer reason must be at least 3 characters'),
});

export const changeAssignmentSchema = z.object({
  participantId: z.string().uuid('Invalid participant ID').optional().nullable(),
  allocationItemId: z.string().uuid('Invalid allocation item ID').optional().nullable(),
  stayRecordId: z.string().uuid('Invalid stay record ID').optional().nullable(),
  newUnitId: z.string().uuid('Invalid new unit ID'),
  reason: z.string().trim().min(2, 'Change reason must be at least 2 characters'),
});

export const batchChangeAssignmentSchema = z.object({
  assignments: z.array(
    z.object({
      participantId: z.string().uuid('Invalid participant ID').optional().nullable(),
      allocationItemId: z.string().uuid('Invalid allocation item ID').optional().nullable(),
      stayRecordId: z.string().uuid('Invalid stay record ID').optional().nullable(),
      newUnitId: z.string().uuid('Invalid new unit ID'),
    })
  ).min(1, 'At least one assignment required'),
  reason: z.string().trim().min(2, 'Change reason must be at least 2 characters'),
});

export const updatePhoneSchema = z.object({
  phone: z.string().trim().min(10, 'Phone must be at least 10 digits'),
});

export const extendStaySchema = z.object({
  stayRecordId: z.string().uuid('Invalid stay record ID'),
  newExitDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  notes: z.string().trim().optional(),
});

export const checkInAgainSchema = z.object({
  participantId: z.string().uuid('Invalid participant ID'),
  unitId: z.string().uuid('Invalid unit ID'),
  checkInDateTime: z.string().optional().nullable(),
  checkOutDateTime: z.string().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

// ----------------------------------------------------------------------------
// CONTROLLER HANDLERS
// ----------------------------------------------------------------------------

/**
 * 1. Overview & Metrics for Reception Dashboard
 */
export async function getReceptionOverview(req: Request, res: Response): Promise<void> {
  try {
    const tab = (req.query.tab as string) || 'TODAY_ARRIVALS';
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const hotelId = typeof req.query.hotelId === 'string' ? req.query.hotelId.trim() : '';
    const roomCategory = typeof req.query.roomCategory === 'string' ? req.query.roomCategory.trim() : '';
    const roomNumber = typeof req.query.roomNumber === 'string' ? req.query.roomNumber.trim() : '';
    const arrivalDate = typeof req.query.arrivalDate === 'string' ? req.query.arrivalDate.trim() : '';
    const checkInDate = typeof req.query.checkInDate === 'string' ? req.query.checkInDate.trim() : '';
    const checkOutDate = typeof req.query.checkOutDate === 'string' ? req.query.checkOutDate.trim() : '';
    const arrivalStatus = typeof req.query.arrivalStatus === 'string' ? req.query.arrivalStatus.trim() : '';
    const allocationStatus = typeof req.query.allocationStatus === 'string' ? req.query.allocationStatus.trim() : '';
    const building = typeof req.query.building === 'string' ? req.query.building.trim() : '';
    const registrationId = typeof req.query.registrationId === 'string' ? req.query.registrationId.trim() : '';
    const primaryName = typeof req.query.primaryName === 'string' ? req.query.primaryName.trim() : '';
    const phone = typeof req.query.phone === 'string' ? req.query.phone.trim() : '';
    const gender = typeof req.query.gender === 'string' ? req.query.gender.trim() : '';
    const checkInStatus = typeof req.query.checkInStatus === 'string' ? req.query.checkInStatus.trim() : '';
    const checkOutStatus = typeof req.query.checkOutStatus === 'string' ? req.query.checkOutStatus.trim() : '';

    const page = parseInt((req.query.page as string) || '1', 10);
    const limit = parseInt((req.query.limit as string) || '20', 10);
    const skip = (page - 1) * limit;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // Compute KPI counts concurrently
    const [
      expectedArrivalsCount,
      tentativeAwaitingCount,
      confirmedParticipantsCount,
      checkedInCount,
      expectedDeparturesCount,
      checkedOutTodayCount,
      totalCheckedOutCount,
      totalActiveBeds,
      totalActiveMats,
      occupiedBeds,
      occupiedMats,
    ] = await Promise.all([
      // Expected arrivals: allocations entering today or earlier not yet checked out or cancelled
      prisma.allocation.count({
        where: {
          status: { in: [AllocationStatus.TENTATIVE, AllocationStatus.CONFIRMED] },
          entryDate: { lte: endOfToday },
          exitDate: { gte: startOfToday },
          isArchived: false,
        },
      }),
      // Tentative allocations awaiting reception
      prisma.allocation.count({
        where: {
          status: AllocationStatus.TENTATIVE,
          isArchived: false,
        },
      }),
      // Confirmed participants
      prisma.participant.count({
        where: {
          checkInStatus: ParticipantStatus.CONFIRMED,
          isArchived: false,
        },
      }),
      // Currently checked-in stays
      prisma.stayRecord.count({
        where: {
          status: { in: [StayStatus.CHECKED_IN, StayStatus.EXTENDED] },
          actualCheckOut: null,
        },
      }),
      // Expected departures today
      prisma.stayRecord.count({
        where: {
          status: { in: [StayStatus.CHECKED_IN, StayStatus.EXTENDED] },
          actualCheckIn: { lte: endOfToday },
        },
      }),
      // Checked out today
      prisma.stayRecord.count({
        where: {
          status: StayStatus.CHECKED_OUT,
          actualCheckOut: { gte: startOfToday, lte: endOfToday },
        },
      }),
      // Total checked out records
      prisma.stayRecord.count({
        where: {
          status: StayStatus.CHECKED_OUT,
        },
      }),
      // Total active beds in active rooms
      prisma.accommodationUnit.count({
        where: {
          type: UnitType.BED,
          status: UnitStatus.ACTIVE,
          room: { status: RoomStatus.ACTIVE },
        },
      }),
      // Total active mats in active rooms
      prisma.accommodationUnit.count({
        where: {
          type: UnitType.MAT,
          status: UnitStatus.ACTIVE,
          room: { status: RoomStatus.ACTIVE },
        },
      }),
      // Currently occupied beds
      prisma.stayRecord.count({
        where: {
          status: { in: [StayStatus.CHECKED_IN, StayStatus.EXTENDED] },
          actualCheckOut: null,
          unit: { type: UnitType.BED },
        },
      }),
      // Currently occupied mats
      prisma.stayRecord.count({
        where: {
          status: { in: [StayStatus.CHECKED_IN, StayStatus.EXTENDED] },
          actualCheckOut: null,
          unit: { type: UnitType.MAT },
        },
      }),
    ]);

    const availableBedsCount = Math.max(0, totalActiveBeds - occupiedBeds);
    const availableMatsCount = Math.max(0, totalActiveMats - occupiedMats);
    const availableAccommodationCount = availableBedsCount + availableMatsCount;

    // Daily Operations Tasks (Requirement 6)
    const notYetArrivedCount = await prisma.participant.count({
      where: {
        isArchived: false,
        checkInStatus: { in: [ParticipantStatus.REGISTERED, ParticipantStatus.CONFIRMED] },
        registration: {
          isArchived: false,
          allocations: {
            some: {
              status: { in: [AllocationStatus.TENTATIVE, AllocationStatus.CONFIRMED] },
              entryDate: { lte: endOfToday },
              exitDate: { gte: startOfToday },
              isArchived: false,
            },
          },
        },
      },
    });

    // Overdue checkouts: stays currently checked in where scheduled exitDate was prior to today (Requirement 6)
    const overdueStays = await prisma.stayRecord.findMany({
      where: {
        status: { in: [StayStatus.CHECKED_IN, StayStatus.EXTENDED] },
        actualCheckOut: null,
        registration: {
          allocations: {
            some: {
              isArchived: false,
              exitDate: { lt: startOfToday },
            },
          },
        },
      },
      include: {
        participant: true,
        unit: {
          include: {
            room: { include: { hotel: true } },
          },
        },
        registration: {
          include: {
            allocations: {
              where: { isArchived: false },
              orderBy: { exitDate: 'desc' },
              take: 1,
            },
          },
        },
      },
      take: 10,
    });

    // Recent Activity (Requirement 7: Last 5 relevant reception actions with staff name, action, time)
    const recentActivityLogs = await prisma.activityLog.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, name: true, role: true },
        },
      },
    });

    // Detailed room inventory query for 6 dashboard cards & room-wise overview
    const allActiveRooms = await prisma.room.findMany({
      where: { status: RoomStatus.ACTIVE },
      include: {
        units: {
          where: { status: UnitStatus.ACTIVE },
          include: {
            stayRecords: {
              where: { status: { in: [StayStatus.CHECKED_IN, StayStatus.EXTENDED] }, actualCheckOut: null },
            },
            allocationItems: {
              where: {
                status: { in: [AllocationItemStatus.TENTATIVE, AllocationItemStatus.CONFIRMED] },
                entryDate: { lte: endOfToday },
                exitDate: { gte: startOfToday },
              },
            },
          },
        },
      },
      orderBy: { roomNumber: 'asc' },
    });

    const totalRoomsCount = allActiveRooms.length;
    let totalBookedUnitsCount = 0;

    const categoryStats: Record<string, { totalRooms: number; availableRooms: number; totalBeds: number; availableBeds: number; totalMats: number; availableMats: number; availableUnits: number }> = {
      FEMALE: { totalRooms: 0, availableRooms: 0, totalBeds: 0, availableBeds: 0, totalMats: 0, availableMats: 0, availableUnits: 0 },
      MALE: { totalRooms: 0, availableRooms: 0, totalBeds: 0, availableBeds: 0, totalMats: 0, availableMats: 0, availableUnits: 0 },
      FAMILY: { totalRooms: 0, availableRooms: 0, totalBeds: 0, availableBeds: 0, totalMats: 0, availableMats: 0, availableUnits: 0 },
      GUEST: { totalRooms: 0, availableRooms: 0, totalBeds: 0, availableBeds: 0, totalMats: 0, availableMats: 0, availableUnits: 0 },
      ANY: { totalRooms: 0, availableRooms: 0, totalBeds: 0, availableBeds: 0, totalMats: 0, availableMats: 0, availableUnits: 0 },
    };

    allActiveRooms.forEach((r) => {
      const cat = r.genderPreference || 'ANY';
      if (categoryStats[cat]) {
        categoryStats[cat].totalRooms++;
      }

      let roomHasFreeUnit = false;

      r.units.forEach((u) => {
        const isBooked = u.stayRecords.length > 0 || u.allocationItems.length > 0;
        if (isBooked) {
          totalBookedUnitsCount++;
        }

        if (categoryStats[cat]) {
          if (u.type === UnitType.BED) {
            categoryStats[cat].totalBeds++;
            if (!isBooked) {
              categoryStats[cat].availableBeds++;
              roomHasFreeUnit = true;
            }
          } else {
            categoryStats[cat].totalMats++;
            if (!isBooked) {
              categoryStats[cat].availableMats++;
              roomHasFreeUnit = true;
            }
          }
        }
      });

      if (roomHasFreeUnit && categoryStats[cat]) {
        categoryStats[cat].availableRooms++;
      }
    });

    Object.values(categoryStats).forEach((c) => {
      c.availableUnits = c.availableBeds + c.availableMats;
    });

    const roomWiseSummary = allActiveRooms.map((r) => {
      const bookedUnits = r.units.filter((u) => u.stayRecords.length > 0 || u.allocationItems.length > 0);
      const freeBeds = r.units.filter((u) => u.type === UnitType.BED && u.stayRecords.length === 0 && u.allocationItems.length === 0);
      const freeMats = r.units.filter((u) => u.type === UnitType.MAT && u.stayRecords.length === 0 && u.allocationItems.length === 0);
      return {
        roomId: r.id,
        roomNumber: r.roomNumber,
        building: r.building,
        floor: r.floor,
        category: r.genderPreference,
        totalUnits: r.units.length,
        bookedUnitsCount: bookedUnits.length,
        availableBeds: freeBeds.length,
        availableMats: freeMats.length,
        availableUnits: freeBeds.length + freeMats.length,
      };
    });

    // Build query based on active tab
    const whereClause: any = { isArchived: false };

    if (q) {
      whereClause.OR = [
        { registrationId: { contains: q, mode: 'insensitive' } },
        { primaryName: { contains: q, mode: 'insensitive' } },
        { mobile: { contains: q } },
      ];
    }

    let records: any[] = [];
    let totalCount = 0;

    const roomFilter: any = {};
    if (hotelId) roomFilter.hotelId = hotelId;
    if (building && building !== 'ALL') roomFilter.building = { contains: building, mode: 'insensitive' };
    if (roomCategory && roomCategory !== 'ALL' && roomCategory !== 'ANY') roomFilter.genderPreference = roomCategory;
    if (roomNumber) roomFilter.roomNumber = { contains: roomNumber, mode: 'insensitive' };

    const unitFilter: any = {};
    if (Object.keys(roomFilter).length > 0) {
      unitFilter.room = roomFilter;
    }

    if (tab === 'CHECKED_IN') {
      // In-House checked-in queue
      const stayWhere: any = {
        status: { in: [StayStatus.CHECKED_IN, StayStatus.EXTENDED] },
        actualCheckOut: null,
      };

      if (Object.keys(unitFilter).length > 0) {
        stayWhere.unit = unitFilter;
      }

      if (registrationId) {
        stayWhere.registration = { ...(stayWhere.registration || {}), registrationId: { contains: registrationId, mode: 'insensitive' } };
      }
      if (primaryName) {
        stayWhere.registration = { ...(stayWhere.registration || {}), primaryName: { contains: primaryName, mode: 'insensitive' } };
      }
      if (phone) {
        stayWhere.OR = [
          { participant: { phone: { contains: phone } } },
          { registration: { mobile: { contains: phone } } },
        ];
      }
      if (gender && gender !== 'ALL') {
        stayWhere.participant = { ...(stayWhere.participant || {}), gender: gender };
      }
      if (checkInStatus && checkInStatus !== 'ALL') {
        stayWhere.status = checkInStatus;
      }

      if (checkInDate) {
        const dStart = new Date(checkInDate);
        dStart.setHours(0, 0, 0, 0);
        const dEnd = new Date(checkInDate);
        dEnd.setHours(23, 59, 59, 999);
        stayWhere.actualCheckIn = { gte: dStart, lte: dEnd };
      }

      if (q) {
        stayWhere.OR = [
          { participant: { fullName: { contains: q, mode: 'insensitive' } } },
          { participant: { phone: { contains: q } } },
          { registration: { primaryName: { contains: q, mode: 'insensitive' } } },
          { registration: { registrationId: { contains: q, mode: 'insensitive' } } },
          { registration: { mobile: { contains: q } } },
          { unit: { room: { roomNumber: { contains: q, mode: 'insensitive' } } } },
        ];
      }

      [totalCount, records] = await Promise.all([
        prisma.stayRecord.count({ where: stayWhere }),
        prisma.stayRecord.findMany({
          where: stayWhere,
          skip,
          take: limit,
          orderBy: { actualCheckIn: 'desc' },
          include: {
            participant: true,
            registration: true,
            unit: {
              include: {
                room: {
                  include: { hotel: true },
                },
              },
            },
            recordedBy: {
              select: { id: true, name: true, email: true },
            },
          },
        }),
      ]);
    } else if (tab === 'CHECKED_OUT') {
      // Checked out queue
      const stayWhere: any = { status: StayStatus.CHECKED_OUT };

      if (Object.keys(unitFilter).length > 0) {
        stayWhere.unit = unitFilter;
      }

      if (checkOutDate) {
        const dStart = new Date(checkOutDate);
        dStart.setHours(0, 0, 0, 0);
        const dEnd = new Date(checkOutDate);
        dEnd.setHours(23, 59, 59, 999);
        stayWhere.actualCheckOut = { gte: dStart, lte: dEnd };
      }

      if (registrationId) {
        stayWhere.registration = { ...(stayWhere.registration || {}), registrationId: { contains: registrationId, mode: 'insensitive' } };
      }
      if (primaryName) {
        stayWhere.registration = { ...(stayWhere.registration || {}), primaryName: { contains: primaryName, mode: 'insensitive' } };
      }
      if (phone) {
        stayWhere.OR = [
          { participant: { phone: { contains: phone } } },
          { registration: { mobile: { contains: phone } } },
        ];
      }
      if (gender && gender !== 'ALL') {
        stayWhere.participant = { ...(stayWhere.participant || {}), gender: gender };
      }
      if (checkOutStatus && checkOutStatus !== 'ALL') {
        stayWhere.status = checkOutStatus;
      }

      if (q) {
        stayWhere.OR = [
          { participant: { fullName: { contains: q, mode: 'insensitive' } } },
          { participant: { phone: { contains: q } } },
          { registration: { primaryName: { contains: q, mode: 'insensitive' } } },
          { registration: { registrationId: { contains: q, mode: 'insensitive' } } },
          { registration: { mobile: { contains: q } } },
          { unit: { room: { roomNumber: { contains: q, mode: 'insensitive' } } } },
        ];
      }

      [totalCount, records] = await Promise.all([
        prisma.stayRecord.count({ where: stayWhere }),
        prisma.stayRecord.findMany({
          where: stayWhere,
          skip,
          take: limit,
          orderBy: { actualCheckOut: 'desc' },
          include: {
            participant: true,
            registration: true,
            unit: {
              include: {
                room: {
                  include: { hotel: true },
                },
              },
            },
            recordedBy: {
              select: { id: true, name: true, email: true },
            },
          },
        }),
      ]);
    } else {
      // Allocations queue: TODAY_ARRIVALS, TENTATIVE, or ALL
      const allocWhere: any = { isArchived: false };

      if (tab === 'TENTATIVE') {
        if (allocationStatus && allocationStatus !== 'ALL') {
          allocWhere.status = allocationStatus;
        } else {
          allocWhere.status = AllocationStatus.TENTATIVE;
        }
        if (arrivalDate) {
          const aStart = new Date(arrivalDate);
          aStart.setHours(0, 0, 0, 0);
          const aEnd = new Date(arrivalDate);
          aEnd.setHours(23, 59, 59, 999);
          allocWhere.entryDate = { gte: aStart, lte: aEnd };
        }
      } else if (tab === 'TODAY_ARRIVALS') {
        allocWhere.status = { in: [AllocationStatus.TENTATIVE, AllocationStatus.CONFIRMED] };
        if (arrivalDate) {
          const aStart = new Date(arrivalDate);
          aStart.setHours(0, 0, 0, 0);
          const aEnd = new Date(arrivalDate);
          aEnd.setHours(23, 59, 59, 999);
          allocWhere.entryDate = { gte: aStart, lte: aEnd };
        } else {
          allocWhere.entryDate = { lte: endOfToday };
          allocWhere.exitDate = { gte: startOfToday };
        }

        if (arrivalStatus === 'CHECKED_IN') {
          allocWhere.registration = { status: RegistrationStatus.CHECKED_IN };
        } else if (arrivalStatus === 'EXPECTED') {
          allocWhere.registration = { status: { not: RegistrationStatus.CHECKED_IN } };
        }
      }

      if (registrationId) {
        allocWhere.registration = { ...(allocWhere.registration || {}), registrationId: { contains: registrationId, mode: 'insensitive' } };
      }
      if (primaryName) {
        allocWhere.registration = { ...(allocWhere.registration || {}), primaryName: { contains: primaryName, mode: 'insensitive' } };
      }
      if (phone) {
        allocWhere.registration = { ...(allocWhere.registration || {}), mobile: { contains: phone } };
      }
      if (gender && gender !== 'ALL') {
        allocWhere.registration = { ...(allocWhere.registration || {}), participants: { some: { gender: gender, isArchived: false } } };
      }

      if (Object.keys(roomFilter).length > 0) {
        allocWhere.items = {
          some: {
            unit: {
              room: roomFilter,
            },
          },
        };
      }

      if (q) {
        allocWhere.OR = [
          { allocationNumber: { contains: q, mode: 'insensitive' } },
          { registration: { primaryName: { contains: q, mode: 'insensitive' } } },
          { registration: { registrationId: { contains: q, mode: 'insensitive' } } },
          { registration: { mobile: { contains: q } } },
          {
            registration: {
              participants: {
                some: {
                  OR: [
                    { fullName: { contains: q, mode: 'insensitive' } },
                    { phone: { contains: q } },
                  ],
                },
              },
            },
          },
        ];
      }

      [totalCount, records] = await Promise.all([
        prisma.allocation.count({ where: allocWhere }),
        prisma.allocation.findMany({
          where: allocWhere,
          skip,
          take: limit,
          orderBy: { entryDate: 'asc' },
          include: {
            registration: {
              include: {
                participants: {
                  where: { isArchived: false },
                  include: {
                    aadhaarRecord: {
                      select: { lastFourDigits: true, complianceStatus: true, retentionConsent: true },
                    },
                    stayRecords: {
                      where: { status: { in: [StayStatus.CHECKED_IN, StayStatus.EXTENDED] } },
                    },
                  },
                },
              },
            },
            items: {
              include: {
                unit: {
                  include: {
                    room: {
                      include: { hotel: true },
                    },
                  },
                },
              },
            },
          },
        }),
      ]);
    }

    res.status(200).json({
      success: true,
      data: {
        metrics: {
          expectedArrivalsCount,
          tentativeAwaitingCount,
          confirmedParticipantsCount,
          checkedInCount,
          expectedDeparturesCount,
          checkedOutTodayCount,
          totalCheckedOutCount,
          tabCounts: {
            todayArrivals: expectedArrivalsCount,
            currentlyStaying: checkedInCount,
            tentative: tentativeAwaitingCount,
            checkedOut: totalCheckedOutCount,
          },
          availableAccommodationCount,
          availableBedsCount,
          availableMatsCount,
          // 6 Dashboard Summary Cards
          totalBookedUnits: totalBookedUnitsCount,
          totalRooms: totalRoomsCount,
          femaleRoomAvailability: categoryStats.FEMALE,
          maleRoomAvailability: categoryStats.MALE,
          familyRoomAvailability: categoryStats.FAMILY,
          guestRoomAvailability: categoryStats.GUEST,
          // Detailed room-wise breakdown
          roomWiseSummary,
          // Requirement 6: Daily Operations Tasks
          dailyTasks: {
            expectedArrivals: expectedArrivalsCount,
            expectedDepartures: expectedDeparturesCount,
            notYetArrived: notYetArrivedCount,
            overdueCheckouts: overdueStays.length,
            overdueList: overdueStays.map((s) => ({
              stayId: s.id,
              participantId: s.participant.id,
              participantName: s.participant.fullName,
              phone: s.participant.phone || s.registration.mobile,
              roomNumber: s.unit.room.roomNumber,
              unitNumber: s.unit.unitNumber,
              hotelName: s.unit.room.hotel?.name || 'Main Wing',
              scheduledExitDate: s.registration.allocations[0]?.exitDate || null,
            })),
          },
          // Requirement 7: Recent Activity (Last 5 actions with staff name, action, time)
          recentActivity: recentActivityLogs.map((log) => ({
            id: log.id,
            action: log.action,
            entityType: log.entityType,
            details: log.details,
            staffName: log.user?.name || 'Staff Member',
            staffRole: log.user?.role || 'RECEPTION_STAFF',
            createdAt: log.createdAt,
          })),
        },
        tab,
        records,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching reception overview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reception overview.',
      error: error.message,
    });
  }
}

/**
 * 2. Rapid Search & Lookup for Reception Staff
 */
export async function searchReception(req: Request, res: Response): Promise<void> {
  try {
    const q = ((req.query.q as string) || '').trim();

    if (!q || q.length < 2) {
      res.status(200).json({
        success: true,
        data: [],
      });
      return;
    }

    const [registrations, directParticipants] = await Promise.all([
      prisma.registration.findMany({
        where: {
          isArchived: false,
          OR: [
            { registrationId: { contains: q, mode: 'insensitive' } },
            { primaryName: { contains: q, mode: 'insensitive' } },
            { mobile: { contains: q } },
            {
              participants: {
                some: {
                  OR: [
                    { fullName: { contains: q, mode: 'insensitive' } },
                    { phone: { contains: q } },
                  ],
                },
              },
            },
            {
              allocations: {
                some: {
                  allocationNumber: { contains: q, mode: 'insensitive' },
                },
              },
            },
          ],
        },
        take: 15,
        include: {
          participants: {
            where: { isArchived: false },
            include: {
              aadhaarRecord: {
                select: { lastFourDigits: true, complianceStatus: true, retentionConsent: true },
              },
              stayRecords: {
                where: { status: { in: [StayStatus.CHECKED_IN, StayStatus.EXTENDED] } },
              },
            },
          },
          allocations: {
            where: { isArchived: false, status: { not: AllocationStatus.CANCELLED } },
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              items: {
                include: {
                  unit: {
                    include: { room: true },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.participant.findMany({
        where: {
          isArchived: false,
          OR: [
            { fullName: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q } },
            { id: q.length === 36 ? q : undefined },
          ],
        },
        take: 15,
        include: {
          registration: true,
          stayRecords: {
            where: { status: { in: [StayStatus.CHECKED_IN, StayStatus.EXTENDED] } },
            include: {
              unit: {
                include: { room: { include: { hotel: true } } },
              },
            },
          },
        },
      }),
    ]);

    const formattedParticipants = directParticipants.map((p) => {
      const activeStay = p.stayRecords[0] || null;
      return {
        id: p.id,
        fullName: p.fullName,
        phone: p.phone,
        gender: p.gender,
        age: p.age,
        relationToPrimary: p.relationToPrimary,
        isPrimary: p.isPrimary,
        checkInStatus: p.checkInStatus,
        registrationId: p.registration.registrationId,
        primaryName: p.registration.primaryName,
        currentRoomNumber: activeStay?.unit.room.roomNumber || null,
        currentUnitNumber: activeStay?.unit.unitNumber || null,
        hotelName: activeStay?.unit.room.hotel?.name || 'Main Wing',
      };
    });

    res.status(200).json({
      success: true,
      data: registrations,
      participants: formattedParticipants,
    });
  } catch (error: any) {
    console.error('Error in reception search:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform reception lookup.',
      error: error.message,
    });
  }
}

/**
 * 3. Deep Reception Profile & Dossier
 */
export async function getReceptionDossier(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // Search by registrationId (UUID or REG-XXXX) or allocationId
    const registration = await prisma.registration.findFirst({
      where: {
        isArchived: false,
        OR: [
          { id },
          { registrationId: id },
          {
            allocations: {
              some: {
                OR: [{ id }, { allocationNumber: id }],
              },
            },
          },
        ],
      },
      include: {
        participants: {
          where: { isArchived: false },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          include: {
            aadhaarRecord: {
              select: {
                id: true,
                lastFourDigits: true,
                complianceStatus: true,
                retentionConsent: true,
                createdAt: true,
              },
            },
            stayRecords: {
              orderBy: { actualCheckIn: 'desc' },
              include: {
                unit: { include: { room: { include: { hotel: true } } } },
                previousStayRecord: {
                  include: { unit: { include: { room: { include: { hotel: true } } } } },
                },
                recordedBy: {
                  select: { id: true, name: true, role: true },
                },
              },
            },
          },
        },
        allocations: {
          where: { isArchived: false },
          orderBy: { createdAt: 'desc' },
          include: {
            createdBy: {
              select: { id: true, name: true, role: true },
            },
            items: {
              include: {
                unit: {
                  include: { room: { include: { hotel: true } } },
                },
                participant: true,
              },
            },
          },
        },
        messageLogs: {
          orderBy: { createdAt: 'desc' },
          include: {
            sentByUser: {
              select: { id: true, name: true, role: true },
            },
          },
        },
      },
    });

    if (!registration) {
      res.status(404).json({
        success: false,
        message: `Registration / Allocation not found for identifier '${id}'.`,
      });
      return;
    }

    // Active allocation
    const activeAllocation = registration.allocations.find((a) => a.status !== AllocationStatus.CANCELLED) || null;

    // Masked aadhaar formatting
    const formattedParticipants = registration.participants.map((p) => {
      const activeStay = p.stayRecords.find((s) => s.status === StayStatus.CHECKED_IN || s.status === StayStatus.EXTENDED) || null;
      return {
        ...p,
        maskedAadhaar: p.aadhaarRecord ? formatMaskedAadhaar(p.aadhaarRecord.lastFourDigits) : null,
        activeStay,
      };
    });

    // Capacity metrics breakdown
    const allocatedUnitsCount = activeAllocation ? activeAllocation.items.filter((i) => i.status !== 'CANCELLED').length : 0;
    const actualParticipantsCount = registration.participants.length;
    const checkedInCount = formattedParticipants.filter((p) => Boolean(p.activeStay)).length;

    res.status(200).json({
      success: true,
      data: {
        registration: {
          ...registration,
          participants: formattedParticipants,
        },
        activeAllocation,
        capacitySummary: {
          totalRegisteredMembers: registration.totalMembers,
          allocatedUnitsCount,
          actualParticipantsCount,
          checkedInCount,
          difference: registration.totalMembers - actualParticipantsCount,
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching reception dossier:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reception dossier.',
      error: error.message,
    });
  }
}

/**
 * 3B. Unified Participant Profile (Requirement 1)
 */
export async function getUnifiedParticipantProfile(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const participant = await prisma.participant.findFirst({
      where: {
        isArchived: false,
        OR: [
          { id: id.length === 36 ? id : undefined },
          { phone: id },
        ],
      },
      include: {
        registration: {
          include: {
            allocations: {
              where: { isArchived: false, status: { not: AllocationStatus.CANCELLED } },
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                items: {
                  include: {
                    unit: {
                      include: {
                        room: { include: { hotel: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        stayRecords: {
          orderBy: { actualCheckIn: 'desc' },
          include: {
            unit: {
              include: {
                room: { include: { hotel: true } },
              },
            },
            previousStayRecord: {
              include: {
                unit: {
                  include: {
                    room: { include: { hotel: true } },
                  },
                },
              },
            },
            recordedBy: {
              select: { id: true, name: true, role: true },
            },
          },
        },
      },
    });

    if (!participant) {
      res.status(404).json({
        success: false,
        message: `Participant profile not found for identifier '${id}'.`,
      });
      return;
    }

    // Determine current active stay
    const currentStay = participant.stayRecords.find(
      (s) => (s.status === StayStatus.CHECKED_IN || s.status === StayStatus.EXTENDED) && s.actualCheckOut === null
    ) || null;

    // Room changes / transfer history
    const roomChanges = participant.stayRecords
      .filter((s) => s.previousStayRecordId !== null || s.transferReason !== null)
      .map((s) => ({
        stayRecordId: s.id,
        transferReason: s.transferReason || 'Room reassignment',
        changedAt: s.actualCheckIn,
        staffName: s.recordedBy?.name || 'Reception Staff',
        fromUnit: s.previousStayRecord
          ? {
              unitNumber: s.previousStayRecord.unit.unitNumber,
              unitType: s.previousStayRecord.unit.type,
              roomNumber: s.previousStayRecord.unit.room.roomNumber,
              hotelName: s.previousStayRecord.unit.room.hotel?.name || 'Main Wing',
            }
          : null,
        toUnit: {
          unitNumber: s.unit.unitNumber,
          unitType: s.unit.type,
          roomNumber: s.unit.room.roomNumber,
          hotelName: s.unit.room.hotel?.name || 'Main Wing',
        },
      }));

    // Stay history (all stays)
    const stayHistory = participant.stayRecords.map((s) => ({
      stayRecordId: s.id,
      unitNumber: s.unit.unitNumber,
      unitType: s.unit.type,
      roomNumber: s.unit.room.roomNumber,
      hotelName: s.unit.room.hotel?.name || 'Main Wing',
      actualCheckIn: s.actualCheckIn,
      actualCheckOut: s.actualCheckOut,
      status: s.status,
      notes: s.notes,
      recordedByStaff: s.recordedBy?.name || 'Staff Member',
    }));

    // Next permitted actions based on status
    const allowedActions: string[] = ['UPDATE_PHONE'];
    if (participant.checkInStatus === ParticipantStatus.CHECKED_IN) {
      allowedActions.push('CHANGE_ROOM', 'CHECK_OUT', 'EXTEND_STAY');
    } else if (participant.checkInStatus === ParticipantStatus.CHECKED_OUT) {
      allowedActions.push('CHECK_IN_AGAIN');
    } else {
      allowedActions.push('CHECK_IN');
    }

    const latestAllocation = participant.registration.allocations[0] || null;

    res.status(200).json({
      success: true,
      data: {
        participant: {
          id: participant.id,
          fullName: participant.fullName,
          phone: participant.phone || null,
          gender: participant.gender || null,
          age: participant.age || null,
          relationToPrimary: participant.relationToPrimary || 'Self',
          isPrimary: participant.isPrimary,
          checkInStatus: participant.checkInStatus,
          notes: participant.notes || null,
        },
        registration: {
          id: participant.registration.id,
          registrationId: participant.registration.registrationId,
          primaryName: participant.registration.primaryName,
          mobile: participant.registration.mobile,
          city: participant.registration.city,
          state: participant.registration.state,
          totalMembers: participant.registration.totalMembers,
          status: participant.registration.status,
          stayDates: latestAllocation
            ? {
                arrivalDate: latestAllocation.entryDate,
                departureDate: latestAllocation.exitDate,
              }
            : null,
        },
        currentAccommodation: currentStay
          ? {
              stayRecordId: currentStay.id,
              unitId: currentStay.unit.id,
              unitNumber: currentStay.unit.unitNumber,
              unitType: currentStay.unit.type,
              roomId: currentStay.unit.room.id,
              roomNumber: currentStay.unit.room.roomNumber,
              building: currentStay.unit.room.building,
              floor: currentStay.unit.room.floor,
              hotelName: currentStay.unit.room.hotel?.name || 'Main Wing',
              actualCheckIn: currentStay.actualCheckIn,
            }
          : null,
        previousRoomChanges: roomChanges,
        stayHistory,
        allowedActions,
      },
    });
  } catch (error: any) {
    console.error('Error fetching participant profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch participant profile.',
      error: error.message,
    });
  }
}

/**
 * 4. Record Actual Arriving Participants (Supports partial arrivals & additions)
 */
export async function recordActualParticipants(req: Request, res: Response): Promise<void> {
  try {
    const validated = recordParticipantsSchema.parse(req.body);

    const registration = await prisma.registration.findUnique({
      where: { id: validated.registrationId },
    });

    if (!registration) {
      res.status(404).json({
        success: false,
        message: 'Registration not found.',
      });
      return;
    }

    const savedParticipants = await prisma.$transaction(async (tx) => {
      const results = [];

      for (const p of validated.participants) {
        if (p.id) {
          // Update existing participant
          const updated = await tx.participant.update({
            where: { id: p.id },
            data: {
              fullName: p.fullName,
              phone: p.phone,
              gender: p.gender,
              age: p.age,
              relationToPrimary: p.relationToPrimary,
              isPrimary: p.isPrimary,
              notes: p.notes,
            },
          });
          results.push(updated);
        } else {
          // Create newly arriving person
          const created = await tx.participant.create({
            data: {
              registrationId: validated.registrationId,
              fullName: p.fullName,
              phone: p.phone,
              gender: p.gender,
              age: p.age,
              relationToPrimary: p.relationToPrimary,
              isPrimary: p.isPrimary,
              notes: p.notes,
              checkInStatus: ParticipantStatus.REGISTERED,
            },
          });
          results.push(created);
        }
      }

      // Record activity
      await tx.activityLog.create({
        data: {
          entityType: 'REGISTRATION',
          entityId: validated.registrationId,
          action: ActionType.UPDATE,
          userId: req.user?.id,
          details: {
            actualRecordedCount: results.length,
            arrivingNames: results.map((r) => r.fullName),
          },
        },
      });

      return results;
    });

    res.status(200).json({
      success: true,
      message: `Successfully recorded ${savedParticipants.length} actual arriving participants.`,
      data: savedParticipants,
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

    console.error('Error recording actual participants:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record arriving participants.',
      error: error.message,
    });
  }
}

/**
 * 5. Collect & Encrypt Aadhaar (AES-256-GCM with masked display only)
 */
export async function collectAadhaarRecord(req: Request, res: Response): Promise<void> {
  try {
    const validated = collectAadhaarSchema.parse(req.body);

    const participant = await prisma.participant.findUnique({
      where: { id: validated.participantId },
    });

    if (!participant) {
      res.status(404).json({
        success: false,
        message: 'Participant not found.',
      });
      return;
    }

    // Encrypt sensitive Aadhaar number application-side
    const encrypted = encryptSensitiveData(validated.aadhaarNumber);

    const record = await prisma.aadhaarRecord.upsert({
      where: { participantId: validated.participantId },
      update: {
        encryptedAadhaar: encrypted.encryptedText,
        aadhaarIv: encrypted.iv,
        aadhaarAuthTag: encrypted.authTag,
        lastFourDigits: encrypted.lastFourDigits,
        retentionConsent: validated.retentionConsent,
        complianceStatus: validated.complianceStatus,
        recordedById: req.user!.id,
      },
      create: {
        participantId: validated.participantId,
        encryptedAadhaar: encrypted.encryptedText,
        aadhaarIv: encrypted.iv,
        aadhaarAuthTag: encrypted.authTag,
        lastFourDigits: encrypted.lastFourDigits,
        retentionConsent: validated.retentionConsent,
        complianceStatus: validated.complianceStatus,
        recordedById: req.user!.id,
      },
    });

    // Immutable activity log strictly records last 4 digits only
    await prisma.activityLog.create({
      data: {
        entityType: 'AADHAAR_RECORD',
        entityId: record.id,
        action: ActionType.CREATE,
        userId: req.user?.id,
        details: {
          participantId: validated.participantId,
          participantName: participant.fullName,
          lastFourDigits: encrypted.lastFourDigits,
          complianceStatus: validated.complianceStatus,
          retentionConsent: validated.retentionConsent,
        },
      },
    });

    res.status(200).json({
      success: true,
      message: 'Aadhaar details securely encrypted and recorded.',
      data: {
        participantId: record.participantId,
        lastFourDigits: record.lastFourDigits,
        maskedAadhaar: formatMaskedAadhaar(record.lastFourDigits),
        complianceStatus: record.complianceStatus,
        retentionConsent: record.retentionConsent,
        createdAt: record.createdAt,
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

    console.error('Error collecting Aadhaar:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record Aadhaar compliance record.',
      error: error.message,
    });
  }
}

/**
 * 6. Reception Review & Allocation Confirmation
 */
export async function confirmReception(req: Request, res: Response): Promise<void> {
  try {
    const validated = confirmReceptionSchema.parse(req.body);

    const allocation = await prisma.allocation.findUnique({
      where: { id: validated.allocationId },
      include: {
        registration: true,
        items: true,
      },
    });

    if (!allocation) {
      res.status(404).json({
        success: false,
        message: 'Allocation not found.',
      });
      return;
    }

    if (allocation.status === AllocationStatus.CANCELLED) {
      res.status(400).json({
        success: false,
        message: 'Cannot confirm a cancelled allocation.',
      });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Transition master allocation to CONFIRMED
      const confirmedAlloc = await tx.allocation.update({
        where: { id: validated.allocationId },
        data: {
          status: AllocationStatus.CONFIRMED,
        },
      });

      // 2. Update parent registration status to CONFIRMED
      await tx.registration.update({
        where: { id: allocation.registrationId },
        data: {
          status: RegistrationStatus.CONFIRMED,
        },
      });

      // 3. Map arriving participants to assigned units & update participant statuses
      for (const assignment of validated.participantAssignments) {
        await tx.participant.update({
          where: { id: assignment.participantId },
          data: {
            checkInStatus: ParticipantStatus.CONFIRMED,
          },
        });

        // If an allocationItemId is provided, link participant to item
        if (assignment.allocationItemId) {
          await tx.allocationItem.update({
            where: { id: assignment.allocationItemId },
            data: {
              participantId: assignment.participantId,
              status: AllocationItemStatus.CONFIRMED,
            },
          });
        }
      }

      // 4. Audit trail
      await tx.activityLog.create({
        data: {
          entityType: 'ALLOCATION',
          entityId: allocation.id,
          action: ActionType.CONFIRM,
          userId: req.user?.id,
          details: {
            allocationNumber: allocation.allocationNumber,
            assignedParticipantsCount: validated.participantAssignments.length,
          },
        },
      });

      return confirmedAlloc;
    });

    res.status(200).json({
      success: true,
      message: `Allocation ${allocation.allocationNumber} confirmed successfully.`,
      data: updated,
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

    console.error('Error confirming reception allocation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm reception allocation.',
      error: error.message,
    });
  }
}

/**
 * 7. Actual Check-in (Physical Bed/Mat Occupancy Activation)
 */
export async function checkInParticipants(req: Request, res: Response): Promise<void> {
  try {
    const validated = checkInSchema.parse(req.body);

    const registration = await prisma.registration.findUnique({
      where: { id: validated.registrationId },
    });

    if (!registration) {
      res.status(404).json({
        success: false,
        message: 'Registration not found.',
      });
      return;
    }

    // If allocationId provided, verify allocation is CONFIRMED
    if (validated.allocationId) {
      const alloc = await prisma.allocation.findUnique({
        where: { id: validated.allocationId },
      });
      if (!alloc) {
        res.status(404).json({
          success: false,
          message: 'Allocation not found.',
        });
        return;
      }
      if (alloc.status !== AllocationStatus.CONFIRMED) {
        res.status(400).json({
          success: false,
          message: `Allocation must be confirmed before check-in (Current status: ${alloc.status}).`,
        });
        return;
      }
    }

    const createdStays = await prisma.$transaction(async (tx) => {
      const stays = [];

      for (const item of validated.checkIns) {
        // 1. Verify participant exists and is CONFIRMED
        const participant = await tx.participant.findUnique({
          where: { id: item.participantId },
        });

        if (!participant) {
          throw new Error(`Participant with ID '${item.participantId}' not found.`);
        }

        if (participant.checkInStatus === ParticipantStatus.CHECKED_IN) {
          const conflictErr: any = new Error(`Participant '${participant.fullName}' already has an active checked-in stay.`);
          conflictErr.code = '23P01';
          throw conflictErr;
        }

        if (participant.checkInStatus !== ParticipantStatus.CONFIRMED) {
          const validationErr: any = new Error(`Participant '${participant.fullName}' cannot be checked in without prior reception confirmation (Current status: ${participant.checkInStatus}).`);
          validationErr.statusCode = 400;
          throw validationErr;
        }

        // 2. Validate unit is active and not maintenance
        const unit = await tx.accommodationUnit.findUnique({
          where: { id: item.unitId },
          include: { room: true },
        });

        if (!unit) {
          throw new Error(`Accommodation unit with ID '${item.unitId}' not found.`);
        }

        if (unit.status !== 'ACTIVE' || unit.room.status !== 'ACTIVE') {
          throw new Error(`Unit ${unit.unitNumber} in Room ${unit.room.roomNumber} is currently under maintenance.`);
        }

        // Create StayRecord (PostgreSQL Exclusion constraint will catch any concurrent overlap 23P01)
        const stay = await tx.stayRecord.create({
          data: {
            registrationId: validated.registrationId,
            participantId: item.participantId,
            unitId: item.unitId,
            allocationItemId: item.allocationItemId,
            actualCheckIn: new Date(),
            status: StayStatus.CHECKED_IN,
            notes: item.notes,
            recordedById: req.user!.id,
          },
          include: {
            participant: true,
            unit: { include: { room: true } },
          },
        });

        // Update participant status
        await tx.participant.update({
          where: { id: item.participantId },
          data: {
            checkInStatus: ParticipantStatus.CHECKED_IN,
          },
        });

        // Update allocation item if supplied
        if (item.allocationItemId) {
          await tx.allocationItem.update({
            where: { id: item.allocationItemId },
            data: {
              status: AllocationItemStatus.CONFIRMED,
              participantId: item.participantId,
            },
          });
        }

        stays.push(stay);
      }

      // Update parent registration status
      await tx.registration.update({
        where: { id: validated.registrationId },
        data: {
          status: RegistrationStatus.CHECKED_IN,
        },
      });

      // Audit Log
      await tx.activityLog.create({
        data: {
          entityType: 'RECEPTION',
          entityId: validated.registrationId,
          action: ActionType.CHECK_IN,
          userId: req.user?.id,
          details: {
            checkedInCount: stays.length,
            units: stays.map((s) => `${s.unit.room.roomNumber}-${s.unit.unitNumber}`),
          },
        },
      });

      return stays;
    });

    res.status(200).json({
      success: true,
      message: `Successfully checked in ${createdStays.length} participants into their assigned units.`,
      data: createdStays,
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

    // PostgreSQL Exclusion Constraint Code: 23P01 (overlapping stay or participant)
    if (error.code === '23P01' || error.message?.includes('no_overlapping_active_stays') || error.message?.includes('no_overlapping_participant_stays')) {
      res.status(409).json({
        success: false,
        message: 'Double occupancy or participant conflict: This unit or participant already has an active checked-in stay.',
        conflictType: 'OCCUPANCY_CONFLICT',
        error: error.message,
      });
      return;
    }

    console.error('Error during participant check-in:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to process check-in.',
    });
  }
}

/**
 * 8. Actual Checkout (Physical Bed/Mat Capacity Release)
 */
export async function checkOutParticipant(req: Request, res: Response): Promise<void> {
  try {
    const validated = checkOutSchema.parse(req.body);

    const stay = await prisma.stayRecord.findUnique({
      where: { id: validated.stayRecordId },
      include: {
        participant: true,
        unit: { include: { room: true } },
      },
    });

    if (!stay) {
      res.status(404).json({
        success: false,
        message: 'Stay record not found.',
      });
      return;
    }

    if (stay.status === StayStatus.CHECKED_OUT) {
      res.status(400).json({
        success: false,
        message: 'This participant is already checked out.',
      });
      return;
    }

    const updatedStay = await prisma.$transaction(async (tx) => {
      // 1. Mark Stay as CHECKED_OUT with departure timestamp
      const completedStay = await tx.stayRecord.update({
        where: { id: validated.stayRecordId },
        data: {
          actualCheckOut: new Date(),
          status: StayStatus.CHECKED_OUT,
          notes: validated.notes
            ? `${stay.notes ? stay.notes + ' | ' : ''}Checkout: ${validated.notes}`
            : stay.notes,
        },
      });

      // 2. Mark participant as CHECKED_OUT
      await tx.participant.update({
        where: { id: stay.participantId },
        data: {
          checkInStatus: ParticipantStatus.CHECKED_OUT,
        },
      });

      // 3. Mark underlying allocation item as COMPLETED if linked
      if (stay.allocationItemId) {
        await tx.allocationItem.update({
          where: { id: stay.allocationItemId },
          data: {
            status: AllocationItemStatus.COMPLETED,
          },
        });
      }

      // 4. Check if all participants in registration are checked out
      const remainingActiveStays = await tx.stayRecord.count({
        where: {
          registrationId: stay.registrationId,
          status: { in: [StayStatus.CHECKED_IN, StayStatus.EXTENDED] },
        },
      });

      if (remainingActiveStays === 0) {
        await tx.registration.update({
          where: { id: stay.registrationId },
          data: {
            status: RegistrationStatus.CHECKED_OUT,
          },
        });
      }

      // 5. Audit log
      await tx.activityLog.create({
        data: {
          entityType: 'STAY_RECORD',
          entityId: stay.id,
          action: ActionType.CHECK_OUT,
          userId: req.user?.id,
          details: {
            participantId: stay.participantId,
            participantName: stay.participant.fullName,
            roomNumber: stay.unit.room.roomNumber,
            unitNumber: stay.unit.unitNumber,
            checkoutNotes: validated.notes,
          },
        },
      });

      return completedStay;
    });

    res.status(200).json({
      success: true,
      message: `Participant ${stay.participant.fullName} checked out successfully. Unit ${stay.unit.unitNumber} released.`,
      data: updatedStay,
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

    console.error('Error during participant checkout:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process checkout.',
      error: error.message,
    });
  }
}

/**
 * 8b. Group Checkout by Primary Participant / Multi-select
 * Atomic batch checkout releasing beds/mats for selected party members
 */
export async function batchCheckOutParticipants(req: Request, res: Response): Promise<void> {
  try {
    const validated = batchCheckOutSchema.parse(req.body);

    const stays = await prisma.stayRecord.findMany({
      where: {
        id: { in: validated.stayRecordIds },
        status: { in: [StayStatus.CHECKED_IN, StayStatus.EXTENDED] },
        actualCheckOut: null,
      },
      include: {
        participant: true,
        unit: { include: { room: true } },
      },
    });

    if (stays.length === 0) {
      res.status(400).json({
        success: false,
        message: 'No active checked-in stay records found for the selected members.',
      });
      return;
    }

    const checkedOutNames: string[] = [];
    const registrationIds = new Set<string>();

    await prisma.$transaction(async (tx) => {
      for (const stay of stays) {
        checkedOutNames.push(stay.participant.fullName);
        registrationIds.add(stay.registrationId);

        // 1. Mark Stay as CHECKED_OUT with departure timestamp
        await tx.stayRecord.update({
          where: { id: stay.id },
          data: {
            actualCheckOut: new Date(),
            status: StayStatus.CHECKED_OUT,
            notes: validated.notes
              ? `${stay.notes ? stay.notes + ' | ' : ''}Group Checkout: ${validated.notes}`
              : stay.notes,
          },
        });

        // 2. Mark participant as CHECKED_OUT
        await tx.participant.update({
          where: { id: stay.participantId },
          data: {
            checkInStatus: ParticipantStatus.CHECKED_OUT,
          },
        });

        // 3. Mark underlying allocation item as COMPLETED if linked
        if (stay.allocationItemId) {
          await tx.allocationItem.update({
            where: { id: stay.allocationItemId },
            data: {
              status: AllocationItemStatus.COMPLETED,
            },
          });
        }

        // 4. Audit log per stay
        await tx.activityLog.create({
          data: {
            entityType: 'STAY_RECORD',
            entityId: stay.id,
            action: ActionType.CHECK_OUT,
            userId: req.user?.id,
            details: {
              participantName: stay.participant.fullName,
              roomNumber: stay.unit.room.roomNumber,
              unitNumber: stay.unit.unitNumber,
              unitType: stay.unit.type,
              checkoutType: 'GROUP_CHECKOUT',
              notes: validated.notes || null,
            },
          },
        });
      }

      // Check remaining active stays for each impacted registration
      for (const regId of registrationIds) {
        const remainingActiveStays = await tx.stayRecord.count({
          where: {
            registrationId: regId,
            status: { in: [StayStatus.CHECKED_IN, StayStatus.EXTENDED] },
            actualCheckOut: null,
          },
        });

        if (remainingActiveStays === 0) {
          await tx.registration.update({
            where: { id: regId },
            data: {
              status: RegistrationStatus.CHECKED_OUT,
            },
          });
        }
      }
    });

    res.status(200).json({
      success: true,
      message: `Checked out ${checkedOutNames.length} member${checkedOutNames.length === 1 ? '' : 's'} successfully: ${checkedOutNames.join(', ')}`,
      data: {
        checkedOutCount: checkedOutNames.length,
        checkedOutNames,
        checkedOutIds: stays.map((s) => s.id),
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: 'Invalid input for group checkout.',
        errors: error.errors,
      });
      return;
    }
    console.error('Error executing group checkout:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete group checkout.',
    });
  }
}

/**
 * 9. Room / Bed / Mat Transfer with Audit History
 */
export async function transferParticipant(req: Request, res: Response): Promise<void> {
  try {
    const validated = transferStaySchema.parse(req.body);

    const oldStay = await prisma.stayRecord.findUnique({
      where: { id: validated.stayRecordId },
      include: {
        participant: true,
        unit: { include: { room: true } },
      },
    });

    if (!oldStay) {
      res.status(404).json({
        success: false,
        message: 'Stay record not found.',
      });
      return;
    }

    if (oldStay.status !== StayStatus.CHECKED_IN && oldStay.status !== StayStatus.EXTENDED) {
      res.status(400).json({
        success: false,
        message: `Cannot transfer a stay with status '${oldStay.status}'. Must be actively checked in.`,
      });
      return;
    }

    if (oldStay.unitId === validated.newUnitId) {
      res.status(400).json({
        success: false,
        message: 'Cannot transfer to the exact same physical unit.',
      });
      return;
    }

    // Verify new unit exists and is active
    const newUnit = await prisma.accommodationUnit.findUnique({
      where: { id: validated.newUnitId },
      include: { room: true },
    });

    if (!newUnit) {
      res.status(404).json({
        success: false,
        message: 'Destination accommodation unit not found.',
      });
      return;
    }

    if (newUnit.status !== 'ACTIVE' || newUnit.room.status !== 'ACTIVE') {
      res.status(400).json({
        success: false,
        message: 'Destination unit or room is not active/available.',
      });
      return;
    }

    const transferResult = await prisma.$transaction(async (tx) => {
      // 1. Conclude old stay with TRANSFERRED status and record reason
      const concludedPriorStay = await tx.stayRecord.update({
        where: { id: validated.stayRecordId },
        data: {
          actualCheckOut: new Date(),
          status: StayStatus.TRANSFERRED,
          transferReason: validated.reason,
        },
      });

      // 2. Create new stay record linked to previous stay
      const newStay = await tx.stayRecord.create({
        data: {
          registrationId: oldStay.registrationId,
          participantId: oldStay.participantId,
          unitId: validated.newUnitId,
          allocationItemId: oldStay.allocationItemId,
          actualCheckIn: new Date(),
          status: StayStatus.CHECKED_IN,
          previousStayRecordId: oldStay.id,
          transferReason: validated.reason,
          recordedById: req.user!.id,
        },
        include: {
          unit: { include: { room: true } },
        },
      });

      // 3. Audit trail
      await tx.activityLog.create({
        data: {
          entityType: 'STAY_RECORD',
          entityId: newStay.id,
          action: ActionType.TRANSFER,
          userId: req.user?.id,
          details: {
            participantId: oldStay.participantId,
            participantName: oldStay.participant.fullName,
            fromRoom: oldStay.unit.room.roomNumber,
            fromUnit: oldStay.unit.unitNumber,
            toRoom: newUnit.room.roomNumber,
            toUnit: newUnit.unitNumber,
            transferReason: validated.reason,
          },
        },
      });

      return {
        previousStay: concludedPriorStay,
        newStay,
      };
    });

    res.status(200).json({
      success: true,
      message: `Transferred ${oldStay.participant.fullName} from Room ${oldStay.unit.room.roomNumber} (${oldStay.unit.unitNumber}) to Room ${newUnit.room.roomNumber} (${newUnit.unitNumber}).`,
      data: transferResult,
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

    if (error.code === '23P01') {
      res.status(409).json({
        success: false,
        message: 'Destination unit already has an active occupant during this period.',
        error: error.message,
      });
      return;
    }

    console.error('Error during room transfer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process room transfer.',
      error: error.message,
    });
  }
}

/**
 * 10. Authorized Stay Extension
 */
export async function extendStay(req: Request, res: Response): Promise<void> {
  try {
    const validated = extendStaySchema.parse(req.body);

    const stay = await prisma.stayRecord.findUnique({
      where: { id: validated.stayRecordId },
      include: {
        participant: true,
        unit: { include: { room: true } },
      },
    });

    if (!stay) {
      res.status(404).json({
        success: false,
        message: 'Stay record not found.',
      });
      return;
    }

    if (stay.status !== StayStatus.CHECKED_IN && stay.status !== StayStatus.EXTENDED) {
      res.status(400).json({
        success: false,
        message: `Cannot extend stay with status '${stay.status}'. Participant must be actively checked in.`,
      });
      return;
    }

    const extensionTargetDate = new Date(validated.newExitDate);
    if (extensionTargetDate <= new Date()) {
      res.status(400).json({
        success: false,
        message: 'Extension exit date must be in the future.',
      });
      return;
    }

    // Check for conflicting reservations on this unit during the extension interval
    const conflictItem = await prisma.allocationItem.findFirst({
      where: {
        unitId: stay.unitId,
        id: stay.allocationItemId ? { not: stay.allocationItemId } : undefined,
        status: { in: ['TENTATIVE', 'CONFIRMED'] },
        entryDate: { lt: extensionTargetDate },
        exitDate: { gt: new Date() },
      },
      include: {
        allocation: {
          include: { registration: true },
        },
      },
    });

    if (conflictItem) {
      res.status(409).json({
        success: false,
        message: `Stay extension conflict: Unit ${stay.unit.unitNumber} in Room ${stay.unit.room.roomNumber} is already reserved by ${conflictItem.allocation.registration.primaryName} (${conflictItem.allocation.allocationNumber}) from ${conflictItem.entryDate.toLocaleDateString()}.`,
        conflictType: 'EXTENSION_CONFLICT',
      });
      return;
    }

    // Capture original planned exit date for audit preservation
    let originalPlannedExit = stay.actualCheckOut?.toISOString();
    if (stay.allocationItemId) {
      const allocItem = await prisma.allocationItem.findUnique({
        where: { id: stay.allocationItemId },
      });
      originalPlannedExit = allocItem?.exitDate.toISOString() || originalPlannedExit;
    }

    const updatedStay = await prisma.$transaction(async (tx) => {
      const extended = await tx.stayRecord.update({
        where: { id: validated.stayRecordId },
        data: {
          status: StayStatus.EXTENDED,
          notes: `${stay.notes ? stay.notes + ' | ' : ''}Extension: Original Exit: ${originalPlannedExit || 'N/A'}, Extended To: ${validated.newExitDate}${validated.notes ? ` (Reason: ${validated.notes})` : ''}`,
        },
      });

      // Update allocation item exitDate if linked
      if (stay.allocationItemId) {
        await tx.allocationItem.update({
          where: { id: stay.allocationItemId },
          data: {
            exitDate: extensionTargetDate,
          },
        });
      }

      await tx.activityLog.create({
        data: {
          entityType: 'STAY_RECORD',
          entityId: stay.id,
          action: ActionType.STATUS_CHANGE,
          userId: req.user?.id,
          details: {
            previousStatus: stay.status,
            newStatus: StayStatus.EXTENDED,
            originalPlannedExit,
            extendedExitDate: validated.newExitDate,
            reason: validated.notes,
          },
        },
      });

      return extended;
    });

    res.status(200).json({
      success: true,
      message: `Stay for ${stay.participant.fullName} extended to ${validated.newExitDate}.`,
      data: updatedStay,
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

    console.error('Error extending stay:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to extend stay.',
      error: error.message,
    });
  }
}

/**
 * 11. Change Room / Bed / Mat Assignment (Pre-check-in or Post-check-in)
 */
export async function changeAssignment(req: Request, res: Response): Promise<void> {
  try {
    const validated = changeAssignmentSchema.parse(req.body);
    req.body = {
      assignments: [
        {
          participantId: validated.participantId,
          allocationItemId: validated.allocationItemId,
          stayRecordId: validated.stayRecordId,
          newUnitId: validated.newUnitId,
        },
      ],
      reason: validated.reason,
    };
    return batchChangeAssignment(req, res);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: 'Validation failed.',
        errors: error.errors,
      });
      return;
    }

    console.error('Error changing assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change unit assignment.',
      error: error.message,
    });
  }
}

/**
 * 11b. Batch Change Room / Bed / Mat Assignments (Single or Multiple Members)
 */
export async function batchChangeAssignment(req: Request, res: Response): Promise<void> {
  try {
    const validated = batchChangeAssignmentSchema.parse(req.body);
    const { assignments, reason } = validated;

    const results = await prisma.$transaction(async (tx) => {
      const processed: any[] = [];

      for (const item of assignments) {
        // 1. Verify destination unit
        const newUnit = await tx.accommodationUnit.findUnique({
          where: { id: item.newUnitId },
          include: { room: { include: { hotel: true } } },
        });

        if (!newUnit) {
          throw new Error(`Destination unit ${item.newUnitId} not found.`);
        }
        if (newUnit.status !== 'ACTIVE' || newUnit.room.status !== 'ACTIVE') {
          throw new Error(`Room ${newUnit.room.roomNumber} or Unit ${newUnit.unitNumber} is inactive or under maintenance.`);
        }

        // Verify not occupied by another active stay
        const activeOccupant = await tx.stayRecord.findFirst({
          where: {
            unitId: item.newUnitId,
            status: { in: [StayStatus.CHECKED_IN, StayStatus.EXTENDED] },
            actualCheckOut: null,
          },
          include: { participant: true },
        });

        if (activeOccupant && activeOccupant.participantId !== item.participantId) {
          throw new Error(`Unit ${newUnit.unitNumber} in Room ${newUnit.room.roomNumber} is currently occupied by ${activeOccupant.participant.fullName}.`);
        }

        // Check if this is a Stay Record change (Checked-in)
        let activeStay = null;
        if (item.stayRecordId) {
          activeStay = await tx.stayRecord.findUnique({
            where: { id: item.stayRecordId },
            include: { unit: { include: { room: true } }, participant: true },
          });
        } else if (item.participantId) {
          activeStay = await tx.stayRecord.findFirst({
            where: {
              participantId: item.participantId,
              status: { in: [StayStatus.CHECKED_IN, StayStatus.EXTENDED] },
              actualCheckOut: null,
            },
            include: { unit: { include: { room: true } }, participant: true },
          });
        }

        if (activeStay) {
          // POST-CHECK-IN TRANSFER
          if (activeStay.unitId !== item.newUnitId) {
            await tx.stayRecord.update({
              where: { id: activeStay.id },
              data: {
                actualCheckOut: new Date(),
                status: StayStatus.TRANSFERRED,
                transferReason: reason,
              },
            });

            if (activeStay.allocationItemId) {
              await tx.allocationItem.update({
                where: { id: activeStay.allocationItemId },
                data: { unitId: item.newUnitId },
              });
            }

            const newStay = await tx.stayRecord.create({
              data: {
                registrationId: activeStay.registrationId,
                participantId: activeStay.participantId,
                unitId: item.newUnitId,
                allocationItemId: activeStay.allocationItemId,
                actualCheckIn: new Date(),
                status: StayStatus.CHECKED_IN,
                previousStayRecordId: activeStay.id,
                transferReason: reason,
                recordedById: req.user!.id,
              },
              include: { unit: { include: { room: true } } },
            });

            await tx.activityLog.create({
              data: {
                entityType: 'STAY_RECORD',
                entityId: newStay.id,
                action: ActionType.TRANSFER,
                userId: req.user?.id,
                details: {
                  participantId: activeStay.participantId,
                  participantName: activeStay.participant?.fullName || 'Guest',
                  fromRoom: activeStay.unit.room.roomNumber,
                  fromUnit: activeStay.unit.unitNumber,
                  toRoom: newUnit.room.roomNumber,
                  toUnit: newUnit.unitNumber,
                  reason,
                  stage: 'POST_CHECK_IN',
                },
              },
            });

            processed.push({ type: 'STAY', id: newStay.id, toRoom: newUnit.room.roomNumber, toUnit: newUnit.unitNumber });
          }
        } else {
          // PRE-CHECK-IN ALLOCATION ITEM REASSIGNMENT
          let allocItem = null;
          if (item.allocationItemId) {
            allocItem = await tx.allocationItem.findUnique({
              where: { id: item.allocationItemId },
              include: { unit: { include: { room: true } }, participant: true },
            });
          } else if (item.participantId) {
            allocItem = await tx.allocationItem.findFirst({
              where: {
                participantId: item.participantId,
                status: { not: AllocationItemStatus.CANCELLED },
              },
              include: { unit: { include: { room: true } }, participant: true },
            });
          }

          if (allocItem) {
            const oldRoom = allocItem.unit.room.roomNumber;
            const oldUnitNum = allocItem.unit.unitNumber;

            const updatedItem = await tx.allocationItem.update({
              where: { id: allocItem.id },
              data: {
                unitId: item.newUnitId,
                ...(item.participantId ? { participantId: item.participantId } : {}),
                notes: reason ? `Reassigned: ${reason}` : allocItem.notes,
              },
              include: { unit: { include: { room: true } } },
            });

            await tx.activityLog.create({
              data: {
                entityType: 'ALLOCATION_ITEM',
                entityId: updatedItem.id,
                action: ActionType.TRANSFER,
                userId: req.user?.id,
                details: {
                  participantId: item.participantId || allocItem.participantId,
                  fromRoom: oldRoom,
                  fromUnit: oldUnitNum,
                  toRoom: newUnit.room.roomNumber,
                  toUnit: newUnit.unitNumber,
                  reason,
                  stage: 'PRE_CHECK_IN',
                },
              },
            });

            processed.push({ type: 'ALLOCATION_ITEM', id: updatedItem.id, toRoom: newUnit.room.roomNumber, toUnit: newUnit.unitNumber });
          } else {
            throw new Error(`Could not find active reservation or allocation item for assignment transfer.`);
          }
        }
      }

      return processed;
    });

    res.status(200).json({
      success: true,
      message: `Successfully transferred ${results.length} assignment(s).`,
      data: results,
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

    console.error('Error in batch change assignment:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to execute assignment transfer.',
    });
  }
}

/**
 * 12. Update Participant Individual Phone Number
 */
export async function updateParticipantPhone(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const validated = updatePhoneSchema.parse(req.body);

    const participant = await prisma.participant.findUnique({
      where: { id, isArchived: false },
    });

    if (!participant) {
      res.status(404).json({
        success: false,
        message: 'Participant not found.',
      });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.participant.update({
        where: { id },
        data: { phone: validated.phone },
      });

      await tx.activityLog.create({
        data: {
          entityType: 'PARTICIPANT',
          entityId: id,
          action: ActionType.UPDATE,
          userId: req.user?.id,
          details: {
            field: 'phone',
            oldPhone: participant.phone,
            newPhone: validated.phone,
            participantName: participant.fullName,
          },
        },
      });

      return p;
    });

    res.status(200).json({
      success: true,
      message: `Updated phone number for ${participant.fullName}.`,
      data: updated,
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

    console.error('Error updating participant phone:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update phone number.',
      error: error.message,
    });
  }
}

/**
 * 13. Accidental Checkout Recovery (Check In Again)
 * Reuses the existing participant (and registration) record without creating duplicates.
 * Preserves previous completed stay history, and creates a new active StayRecord.
 */
export async function checkInAgain(req: Request, res: Response): Promise<void> {
  try {
    const validated = checkInAgainSchema.parse(req.body);

    const participant = await prisma.participant.findUnique({
      where: { id: validated.participantId },
      include: {
        registration: true,
        stayRecords: {
          orderBy: { actualCheckOut: 'desc' },
        },
      },
    });

    if (!participant || participant.isArchived) {
      res.status(404).json({
        success: false,
        message: 'Participant not found or is archived.',
      });
      return;
    }

    // Check if participant already has an active stay
    const activeStay = participant.stayRecords.find(
      (s) => (s.status === StayStatus.CHECKED_IN || s.status === StayStatus.EXTENDED) && !s.actualCheckOut
    );

    if (activeStay) {
      res.status(409).json({
        success: false,
        message: `Participant '${participant.fullName}' already has an active checked-in stay. Check out or transfer first.`,
      });
      return;
    }

    // Validate target unit
    const unit = await prisma.accommodationUnit.findUnique({
      where: { id: validated.unitId },
      include: {
        room: {
          include: { hotel: true },
        },
      },
    });

    if (!unit) {
      res.status(404).json({
        success: false,
        message: 'Accommodation unit not found.',
      });
      return;
    }

    if (unit.status !== 'ACTIVE' || unit.room.status !== 'ACTIVE') {
      res.status(400).json({
        success: false,
        message: `Unit ${unit.unitNumber} in Room ${unit.room.roomNumber} is currently under maintenance or inactive.`,
      });
      return;
    }

    // Check if target unit is currently occupied by someone else
    const currentUnitOccupancy = await prisma.stayRecord.findFirst({
      where: {
        unitId: validated.unitId,
        status: { in: [StayStatus.CHECKED_IN, StayStatus.EXTENDED] },
        actualCheckOut: null,
      },
      include: { participant: true },
    });

    if (currentUnitOccupancy) {
      res.status(409).json({
        success: false,
        message: `Unit ${unit.unitNumber} in Room ${unit.room.roomNumber} is already occupied by ${currentUnitOccupancy.participant.fullName}.`,
      });
      return;
    }

    // Validate gender compatibility if room is gender restricted
    if (participant.gender) {
      if (
        unit.room.genderPreference === 'MALE' &&
        participant.gender === 'FEMALE'
      ) {
        res.status(400).json({
          success: false,
          message: `Cannot assign female guest to male-restricted Room ${unit.room.roomNumber}.`,
        });
        return;
      }
      if (
        unit.room.genderPreference === 'FEMALE' &&
        participant.gender === 'MALE'
      ) {
        res.status(400).json({
          success: false,
          message: `Cannot assign male guest to female-restricted Room ${unit.room.roomNumber}.`,
        });
        return;
      }
    }

    const lastCompletedStay = participant.stayRecords[0];

    const newStay = await prisma.$transaction(async (tx) => {
      // 1. Create new StayRecord preserving previous stay history
      const createdStay = await tx.stayRecord.create({
        data: {
          registrationId: participant.registrationId,
          participantId: participant.id,
          unitId: validated.unitId,
          actualCheckIn: validated.checkInDateTime ? new Date(validated.checkInDateTime) : new Date(),
          actualCheckOut: null,
          status: StayStatus.CHECKED_IN,
          previousStayRecordId: lastCompletedStay ? lastCompletedStay.id : null,
          notes: validated.notes
            ? `Accidental checkout recovery: ${validated.notes}`
            : 'Accidental checkout recovery / re-checkin',
          recordedById: req.user!.id,
        },
        include: {
          participant: true,
          unit: {
            include: {
              room: {
                include: { hotel: true },
              },
            },
          },
        },
      });

      // 2. Update participant status back to CHECKED_IN
      await tx.participant.update({
        where: { id: participant.id },
        data: {
          checkInStatus: ParticipantStatus.CHECKED_IN,
        },
      });

      // 3. Update registration status back to CHECKED_IN if needed
      await tx.registration.update({
        where: { id: participant.registrationId },
        data: {
          status: RegistrationStatus.CHECKED_IN,
        },
      });

      // 4. Log Audit Activity
      await tx.activityLog.create({
        data: {
          entityType: 'RECEPTION',
          entityId: participant.registrationId,
          action: ActionType.CHECK_IN,
          userId: req.user?.id,
          details: {
            type: 'ACCIDENTAL_CHECKOUT_RECOVERY',
            participantId: participant.id,
            participantName: participant.fullName,
            phone: participant.phone,
            unitNumber: unit.unitNumber,
            roomNumber: unit.room.roomNumber,
            hotel: unit.room.hotel?.name,
            previousStayRecordId: lastCompletedStay?.id,
            notes: validated.notes,
          },
        },
      });

      return createdStay;
    });

    res.status(200).json({
      success: true,
      message: `Successfully checked in ${participant.fullName} again to Room ${unit.room.roomNumber} (${unit.unitNumber}).`,
      data: newStay,
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

    console.error('Error during accidental checkout recovery:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to perform accidental checkout recovery.',
    });
  }
}
