import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { StayStatus } from '@prisma/client';

// Validation schema for global search query
const searchQuerySchema = z.object({
  q: z.string().trim().min(1, 'Search query is required').max(100),
  limit: z.coerce.number().int().min(1).max(50).default(15),
  type: z
    .enum(['ALL', 'REGISTRATION', 'ALLOCATION', 'ROOM', 'UNIT', 'PARTICIPANT'])
    .default('ALL'),
});

export interface SearchResultItem {
  id: string;
  type: 'REGISTRATION' | 'ALLOCATION' | 'ROOM' | 'UNIT' | 'PARTICIPANT';
  title: string;
  subtitle: string;
  badge: string;
  link: string;
  metadata: Record<string, any>;
}

export async function globalSearch(req: Request, res: Response) {
  const parseResult = searchQuerySchema.safeParse(req.query);
  if (!parseResult.success) {
    return res.status(400).json({
      success: false,
      message: 'Invalid search parameters.',
      errors: parseResult.error.flatten().fieldErrors,
    });
  }

  const { q, limit, type } = parseResult.data;
  const searchTerm = q.trim();
  const searchPattern = `%${searchTerm}%`;

  const results: SearchResultItem[] = [];
  const perTypeLimit = Math.max(3, Math.ceil(limit / 3));

  try {
    const promises: Promise<void>[] = [];

    // 1. REGISTRATIONS SEARCH
    if (type === 'ALL' || type === 'REGISTRATION') {
      promises.push(
        (async () => {
          const registrations = await prisma.registration.findMany({
            where: {
              isArchived: false,
              OR: [
                { registrationId: { contains: searchTerm, mode: 'insensitive' } },
                { primaryName: { contains: searchTerm, mode: 'insensitive' } },
                { mobile: { contains: searchTerm } },
                { city: { contains: searchTerm, mode: 'insensitive' } },
              ],
            },
            take: perTypeLimit,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              registrationId: true,
              primaryName: true,
              mobile: true,
              city: true,
              state: true,
              totalMembers: true,
              status: true,
            },
          });

          for (const reg of registrations) {
            results.push({
              id: reg.id,
              type: 'REGISTRATION',
              title: `${reg.registrationId}: ${reg.primaryName}`,
              subtitle: `+91 ${reg.mobile} • ${reg.totalMembers} Member${reg.totalMembers > 1 ? 's' : ''} • ${reg.city || 'N/A'}`,
              badge: reg.status,
              link: `/dashboard/registrations/${reg.id}`,
              metadata: {
                registrationId: reg.registrationId,
                status: reg.status,
                mobile: reg.mobile,
              },
            });
          }
        })()
      );
    }

    // 2. ALLOCATIONS SEARCH
    if (type === 'ALL' || type === 'ALLOCATION') {
      promises.push(
        (async () => {
          const allocations = await prisma.allocation.findMany({
            where: {
              isArchived: false,
              OR: [
                { allocationNumber: { contains: searchTerm, mode: 'insensitive' } },
                {
                  registration: {
                    OR: [
                      { registrationId: { contains: searchTerm, mode: 'insensitive' } },
                      { primaryName: { contains: searchTerm, mode: 'insensitive' } },
                      { mobile: { contains: searchTerm } },
                    ],
                  },
                },
              ],
            },
            take: perTypeLimit,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              allocationNumber: true,
              status: true,
              entryDate: true,
              exitDate: true,
              registration: {
                select: {
                  id: true,
                  registrationId: true,
                  primaryName: true,
                  mobile: true,
                },
              },
              items: {
                select: {
                  unit: {
                    select: {
                      unitNumber: true,
                      type: true,
                      room: { select: { roomNumber: true } },
                    },
                  },
                },
              },
            },
          });

          for (const alc of allocations) {
            const unitSummary = alc.items
              .slice(0, 3)
              .map((it: { unit: { room: { roomNumber: string }; unitNumber: string; type: any } }) => `${it.unit.room.roomNumber}-${it.unit.unitNumber}`)
              .join(', ');
            const extraCount = alc.items.length > 3 ? ` +${alc.items.length - 3} more` : '';

            results.push({
              id: alc.id,
              type: 'ALLOCATION',
              title: `${alc.allocationNumber} (${alc.registration.primaryName})`,
              subtitle: `Reg: ${alc.registration.registrationId} • ${alc.items.length} Units [${unitSummary}${extraCount}]`,
              badge: alc.status,
              link: `/dashboard/allocate?search=${alc.allocationNumber}`,
              metadata: {
                allocationNumber: alc.allocationNumber,
                registrationId: alc.registration.registrationId,
                status: alc.status,
              },
            });
          }
        })()
      );
    }

    // 3. ROOMS SEARCH
    if (type === 'ALL' || type === 'ROOM') {
      promises.push(
        (async () => {
          const rooms = await prisma.room.findMany({
            where: {
              OR: [
                { roomNumber: { contains: searchTerm, mode: 'insensitive' } },
                { building: { contains: searchTerm, mode: 'insensitive' } },
              ],
            },
            take: perTypeLimit,
            orderBy: { roomNumber: 'asc' },
            select: {
              id: true,
              roomNumber: true,
              building: true,
              floor: true,
              status: true,
              totalBeds: true,
              totalMats: true,
              genderPreference: true,
            },
          });

          for (const r of rooms) {
            results.push({
              id: r.id,
              type: 'ROOM',
              title: `Room ${r.roomNumber}`,
              subtitle: `${r.building ? `${r.building}, ` : ''}Floor ${r.floor} • ${r.totalBeds} Beds, ${r.totalMats} Mats • ${r.genderPreference}`,
              badge: r.status,
              link: `/dashboard/rooms?search=${r.roomNumber}`,
              metadata: {
                roomNumber: r.roomNumber,
                status: r.status,
                building: r.building,
              },
            });
          }
        })()
      );
    }

    // 4. ACCOMMODATION UNITS SEARCH (Beds / Mats)
    if (type === 'ALL' || type === 'UNIT') {
      promises.push(
        (async () => {
          const units = await prisma.accommodationUnit.findMany({
            where: {
              OR: [
                { unitNumber: { contains: searchTerm, mode: 'insensitive' } },
                { room: { roomNumber: { contains: searchTerm, mode: 'insensitive' } } },
              ],
            },
            take: perTypeLimit,
            orderBy: [{ room: { roomNumber: 'asc' } }, { unitNumber: 'asc' }],
            select: {
              id: true,
              unitNumber: true,
              type: true,
              genderCategory: true,
              status: true,
              room: {
                select: {
                  id: true,
                  roomNumber: true,
                  building: true,
                },
              },
            },
          });

          for (const u of units) {
            results.push({
              id: u.id,
              type: 'UNIT',
              title: `${u.type === 'BED' ? 'Bed' : 'Mat'} ${u.unitNumber} (Room ${u.room.roomNumber})`,
              subtitle: `${u.room.building ? `${u.room.building} • ` : ''}${u.genderCategory} • Status: ${u.status}`,
              badge: u.status,
              link: `/dashboard/rooms?search=${u.room.roomNumber}`,
              metadata: {
                unitNumber: u.unitNumber,
                roomNumber: u.room.roomNumber,
                unitType: u.type,
                status: u.status,
              },
            });
          }
        })()
      );
    }

    // 5. PARTICIPANTS SEARCH (Arrived / Accommodated Individuals)
    if (type === 'ALL' || type === 'PARTICIPANT') {
      promises.push(
        (async () => {
          const participants = await prisma.participant.findMany({
            where: {
              isArchived: false,
              fullName: { contains: searchTerm, mode: 'insensitive' },
            },
            take: perTypeLimit,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              fullName: true,
              gender: true,
              age: true,
              relationToPrimary: true,
              isPrimary: true,
              checkInStatus: true,
              registration: {
                select: {
                  id: true,
                  registrationId: true,
                  primaryName: true,
                  mobile: true,
                },
              },
              stayRecords: {
                where: {
                  status: { in: [StayStatus.CHECKED_IN, StayStatus.EXTENDED] },
                  actualCheckOut: null,
                },
                take: 1,
                select: {
                  unit: {
                    select: {
                      unitNumber: true,
                      room: { select: { roomNumber: true } },
                    },
                  },
                },
              },
            },
          });

          for (const p of participants) {
            const activeStay = p.stayRecords[0];
            const stayLocation = activeStay
              ? ` • Room ${activeStay.unit.room.roomNumber} (${activeStay.unit.unitNumber})`
              : '';

            results.push({
              id: p.id,
              type: 'PARTICIPANT',
              title: `${p.fullName}${p.isPrimary ? ' (Primary)' : ''}`,
              subtitle: `Reg: ${p.registration.registrationId} • ${p.gender}${p.age ? `, ${p.age}y` : ''}${stayLocation}`,
              badge: p.checkInStatus,
              link: `/dashboard/reception?search=${p.registration.registrationId}`,
              metadata: {
                registrationId: p.registration.registrationId,
                checkInStatus: p.checkInStatus,
                isPrimary: p.isPrimary,
              },
            });
          }
        })()
      );
    }

    await Promise.all(promises);

    // Limit final array to requested limit
    const finalResults = results.slice(0, limit);

    return res.json({
      success: true,
      query: searchTerm,
      total: finalResults.length,
      data: finalResults,
    });
  } catch (error: any) {
    console.error('Global search error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to perform global search.',
      error: error.message,
    });
  }
}
