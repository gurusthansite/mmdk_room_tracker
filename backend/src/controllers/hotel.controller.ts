import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { ActionType, RoomStatus } from '@prisma/client';

export const createHotelSchema = z.object({
  name: z.string().trim().min(1, 'Hotel name is required'),
  address: z.string().trim().optional().nullable(),
  contactPhone: z.string().trim().optional().nullable(),
  contactEmail: z.string().trim().email('Invalid email').optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

export const updateHotelSchema = z.object({
  name: z.string().trim().min(1, 'Hotel name is required').optional(),
  address: z.string().trim().optional().nullable(),
  contactPhone: z.string().trim().optional().nullable(),
  contactEmail: z.string().trim().email('Invalid email').optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

/**
 * List all hotels with room and capacity counts.
 */
export async function listHotels(req: Request, res: Response) {
  try {
    const { q } = req.query;
    const whereClause: any = {};

    if (typeof q === 'string' && q.trim()) {
      whereClause.OR = [
        { name: { contains: q.trim(), mode: 'insensitive' } },
        { address: { contains: q.trim(), mode: 'insensitive' } },
        { contactPhone: { contains: q.trim(), mode: 'insensitive' } },
      ];
    }

    const hotels = await prisma.hotel.findMany({
      where: whereClause,
      include: {
        rooms: {
          include: {
            units: true,
          },
          orderBy: { roomNumber: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    const formatted = hotels.map((h) => {
      let totalBeds = 0;
      let totalMats = 0;
      let activeRooms = 0;

      for (const r of h.rooms) {
        if (r.status === RoomStatus.ACTIVE) activeRooms++;
        totalBeds += r.units.filter((u) => u.type === 'BED').length;
        totalMats += r.units.filter((u) => u.type === 'MAT').length;
      }

      return {
        id: h.id,
        name: h.name,
        address: h.address,
        contactPhone: h.contactPhone,
        contactEmail: h.contactEmail,
        notes: h.notes,
        createdAt: h.createdAt,
        updatedAt: h.updatedAt,
        roomCount: h.rooms.length,
        activeRooms,
        totalBeds,
        totalMats,
        totalCapacity: totalBeds + totalMats,
        rooms: h.rooms.map((r) => ({
          id: r.id,
          roomNumber: r.roomNumber,
          floor: r.floor,
          genderPreference: r.genderPreference,
          status: r.status,
          totalBeds: r.units.filter((u) => u.type === 'BED').length,
          totalMats: r.units.filter((u) => u.type === 'MAT').length,
        })),
      };
    });

    return res.json({
      success: true,
      data: formatted,
    });
  } catch (err: any) {
    console.error('Error listing hotels:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to list hotels',
    });
  }
}

/**
 * Get a single hotel with its rooms.
 */
export async function getHotelById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const hotel = await prisma.hotel.findUnique({
      where: { id },
      include: {
        rooms: {
          include: {
            units: true,
          },
          orderBy: { roomNumber: 'asc' },
        },
      },
    });

    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: 'Hotel not found',
      });
    }

    let totalBeds = 0;
    let totalMats = 0;
    for (const r of hotel.rooms) {
      totalBeds += r.units.filter((u) => u.type === 'BED').length;
      totalMats += r.units.filter((u) => u.type === 'MAT').length;
    }

    return res.json({
      success: true,
      data: {
        ...hotel,
        totalBeds,
        totalMats,
        totalCapacity: totalBeds + totalMats,
      },
    });
  } catch (err: any) {
    console.error('Error fetching hotel:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to retrieve hotel',
    });
  }
}

/**
 * Create a new hotel (empty or without rooms initially).
 */
export async function createHotel(req: Request, res: Response) {
  try {
    const parsed = createHotelSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parsed.error.errors,
      });
    }

    const { name, address, contactPhone, contactEmail, notes } = parsed.data;

    const existing = await prisma.hotel.findUnique({
      where: { name },
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Hotel with name '${name}' already exists.`,
      });
    }

    const hotel = await prisma.hotel.create({
      data: {
        name,
        address: address || null,
        contactPhone: contactPhone || null,
        contactEmail: contactEmail || null,
        notes: notes || null,
      },
    });

    if (req.user) {
      await prisma.activityLog.create({
        data: {
          entityType: 'HOTEL',
          entityId: hotel.id,
          action: ActionType.CREATE,
          userId: req.user.id,
          details: { name, address, contactPhone },
        },
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Hotel created successfully',
      data: hotel,
    });
  } catch (err: any) {
    console.error('Error creating hotel:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to create hotel',
    });
  }
}

/**
 * Update an existing hotel.
 */
export async function updateHotel(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const parsed = updateHotelSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parsed.error.errors,
      });
    }

    const hotel = await prisma.hotel.findUnique({ where: { id } });
    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: 'Hotel not found',
      });
    }

    const updated = await prisma.hotel.update({
      where: { id },
      data: parsed.data,
    });

    if (req.user) {
      await prisma.activityLog.create({
        data: {
          entityType: 'HOTEL',
          entityId: updated.id,
          action: ActionType.UPDATE,
          userId: req.user.id,
          details: parsed.data,
        },
      });
    }

    return res.json({
      success: true,
      message: 'Hotel updated successfully',
      data: updated,
    });
  } catch (err: any) {
    console.error('Error updating hotel:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to update hotel',
    });
  }
}

/**
 * Delete a hotel (only if it has no rooms assigned).
 */
export async function deleteHotel(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const hotel = await prisma.hotel.findUnique({
      where: { id },
      include: { rooms: true },
    });

    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: 'Hotel not found',
      });
    }

    if (hotel.rooms.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete hotel '${hotel.name}' because it still contains ${hotel.rooms.length} room(s). Reassign or delete the rooms first.`,
      });
    }

    await prisma.hotel.delete({
      where: { id },
    });

    if (req.user) {
      await prisma.activityLog.create({
        data: {
          entityType: 'HOTEL',
          entityId: id,
          action: ActionType.DELETE,
          userId: req.user.id,
          details: { name: hotel.name },
        },
      });
    }

    return res.json({
      success: true,
      message: `Hotel '${hotel.name}' deleted successfully`,
    });
  } catch (err: any) {
    console.error('Error deleting hotel:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to delete hotel',
    });
  }
}
