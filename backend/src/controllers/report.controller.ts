import { Request, Response } from 'express';
import { z } from 'zod';
import * as XLSX from 'xlsx';
import { prisma } from '../config/prisma';
import { StayStatus, ActionType, RoomStatus, UnitStatus, RegistrationStatus, UnitType, AllocationItemStatus } from '@prisma/client';
import { generateOperationalPdfReport } from '../utils/pdfGenerator';

const dateRangeSchema = z.object({
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  hotelId: z.string().trim().optional(),
});

function getDateRangeFilter(startDate?: string, endDate?: string) {
  if (!startDate && !endDate) return undefined;
  const filter: any = {};
  if (startDate) {
    const s = new Date(startDate);
    s.setHours(0, 0, 0, 0);
    filter.gte = s;
  }
  if (endDate) {
    const e = new Date(endDate);
    e.setHours(23, 59, 59, 999);
    filter.lte = e;
  }
  return filter;
}

// ----------------------------------------------------------------------------
// 1. EXECUTIVE REPORT OVERVIEW
// ----------------------------------------------------------------------------
export async function getReportOverview(req: Request, res: Response) {
  try {
    const { startDate, endDate, hotelId } = dateRangeSchema.parse(req.query);
    const dateFilter = getDateRangeFilter(startDate, endDate);
    const hasHotelFilter = Boolean(hotelId && hotelId !== 'ALL');

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const [
      rooms,
      units,
      activeStays,
      registrations,
      participantsCount,
      todayArrivals,
      todayCheckIns,
      todayDepartures,
      todayCheckOuts,
      todayTransfers,
    ] = await Promise.all([
      // All rooms with units and occupancy
      prisma.room.findMany({
        where: {
          status: RoomStatus.ACTIVE,
          ...(hasHotelFilter ? { hotelId } : {}),
        },
        include: {
          hotel: {
            select: { id: true, name: true },
          },
          units: {
            where: { status: UnitStatus.ACTIVE },
            include: {
              stayRecords: {
                where: { status: { in: [StayStatus.CHECKED_IN, StayStatus.EXTENDED] }, actualCheckOut: null },
              },
              allocationItems: {
                where: {
                  status: { in: [AllocationItemStatus.TENTATIVE, AllocationItemStatus.CONFIRMED] },
                  exitDate: { gte: startOfToday },
                },
              },
            },
          },
        },
        orderBy: { roomNumber: 'asc' },
      }),

      // All accommodation units
      prisma.accommodationUnit.findMany({
        where: hasHotelFilter ? { room: { hotelId } } : undefined,
        select: {
          id: true,
          type: true,
          genderCategory: true,
          status: true,
        },
      }),

      // Active stays
      prisma.stayRecord.findMany({
        where: {
          status: { in: [StayStatus.CHECKED_IN, StayStatus.EXTENDED] },
          actualCheckOut: null,
          ...(hasHotelFilter ? { unit: { room: { hotelId } } } : {}),
        },
        include: {
          unit: {
            select: {
              type: true,
              genderCategory: true,
            },
          },
        },
      }),

      // Registrations within date range (or all if not specified)
      prisma.registration.findMany({
        where: {
          isArchived: false,
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
        select: {
          id: true,
          status: true,
          totalMembers: true,
        },
      }),

      // Participants count
      prisma.participant.count({
        where: {
          isArchived: false,
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
      }),

      // Today's expected arrivals
      prisma.allocation.count({
        where: {
          isArchived: false,
          entryDate: { gte: startOfToday, lte: endOfToday },
          ...(hasHotelFilter ? { items: { some: { unit: { room: { hotelId } } } } } : {}),
        },
      }),

      // Today's actual check-ins
      prisma.stayRecord.count({
        where: {
          actualCheckIn: { gte: startOfToday, lte: endOfToday },
          ...(hasHotelFilter ? { unit: { room: { hotelId } } } : {}),
        },
      }),

      // Today's expected departures
      prisma.allocation.count({
        where: {
          isArchived: false,
          exitDate: { gte: startOfToday, lte: endOfToday },
          ...(hasHotelFilter ? { items: { some: { unit: { room: { hotelId } } } } } : {}),
        },
      }),

      // Today's actual check-outs
      prisma.stayRecord.count({
        where: {
          actualCheckOut: { gte: startOfToday, lte: endOfToday },
          status: StayStatus.CHECKED_OUT,
          ...(hasHotelFilter ? { unit: { room: { hotelId } } } : {}),
        },
      }),

      // Today's transfers
      prisma.stayRecord.count({
        where: {
          previousStayRecordId: { not: null },
          createdAt: { gte: startOfToday, lte: endOfToday },
          ...(hasHotelFilter ? { unit: { room: { hotelId } } } : {}),
        },
      }),
    ]);

    // Calculate capacity metrics
    const totalRooms = rooms.length;
    const activeRooms = rooms.filter((r) => r.status === RoomStatus.ACTIVE).length;
    const totalBeds = units.filter((u) => u.type === 'BED').length;
    const totalMats = units.filter((u) => u.type === 'MAT').length;
    const totalCapacity = units.length;

    const maintenanceUnits = units.filter((u) => u.status === UnitStatus.MAINTENANCE).length;
    const occupiedUnits = activeStays.length;
    const occupiedBeds = activeStays.filter((s) => s.unit.type === 'BED').length;
    const occupiedMats = activeStays.filter((s) => s.unit.type === 'MAT').length;

    // Registrations status distribution
    const regStatusDistribution: Record<string, number> = {
      REGISTERED: 0,
      ALLOCATED: 0,
      CONFIRMED: 0,
      CHECKED_IN: 0,
      CHECKED_OUT: 0,
      CANCELLED: 0,
    };
    let totalRegisteredMembers = 0;
    for (const reg of registrations) {
      regStatusDistribution[reg.status] = (regStatusDistribution[reg.status] || 0) + 1;
      totalRegisteredMembers += reg.totalMembers;
    }

    // Gender breakdown in active stays
    const genderOccupancy = {
      male: activeStays.filter((s) => s.unit.genderCategory === 'MALE').length,
      female: activeStays.filter((s) => s.unit.genderCategory === 'FEMALE').length,
      any: activeStays.filter((s) => s.unit.genderCategory === 'ANY').length,
    };

    let totalBookedUnitsCount = 0;
    const categoryStats: Record<string, { totalRooms: number; availableRooms: number; totalBeds: number; availableBeds: number; totalMats: number; availableMats: number; availableUnits: number }> = {
      FEMALE: { totalRooms: 0, availableRooms: 0, totalBeds: 0, availableBeds: 0, totalMats: 0, availableMats: 0, availableUnits: 0 },
      MALE: { totalRooms: 0, availableRooms: 0, totalBeds: 0, availableBeds: 0, totalMats: 0, availableMats: 0, availableUnits: 0 },
      FAMILY: { totalRooms: 0, availableRooms: 0, totalBeds: 0, availableBeds: 0, totalMats: 0, availableMats: 0, availableUnits: 0 },
      GUEST: { totalRooms: 0, availableRooms: 0, totalBeds: 0, availableBeds: 0, totalMats: 0, availableMats: 0, availableUnits: 0 },
      ANY: { totalRooms: 0, availableRooms: 0, totalBeds: 0, availableBeds: 0, totalMats: 0, availableMats: 0, availableUnits: 0 },
    };

    rooms.forEach((r: any) => {
      const cat = r.genderPreference || 'ANY';
      if (categoryStats[cat]) {
        categoryStats[cat].totalRooms++;
      }

      let roomHasFreeUnit = false;

      r.units?.forEach((u: any) => {
        const hasStay = (u.stayRecords?.length || 0) > 0;
        const hasAlloc = (u.allocationItems?.length || 0) > 0;
        const isBookedOrOccupied = hasStay || hasAlloc;
        if (isBookedOrOccupied) {
          totalBookedUnitsCount++;
        }

        if (categoryStats[cat]) {
          if (u.type === 'BED') {
            categoryStats[cat].totalBeds++;
            if (!isBookedOrOccupied) {
              categoryStats[cat].availableBeds++;
              roomHasFreeUnit = true;
            }
          } else {
            categoryStats[cat].totalMats++;
            if (!isBookedOrOccupied) {
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

    // Effective active units (both checked in and reserved under allocations)
    const reservedUnits = Math.max(0, totalBookedUnitsCount - occupiedUnits);
    const totalActiveUnits = Math.min(totalCapacity, occupiedUnits + reservedUnits);
    const availableUnits = Math.max(0, totalCapacity - totalActiveUnits - maintenanceUnits);
    const overallOccupancyRate = totalCapacity > 0 ? Math.round((totalActiveUnits / totalCapacity) * 100) : 0;
    const checkedInRate = totalCapacity > 0 ? Math.round((occupiedUnits / totalCapacity) * 100) : 0;
    const reservedRate = totalCapacity > 0 ? Math.round((reservedUnits / totalCapacity) * 100) : 0;
    const bedOccupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
    const matOccupancyRate = totalMats > 0 ? Math.round((occupiedMats / totalMats) * 100) : 0;

    const roomWiseSummary = rooms.map((r: any) => {
      const bookedUnits = r.units?.filter((u: any) => (u.stayRecords?.length || 0) > 0 || (u.allocationItems?.length || 0) > 0) || [];
      const freeBeds = r.units?.filter((u: any) => u.type === 'BED' && (u.stayRecords?.length || 0) === 0 && (u.allocationItems?.length || 0) === 0) || [];
      const freeMats = r.units?.filter((u: any) => u.type === 'MAT' && (u.stayRecords?.length || 0) === 0 && (u.allocationItems?.length || 0) === 0) || [];
      return {
        roomId: r.id,
        hotelId: r.hotelId,
        hotelName: r.hotel?.name || 'Main Property',
        roomNumber: r.roomNumber,
        building: r.building,
        floor: r.floor,
        category: r.genderPreference,
        totalUnits: r.units?.length || 0,
        bookedUnitsCount: bookedUnits.length,
        availableBeds: freeBeds.length,
        availableMats: freeMats.length,
        availableUnits: freeBeds.length + freeMats.length,
      };
    });

    // Natural numeric sorting for room breakdown
    roomWiseSummary.sort((a: any, b: any) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true, sensitivity: 'base' }));

    return res.json({
      success: true,
      data: {
        sixSummaryCards: {
          totalBookedUnits: totalBookedUnitsCount,
          totalRooms: rooms.length,
          femaleRoomAvailability: categoryStats.FEMALE,
          maleRoomAvailability: categoryStats.MALE,
          familyRoomAvailability: categoryStats.FAMILY,
          guestRoomAvailability: categoryStats.GUEST,
        },
        roomWiseSummary,
        dateRange: {
          startDate: startDate || 'All Time',
          endDate: endDate || 'Current',
          hotelId: hotelId || 'ALL',
        },
        capacity: {
          totalRooms,
          activeRooms,
          totalCapacity,
          totalBeds,
          totalMats,
          occupiedUnits,
          occupiedBeds,
          occupiedMats,
          reservedUnits,
          totalActiveUnits,
          availableUnits,
          maintenanceUnits,
          overallOccupancyRate,
          checkedInRate,
          reservedRate,
          bedOccupancyRate,
          matOccupancyRate,
          genderOccupancy,
        },
        registrations: {
          totalRegistrations: registrations.length,
          totalRegisteredMembers,
          actualParticipantsCreated: participantsCount,
          statusDistribution: regStatusDistribution,
        },
        todayOperations: {
          expectedArrivals: todayArrivals,
          actualCheckIns: todayCheckIns,
          expectedDepartures: todayDepartures,
          actualCheckOuts: todayCheckOuts,
          transfers: todayTransfers,
        },
      },
    });
  } catch (error: any) {
    console.error('Report overview error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate report overview.',
      error: error.message,
    });
  }
}

// ----------------------------------------------------------------------------
// 2. ROOM & BED OCCUPANCY UTILIZATION REPORT
// ----------------------------------------------------------------------------
export async function getOccupancyReport(req: Request, res: Response) {
  try {
    const { startDate, endDate, hotelId } = dateRangeSchema.parse(req.query);
    const hasHotelFilter = Boolean(hotelId && hotelId !== 'ALL');

    const rooms = await prisma.room.findMany({
      where: {
        ...(hasHotelFilter ? { hotelId } : {}),
      },
      include: {
        hotel: {
          select: { id: true, name: true },
        },
        units: {
          orderBy: { unitNumber: 'asc' },
          include: {
            stayRecords: {
              where: {
                status: { in: [StayStatus.CHECKED_IN, StayStatus.EXTENDED] },
                actualCheckOut: null,
              },
              include: {
                participant: {
                  select: {
                    fullName: true,
                    gender: true,
                  },
                },
              },
            },
            allocationItems: {
              where: {
                status: { in: [AllocationItemStatus.TENTATIVE, AllocationItemStatus.CONFIRMED] },
              },
              include: {
                allocation: {
                  select: {
                    id: true,
                    allocationNumber: true,
                    registration: {
                      select: {
                        primaryName: true,
                      },
                    },
                  },
                },
                participant: {
                  select: {
                    fullName: true,
                    gender: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Building & Floor group summaries (Grouped primarily by Hotel Property!)
    const buildingMap: Record<string, any> = {};

    const roomDetails = rooms.map((room) => {
      const hotelName = room.hotel?.name || 'Main Property';
      const bldg = room.building || null;
      const flr = room.floor !== null && room.floor !== undefined ? `Floor ${room.floor}` : null;
      const groupKey = bldg ? `${hotelName} • ${bldg}${flr ? ` (${flr})` : ''}` : (flr ? `${hotelName} • ${flr}` : hotelName);

      if (!buildingMap[groupKey]) {
        buildingMap[groupKey] = {
          groupTitle: groupKey,
          hotelId: room.hotelId || 'DEFAULT',
          hotelName,
          building: bldg || hotelName,
          floor: room.floor ?? 0,
          totalRooms: 0,
          totalBeds: 0,
          totalMats: 0,
          totalCapacity: 0,
          occupiedUnits: 0,
          reservedUnits: 0,
          totalActiveUnits: 0,
          maintenanceUnits: 0,
        };
      }

      const roomBeds = room.units.filter((u) => u.type === 'BED').length;
      const roomMats = room.units.filter((u) => u.type === 'MAT').length;
      const roomCapacity = room.units.length;

      let roomOccupied = 0;
      let roomReserved = 0;
      let roomMaintenance = 0;
      const occupants: any[] = [];

      for (const unit of room.units) {
        if (unit.status === UnitStatus.MAINTENANCE) {
          roomMaintenance++;
        } else if (unit.stayRecords.length > 0) {
          roomOccupied++;
          unit.stayRecords.forEach((stay) => {
            occupants.push({
              unitNumber: unit.unitNumber,
              type: unit.type,
              status: 'CHECKED_IN',
              fullName: stay.participant?.fullName || 'Occupant',
              gender: stay.participant?.gender,
              actualCheckIn: stay.actualCheckIn,
            });
          });
        } else if (unit.allocationItems.length > 0) {
          roomReserved++;
          unit.allocationItems.forEach((item) => {
            occupants.push({
              unitNumber: unit.unitNumber,
              type: unit.type,
              status: 'RESERVED',
              fullName: item.participant?.fullName || item.allocation?.registration?.primaryName || 'Reserved Guest',
              gender: item.participant?.gender,
              actualCheckIn: null,
            });
          });
        }
      }

      const roomTotalActive = roomOccupied + roomReserved;

      // Add to building group
      buildingMap[groupKey].totalRooms += 1;
      buildingMap[groupKey].totalBeds += roomBeds;
      buildingMap[groupKey].totalMats += roomMats;
      buildingMap[groupKey].totalCapacity += roomCapacity;
      buildingMap[groupKey].occupiedUnits += roomOccupied;
      buildingMap[groupKey].reservedUnits += roomReserved;
      buildingMap[groupKey].totalActiveUnits += roomTotalActive;
      buildingMap[groupKey].maintenanceUnits += roomMaintenance;

      const utilization = roomCapacity > 0 ? Math.round((roomTotalActive / roomCapacity) * 100) : 0;

      return {
        id: room.id,
        hotelId: room.hotelId,
        hotelName,
        roomNumber: room.roomNumber,
        building: room.building,
        floor: room.floor,
        genderPreference: room.genderPreference,
        status: room.status,
        totalBeds: roomBeds,
        totalMats: roomMats,
        totalCapacity: roomCapacity,
        occupiedUnits: roomOccupied,
        reservedUnits: roomReserved,
        totalActiveUnits: roomTotalActive,
        maintenanceUnits: roomMaintenance,
        availableUnits: Math.max(0, roomCapacity - roomTotalActive - roomMaintenance),
        utilizationRate: utilization,
        occupants,
      };
    });

    // Natural numeric sorting for room details (e.g. 1, 2, 5, 49, 104, 105)
    roomDetails.sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true, sensitivity: 'base' }));

    const buildingBreakdown = Object.values(buildingMap).map((grp: any) => ({
      ...grp,
      availableUnits: Math.max(0, grp.totalCapacity - grp.totalActiveUnits - grp.maintenanceUnits),
      utilizationRate: grp.totalCapacity > 0 ? Math.round((grp.totalActiveUnits / grp.totalCapacity) * 100) : 0,
    }));

    return res.json({
      success: true,
      data: {
        summary: buildingBreakdown,
        rooms: roomDetails,
      },
    });
  } catch (error: any) {
    console.error('Occupancy report error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate room occupancy report.',
      error: error.message,
    });
  }
}

// ----------------------------------------------------------------------------
// 3. REGISTRATIONS & GEOGRAPHIC REPORT
// ----------------------------------------------------------------------------
export async function getRegistrationReport(req: Request, res: Response) {
  try {
    const { startDate, endDate } = dateRangeSchema.parse(req.query);
    const dateFilter = getDateRangeFilter(startDate, endDate);

    const registrations = await prisma.registration.findMany({
      where: {
        isArchived: false,
        ...(dateFilter ? { createdAt: dateFilter } : {}),
      },
      select: {
        id: true,
        registrationId: true,
        primaryName: true,
        city: true,
        state: true,
        totalMembers: true,
        status: true,
        createdAt: true,
      },
    });

    // 1. Status breakdown
    const statusCounts: Record<string, number> = {};
    // 2. City breakdown
    const cityCounts: Record<string, number> = {};
    // 3. State breakdown
    const stateCounts: Record<string, number> = {};
    // 4. Group size distribution
    const groupSizes = {
      individual: 0, // 1 member
      small: 0,      // 2-3 members
      medium: 0,     // 4-5 members
      large: 0,      // 6+ members
    };
    // 5. Daily trend
    const dailyTrendMap: Record<string, number> = {};

    let totalRegisteredMembers = 0;

    for (const reg of registrations) {
      statusCounts[reg.status] = (statusCounts[reg.status] || 0) + 1;

      const city = reg.city ? reg.city.trim() : 'Unspecified';
      cityCounts[city] = (cityCounts[city] || 0) + 1;

      const state = reg.state ? reg.state.trim() : 'Unspecified';
      stateCounts[state] = (stateCounts[state] || 0) + 1;

      totalRegisteredMembers += reg.totalMembers;

      if (reg.totalMembers === 1) groupSizes.individual++;
      else if (reg.totalMembers <= 3) groupSizes.small++;
      else if (reg.totalMembers <= 5) groupSizes.medium++;
      else groupSizes.large++;

      const dayKey = reg.createdAt.toISOString().slice(0, 10);
      dailyTrendMap[dayKey] = (dailyTrendMap[dayKey] || 0) + 1;
    }

    // Sort top cities
    const topCities = Object.entries(cityCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Sort top states
    const topStates = Object.entries(stateCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Sort daily trend chronologically
    const registrationTrend = Object.entries(dailyTrendMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return res.json({
      success: true,
      data: {
        totalRegistrations: registrations.length,
        totalRegisteredMembers,
        statusBreakdown: statusCounts,
        groupSizeDistribution: groupSizes,
        topCities,
        topStates,
        registrationTrend,
      },
    });
  } catch (error: any) {
    console.error('Registration report error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate registration report.',
      error: error.message,
    });
  }
}

// ----------------------------------------------------------------------------
// 4. PARTICIPANT DEMOGRAPHICS & STATUTORY COMPLIANCE REPORT
// ----------------------------------------------------------------------------
export async function getParticipantReport(req: Request, res: Response) {
  try {
    const { startDate, endDate } = dateRangeSchema.parse(req.query);
    const dateFilter = getDateRangeFilter(startDate, endDate);

    const [participants, aadhaarRecords] = await Promise.all([
      prisma.participant.findMany({
        where: {
          isArchived: false,
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
        select: {
          id: true,
          gender: true,
          age: true,
          isPrimary: true,
          checkInStatus: true,
        },
      }),

      prisma.aadhaarRecord.findMany({
        select: {
          id: true,
          complianceStatus: true,
          retentionConsent: true,
        },
      }),
    ]);

    const genderStats: Record<string, number> = {
      MALE: 0,
      FEMALE: 0,
      OTHER: 0,
      UNKNOWN: 0,
    };

    const ageGroups = {
      minor: 0,   // < 18
      youth: 0,   // 18 - 35
      adult: 0,   // 36 - 60
      senior: 0,  // 60+
      unknown: 0,
    };

    let primaryCount = 0;
    let accompanyingCount = 0;

    for (const p of participants) {
      if (p.isPrimary) primaryCount++;
      else accompanyingCount++;

      const g = p.gender || 'UNKNOWN';
      genderStats[g] = (genderStats[g] || 0) + 1;

      if (p.age === null || p.age === undefined) {
        ageGroups.unknown++;
      } else if (p.age < 18) {
        ageGroups.minor++;
      } else if (p.age <= 35) {
        ageGroups.youth++;
      } else if (p.age <= 60) {
        ageGroups.adult++;
      } else {
        ageGroups.senior++;
      }
    }

    const totalAadhaar = aadhaarRecords.length;
    const consentCount = aadhaarRecords.filter((a) => a.retentionConsent).length;
    const complianceRate = participants.length > 0 ? Math.round((totalAadhaar / participants.length) * 100) : 0;

    return res.json({
      success: true,
      data: {
        totalParticipants: participants.length,
        primaryCount,
        accompanyingCount,
        genderDistribution: genderStats,
        ageGroups,
        aadhaarCompliance: {
          totalParticipants: participants.length,
          aadhaarCollected: totalAadhaar,
          retentionConsentGiven: consentCount,
          compliancePercentage: complianceRate,
        },
      },
    });
  } catch (error: any) {
    console.error('Participant report error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate participant statistics report.',
      error: error.message,
    });
  }
}

// ----------------------------------------------------------------------------
// 5. DAILY OPERATIONAL REPORT (Arrivals, Departures & Turnover Timeline)
// ----------------------------------------------------------------------------
export async function getDailyOperationalReport(req: Request, res: Response) {
  try {
    const { startDate, endDate, hotelId } = dateRangeSchema.parse(req.query);
    const hasHotelFilter = Boolean(hotelId && hotelId !== 'ALL');

    // Default to last 14 days if not supplied
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const start = startDate
      ? new Date(startDate)
      : new Date(end.getTime() - 13 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);

    const [allocations, stayRecords] = await Promise.all([
      prisma.allocation.findMany({
        where: {
          isArchived: false,
          OR: [
            { entryDate: { gte: start, lte: end } },
            { exitDate: { gte: start, lte: end } },
          ],
          ...(hasHotelFilter ? { items: { some: { unit: { room: { hotelId } } } } } : {}),
        },
        select: {
          entryDate: true,
          exitDate: true,
        },
      }),

      prisma.stayRecord.findMany({
        where: {
          OR: [
            { actualCheckIn: { gte: start, lte: end } },
            { actualCheckOut: { gte: start, lte: end } },
            { previousStayRecordId: { not: null }, createdAt: { gte: start, lte: end } },
          ],
          ...(hasHotelFilter ? { unit: { room: { hotelId } } } : {}),
        },
        select: {
          actualCheckIn: true,
          actualCheckOut: true,
          previousStayRecordId: true,
          createdAt: true,
        },
      }),
    ]);

    // Build day map
    const dayMap: Record<string, any> = {};
    const curr = new Date(start);
    while (curr <= end) {
      const dateKey = curr.toISOString().slice(0, 10);
      dayMap[dateKey] = {
        date: dateKey,
        expectedArrivals: 0,
        actualCheckIns: 0,
        expectedDepartures: 0,
        actualCheckOuts: 0,
        transfers: 0,
      };
      curr.setDate(curr.getDate() + 1);
    }

    for (const a of allocations) {
      const entryKey = a.entryDate.toISOString().slice(0, 10);
      if (dayMap[entryKey]) dayMap[entryKey].expectedArrivals++;

      const exitKey = a.exitDate.toISOString().slice(0, 10);
      if (dayMap[exitKey]) dayMap[exitKey].expectedDepartures++;
    }

    for (const s of stayRecords) {
      const checkInKey = s.actualCheckIn.toISOString().slice(0, 10);
      if (dayMap[checkInKey]) dayMap[checkInKey].actualCheckIns++;

      if (s.actualCheckOut) {
        const checkOutKey = s.actualCheckOut.toISOString().slice(0, 10);
        if (dayMap[checkOutKey]) dayMap[checkOutKey].actualCheckOuts++;
      }

      if (s.previousStayRecordId) {
        const transferKey = s.createdAt.toISOString().slice(0, 10);
        if (dayMap[transferKey]) dayMap[transferKey].transfers++;
      }
    }

    const timeline = Object.values(dayMap).sort((a: any, b: any) =>
      a.date.localeCompare(b.date)
    );

    return res.json({
      success: true,
      data: timeline,
    });
  } catch (error: any) {
    console.error('Daily operational report error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate daily operational timeline report.',
      error: error.message,
    });
  }
}

// ----------------------------------------------------------------------------
// 6. EXCEL REPORT EXPORT (Multi-Sheet Comprehensive Workbook)
// ----------------------------------------------------------------------------
export async function exportReportExcel(req: Request, res: Response) {
  try {
    const { startDate, endDate, hotelId } = dateRangeSchema.parse(req.query);
    const hasHotelFilter = Boolean(hotelId && hotelId !== 'ALL');

    const [rooms, units, activeStays, registrations, dailyStats] = await Promise.all([
      // Rooms & Capacity
      prisma.room.findMany({
        where: hasHotelFilter ? { hotelId } : {},
        include: {
          hotel: { select: { id: true, name: true } },
          units: true,
        },
      }),

      prisma.accommodationUnit.findMany({
        where: hasHotelFilter ? { room: { hotelId } } : {},
      }),

      // Active stays
      prisma.stayRecord.findMany({
        where: {
          status: { in: [StayStatus.CHECKED_IN, StayStatus.EXTENDED] },
          actualCheckOut: null,
          ...(hasHotelFilter ? { unit: { room: { hotelId } } } : {}),
        },
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
              room: { select: { roomNumber: true } },
            },
          },
          registration: {
            select: {
              registrationId: true,
              primaryName: true,
              mobile: true,
            },
          },
        },
      }),

      // Registrations
      prisma.registration.findMany({
        where: { isArchived: false },
        orderBy: { createdAt: 'desc' },
        take: 2000,
        select: {
          registrationId: true,
          primaryName: true,
          mobile: true,
          city: true,
          state: true,
          totalMembers: true,
          status: true,
          createdAt: true,
        },
      }),

      // Recent 14-day operations
      prisma.stayRecord.findMany({
        where: {
          createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
        },
        select: {
          actualCheckIn: true,
          actualCheckOut: true,
          previousStayRecordId: true,
          createdAt: true,
        },
      }),
    ]);

    rooms.sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true, sensitivity: 'base' }));

    const workbook = XLSX.utils.book_new();

    // SHEET 1: Executive KPI Summary
    const summaryRows = [
      { Metric: 'Report Generation Timestamp', Value: new Date().toISOString() },
      { Metric: 'Hotel Property Scope', Value: hasHotelFilter ? 'Filtered Property' : 'All Properties' },
      { Metric: 'Total Configured Rooms', Value: rooms.length },
      { Metric: 'Total Accommodation Capacity (Beds + Mats)', Value: units.length },
      { Metric: 'Total Beds', Value: units.filter((u) => u.type === 'BED').length },
      { Metric: 'Total Mats', Value: units.filter((u) => u.type === 'MAT').length },
      { Metric: 'Currently Occupied Units', Value: activeStays.length },
      { Metric: 'Units Under Maintenance', Value: units.filter((u) => u.status === 'MAINTENANCE').length },
      { Metric: 'Available Units for Allocation', Value: Math.max(0, units.length - activeStays.length) },
      {
        Metric: 'Overall Capacity Utilization (%)',
        Value: `${units.length > 0 ? Math.round((activeStays.length / units.length) * 100) : 0}%`,
      },
      { Metric: 'Total Registrations Handled', Value: registrations.length },
      { Metric: 'Privacy Compliance Status', Value: 'Aadhaar numbers strictly omitted & redacted' },
    ];
    const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
    summarySheet['!cols'] = [{ wch: 40 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Executive Summary');

    // SHEET 2: Room & Unit Inventory Breakdown
    const roomRows = rooms.map((r, i) => {
      const beds = r.units.filter((u) => u.type === 'BED').length;
      const mats = r.units.filter((u) => u.type === 'MAT').length;
      const occupied = activeStays.filter((s) => s.unit.room.roomNumber === r.roomNumber).length;
      const util = r.units.length > 0 ? Math.round((occupied / r.units.length) * 100) : 0;

      return {
        Index: i + 1,
        Hotel: (r as any).hotel?.name || 'Main Property',
        'Room Number': r.roomNumber,
        Building: r.building || (r as any).hotel?.name || 'Main Block',
        Floor: r.floor ?? 0,
        Status: r.status,
        'Gender Preference': r.genderPreference,
        'Total Beds': beds,
        'Total Mats': mats,
        'Total Capacity': r.units.length,
        'Occupied Count': occupied,
        'Utilization (%)': `${util}%`,
      };
    });
    const roomSheet = XLSX.utils.json_to_sheet(roomRows);
    roomSheet['!cols'] = [
      { wch: 8 },
      { wch: 22 },
      { wch: 16 },
      { wch: 18 },
      { wch: 10 },
      { wch: 14 },
      { wch: 20 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(workbook, roomSheet, 'Room Utilization');

    // SHEET 3: Current In-House Guests Roster
    const guestRows = activeStays.map((s, i) => ({
      Index: i + 1,
      'Registration ID': s.registration.registrationId,
      'Primary Registrant': s.registration.primaryName,
      'Mobile Contact': `+91 ${s.registration.mobile}`,
      'Guest Full Name': s.participant.fullName,
      'Gender': s.participant.gender || 'N/A',
      'Age': s.participant.age || 'N/A',
      'Room Number': s.unit.room.roomNumber,
      'Unit Number': s.unit.unitNumber,
      'Unit Type': s.unit.type,
      'Actual Check-in Time': s.actualCheckIn.toISOString(),
      'Identity Status': 'Verified (Statutory Masked)',
    }));
    const guestSheet = XLSX.utils.json_to_sheet(guestRows);
    guestSheet['!cols'] = [
      { wch: 8 },
      { wch: 18 },
      { wch: 24 },
      { wch: 18 },
      { wch: 24 },
      { wch: 10 },
      { wch: 8 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
      { wch: 24 },
      { wch: 24 },
    ];
    XLSX.utils.book_append_sheet(workbook, guestSheet, 'Active In-House Roster');

    // SHEET 4: Registrations Log
    const regRows = registrations.map((reg, i) => ({
      Index: i + 1,
      'Registration ID': reg.registrationId,
      'Primary Name': reg.primaryName,
      'Mobile Number': `+91 ${reg.mobile}`,
      City: reg.city || 'N/A',
      State: reg.state || 'N/A',
      'Total Members': reg.totalMembers,
      Status: reg.status,
      'Registered Date': reg.createdAt.toISOString().slice(0, 10),
    }));
    const regSheet = XLSX.utils.json_to_sheet(regRows);
    regSheet['!cols'] = [
      { wch: 8 },
      { wch: 18 },
      { wch: 24 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(workbook, regSheet, 'Registrations Directory');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    const filename = `accommodation-operational-report-${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(excelBuffer);
  } catch (error: any) {
    console.error('Excel report export error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to export Excel report.',
      error: error.message,
    });
  }
}

// ----------------------------------------------------------------------------
// 7. PDF EXECUTIVE REPORT EXPORT
// ----------------------------------------------------------------------------
export async function exportReportPdf(req: Request, res: Response) {
  try {
    const { startDate, endDate, hotelId } = dateRangeSchema.parse(req.query);
    const hasHotelFilter = Boolean(hotelId && hotelId !== 'ALL');

    const [rooms, units, activeStays, registrations] = await Promise.all([
      prisma.room.findMany({
        where: hasHotelFilter ? { hotelId } : {},
        include: { hotel: { select: { id: true, name: true } }, units: true },
      }),
      prisma.accommodationUnit.findMany({
        where: hasHotelFilter ? { room: { hotelId } } : {},
      }),
      prisma.stayRecord.findMany({
        where: {
          status: { in: [StayStatus.CHECKED_IN, StayStatus.EXTENDED] },
          actualCheckOut: null,
          ...(hasHotelFilter ? { unit: { room: { hotelId } } } : {}),
        },
      }),
      prisma.registration.findMany({ where: { isArchived: false } }),
    ]);

    const totalCapacity = units.length;
    const occupiedUnits = activeStays.length;
    const availableUnits = Math.max(0, totalCapacity - occupiedUnits);
    const occupancyRate = totalCapacity > 0 ? Math.round((occupiedUnits / totalCapacity) * 100) : 0;

    // Building table rows
    const buildingMap: Record<string, { bldg: string; cap: number; occ: number }> = {};
    for (const r of rooms) {
      const bldg = (r as any).hotel?.name || r.building || 'Main Block';
      if (!buildingMap[bldg]) buildingMap[bldg] = { bldg, cap: 0, occ: 0 };
      buildingMap[bldg].cap += r.units.length;
      buildingMap[bldg].occ += activeStays.filter((s) => s.unitId && r.units.some((u) => u.id === s.unitId)).length;
    }

    const buildingRows = Object.values(buildingMap).map((b) => [
      b.bldg,
      b.cap,
      b.occ,
      b.cap - b.occ,
      `${b.cap > 0 ? Math.round((b.occ / b.cap) * 100) : 0}%`,
    ]);

    // Top room utilization rows
    const roomSampleRows = rooms.slice(0, 10).map((r) => {
      const cap = r.units.length;
      const occ = activeStays.filter((s) => r.units.some((u) => u.id === s.unitId)).length;
      const util = cap > 0 ? Math.round((occ / cap) * 100) : 0;
      return [r.roomNumber, r.building || 'Main', cap, occ, `${util}%`];
    });

    const pdfBuffer = await generateOperationalPdfReport({
      title: 'Executive Accommodation & Occupancy Briefing',
      subtitle: 'Comprehensive audit overview of room inventory, active guest occupancy, and capacity utilization',
      generatedBy: req.user?.name || 'Administrator',
      generatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
      dateRange: 'Current Operational Snapshot',
      metrics: [
        { label: 'Total Capacity', value: totalCapacity },
        { label: 'Occupied Units', value: occupiedUnits },
        { label: 'Available Units', value: availableUnits },
        { label: 'Utilization Rate', value: `${occupancyRate}%` },
      ],
      tables: [
        {
          title: 'Building-Wise Capacity Breakdown',
          headers: ['Building Block', 'Total Capacity', 'Occupied', 'Available', 'Occupancy %'],
          rows: buildingRows,
        },
        {
          title: 'Room Inventory Snapshot (Sample 10 Rooms)',
          headers: ['Room Number', 'Building', 'Capacity', 'Occupied', 'Utilization'],
          rows: roomSampleRows,
        },
      ],
    });

    const filename = `accommodation-briefing-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(pdfBuffer);
  } catch (error: any) {
    console.error('PDF report export error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate PDF report.',
      error: error.message,
    });
  }
}
