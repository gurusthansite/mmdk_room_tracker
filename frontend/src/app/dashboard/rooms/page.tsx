'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building, 
  Bed, 
  Layers, 
  Plus, 
  Search, 
  Filter, 
  Edit2, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Info, 
  ShieldAlert, 
  Eye, 
  UserCheck, 
  Clock, 
  Check,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  SlidersHorizontal,
  Wrench,
  Users,
  MapPin,
  Phone,
  Mail
} from 'lucide-react';
import { 
  api, 
  RoomListItem, 
  RoomDetail, 
  AccommodationUnitItem, 
  CreateRoomInput, 
  UpdateRoomInput, 
  AddUnitInput,
  VisualUnitState,
  GenderPreference,
  RoomStatus,
  GenderCategory,
  UnitType,
  UnitStatus,
  HotelListItem,
  CreateHotelInput,
  UpdateHotelInput,
  CreateBulkRoomsInput,
  BulkRoomGroupInput
} from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';

interface RoomGroupForm {
  id: string;
  roomNumbersText: string;
  building?: string;
  floor?: number;
  genderPreference: GenderPreference;
  status: RoomStatus;
  notes: string;
  totalBeds: number;
  totalMats: number;
}

function parseRoomTokens(input: string): string[] {
  if (!input || !input.trim()) return [];
  const rawParts = input.split(/[\n,;]+/).map((p) => p.trim()).filter(Boolean);
  const result: string[] = [];
  const seen = new Set<string>();

  for (const part of rawParts) {
    const rangeMatch = part.match(/^([A-Za-z_-]*)(\d+)\s*[-~to]+\s*([A-Za-z_-]*)(\d+)$/i);
    if (rangeMatch) {
      const prefix1 = rangeMatch[1];
      const startNum = parseInt(rangeMatch[2], 10);
      const prefix2 = rangeMatch[3];
      const endNum = parseInt(rangeMatch[4], 10);
      const prefix = prefix1 || prefix2 || '';

      if (!isNaN(startNum) && !isNaN(endNum) && startNum <= endNum && endNum - startNum <= 100) {
        for (let i = startNum; i <= endNum; i++) {
          const room = `${prefix}${i}`;
          if (!seen.has(room.toLowerCase())) {
            seen.add(room.toLowerCase());
            result.push(room);
          }
        }
        continue;
      }
    }

    const spaceTokens = part.split(/\s+/).filter(Boolean);
    if (spaceTokens.length > 1 && spaceTokens.every((t) => /^[A-Za-z0-9_-]+$/.test(t))) {
      for (const tok of spaceTokens) {
        if (!seen.has(tok.toLowerCase())) {
          seen.add(tok.toLowerCase());
          result.push(tok);
        }
      }
      continue;
    }

    if (!seen.has(part.toLowerCase())) {
      seen.add(part.toLowerCase());
      result.push(part);
    }
  }

  return result;
}

export default function RoomsPage() {
  const { user } = useAuth();
  const canManageRooms = user?.role === 'SUPER_ADMIN' || user?.role === 'ALLOCATION_MANAGER';
  const canEditUnits = canManageRooms;

  // Strict RBAC: Reception staff are blocked from room inventory management
  if (user?.role === 'RECEPTION_STAFF') {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white border border-slate-200 rounded-2xl shadow-xl text-center space-y-4">
        <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Access Restricted</h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          Reception staff accounts do not have permission to manage room inventory, modify rooms, or alter bed setups. Please use the Reception Desk for live room availability and allocations.
        </p>
        <a
          href="/dashboard/reception"
          className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-sm transition"
        >
          Go to Reception Desk &rarr;
        </a>
      </div>
    );
  }

  const { success: notifySuccess, error: notifyError, warning: notifyWarning, info: notifyInfo } = useNotification();

  // State
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [errorMessage, _setErrorMessage] = useState<string | null>(null);
  const [successMessage, _setSuccessMessage] = useState<string | null>(null);

  const setSuccessMessage = React.useCallback((msg: string | null) => {
    _setSuccessMessage(msg);
    if (msg) notifySuccess(msg);
  }, [notifySuccess]);

  const setErrorMessage = React.useCallback((msg: string | null) => {
    _setErrorMessage(msg);
    if (msg) notifyError(msg);
  }, [notifyError]);

  // Main view switcher
  const [mainView, setMainView] = useState<'ROOMS' | 'HOTELS'>('ROOMS');

  // Hotels State
  const [hotels, setHotels] = useState<HotelListItem[]>([]);
  const [hotelFilter, setHotelFilter] = useState<string>('ALL');
  const [isAddHotelOpen, setIsAddHotelOpen] = useState<boolean>(false);
  const [isEditHotelOpen, setIsEditHotelOpen] = useState<boolean>(false);
  const [isDeleteHotelOpen, setIsDeleteHotelOpen] = useState<boolean>(false);
  const [editingHotel, setEditingHotel] = useState<HotelListItem | null>(null);
  const [hotelToDelete, setHotelToDelete] = useState<HotelListItem | null>(null);

  const [newHotelForm, setNewHotelForm] = useState<CreateHotelInput>({
    name: '',
    address: '',
    contactPhone: '',
    contactEmail: '',
    notes: '',
  });

  const [editHotelForm, setEditHotelForm] = useState<UpdateHotelInput>({
    name: '',
    address: '',
    contactPhone: '',
    contactEmail: '',
    notes: '',
  });

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [buildingFilter, setBuildingFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [genderFilter, setGenderFilter] = useState<string>('ALL');

  // Selected Room for Visual Layout Grid
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedRoomDetail, setSelectedRoomDetail] = useState<RoomDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Modals
  const [isAddRoomOpen, setIsAddRoomOpen] = useState<boolean>(false);
  const [isEditRoomOpen, setIsEditRoomOpen] = useState<boolean>(false);
  const [isAddUnitOpen, setIsAddUnitOpen] = useState<boolean>(false);
  const [isEditUnitOpen, setIsEditUnitOpen] = useState<boolean>(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState<boolean>(false);
  const [selectedRoomIdsForBulk, setSelectedRoomIdsForBulk] = useState<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState<boolean>(false);
  const [bulkTargetHotelId, setBulkTargetHotelId] = useState<string>('');

  // Modal data states
  const [editingRoom, setEditingRoom] = useState<RoomListItem | null>(null);
  const [roomToDelete, setRoomToDelete] = useState<RoomListItem | null>(null);
  const [editingUnit, setEditingUnit] = useState<AccommodationUnitItem | null>(null);

  // Add Room (Multi-Room & Batch Provisioning) State
  const [selectedHotelForAdd, setSelectedHotelForAdd] = useState<string>('');
  const [roomGroups, setRoomGroups] = useState<RoomGroupForm[]>([
    {
      id: 'grp_1',
      roomNumbersText: '',
      genderPreference: 'MALE',
      status: 'ACTIVE',
      notes: '',
      totalBeds: 4,
      totalMats: 2,
    },
  ]);

  // Backward compatibility state if referenced
  const [newRoom, setNewRoom] = useState<CreateRoomInput>({
    roomNumber: '',
    hotelId: '',
    building: '',
    floor: 1,
    genderPreference: 'MALE',
    status: 'ACTIVE',
    notes: '',
    totalBeds: 4,
    totalMats: 2,
  });

  // Dynamic summary for the Add Room Modal
  const modalSummary = useMemo(() => {
    let totalRooms = 0;
    let totalBeds = 0;
    let totalMats = 0;
    const roomList: string[] = [];

    roomGroups.forEach((g) => {
      const tokens = parseRoomTokens(g.roomNumbersText);
      totalRooms += tokens.length;
      totalBeds += tokens.length * (Number(g.totalBeds) || 0);
      totalMats += tokens.length * (Number(g.totalMats) || 0);
      roomList.push(...tokens);
    });

    return {
      totalRooms,
      totalBeds,
      totalMats,
      totalUnits: totalBeds + totalMats,
      roomList,
    };
  }, [roomGroups]);

  // Edit Room Form State
  const [editRoomForm, setEditRoomForm] = useState<UpdateRoomInput>({
    hotelId: '',
    building: '',
    floor: 1,
    genderPreference: 'ANY',
    status: 'ACTIVE',
    notes: '',
  });

  // Add Unit Form State
  const [newUnit, setNewUnit] = useState<AddUnitInput>({
    unitNumber: '',
    type: 'BED',
    genderCategory: 'ANY',
    status: 'ACTIVE',
    notes: '',
  });

  // Edit Unit Form State
  const [editUnitForm, setEditUnitForm] = useState<{
    genderCategory: GenderCategory;
    status: UnitStatus;
    notes: string;
  }>({
    genderCategory: 'ANY',
    status: 'ACTIVE',
    notes: '',
  });

  // Auto-dismiss notification after 5s
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 7000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  // Load Rooms list
  const fetchRooms = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.getRooms();
      if (res.success && res.data) {
        setRooms(res.data);
        // If a room was already selected, refresh its details too
        if (selectedRoomId) {
          fetchRoomDetail(selectedRoomId);
        } else if (res.data.length > 0) {
          // Default select the first room to immediately show layout
          fetchRoomDetail(res.data[0].id);
        }
      } else {
        setErrorMessage(res.message || 'Failed to load rooms');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to communicate with server');
    } finally {
      setLoading(false);
    }
  };

  // Load selected room details with units & occupant information
  const fetchRoomDetail = async (roomId: string) => {
    setLoadingDetail(true);
    setSelectedRoomId(roomId);
    try {
      const res = await api.getRoom(roomId);
      if (res.success && res.data) {
        setSelectedRoomDetail(res.data);
      } else {
        setErrorMessage(res.message || 'Failed to load room layout');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load room details');
    } finally {
      setLoadingDetail(false);
    }
  };

  // Load Hotels list
  const fetchHotels = async () => {
    try {
      const res = await api.getHotels();
      if (res.success && res.data) {
        setHotels(res.data);
      }
    } catch (e) {
      console.error('Failed to load hotels:', e);
    }
  };

  useEffect(() => {
    fetchRooms();
    fetchHotels();
  }, []);

  // Hotel CRUD Handlers
  const handleCreateHotel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHotelForm.name.trim()) {
      setErrorMessage('Hotel name is required');
      return;
    }
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const sanitizedPayload = {
        name: newHotelForm.name.trim(),
        address: newHotelForm.address?.trim() || undefined,
        contactPhone: newHotelForm.contactPhone?.trim() || undefined,
        contactEmail: newHotelForm.contactEmail?.trim() || undefined,
        notes: newHotelForm.notes?.trim() || undefined,
      };
      const res = await api.createHotel(sanitizedPayload);
      if (res.success && res.data) {
        const createdHotel = res.data;
        setSuccessMessage(`Hotel '${createdHotel.name}' created successfully! Now provision its rooms and beds.`);
        setIsAddHotelOpen(false);
        setNewHotelForm({ name: '', address: '', contactPhone: '', contactEmail: '', notes: '' });
        await fetchHotels();
        handleOpenAddRoom(createdHotel.id);
      } else if (res.success) {
        setSuccessMessage(`Hotel '${newHotelForm.name}' created successfully.`);
        setIsAddHotelOpen(false);
        setNewHotelForm({ name: '', address: '', contactPhone: '', contactEmail: '', notes: '' });
        await fetchHotels();
      } else {
        setErrorMessage(res.message || 'Failed to create hotel');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error creating hotel');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenEditHotel = (hotel: HotelListItem) => {
    setEditingHotel(hotel);
    setEditHotelForm({
      name: hotel.name,
      address: hotel.address || '',
      contactPhone: hotel.contactPhone || '',
      contactEmail: hotel.contactEmail || '',
      notes: hotel.notes || '',
    });
    setIsEditHotelOpen(true);
  };

  const handleUpdateHotel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHotel) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const sanitizedPayload = {
        name: editHotelForm.name?.trim() || undefined,
        address: editHotelForm.address?.trim() || undefined,
        contactPhone: editHotelForm.contactPhone?.trim() || undefined,
        contactEmail: editHotelForm.contactEmail?.trim() || undefined,
        notes: editHotelForm.notes?.trim() || undefined,
      };
      const res = await api.updateHotel(editingHotel.id, sanitizedPayload);
      if (res.success) {
        setSuccessMessage(`Hotel '${editHotelForm.name || editingHotel.name}' updated successfully.`);
        setIsEditHotelOpen(false);
        setEditingHotel(null);
        await fetchHotels();
        await fetchRooms();
      } else {
        setErrorMessage(res.message || 'Failed to update hotel');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error updating hotel');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteHotel = async () => {
    if (!hotelToDelete) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.deleteHotel(hotelToDelete.id);
      if (res.success) {
        setSuccessMessage(`Hotel '${hotelToDelete.name}' deleted successfully.`);
        setIsDeleteHotelOpen(false);
        setHotelToDelete(null);
        await fetchHotels();
        await fetchRooms();
      } else {
        setErrorMessage(res.message || 'Failed to delete hotel');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error deleting hotel');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered rooms list
  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      // Search
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        r.roomNumber.toLowerCase().includes(q) || 
        (r.building && r.building.toLowerCase().includes(q)) ||
        (r.hotel?.name && r.hotel.name.toLowerCase().includes(q)) ||
        (r.notes && r.notes.toLowerCase().includes(q));

      // Hotel filter
      const matchesHotel = hotelFilter === 'ALL' || r.hotelId === hotelFilter;

      // Building filter
      const matchesBuilding = buildingFilter === 'ALL' || (r.building || '').toLowerCase() === buildingFilter.toLowerCase();

      // Status filter
      const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;

      // Gender preference filter
      const matchesGender = genderFilter === 'ALL' || r.genderPreference === genderFilter;

      return matchesSearch && matchesHotel && matchesBuilding && matchesStatus && matchesGender;
    }).sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true, sensitivity: 'base' }));
  }, [rooms, searchQuery, hotelFilter, buildingFilter, statusFilter, genderFilter]);

  // Unique buildings for filter dropdown
  const uniqueBuildings = useMemo(() => {
    const set = new Set<string>();
    rooms.forEach((r) => {
      if (r.building) set.add(r.building);
    });
    return Array.from(set).sort();
  }, [rooms]);

  // Aggregated KPIs
  const metrics = useMemo(() => {
    let totalBeds = 0;
    let totalMats = 0;
    let activeRooms = 0;
    let maleRooms = 0;
    let femaleRooms = 0;
    let familyRooms = 0;
    let guestRooms = 0;

    rooms.forEach((r) => {
      totalBeds += r.totalBeds;
      totalMats += r.totalMats;
      if (r.status === 'ACTIVE') activeRooms++;
      if (r.genderPreference === 'MALE') maleRooms++;
      else if (r.genderPreference === 'FEMALE') femaleRooms++;
      else if (r.genderPreference === 'FAMILY') familyRooms++;
      else if (r.genderPreference === 'GUEST') guestRooms++;
    });

    return {
      totalRooms: rooms.length,
      activeRooms,
      totalBeds,
      totalMats,
      totalUnits: totalBeds + totalMats,
      maleRooms,
      femaleRooms,
      familyRooms,
      guestRooms,
    };
  }, [rooms]);

  // --------------------------------------------------------------------------
  // Handlers
  // --------------------------------------------------------------------------

  const handleOpenAddRoom = (defaultHotelId?: string) => {
    const targetHotelId = defaultHotelId || (hotelFilter !== 'ALL' ? hotelFilter : (hotels[0]?.id || ''));
    setSelectedHotelForAdd(targetHotelId);
    setRoomGroups([
      {
        id: `grp_${Date.now()}`,
        roomNumbersText: '',
        genderPreference: 'MALE',
        status: 'ACTIVE',
        notes: '',
        totalBeds: 4,
        totalMats: 2,
      },
    ]);
    setIsAddRoomOpen(true);
  };

  const handleAddRoomGroup = () => {
    setRoomGroups((prev) => [
      ...prev,
      {
        id: `grp_${Date.now()}_${prev.length + 1}`,
        roomNumbersText: '',
        genderPreference: prev[prev.length - 1]?.genderPreference || 'MALE',
        status: 'ACTIVE',
        notes: '',
        totalBeds: 4,
        totalMats: 2,
      },
    ]);
  };

  const handleRemoveRoomGroup = (groupId: string) => {
    if (roomGroups.length <= 1) return;
    setRoomGroups((prev) => prev.filter((g) => g.id !== groupId));
  };

  const handleUpdateRoomGroup = (groupId: string, updates: Partial<RoomGroupForm>) => {
    setRoomGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, ...updates } : g))
    );
  };

  const handleCreateRoomsBatch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedHotelForAdd && hotels.length > 0) {
      setErrorMessage('Please select a hotel facility for these rooms.');
      return;
    }

    const seen = new Set<string>();
    for (let i = 0; i < roomGroups.length; i++) {
      const tokens = parseRoomTokens(roomGroups[i].roomNumbersText);
      if (tokens.length === 0) {
        setErrorMessage(`Please enter at least one room number for Group #${i + 1}.`);
        return;
      }
      for (const tok of tokens) {
        const key = tok.toLowerCase();
        if (seen.has(key)) {
          setErrorMessage(`Duplicate room number '${tok}' found across your groups. Please ensure all room numbers are unique.`);
          return;
        }
        seen.add(key);
      }
    }

    if (modalSummary.totalRooms === 0) {
      setErrorMessage('Please enter at least one room number (e.g. 21, 23, 24, 43).');
      return;
    }

    setActionLoading(true);
    setErrorMessage(null);

    try {
      const payload: CreateBulkRoomsInput = {
        hotelId: selectedHotelForAdd || null,
        groups: roomGroups.map((g) => ({
          roomNumbers: parseRoomTokens(g.roomNumbersText),
          genderPreference: g.genderPreference,
          status: g.status,
          notes: g.notes.trim() || undefined,
          totalBeds: Number(g.totalBeds) || 0,
          totalMats: Number(g.totalMats) || 0,
        })),
      };

      const res = await api.createBulkRooms(payload);

      if (res.success && res.data) {
        setSuccessMessage(
          `Successfully created ${res.data.createdCount} room(s) with ${res.data.totalUnits} total inventory units!`
        );
        setIsAddRoomOpen(false);
        await fetchRooms();
        await fetchHotels();

        if (selectedHotelForAdd) {
          setHotelFilter(selectedHotelForAdd);
        }
        if (res.data.rooms && res.data.rooms.length > 0) {
          fetchRoomDetail(res.data.rooms[0].id);
        }
      } else {
        setErrorMessage(res.message || 'Failed to create rooms');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error creating rooms');
    } finally {
      setActionLoading(false);
    }
  };

  // Backward compatibility alias
  const handleCreateRoom = handleCreateRoomsBatch;

  // Bulk room selection & deletion handlers
  const handleToggleSelectRoom = (roomId: string) => {
    setSelectedRoomIdsForBulk((prev) =>
      prev.includes(roomId) ? prev.filter((id) => id !== roomId) : [...prev, roomId]
    );
  };

  const handleToggleSelectAllRooms = () => {
    if (selectedRoomIdsForBulk.length === filteredRooms.length) {
      setSelectedRoomIdsForBulk([]);
    } else {
      setSelectedRoomIdsForBulk(filteredRooms.map((r) => r.id));
    }
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedRoomIdsForBulk.length === 0) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.deleteBulkRooms(selectedRoomIdsForBulk);
      if (res.success && res.data) {
        setSuccessMessage(
          `Successfully deleted ${res.data.deletedCount} room(s): ${res.data.deletedRoomNumbers.join(', ')}.`
        );
        setIsBulkDeleteModalOpen(false);
        setSelectedRoomIdsForBulk([]);
        await fetchRooms();
        await fetchHotels();
        setSelectedRoomId(null);
        setSelectedRoomDetail(null);
      } else {
        setErrorMessage(res.message || 'Failed to delete selected rooms');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error executing bulk room deletion');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteBulkAssignHotel = async () => {
    if (!bulkTargetHotelId || selectedRoomIdsForBulk.length === 0) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.bulkAssignHotel(selectedRoomIdsForBulk, bulkTargetHotelId);
      if (res.success) {
        setSuccessMessage(res.message || `Assigned ${selectedRoomIdsForBulk.length} rooms to hotel.`);
        setSelectedRoomIdsForBulk([]);
        setBulkTargetHotelId('');
        await fetchRooms();
      } else {
        setErrorMessage(res.message || 'Failed to assign hotel');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error assigning hotel');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenEditRoom = (room: RoomListItem) => {
    setEditingRoom(room);
    setEditRoomForm({
      hotelId: room.hotelId || '',
      building: room.building || '',
      floor: room.floor || 1,
      genderPreference: room.genderPreference,
      status: room.status,
      notes: room.notes || '',
    });
    setIsEditRoomOpen(true);
  };

  const handleUpdateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom) return;

    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.updateRoom(editingRoom.id, {
        ...editRoomForm,
        hotelId: editRoomForm.hotelId || null,
        floor: editRoomForm.floor ? Number(editRoomForm.floor) : null,
      });

      if (res.success && res.data) {
        setSuccessMessage(`Room ${editingRoom.roomNumber} updated successfully.`);
        setIsEditRoomOpen(false);
        await fetchRooms();
        await fetchHotels();
        if (selectedRoomId === editingRoom.id) {
          fetchRoomDetail(editingRoom.id);
        }
      } else {
        setErrorMessage(res.message || 'Failed to update room');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error updating room');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenDelete = (room: RoomListItem) => {
    setRoomToDelete(room);
    setIsDeleteConfirmOpen(true);
  };

  const handleDeleteRoom = async () => {
    if (!roomToDelete) return;

    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.deleteRoom(roomToDelete.id);
      if (res.success) {
        setSuccessMessage(`Room ${roomToDelete.roomNumber} deleted successfully.`);
        setIsDeleteConfirmOpen(false);
        if (selectedRoomId === roomToDelete.id) {
          setSelectedRoomId(null);
          setSelectedRoomDetail(null);
        }
        await fetchRooms();
      } else {
        setErrorMessage(res.message || 'Failed to delete room');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error deleting room');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenAddUnit = () => {
    if (!selectedRoomDetail) return;
    const existingUnitCount = selectedRoomDetail.units.length;
    setNewUnit({
      unitNumber: `B${existingUnitCount + 1}`,
      type: 'BED',
      genderCategory: 'ANY',
      status: 'ACTIVE',
      notes: '',
    });
    setIsAddUnitOpen(true);
  };

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoomDetail) return;
    if (!newUnit.unitNumber.trim()) {
      setErrorMessage('Unit number is required');
      return;
    }

    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.addUnit(selectedRoomDetail.id, newUnit);
      if (res.success) {
        setSuccessMessage(`Unit ${newUnit.unitNumber} added to Room ${selectedRoomDetail.roomNumber}.`);
        setIsAddUnitOpen(false);
        await fetchRoomDetail(selectedRoomDetail.id);
        await fetchRooms();
      } else {
        setErrorMessage(res.message || 'Failed to add unit');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error adding unit');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenEditUnit = (unit: AccommodationUnitItem) => {
    setEditingUnit(unit);
    setEditUnitForm({
      genderCategory: unit.genderCategory,
      status: unit.status,
      notes: unit.notes || '',
    });
    setIsEditUnitOpen(true);
  };

  const handleUpdateUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoomDetail || !editingUnit) return;

    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.updateUnit(selectedRoomDetail.id, editingUnit.id, editUnitForm);
      if (res.success) {
        setSuccessMessage(`Unit ${editingUnit.unitNumber} updated successfully.`);
        setIsEditUnitOpen(false);
        await fetchRoomDetail(selectedRoomDetail.id);
        await fetchRooms();
      } else {
        setErrorMessage(res.message || 'Failed to update unit');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error updating unit');
    } finally {
      setActionLoading(false);
    }
  };

  // Visual status badge helper
  const getVisualStateBadge = (state: VisualUnitState) => {
    switch (state) {
      case 'AVAILABLE':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-emerald-500/20',
          dot: 'bg-emerald-500',
          label: 'Available',
        };
      case 'ALLOCATED':
        return {
          bg: 'bg-blue-50 text-blue-700 border-blue-300 ring-blue-500/20',
          dot: 'bg-blue-500',
          label: 'Allocated (Tentative)',
        };
      case 'CONFIRMED':
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-300 ring-amber-500/20',
          dot: 'bg-amber-500',
          label: 'Confirmed',
        };
      case 'CHECKED_IN':
        return {
          bg: 'bg-purple-50 text-purple-700 border-purple-300 ring-purple-500/20',
          dot: 'bg-purple-500',
          label: 'Checked In',
        };
      case 'MAINTENANCE':
        return {
          bg: 'bg-slate-100 text-slate-700 border-slate-300 ring-slate-500/20',
          dot: 'bg-slate-500',
          label: 'Maintenance',
        };
      default:
        return {
          bg: 'bg-gray-100 text-gray-700 border-gray-300',
          dot: 'bg-gray-400',
          label: state,
        };
    }
  };

  // Gender category badge helper
  const getGenderBadge = (gender: GenderCategory | GenderPreference) => {
    switch (gender) {
      case 'MALE':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800">Male (M)</span>;
      case 'FEMALE':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-pink-100 text-pink-800">Female (F)</span>;
      case 'FAMILY':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-800">Family</span>;
      case 'GUEST':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-300">Guest</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">Any</span>;
    }
  };

  // Room status badge helper
  const getRoomStatusBadge = (status: RoomStatus) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
          </span>
        );
      case 'MAINTENANCE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Maintenance
          </span>
        );
      case 'INACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Inactive
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ------------------------------------------------------------------ */}
      {/* HEADER SECTION                                                     */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Rooms &amp; Beds Inventory
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 rounded-full">
              Live Room Grid
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Check which rooms, beds, and mats are available, occupied, or under maintenance. Click any room to see its layout.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchRooms()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            Refresh
          </button>

          {canManageRooms && (
            <button
              onClick={() => handleOpenAddRoom()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            >
              <Plus className="w-4 h-4" />
              Add Room
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* ALERTS / NOTIFICATIONS                                             */}
      {/* ------------------------------------------------------------------ */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start justify-between shadow-sm animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-900">Action Failed</p>
              <p className="text-xs text-rose-700 mt-0.5">{errorMessage}</p>
            </div>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start justify-between shadow-sm animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-900">Success</p>
              <p className="text-xs text-emerald-700 mt-0.5">{successMessage}</p>
            </div>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* View Switcher: Rooms Inventory vs Hotels & Buildings */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-200/80 rounded-xl text-xs font-bold w-fit">
        <button
          type="button"
          onClick={() => setMainView('ROOMS')}
          className={`px-4 py-2 rounded-lg transition flex items-center gap-1.5 ${
            mainView === 'ROOMS' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Bed className="w-4 h-4" />
          <span>Room &amp; Bed Inventory</span>
        </button>
        <button
          type="button"
          onClick={() => setMainView('HOTELS')}
          className={`px-4 py-2 rounded-lg transition flex items-center gap-1.5 ${
            mainView === 'HOTELS' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Hotels &amp; Buildings ({hotels.length})</span>
        </button>
      </div>

      {mainView === 'HOTELS' ? (
        <div className="space-y-6 animate-in fade-in">
          {/* Hotels Top Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Building className="w-5 h-5 text-blue-600" />
                <span>Hotel Facilities &amp; Buildings Directory</span>
              </h2>
              <p className="text-xs text-slate-500">
                Manage hotel properties, building contact information, and room capacities.
              </p>
            </div>
            {canManageRooms && (
              <button
                type="button"
                onClick={() => {
                  setNewHotelForm({ name: '', address: '', contactPhone: '', contactEmail: '', notes: '' });
                  setIsAddHotelOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Add Hotel / Building</span>
              </button>
            )}
          </div>

          {/* Hotel KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Total Hotels</span>
              <p className="text-2xl font-black text-slate-900 mt-1">{hotels.length}</p>
            </div>
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Total Rooms</span>
              <p className="text-2xl font-black text-blue-700 mt-1">
                {hotels.reduce((acc, h) => acc + h.roomCount, 0)}
              </p>
            </div>
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase">🛏️ Total Beds</span>
              <p className="text-2xl font-black text-indigo-700 mt-1">
                {hotels.reduce((acc, h) => acc + h.totalBeds, 0)}
              </p>
            </div>
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase">🧘 Total Mats</span>
              <p className="text-2xl font-black text-emerald-700 mt-1">
                {hotels.reduce((acc, h) => acc + h.totalMats, 0)}
              </p>
            </div>
          </div>

          {/* Hotel Cards List */}
          {hotels.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400">
              <Building className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold">No Hotels Found</p>
              <p className="text-xs text-slate-500 mt-1">Click &ldquo;Add Hotel / Building&rdquo; above to create your first hotel facility.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {hotels.map((hotel) => (
                <div key={hotel.id} className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4 hover:border-blue-300 transition flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900">{hotel.name}</h3>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                            {hotel.roomCount} Rooms
                          </span>
                        </div>
                        {hotel.address && (
                          <p className="text-xs text-slate-600 mt-1 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{hotel.address}</span>
                          </p>
                        )}
                      </div>

                      {canManageRooms && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenEditHotel(hotel)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition"
                            title="Edit Hotel"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setHotelToDelete(hotel);
                              setIsDeleteHotelOpen(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Delete Hotel"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Contacts & Notes */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                      {hotel.contactPhone && (
                        <span className="flex items-center gap-1 font-mono">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{hotel.contactPhone}</span>
                        </span>
                      )}
                      {hotel.contactEmail && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span>{hotel.contactEmail}</span>
                        </span>
                      )}
                    </div>

                    {hotel.notes && (
                      <p className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        {hotel.notes}
                      </p>
                    )}

                    {/* Inventory breakdown */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 grid grid-cols-3 gap-2 text-center text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Active Rooms</span>
                        <span className="font-bold text-slate-800">{hotel.activeRooms} / {hotel.roomCount}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">🛏️ Beds</span>
                        <span className="font-bold text-indigo-700">{hotel.totalBeds}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">🧘 Mats</span>
                        <span className="font-bold text-emerald-700">{hotel.totalMats}</span>
                      </div>
                    </div>

                    {/* Rooms in this hotel */}
                    {hotel.rooms && hotel.rooms.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Rooms in this Hotel:</span>
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                          {hotel.rooms.map((r) => (
                            <span
                              key={r.id}
                              className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-white border border-slate-200 text-slate-800 flex items-center gap-1"
                            >
                              <span>Room {r.roomNumber}</span>
                              <span className="text-[9px] text-slate-500 font-sans">({r.totalBeds}B/{r.totalMats}M)</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setHotelFilter(hotel.id);
                        setMainView('ROOMS');
                      }}
                      className="px-3 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition"
                    >
                      View &amp; Manage Rooms &rarr;
                    </button>
                    {canManageRooms && (
                      <button
                        type="button"
                        onClick={() => handleOpenAddRoom(hotel.id)}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition flex items-center gap-1 shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Room to Hotel</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* ------------------------------------------------------------------ */}
          {/* METRIC KPI CARDS                                                   */}
          {/* ------------------------------------------------------------------ */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Rooms */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Rooms</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">{metrics.totalRooms}</h3>
                <p className="text-[11px] text-emerald-600 mt-0.5 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  {metrics.activeRooms} Active &bull; {metrics.totalRooms - metrics.activeRooms} Inactive/Maint.
                </p>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Building className="w-6 h-6" />
              </div>
            </div>

            {/* Total Beds & Mats */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Inventory Capacity</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">{metrics.totalUnits} Units</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  🛏️ {metrics.totalBeds} Beds &bull; 🧘 {metrics.totalMats} Floor Mats
                </p>
              </div>
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                <Bed className="w-6 h-6" />
              </div>
            </div>

            {/* Male & Female Rooms */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Gendered Rooms</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg font-bold text-blue-900">👦 {metrics.maleRooms} Male</span>
                  <span className="text-slate-300">|</span>
                  <span className="text-lg font-bold text-pink-900">👩 {metrics.femaleRooms} Female</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">Categorized for single gender groups</p>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Users className="w-6 h-6" />
              </div>
            </div>

            {/* Family & Guest Rooms */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Family &amp; Guest Rooms</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg font-bold text-purple-900">👨‍👩‍👧‍👦 {metrics.familyRooms} Family</span>
                  <span className="text-slate-300">|</span>
                  <span className="text-lg font-bold text-amber-900">🌟 {metrics.guestRooms} Guest</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">Dedicated family &amp; VIP suites</p>
              </div>
              <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                <Sparkles className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------------------ */}
          {/* FILTER & SEARCH TOOLBAR                                            */}
          {/* ------------------------------------------------------------------ */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search room number, hotel, building, or notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Hotel Filter */}
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <Building className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={hotelFilter}
                  onChange={(e) => setHotelFilter(e.target.value)}
                  className="py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">All Hotels</option>
                  {hotels.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>

              {/* Building */}
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={buildingFilter}
                  onChange={(e) => setBuildingFilter(e.target.value)}
                  className="py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">All Buildings</option>
                  {uniqueBuildings.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>

              {/* Gender Preference */}
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <select
                  value={genderFilter}
                  onChange={(e) => setGenderFilter(e.target.value)}
                  className="py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">All Categories</option>
                  <option value="MALE">👦 Male Only</option>
                  <option value="FEMALE">👩 Female Only</option>
                  <option value="FAMILY">👨‍👩‍👧 Family Only</option>
                  <option value="GUEST">🌟 Guest / VIP</option>
                  <option value="ANY">Any / Unrestricted</option>
                </select>
              </div>
              {(searchQuery || hotelFilter !== 'ALL' || buildingFilter !== 'ALL' || statusFilter !== 'ALL' || genderFilter !== 'ALL') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setHotelFilter('ALL');
                    setBuildingFilter('ALL');
                    setStatusFilter('ALL');
                    setGenderFilter('ALL');
                  }}
                  className="px-2 py-1 text-xs text-rose-600 hover:text-rose-700 hover:underline font-medium"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

      {/* ------------------------------------------------------------------ */}
      {/* ROOMS TABLE                                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Rooms Directory ({filteredRooms.length} {filteredRooms.length === 1 ? 'room' : 'rooms'})
            </h2>
            <p className="text-[11px] text-slate-500">
              Click any room row to view its visual unit layout grid below.
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {rooms.length} Total Registered in DB
          </span>
        </div>

        {/* Bulk Selection Bar */}
        {canManageRooms && selectedRoomIdsForBulk.length > 0 && (
          <div className="bg-rose-50 border-b-2 border-rose-300 p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] font-bold">
                {selectedRoomIdsForBulk.length}
              </span>
              <span className="text-xs font-bold text-rose-950">
                {selectedRoomIdsForBulk.length} Room{selectedRoomIdsForBulk.length > 1 ? 's' : ''} Selected
              </span>
              <span className="text-[11px] text-rose-700">
                (out of {filteredRooms.length} listed)
              </span>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
              {/* Bulk Assign to Hotel */}
              <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-slate-300">
                <Building className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <select
                  value={bulkTargetHotelId}
                  onChange={(e) => setBulkTargetHotelId(e.target.value)}
                  className="text-xs bg-transparent border-none text-slate-800 font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="">Select Hotel to Assign...</option>
                  {hotels.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!bulkTargetHotelId || actionLoading}
                  onClick={handleExecuteBulkAssignHotel}
                  className="px-2.5 py-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md transition"
                >
                  Assign
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedRoomIdsForBulk([])}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition"
              >
                Clear Selection
              </button>
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(true)}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 rounded-lg shadow-sm transition flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected ({selectedRoomIdsForBulk.length})</span>
              </button>
            </div>
          </div>
        )}

        {/* Desktop Rooms Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 text-slate-600 font-semibold border-b border-slate-200">
                {canManageRooms && (
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        filteredRooms.length > 0 &&
                        selectedRoomIdsForBulk.length === filteredRooms.length
                      }
                      onChange={handleToggleSelectAllRooms}
                      title={
                        selectedRoomIdsForBulk.length === filteredRooms.length
                          ? 'Deselect all rooms'
                          : 'Select all rooms'
                      }
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                )}
                <th className="py-3 px-4">Room No.</th>
                <th className="py-3 px-4">Building &amp; Floor</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-center font-bold text-blue-900">🛏️ Beds</th>
                <th className="py-3 px-4 text-center font-bold text-indigo-900">🧘 Mats</th>
                <th className="py-3 px-4 text-center font-extrabold">Total Capacity</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading && rooms.length === 0 ? (
                <tr>
                  <td colSpan={canManageRooms ? 9 : 8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                    Loading room inventory from database...
                  </td>
                </tr>
              ) : filteredRooms.length === 0 ? (
                <tr>
                  <td colSpan={canManageRooms ? 9 : 8} className="py-12 text-center text-slate-400">
                    No rooms match your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredRooms.map((room) => {
                  const isSelected = selectedRoomId === room.id;
                  const isBulkSelected = selectedRoomIdsForBulk.includes(room.id);
                  return (
                    <tr
                      key={room.id}
                      onClick={() => fetchRoomDetail(room.id)}
                      className={`cursor-pointer transition-colors ${
                        isBulkSelected
                          ? 'bg-rose-50/60 hover:bg-rose-50'
                          : isSelected 
                             ? 'bg-blue-50/70 hover:bg-blue-50 border-l-4 border-l-blue-600 font-medium' 
                            : 'hover:bg-slate-50'
                      }`}
                    >
                      {/* Bulk Selection Checkbox */}
                      {canManageRooms && (
                        <td
                          className="py-3.5 px-3 w-10 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isBulkSelected}
                            onChange={() => handleToggleSelectRoom(room.id)}
                            className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                          />
                        </td>
                      )}
                      {/* Room Number */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{room.roomNumber}</span>
                          {isSelected && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-blue-600 text-white font-sans uppercase">
                              Active View
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Building & Floor */}
                      <td className="py-3.5 px-4 text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-slate-400" />
                          <span>{room.building || 'Main'}</span>
                          <span className="text-slate-400">&bull;</span>
                          <span className="text-[11px] text-slate-500">Floor {room.floor ?? 1}</span>
                        </div>
                      </td>

                      {/* Room Category */}
                      <td className="py-3.5 px-4">
                        {getGenderBadge(room.genderPreference)}
                      </td>

                      {/* Total Beds */}
                      <td className="py-3.5 px-4 text-center font-bold text-blue-900">
                        {room.totalBeds} Beds
                      </td>

                      {/* Total Mats */}
                      <td className="py-3.5 px-4 text-center font-bold text-indigo-900">
                        {room.totalMats} Mats
                      </td>

                      {/* Total Capacity */}
                      <td className="py-3.5 px-4 text-center font-extrabold text-slate-900">
                        <span className="inline-block px-2.5 py-0.5 bg-slate-100 rounded-md font-mono text-sm">
                          {room.totalCapacity}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {getRoomStatusBadge(room.status)}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => fetchRoomDetail(room.id)}
                            title="View Unit Grid"
                            className={`p-1.5 rounded-lg border transition ${
                              isSelected
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'text-slate-600 hover:text-blue-600 hover:bg-slate-100 border-slate-200'
                            }`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {canManageRooms && (
                            <>
                              <button
                                onClick={() => handleOpenEditRoom(room)}
                                title="Edit Room Properties"
                                className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleOpenDelete(room)}
                                title="Delete Room"
                                className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-lg transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View: Compact Room Selector & In-Place Beds/Mats Display */}
        <div className="block md:hidden p-3 space-y-4">
          {loading && rooms.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
              Loading room inventory...
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No rooms match your filter criteria.
            </div>
          ) : (
            <div className="space-y-4">
              {/* 1. Top Compact Room Selector Header */}
              <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-md space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building className="w-5 h-5 text-blue-400" />
                    <div>
                      <h2 className="text-sm font-black tracking-tight">Room Inventory Selector</h2>
                      <p className="text-[10px] text-slate-400">
                        {filteredRooms.length} {filteredRooms.length === 1 ? 'room' : 'rooms'} found
                      </p>
                    </div>
                  </div>
                  {canManageRooms && (
                    <button
                      onClick={() => setIsAddRoomOpen(true)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center gap-1 shadow-xs transition min-h-[38px]"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Room</span>
                    </button>
                  )}
                </div>

                {/* Dropdown with Quick Previous/Next Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    title="Previous Room"
                    disabled={filteredRooms.findIndex((r) => r.id === selectedRoomId) <= 0}
                    onClick={() => {
                      const idx = filteredRooms.findIndex((r) => r.id === selectedRoomId);
                      if (idx > 0) fetchRoomDetail(filteredRooms[idx - 1].id);
                    }}
                    className="p-2.5 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition min-h-[44px] min-w-[44px] flex items-center justify-center border border-slate-700"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <select
                    value={selectedRoomId || ''}
                    onChange={(e) => fetchRoomDetail(e.target.value)}
                    aria-label="Select room to view units"
                    className="flex-1 bg-slate-800 text-white text-xs font-bold rounded-xl border border-slate-700 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                  >
                    {filteredRooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        Room {room.roomNumber} ({room.genderPreference} • {room.totalBeds}B/{room.totalMats}M • Fl {room.floor ?? 1})
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    title="Next Room"
                    disabled={
                      filteredRooms.findIndex((r) => r.id === selectedRoomId) >= filteredRooms.length - 1 ||
                      filteredRooms.findIndex((r) => r.id === selectedRoomId) === -1
                    }
                    onClick={() => {
                      const idx = filteredRooms.findIndex((r) => r.id === selectedRoomId);
                      if (idx !== -1 && idx < filteredRooms.length - 1) fetchRoomDetail(filteredRooms[idx + 1].id);
                    }}
                    className="p-2.5 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition min-h-[44px] min-w-[44px] flex items-center justify-center border border-slate-700"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                {/* Compact Room Chips Bar (Touch-friendly quick tap) */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
                  {filteredRooms.map((room) => {
                    const isSelected = selectedRoomId === room.id;
                    return (
                      <button
                        key={room.id}
                        type="button"
                        onClick={() => fetchRoomDetail(room.id)}
                        className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 min-h-[38px] ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-300'
                            : 'bg-slate-800/90 hover:bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        <span className="font-mono">{room.roomNumber}</span>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          room.status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-slate-400'
                        }`}></span>
                        <span className="text-[10px] opacity-75 font-normal">
                          ({room.totalCapacity})
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Selected Room Complete Details (Directly Below Selector) */}
              {loadingDetail ? (
                <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-500 shadow-xs">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                  <p className="text-xs font-semibold">Loading room and bed layout...</p>
                </div>
              ) : selectedRoomDetail ? (
                <div className="space-y-4 animate-in fade-in duration-150">
                  {/* Complete Room Summary Card */}
                  <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 shadow-xs space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-lg font-black font-mono text-slate-900">
                            Room {selectedRoomDetail.roomNumber}
                          </span>
                          {getGenderBadge(selectedRoomDetail.genderPreference)}
                          {getRoomStatusBadge(selectedRoomDetail.status)}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>{selectedRoomDetail.hotel?.name || selectedRoomDetail.building || 'Main Facility'}</span>
                          <span>&bull;</span>
                          <span>Floor {selectedRoomDetail.floor ?? 1}</span>
                          {selectedRoomDetail.notes && (
                            <>
                              <span>&bull;</span>
                              <span className="italic truncate max-w-[150px]">&quot;{selectedRoomDetail.notes}&quot;</span>
                            </>
                          )}
                        </p>
                      </div>

                      {/* Management Actions */}
                      {canManageRooms && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenEditRoom(selectedRoomDetail)}
                            className="p-2 min-h-[44px] min-w-[44px] text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition flex items-center justify-center border border-slate-200"
                            title="Edit Room Properties"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDelete(selectedRoomDetail)}
                            className="p-2 min-h-[44px] min-w-[44px] text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition flex items-center justify-center border border-rose-200"
                            title="Delete Room"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Room Metrics Grid */}
                    <div className="grid grid-cols-5 gap-1.5 text-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <div className="p-1">
                        <span className="block text-[10px] text-slate-500 font-bold uppercase">Beds</span>
                        <span className="font-extrabold text-blue-900 text-sm">{selectedRoomDetail.totalBeds}</span>
                      </div>
                      <div className="p-1 border-l border-slate-200">
                        <span className="block text-[10px] text-slate-500 font-bold uppercase">Mats</span>
                        <span className="font-extrabold text-indigo-900 text-sm">{selectedRoomDetail.totalMats}</span>
                      </div>
                      <div className="p-1 border-l border-slate-200">
                        <span className="block text-[10px] text-slate-500 font-bold uppercase">Total</span>
                        <span className="font-extrabold text-slate-900 text-sm">{selectedRoomDetail.totalCapacity}</span>
                      </div>
                      <div className="p-1 border-l border-slate-200">
                        <span className="block text-[10px] text-emerald-700 font-bold uppercase">Avail</span>
                        <span className="font-black text-emerald-600 text-sm">
                          {selectedRoomDetail.units.filter((u) => u.visualState === 'AVAILABLE').length}
                        </span>
                      </div>
                      <div className="p-1 border-l border-slate-200">
                        <span className="block text-[10px] text-purple-700 font-bold uppercase">Occ/Res</span>
                        <span className="font-black text-purple-600 text-sm">
                          {selectedRoomDetail.units.filter((u) => u.visualState !== 'AVAILABLE').length}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 3. In-Place Beds & Mats Section */}
                  <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 shadow-xs space-y-3">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        <Bed className="w-4 h-4 text-blue-600" />
                        <h3 className="text-xs font-black uppercase text-slate-900">
                          Beds &amp; Mats in Room {selectedRoomDetail.roomNumber} ({selectedRoomDetail.units.length})
                        </h3>
                      </div>
                      {canManageRooms && (
                        <button
                          type="button"
                          onClick={handleOpenAddUnit}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition min-h-[38px]"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Unit</span>
                        </button>
                      )}
                    </div>

                    {/* Status Color Legend */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] bg-slate-50 p-2 rounded-xl border border-slate-200">
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span>Available</span>
                      </div>
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 font-bold">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        <span>Allocated</span>
                      </div>
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 font-bold">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <span>Confirmed</span>
                      </div>
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 font-bold">
                        <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                        <span>Checked In</span>
                      </div>
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                        <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                        <span>Maintenance</span>
                      </div>
                    </div>

                    {/* Units Grid */}
                    {selectedRoomDetail.units.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-xs">
                        No beds or mats provisioned in Room {selectedRoomDetail.roomNumber}.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {selectedRoomDetail.units.map((unit) => {
                          const stateBadge = getVisualStateBadge(unit.visualState);
                          const isBed = unit.type === 'BED';

                          return (
                            <div
                              key={unit.id}
                              onClick={() => canEditUnits && handleOpenEditUnit(unit)}
                              className={`rounded-xl border p-3 transition min-h-[72px] flex flex-col justify-between ${
                                canEditUnits ? 'cursor-pointer hover:shadow-xs active:scale-98' : ''
                              } ${stateBadge.bg}`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                  <div className={`p-1.5 rounded-lg ${isBed ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'}`}>
                                    {isBed ? <Bed className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
                                  </div>
                                  <div>
                                    <span className="text-sm font-black font-mono text-slate-900">
                                      {unit.unitNumber}
                                    </span>
                                    <span className="ml-1.5 text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
                                      {unit.type}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  {getGenderBadge(unit.genderCategory)}
                                  {canEditUnits && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenEditUnit(unit);
                                      }}
                                      className="p-1 min-h-[32px] min-w-[32px] text-slate-400 hover:text-slate-800 flex items-center justify-center rounded"
                                      title="Edit Unit"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Status indicator and occupant info */}
                              <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                                <div className="flex items-center gap-1.5">
                                  <span className={`w-2 h-2 rounded-full ${stateBadge.dot}`}></span>
                                  <span className="text-[11px] font-bold text-slate-800">
                                    {stateBadge.label}
                                  </span>
                                </div>
                                {unit.occupantInfo && (
                                  <span className="text-[10px] text-slate-600 font-semibold truncate max-w-[130px]">
                                    {unit.occupantInfo.participantName || unit.occupantInfo.primaryName || 'Guest'}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
                  Please select a room from the selector above to view its units.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* INTERACTIVE ROOM LAYOUT VISUALIZER (Desktop Layout)                */}
      {/* ------------------------------------------------------------------ */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Layout Visualizer Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-blue-400" />
              <h2 className="text-base font-bold tracking-tight">
                Room Layout &bull; {selectedRoomDetail ? selectedRoomDetail.roomNumber : 'Select a Room'}
              </h2>
              {selectedRoomDetail && (
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                  {selectedRoomDetail.building || 'Main'} - Floor {selectedRoomDetail.floor ?? 1}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Visual status breakdown of individual beds &amp; mats. Real-time mapping against active allocations and check-ins.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Color Legend matching Reference Image */}
            <div className="flex flex-wrap items-center gap-2 text-[11px] bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span className="text-slate-300">Available</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                <span className="text-slate-300">Allocated</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span className="text-slate-300">Confirmed</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                <span className="text-slate-300">Checked In</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span>
                <span className="text-slate-300">Maintenance</span>
              </div>
            </div>

            {canManageRooms && selectedRoomDetail && (
              <button
                onClick={handleOpenAddUnit}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Unit to {selectedRoomDetail.roomNumber}
              </button>
            )}
          </div>
        </div>

        {/* Visual Unit Grid Container */}
        <div className="p-6">
          {loadingDetail ? (
            <div className="py-16 text-center text-slate-500">
              <RefreshCw className="w-7 h-7 animate-spin mx-auto text-blue-600 mb-2" />
              <p className="text-xs font-medium">Retrieving real-time unit states from database...</p>
            </div>
          ) : !selectedRoomDetail ? (
            <div className="py-16 text-center text-slate-400">
              <Building className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-xs">No room selected. Click on a room from the table above to view its layout.</p>
            </div>
          ) : selectedRoomDetail.units.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Bed className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-xs">No bed or mat units exist in this room.</p>
              {canManageRooms && (
                <button
                  onClick={handleOpenAddUnit}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg"
                >
                  <Plus className="w-3.5 h-3.5" /> Add First Unit
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary sub-bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 text-xs text-slate-600">
                <div className="flex items-center gap-4">
                  <span>
                    Total Units: <strong className="text-slate-900">{selectedRoomDetail.units.length}</strong>
                  </span>
                  <span>
                    Beds: <strong className="text-slate-900">{selectedRoomDetail.totalBeds}</strong>
                  </span>
                  <span>
                    Mats: <strong className="text-slate-900">{selectedRoomDetail.totalMats}</strong>
                  </span>
                  {selectedRoomDetail.notes && (
                    <span className="italic text-slate-500">
                      &quot;{selectedRoomDetail.notes}&quot;
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-slate-400">
                  Click on any unit to modify its gender, status, or maintenance notes.
                </div>
              </div>

              {/* Grid of Unit Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {selectedRoomDetail.units.map((unit) => {
                  const stateBadge = getVisualStateBadge(unit.visualState);
                  const isBed = unit.type === 'BED';

                  return (
                    <div
                      key={unit.id}
                      onClick={() => canEditUnits && handleOpenEditUnit(unit)}
                      className={`group relative rounded-xl border p-4 transition-all duration-200 ${
                        canEditUnits ? 'cursor-pointer hover:shadow-md' : ''
                      } ${stateBadge.bg}`}
                    >
                      {/* Top Row: Unit Number & Type Icon */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-lg ${isBed ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'}`}>
                            {isBed ? <Bed className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
                          </div>
                          <div>
                            <span className="text-sm font-extrabold font-mono text-slate-900">
                              {unit.unitNumber}
                            </span>
                            <p className="text-[10px] text-slate-500 uppercase font-semibold">
                              {unit.type}
                            </p>
                          </div>
                        </div>

                        {/* Gender Badge */}
                        <div className="flex items-center gap-1">
                          {getGenderBadge(unit.genderCategory)}
                          {canEditUnits && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditUnit(unit);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-700 rounded transition"
                              title="Edit Unit"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* State Indicator */}
                      <div className="mt-3 flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${stateBadge.dot} animate-pulse`}></span>
                        <span className="text-xs font-bold tracking-tight">
                          {stateBadge.label}
                        </span>
                      </div>

                      {/* Occupant Information / Details */}
                      <div className="mt-2.5 pt-2.5 border-t border-slate-200/60 text-[11px] min-h-[42px] flex flex-col justify-center">
                        {unit.visualState === 'CHECKED_IN' && unit.occupantInfo ? (
                          <div className="space-y-0.5 text-purple-900">
                            <p className="font-semibold truncate">
                              Occupant: {unit.occupantInfo.participantName || 'Guest'}
                            </p>
                            <p className="text-[10px] text-purple-700 truncate">
                              Reg: {unit.occupantInfo.registrationId}
                            </p>
                          </div>
                        ) : (unit.visualState === 'CONFIRMED' || unit.visualState === 'ALLOCATED') && unit.occupantInfo ? (
                          <div className="space-y-0.5 text-slate-700">
                            <p className="font-semibold truncate">
                              Primary: {unit.occupantInfo.primaryName || 'Guest'}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate">
                              Reg: {unit.occupantInfo.registrationId} &bull; {unit.occupantInfo.entryDate ? new Date(unit.occupantInfo.entryDate).toLocaleDateString() : ''}
                            </p>
                          </div>
                        ) : unit.visualState === 'MAINTENANCE' ? (
                          <p className="text-slate-500 italic">
                            {unit.notes ? `Reason: ${unit.notes}` : 'Under maintenance'}
                          </p>
                        ) : (
                          <p className="text-emerald-700 font-medium">
                            Ready for manual allocation
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 1: ADD ROOMS (MULTI-ROOM & BATCH PROVISIONING) DIALOG        */}
      {/* ------------------------------------------------------------------ */}
      {isAddRoomOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="text-base font-bold">Add Physical Rooms &amp; Provision Inventory</h3>
                  <p className="text-[11px] text-slate-400">Add single or multiple rooms at once for a hotel property</p>
                </div>
              </div>
              <button 
                onClick={() => setIsAddRoomOpen(false)} 
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateRoomsBatch} className="overflow-y-auto p-6 space-y-6 flex-1">
              {/* Hotel / Facility Selector */}
              <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800">
                    Target Hotel / Building Facility <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddRoomOpen(false);
                      setIsAddHotelOpen(true);
                    }}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    + Create New Hotel
                  </button>
                </div>
                <select
                  value={selectedHotelForAdd || ''}
                  onChange={(e) => setSelectedHotelForAdd(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-white border border-blue-300 rounded-lg text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select Target Hotel Facility --</option>
                  {hotels.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} {h.roomCount !== undefined ? `(${h.roomCount} rooms)` : ''}
                    </option>
                  ))}
                </select>
                {selectedHotelForAdd && (
                  <div className="text-[11px] text-blue-800 flex items-center gap-1.5 pt-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>
                      Selected:{' '}
                      <strong>{hotels.find((h) => h.id === selectedHotelForAdd)?.name}</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Informative Guidance Banner */}
              <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold">Multiple Room Entry Supported</p>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Enter multiple rooms that share the same bed count (e.g.{' '}
                    <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold">21, 23, 24, 43</code> or ranges{' '}
                    <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold">101-105</code>). If you also need rooms with different beds/mats, click <strong>&quot;+ Add Another Room Group&quot;</strong> below!
                  </p>
                </div>
              </div>

              {/* Room Groups Builder */}
              <div className="space-y-4">
                {roomGroups.map((grp, idx) => {
                  const tokens = parseRoomTokens(grp.roomNumbersText);
                  const grpBeds = Number(grp.totalBeds) || 0;
                  const grpMats = Number(grp.totalMats) || 0;
                  const grpTotalUnits = tokens.length * (grpBeds + grpMats);

                  return (
                    <div
                      key={grp.id}
                      className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200 shadow-xs space-y-4 relative"
                    >
                      {/* Group Header */}
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-800">
                            {roomGroups.length > 1 ? `Room Group #${idx + 1}` : 'Room Batch Configuration'}
                          </span>
                          {tokens.length > 0 && (
                            <span className="text-[11px] font-semibold px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full">
                              {tokens.length} {tokens.length === 1 ? 'Room' : 'Rooms'} ({grpTotalUnits} units)
                            </span>
                          )}
                        </div>

                        {roomGroups.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveRoomGroup(grp.id)}
                            className="text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2 py-1 rounded-md transition flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        )}
                      </div>

                      {/* Room Numbers Input */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-bold text-slate-700">
                            Room Number(s) <span className="text-rose-500">*</span>
                          </label>
                          <span className="text-[10px] text-slate-400">
                            Comma-separated or range (e.g. 21, 23, 24, 43 or 101-105)
                          </span>
                        </div>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 21, 23, 24, 43 or 101-105 or single 12"
                          value={grp.roomNumbersText}
                          onChange={(e) =>
                            handleUpdateRoomGroup(grp.id, { roomNumbersText: e.target.value })
                          }
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-mono font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />

                        {/* Live Badges Preview of Detected Rooms */}
                        {tokens.length > 0 ? (
                          <div className="mt-2 p-2 bg-white rounded-lg border border-slate-200">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                              {tokens.length} Room{tokens.length > 1 ? 's' : ''} to create:
                            </span>
                            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                              {tokens.map((num) => (
                                <span
                                  key={num}
                                  className="px-2 py-0.5 bg-blue-50 text-blue-700 font-mono text-[11px] font-bold rounded-md border border-blue-200"
                                >
                                  Room {num}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400 mt-1">
                            Type single room number or multiple separated by commas / spaces.
                          </p>
                        )}
                      </div>

                      {/* Room Meta: Category & Status */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Room Category */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Category
                          </label>
                          <select
                            value={grp.genderPreference}
                            onChange={(e) =>
                              handleUpdateRoomGroup(grp.id, {
                                genderPreference: e.target.value as GenderPreference,
                              })
                            }
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                          >
                            <option value="MALE">Male (M) Room</option>
                            <option value="FEMALE">Female (F) Room</option>
                            <option value="FAMILY">Family Room</option>
                            <option value="GUEST">Guest Room</option>
                            <option value="ANY">Any / Unrestricted</option>
                          </select>
                        </div>

                        {/* Status */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Initial Status
                          </label>
                          <select
                            value={grp.status}
                            onChange={(e) =>
                              handleUpdateRoomGroup(grp.id, {
                                status: e.target.value as RoomStatus,
                              })
                            }
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="ACTIVE">Active</option>
                            <option value="MAINTENANCE">Maintenance</option>
                            <option value="INACTIVE">Inactive</option>
                          </select>
                        </div>
                      </div>

                      {/* Units Provisioning Box */}
                      <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                            <span>Room Units Provisioning (Per Room)</span>
                          </h4>
                          <span className="text-[11px] font-mono font-semibold px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                            {grpBeds + grpMats} Units / Room
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              🛏️ Total Beds per Room
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={grp.totalBeds}
                              onChange={(e) =>
                                handleUpdateRoomGroup(grp.id, {
                                  totalBeds: parseInt(e.target.value) || 0,
                                })
                              }
                              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-[10px] text-slate-400 mt-0.5 block">
                              Auto-creates B1, B2...
                            </span>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              🧘 Floor Mats per Room
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={grp.totalMats}
                              onChange={(e) =>
                                handleUpdateRoomGroup(grp.id, {
                                  totalMats: parseInt(e.target.value) || 0,
                                })
                              }
                              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-[10px] text-slate-400 mt-0.5 block">
                              Auto-creates M1, M2...
                            </span>
                          </div>
                        </div>

                        <div className="text-[11px] text-slate-500 flex items-center gap-1 pt-1">
                          <span>ℹ️</span>
                          <span>
                            Each room gets <strong>{grpBeds} Beds</strong> &amp;{' '}
                            <strong>{grpMats} Mats</strong> inheriting{' '}
                            <strong>{grp.genderPreference}</strong> category.
                          </span>
                        </div>
                      </div>

                      {/* Notes */}
                      <div>
                        <input
                          type="text"
                          placeholder="Notes / Amenities (e.g. Attached washroom, ground floor accessible...)"
                          value={grp.notes}
                          onChange={(e) =>
                            handleUpdateRoomGroup(grp.id, { notes: e.target.value })
                          }
                          className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  );
                })}

                {/* Add Another Room Group Button */}
                <button
                  type="button"
                  onClick={handleAddRoomGroup}
                  className="w-full py-2.5 border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/40 hover:bg-blue-50 text-blue-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Add Another Room Group (Different Beds / Mats)</span>
                </button>
              </div>

              {/* Dynamic Overall Summary Box */}
              {modalSummary.totalRooms > 0 && (
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-blue-600" />
                      <span>Ready to Provision {modalSummary.totalRooms} Room(s)</span>
                    </h5>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Total Inventory Capacity:{' '}
                      <strong className="text-slate-900">{modalSummary.totalBeds} Beds</strong> +{' '}
                      <strong className="text-slate-900">{modalSummary.totalMats} Floor Mats</strong> ={' '}
                      <strong className="text-blue-700 font-bold">{modalSummary.totalUnits} Total Units</strong>
                    </p>
                  </div>
                  <div className="text-[11px] font-mono font-bold text-slate-700 bg-white/80 px-3 py-1.5 rounded-lg border border-blue-100 self-start sm:self-auto">
                    {modalSummary.totalRooms} Rooms | {modalSummary.totalUnits} Units
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddRoomOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || modalSummary.totalRooms === 0}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
                >
                  {actionLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span>
                    Create {modalSummary.totalRooms > 0 ? `${modalSummary.totalRooms} Room(s)` : 'Rooms'} &amp; Inventory
                    {modalSummary.totalUnits > 0 ? ` (${modalSummary.totalUnits} Units)` : ''}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 2: EDIT ROOM DIALOG                                          */}
      {/* ------------------------------------------------------------------ */}
      {isEditRoomOpen && editingRoom && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold">Edit Room {editingRoom.roomNumber}</h3>
              </div>
              <button onClick={() => setIsEditRoomOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateRoom} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hotel / Facility
                </label>
                <select
                  value={editRoomForm.hotelId || ''}
                  onChange={(e) => setEditRoomForm({ ...editRoomForm, hotelId: e.target.value || null })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- No Hotel / Unassigned --</option>
                  {hotels.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Building / Block
                  </label>
                  <input
                    type="text"
                    value={editRoomForm.building || ''}
                    onChange={(e) => setEditRoomForm({ ...editRoomForm, building: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Floor
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editRoomForm.floor ?? 1}
                    onChange={(e) => setEditRoomForm({ ...editRoomForm, floor: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Room Category
                  </label>
                  <select
                    value={editRoomForm.genderPreference}
                    onChange={(e) => setEditRoomForm({ ...editRoomForm, genderPreference: e.target.value as GenderPreference })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    <option value="MALE">Male (M) Room</option>
                    <option value="FEMALE">Female (F) Room</option>
                    <option value="FAMILY">Family Room</option>
                    <option value="GUEST">Guest Room</option>
                    <option value="ANY">Any / Unrestricted</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status
                  </label>
                  <select
                    value={editRoomForm.status}
                    onChange={(e) => setEditRoomForm({ ...editRoomForm, status: e.target.value as RoomStatus })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notes
                </label>
                <textarea
                  rows={3}
                  value={editRoomForm.notes || ''}
                  onChange={(e) => setEditRoomForm({ ...editRoomForm, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                ></textarea>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditRoomOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 3: ADD UNIT TO ROOM DIALOG                                   */}
      {/* ------------------------------------------------------------------ */}
      {isAddUnitOpen && selectedRoomDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold">Add Unit to Room {selectedRoomDetail.roomNumber}</h3>
              </div>
              <button onClick={() => setIsAddUnitOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddUnit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Unit Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. B7 or M3"
                    value={newUnit.unitNumber}
                    onChange={(e) => setNewUnit({ ...newUnit, unitNumber: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Unit Type
                  </label>
                  <select
                    value={newUnit.type}
                    onChange={(e) => setNewUnit({ ...newUnit, type: e.target.value as UnitType })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="BED">Bed (B)</option>
                    <option value="MAT">Mat (M)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Gender Category
                  </label>
                  <select
                    value={newUnit.genderCategory}
                    onChange={(e) => setNewUnit({ ...newUnit, genderCategory: e.target.value as GenderCategory })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ANY">Any</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status
                  </label>
                  <select
                    value={newUnit.status}
                    onChange={(e) => setNewUnit({ ...newUnit, status: e.target.value as UnitStatus })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Near window"
                  value={newUnit.notes || ''}
                  onChange={(e) => setNewUnit({ ...newUnit, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddUnitOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Add Unit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 4: EDIT UNIT DIALOG                                          */}
      {/* ------------------------------------------------------------------ */}
      {isEditUnitOpen && editingUnit && selectedRoomDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold">
                  Edit Unit {editingUnit.unitNumber} ({selectedRoomDetail.roomNumber})
                </h3>
              </div>
              <button onClick={() => setIsEditUnitOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateUnit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Gender Category
                  </label>
                  <select
                    value={editUnitForm.genderCategory}
                    onChange={(e) => setEditUnitForm({ ...editUnitForm, genderCategory: e.target.value as GenderCategory })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ANY">Any</option>
                    <option value="MALE">Male (M)</option>
                    <option value="FEMALE">Female (F)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status
                  </label>
                  <select
                    value={editUnitForm.status}
                    onChange={(e) => setEditUnitForm({ ...editUnitForm, status: e.target.value as UnitStatus })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Maintenance / Service Notes
                </label>
                <textarea
                  rows={2}
                  value={editUnitForm.notes}
                  onChange={(e) => setEditUnitForm({ ...editUnitForm, notes: e.target.value })}
                  placeholder="e.g. Slat broken, undergoing repair..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                ></textarea>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditUnitOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save Unit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 5: DELETE ROOM CONFIRMATION DIALOG                           */}
      {/* ------------------------------------------------------------------ */}
      {isDeleteConfirmOpen && roomToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95 my-4 max-h-[92vh] overflow-y-auto">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">Delete Room {roomToDelete.roomNumber}?</h3>
              <p className="text-xs text-slate-500">
                This will delete the room and its {roomToDelete.unitCount} inventory units. 
                Rooms with existing allocations or stay records cannot be deleted.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteRoom}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5B: BULK DELETE ROOMS CONFIRMATION DIALOG */}
      {isBulkDeleteModalOpen && selectedRoomIdsForBulk.length > 0 && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95 my-4 max-h-[92vh] overflow-y-auto">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-slate-900">
                Delete {selectedRoomIdsForBulk.length} Selected Rooms?
              </h3>
              <p className="text-xs text-slate-500">
                This will permanently delete these {selectedRoomIdsForBulk.length} rooms and all of their provisioned bed and mat inventory units from the database.
              </p>
            </div>

            {/* List of rooms to be deleted */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 max-h-36 overflow-y-auto">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Selected Rooms to Delete:
              </span>
              <div className="flex flex-wrap gap-1">
                {rooms
                  .filter((r) => selectedRoomIdsForBulk.includes(r.id))
                  .map((r) => (
                    <span
                      key={r.id}
                      className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded font-mono text-[11px] font-bold"
                    >
                      Room {r.roomNumber}
                    </span>
                  ))}
              </div>
            </div>

            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Safety protection: Rooms with active allocations or checked-in guests will not be deleted to protect event data.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkDelete}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
              >
                {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Yes, Delete {selectedRoomIdsForBulk.length} Rooms</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 6: ADD HOTEL / BUILDING DIALOG                               */}
      {/* ------------------------------------------------------------------ */}
      {isAddHotelOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 my-8">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold">Add Hotel / Building Facility</h3>
              </div>
              <button onClick={() => setIsAddHotelOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateHotel} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hotel / Building Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Grand Heritage Wing"
                  value={newHotelForm.name}
                  onChange={(e) => setNewHotelForm({ ...newHotelForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Address / Location
                </label>
                <input
                  type="text"
                  placeholder="e.g. Near West Gate, Campus 2"
                  value={newHotelForm.address || ''}
                  onChange={(e) => setNewHotelForm({ ...newHotelForm, address: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={newHotelForm.contactPhone || ''}
                    onChange={(e) => setNewHotelForm({ ...newHotelForm, contactPhone: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. desk@hotel.com"
                    value={newHotelForm.contactEmail || ''}
                    onChange={(e) => setNewHotelForm({ ...newHotelForm, contactEmail: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notes / Description
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Primary facility for VIP and family guests..."
                  value={newHotelForm.notes || ''}
                  onChange={(e) => setNewHotelForm({ ...newHotelForm, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                ></textarea>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddHotelOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Create Hotel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 7: EDIT HOTEL DIALOG                                         */}
      {/* ------------------------------------------------------------------ */}
      {isEditHotelOpen && editingHotel && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 my-8">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold">Edit Hotel: {editingHotel.name}</h3>
              </div>
              <button onClick={() => setIsEditHotelOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateHotel} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hotel Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editHotelForm.name || ''}
                  onChange={(e) => setEditHotelForm({ ...editHotelForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={editHotelForm.address || ''}
                  onChange={(e) => setEditHotelForm({ ...editHotelForm, address: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={editHotelForm.contactPhone || ''}
                    onChange={(e) => setEditHotelForm({ ...editHotelForm, contactPhone: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editHotelForm.contactEmail || ''}
                    onChange={(e) => setEditHotelForm({ ...editHotelForm, contactEmail: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={editHotelForm.notes || ''}
                  onChange={(e) => setEditHotelForm({ ...editHotelForm, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                ></textarea>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditHotelOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save Hotel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 8: DELETE HOTEL CONFIRMATION DIALOG                          */}
      {/* ------------------------------------------------------------------ */}
      {isDeleteHotelOpen && hotelToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95 my-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">Delete Hotel {hotelToDelete.name}?</h3>
              {hotelToDelete.roomCount > 0 ? (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 text-left">
                  ⚠️ This hotel currently has <strong>{hotelToDelete.roomCount} room(s)</strong> assigned to it. You must reassign or delete the rooms before deleting this hotel facility.
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  This hotel has no rooms and can be safely deleted. This action cannot be undone.
                </p>
              )}
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setIsDeleteHotelOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteHotel}
                disabled={actionLoading || hotelToDelete.roomCount > 0}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Yes, Delete Hotel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
