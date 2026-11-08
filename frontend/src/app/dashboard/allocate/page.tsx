'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { 
  Bed, 
  Layers, 
  Calendar, 
  Search, 
  Filter, 
  Building, 
  UserCheck, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  X, 
  Check, 
  Plus, 
  RefreshCw, 
  AlertTriangle, 
  Eye, 
  ShieldAlert, 
  Ban, 
  Sparkles,
  ArrowRight,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  User,
  SlidersHorizontal,
  BookmarkCheck,
  MessageSquare,
  Send,
  ExternalLink,
  History,
  Smartphone,
  Share2,
  LogOut,
  CheckSquare,
  Wrench,
  LayoutGrid,
  List,
  Percent
} from 'lucide-react';
import { 
  api, 
  RegistrationListItem, 
  RegistrationDetail,
  AllocationListItem, 
  AllocationStatus, 
  AvailabilityRoom, 
  AvailabilityUnit,
  GenderCategory,
  GenderPreference,
  UnitType,
  WhatsAppPreparedData,
  MessageLogItem,
  MessageStatus,
  HotelListItem
} from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function AllocatePage() {
  const { user } = useAuth();
  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'ALLOCATION_MANAGER';
  const canSendWhatsApp = user?.role === 'SUPER_ADMIN' || user?.role === 'ALLOCATION_MANAGER' || user?.role === 'RECEPTION_STAFF';

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'WORKBENCH' | 'DIRECTORY'>('WORKBENCH');

  // Loading & Alerts
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // WHATSAPP CLICK-TO-CHAT STATE
  // --------------------------------------------------------------------------
  const [whatsappAllocation, setWhatsappAllocation] = useState<AllocationListItem | null>(null);
  const [whatsappModalOpen, setWhatsappModalOpen] = useState<boolean>(false);
  const [whatsappTab, setWhatsappTab] = useState<'PREVIEW' | 'HISTORY'>('PREVIEW');
  const [whatsappLoading, setWhatsappLoading] = useState<boolean>(false);
  const [whatsappPreparedData, setWhatsappPreparedData] = useState<WhatsAppPreparedData | null>(null);
  const [whatsappOpenedState, setWhatsappOpenedState] = useState<boolean>(false);
  const [whatsappConfirmNotes, setWhatsappConfirmNotes] = useState<string>('');
  const [whatsappFailureReason, setWhatsappFailureReason] = useState<string>('');
  const [whatsappHistoryLogs, setWhatsappHistoryLogs] = useState<MessageLogItem[]>([]);
  const [whatsappHelpdeskContact, setWhatsappHelpdeskContact] = useState<string>('+91 98765 43210');
  const [whatsappCustomNotes, setWhatsappCustomNotes] = useState<string>('');
  const [whatsappActionSubmitting, setWhatsappActionSubmitting] = useState<boolean>(false);
  const [whatsappActionSuccess, setWhatsappActionSuccess] = useState<string | null>(null);
  const [whatsappActionError, setWhatsappActionError] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // WORKBENCH STATE
  // --------------------------------------------------------------------------
  // Step 1: Registration
  const [registrations, setRegistrations] = useState<RegistrationListItem[]>([]);
  const [regSearchQuery, setRegSearchQuery] = useState<string>('');
  const [selectedReg, setSelectedReg] = useState<RegistrationListItem | null>(null);
  const [selectedRegDetail, setSelectedRegDetail] = useState<RegistrationDetail | null>(null);
  const [showRegDropdown, setShowRegDropdown] = useState<boolean>(false);
  const [showBasketRegDropdown, setShowBasketRegDropdown] = useState<boolean>(false);
  const basketSearchRef = useRef<HTMLInputElement>(null);

  const handleSelectRegistration = async (r: RegistrationListItem) => {
    setSelectedReg(r);
    setShowRegDropdown(false);
    setShowBasketRegDropdown(false);
    try {
      const res = await api.getRegistration(r.id);
      if (res.success && res.data) {
        setSelectedRegDetail(res.data);
      }
    } catch (e) {
      console.warn('Failed to load full registration details', e);
    }
  };

  // Quick Add Person / Family State
  const [assignMode, setAssignMode] = useState<'NEW' | 'EXISTING'>('NEW');
  const [newPersonName, setNewPersonName] = useState<string>('');
  const [newPersonMobile, setNewPersonMobile] = useState<string>('');
  const [newPersonCity, setNewPersonCity] = useState<string>('');
  const [newPersonAadhaar, setNewPersonAadhaar] = useState<string>('');
  const [newPersonCheckInNow, setNewPersonCheckInNow] = useState<boolean>(false);
  const [guestCategory, setGuestCategory] = useState<'MALE' | 'FEMALE' | 'FAMILY' | 'GUEST' | 'SINGLE' | 'MULTIPLE'>('MALE');
  const [quickAddSubmitting, setQuickAddSubmitting] = useState<boolean>(false);
  const [isTrayMinimized, setIsTrayMinimized] = useState<boolean>(false);
  const [isMobileAssignOpen, setIsMobileAssignOpen] = useState<boolean>(false);
  const [activeBedModal, setActiveBedModal] = useState<{ room: AvailabilityRoom; unit: AvailabilityUnit } | null>(null);
  const [bedActionLoading, setBedActionLoading] = useState<boolean>(false);

  // Bed Options Modal State
  const [modalCheckInTime, setModalCheckInTime] = useState<string>('');
  const [modalCheckOutTime, setModalCheckOutTime] = useState<string>('');
  const [modalParticipants, setModalParticipants] = useState<Array<{
    unitId: string;
    unitNumber: string;
    roomNumber: string;
    unitType: string;
    fullName: string;
    gender: string;
    age: string;
    aadhaarNumber: string;
  }>>([]);
  const [accompanyingMembersData, setAccompanyingMembersData] = useState<Array<{
    fullName: string;
    gender: string;
    age: string;
    aadhaarNumber: string;
  }>>([]);

  // Step 2: Date Window
  const todayStr = new Date().toISOString().slice(0, 10);
  const defaultExit = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [entryDate, setEntryDate] = useState<string>(todayStr);
  const [exitDate, setExitDate] = useState<string>(defaultExit);
  const [newPersonCheckInTime, setNewPersonCheckInTime] = useState<string>(`${todayStr}T10:00`);
  const [newPersonCheckOutTime, setNewPersonCheckOutTime] = useState<string>(`${defaultExit}T10:00`);

  // Step 3: Availability & Unit Selection
  const [hotels, setHotels] = useState<HotelListItem[]>([]);
  const [filterHotelId, setFilterHotelId] = useState<string>('ALL');
  const [availabilityRooms, setAvailabilityRooms] = useState<AvailabilityRoom[]>([]);
  const [availabilitySummary, setAvailabilitySummary] = useState<any>(null);
  const [filterBuilding, setFilterBuilding] = useState<string>('ALL');
  const [filterGender, setFilterGender] = useState<string>('ALL');
  const [filterUnitType, setFilterUnitType] = useState<string>('ALL');
  const [filterRoomCategory, setFilterRoomCategory] = useState<string>('ALL');
  const [roomSearchQuery, setRoomSearchQuery] = useState<string>('');
  const [occupancyFilter, setOccupancyFilter] = useState<'ALL' | '0' | '25' | '50' | '75' | '100'>('ALL');
  const [viewMode, setViewMode] = useState<'DETAILED' | 'COMPACT'>('DETAILED');
  const [selectedUnits, setSelectedUnits] = useState<Array<{
    unitId: string;
    unitNumber: string;
    unitType: UnitType;
    genderCategory: GenderCategory;
    roomId: string;
    roomNumber: string;
    building: string | null;
    roomCategory?: GenderPreference;
  }>>([]);

  // Fetch hotels for facility dropdown
  useEffect(() => {
    const loadHotels = async () => {
      try {
        const res = await api.getHotels();
        if (res.success && res.data) {
          setHotels(res.data);
        }
      } catch (err) {
        console.error('Failed to load hotels list', err);
      }
    };
    loadHotels();
  }, []);

  useEffect(() => {
    if (selectedUnits.length === 1) {
      setGuestCategory('SINGLE');
    } else if (selectedUnits.length > 1 && guestCategory === 'SINGLE') {
      setGuestCategory('FAMILY');
    }
  }, [selectedUnits.length]);

  useEffect(() => {
    if (selectedUnits.length > 1) {
      setAccompanyingMembersData((prev) => {
        const next = [...prev];
        while (next.length < selectedUnits.length - 1) {
          next.push({ fullName: '', gender: '', age: '', aadhaarNumber: '' });
        }
        return next.slice(0, selectedUnits.length - 1);
      });
    } else {
      setAccompanyingMembersData([]);
    }
  }, [selectedUnits.length]);

  useEffect(() => {
    if (entryDate) setNewPersonCheckInTime(`${entryDate}T10:00`);
    if (exitDate) setNewPersonCheckOutTime(`${exitDate}T10:00`);
  }, [entryDate, exitDate]);

  // Step 4: Reservation Status & Notes
  const [allocationStatus, setAllocationStatus] = useState<AllocationStatus>('TENTATIVE');
  const [notes, setNotes] = useState<string>('');

  // --------------------------------------------------------------------------
  // ALLOCATIONS DIRECTORY STATE
  // --------------------------------------------------------------------------
  const [allocations, setAllocations] = useState<AllocationListItem[]>([]);
  const [allocMetrics, setAllocMetrics] = useState<any>({
    totalAllocations: 0,
    TENTATIVE: 0,
    CONFIRMED: 0,
    CANCELLED: 0,
  });
  const [allocSearch, setAllocSearch] = useState<string>('');
  const [allocStatusFilter, setAllocStatusFilter] = useState<string>('ALL');
  const [allocPage, setAllocPage] = useState<number>(1);
  const [allocTotalPages, setAllocTotalPages] = useState<number>(1);
  const [allocTotalCount, setAllocTotalCount] = useState<number>(0);

  // Modals
  const [viewingAllocation, setViewingAllocation] = useState<any | null>(null);
  const [cancellingAllocation, setCancellingAllocation] = useState<AllocationListItem | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('Cancelled by administrative request');

  // Auto-dismiss messages
  useEffect(() => {
    if (successMessage) {
      const t = setTimeout(() => setSuccessMessage(null), 6000);
      return () => clearTimeout(t);
    }
  }, [successMessage]);

  useEffect(() => {
    if (errorMessage) {
      const t = setTimeout(() => setErrorMessage(null), 8000);
      return () => clearTimeout(t);
    }
  }, [errorMessage]);

  // Load Registrations for selector
  const fetchRegistrationsForSelect = async () => {
    try {
      const res = await api.getRegistrations({
        limit: 50,
        q: regSearchQuery,
        status: 'REGISTERED',
      });
      if (res.success && res.data) {
        setRegistrations(res.data);
      }
    } catch (e) {
      // Ignore background fetch error
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchRegistrationsForSelect();
    }, 300);
    return () => clearTimeout(handler);
  }, [regSearchQuery]);

  // Load Availability for date window
  const fetchAvailability = async () => {
    if (!entryDate || !exitDate) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.checkAvailability({
        entryDate: `${entryDate}T10:00:00.000Z`,
        exitDate: `${exitDate}T10:00:00.000Z`,
        hotelId: filterHotelId !== 'ALL' ? filterHotelId : undefined,
        building: filterBuilding !== 'ALL' ? filterBuilding : undefined,
        genderCategory: filterGender !== 'ALL' ? (filterGender as GenderCategory) : undefined,
        unitType: filterUnitType !== 'ALL' ? (filterUnitType as UnitType) : undefined,
        roomCategory: filterRoomCategory !== 'ALL' ? (filterRoomCategory as GenderPreference) : undefined,
      });

      if (res.success && res.data) {
        setAvailabilityRooms(res.data.rooms);
        setAvailabilitySummary(res.data.summary);
      } else {
        setErrorMessage(res.message || 'Failed to query inventory availability');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error checking unit availability');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'WORKBENCH') {
      fetchAvailability();
    }
  }, [entryDate, exitDate, filterHotelId, filterBuilding, filterGender, filterUnitType, filterRoomCategory, activeTab]);

  // Load Allocations Directory
  const fetchAllocations = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.getAllocations({
        page: allocPage,
        limit: 10,
        q: allocSearch,
        status: allocStatusFilter,
      });

      if (res.success && res.data) {
        setAllocations(res.data);
        if (res.pagination) {
          setAllocTotalPages(res.pagination.totalPages);
          setAllocTotalCount(res.pagination.totalCount);
        }
        if (res.metrics) {
          setAllocMetrics(res.metrics);
        }
      } else {
        setErrorMessage(res.message || 'Failed to load allocations');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error fetching allocations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'DIRECTORY') {
      fetchAllocations();
    }
  }, [allocPage, allocStatusFilter, activeTab]);

  useEffect(() => {
    if (activeTab === 'DIRECTORY') {
      const handler = setTimeout(() => {
        setAllocPage(1);
        fetchAllocations();
      }, 400);
      return () => clearTimeout(handler);
    }
  }, [allocSearch]);

  // Open Bed Occupancy Modal for single or linked multi-bed reservations
  const openBedModal = (room: AvailabilityRoom, unit: AvailabilityUnit) => {
    setActiveBedModal({ room, unit });
    const conflict = unit.conflict;
    const nowTime = new Date().toISOString().slice(0, 16);
    const endTime = conflict?.exitDate
      ? new Date(conflict.exitDate).toISOString().slice(0, 16)
      : new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 16);

    setModalCheckInTime(
      conflict?.actualCheckIn
        ? new Date(conflict.actualCheckIn).toISOString().slice(0, 16)
        : conflict?.entryDate
        ? new Date(conflict.entryDate).toISOString().slice(0, 16)
        : nowTime
    );
    setModalCheckOutTime(endTime);

    const linkedUnits: Array<any> = conflict?.allUnits && conflict.allUnits.length > 0
      ? conflict.allUnits
      : [{
          unitId: unit.id,
          unitNumber: unit.unitNumber,
          unitType: unit.type,
          genderCategory: unit.genderCategory,
          roomNumber: room.roomNumber,
          participantName: conflict?.participantName || conflict?.primaryName || '',
        }];

    setModalParticipants(
      linkedUnits.map((u: any, idx: number) => {
        const existingParticipant = conflict?.participants?.[idx];
        return {
          unitId: u.unitId,
          unitNumber: u.unitNumber,
          roomNumber: u.roomNumber || room.roomNumber,
          unitType: u.unitType || unit.type,
          fullName: u.participantName || existingParticipant?.fullName || (idx === 0 ? conflict?.primaryName || '' : ''),
          gender: existingParticipant?.gender || '',
          age: existingParticipant?.age ? String(existingParticipant.age) : '',
          aadhaarNumber: existingParticipant?.aadhaarRecord?.lastFourDigits ? `**** **** ${existingParticipant.aadhaarRecord.lastFourDigits}` : '',
        };
      })
    );
  };

  const updateModalParticipant = (index: number, field: string, value: string) => {
    setModalParticipants((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], [field]: value };
      }
      return next;
    });
  };

  const updateAccompanyingMember = (index: number, field: string, value: string) => {
    setAccompanyingMembersData((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], [field]: value };
      }
      return next;
    });
  };

  // Toggle unit selection
  const handleToggleUnit = (room: AvailabilityRoom, unit: AvailabilityUnit) => {
    if (!unit.isAvailable) {
      // Direct rewrite options for occupied / reserved / maintenance bed
      openBedModal(room, unit);
      return;
    }

    const exists = selectedUnits.some((u) => u.unitId === unit.id);
    if (exists) {
      setSelectedUnits(selectedUnits.filter((u) => u.unitId !== unit.id));
    } else {
      setSelectedUnits([
        ...selectedUnits,
        {
          unitId: unit.id,
          unitNumber: unit.unitNumber,
          unitType: unit.type,
          genderCategory: unit.genderCategory,
          roomId: room.id,
          roomNumber: room.roomNumber,
          building: room.building,
          roomCategory: room.genderPreference,
        },
      ]);
    }
  };

  // Direct Rewrite of Bed Occupancy Status (Check In, Check Out, Release Allocation, Maintenance)
  const handleRewriteUnitStatus = async (
    action: 'CHECK_IN' | 'CHECK_OUT' | 'RELEASE_ALLOCATION' | 'SET_MAINTENANCE' | 'SET_ACTIVE',
    notes?: string
  ) => {
    if (!activeBedModal) return;
    setBedActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.rewriteUnitStatus(activeBedModal.unit.id, action, {
        notes,
        checkInDateTime: modalCheckInTime ? `${modalCheckInTime}:00.000Z` : undefined,
        checkOutDateTime: modalCheckOutTime ? `${modalCheckOutTime}:00.000Z` : undefined,
        participants: modalParticipants.map((p) => ({
          unitId: p.unitId,
          fullName: p.fullName.trim() || 'Guest',
          gender: (p.gender as any) || null,
          age: p.age ? Number(p.age) : null,
          aadhaarNumber: p.aadhaarNumber && !p.aadhaarNumber.includes('*') ? p.aadhaarNumber.trim() : undefined,
        })),
      });
      if (res.success) {
        setSuccessMessage(res.message || `Bed updated successfully.`);
        setActiveBedModal(null);
        await fetchAvailability();
        await fetchAllocations();
      } else {
        setErrorMessage(res.message || 'Failed to update bed status');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error updating bed occupancy status');
    } finally {
      setBedActionLoading(false);
    }
  };

  const handleRemoveSelectedUnit = (unitId: string) => {
    setSelectedUnits(selectedUnits.filter((u) => u.unitId !== unitId));
  };

  // Submit Allocation
  const handleCommitAllocation = async () => {
    if (!selectedReg) {
      setErrorMessage('Please select a registration to allocate accommodation.');
      return;
    }
    if (selectedUnits.length === 0) {
      setErrorMessage('Please select at least one bed or mat unit.');
      return;
    }

    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.createAllocation({
        registrationId: selectedReg.registrationId,
        entryDate: `${entryDate}T10:00:00.000Z`,
        exitDate: `${exitDate}T10:00:00.000Z`,
        unitIds: selectedUnits.map((u) => u.unitId),
        status: allocationStatus,
        notes: notes || undefined,
      });

      if (res.success && res.data) {
        setSuccessMessage(`Allocation ${res.data.allocationNumber} successfully reserved for ${selectedReg.primaryName}!`);
        // Reset form
        setSelectedUnits([]);
        setSelectedReg(null);
        setNotes('');
        await fetchAvailability();
        // Switch to directory to see new allocation
        setActiveTab('DIRECTORY');
      } else {
        setErrorMessage(res.message || 'Failed to create allocation');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error processing accommodation allocation');
    } finally {
      setActionLoading(false);
    }
  };

  // Quick Add New Person / Family and Assign Selected Beds in One Click
  const handleQuickAddAndAssign = async () => {
    if (!newPersonName.trim()) {
      setErrorMessage('Please enter the person or family name.');
      return;
    }
    if (!newPersonMobile.trim() || newPersonMobile.trim().length < 7) {
      setErrorMessage('Please enter a valid phone number.');
      return;
    }
    if (selectedUnits.length === 0) {
      setErrorMessage('Please select at least one bed or mat first.');
      return;
    }

    setQuickAddSubmitting(true);
    setErrorMessage(null);
    try {
      // 1. Determine members & category tag based on category
      const totalMembers = Math.max(1, selectedUnits.length);
      const hasMaleUnits = selectedUnits.some(u => u.roomCategory === 'MALE' || u.genderCategory === 'MALE');
      const hasFemaleUnits = selectedUnits.some(u => u.roomCategory === 'FEMALE' || u.genderCategory === 'FEMALE');
      const isMixedSplit = hasMaleUnits && hasFemaleUnits && guestCategory !== 'FAMILY';

      const categoryTag = isMixedSplit
        ? `[Category: Friends / Mixed Group (${totalMembers} Persons)]`
        : guestCategory === 'MALE'
        ? `[Category: Male Group (${totalMembers} Persons)]`
        : guestCategory === 'FEMALE'
        ? `[Category: Female Group (${totalMembers} Persons)]`
        : guestCategory === 'FAMILY'
        ? `[Guest: Family (${totalMembers} Members)]`
        : guestCategory === 'GUEST'
        ? `[Guest: Special / VIP (${totalMembers} Members)]`
        : guestCategory === 'SINGLE'
        ? `[Guest: Single Person]`
        : `[Guest: Multiple Group (${totalMembers} Persons)]`;
      const combinedNotes = notes ? `${categoryTag} ${notes}` : categoryTag;

      // Primary registrant gender: matches first selected unit room category or guestCategory
      const primaryUnit = selectedUnits[0];
      const primaryGender = primaryUnit?.roomCategory === 'FEMALE' ? 'FEMALE' : (guestCategory === 'FEMALE' ? 'FEMALE' : 'MALE');

      // Accompanying members from form
      const accompanyingMembers = (accompanyingMembersData || []).slice(0, selectedUnits.length - 1).map((m, idx) => {
        const correspondingUnit = selectedUnits[idx + 1];
        const inferredGender = correspondingUnit?.roomCategory === 'MALE' ? 'MALE' : correspondingUnit?.roomCategory === 'FEMALE' ? 'FEMALE' : null;
        return {
          fullName: m.fullName.trim() || `Guest ${idx + 2}`,
          gender: (m.gender as any) || inferredGender || (guestCategory === 'MALE' ? 'MALE' : guestCategory === 'FEMALE' ? 'FEMALE' : 'MALE'),
          age: m.age ? Number(m.age) : null,
          relationToPrimary: 'Accompanying',
        };
      });

      const regRes = await api.createRegistration({
        primaryName: newPersonName.trim(),
        gender: primaryGender as any,
        primaryGender: primaryGender as any,
        mobile: newPersonMobile.trim(),
        city: newPersonCity.trim() || undefined,
        totalMembers,
        notes: combinedNotes,
        accompanyingMembers,
      });

      if (!regRes.success || !regRes.data) {
        const errorMsg = (regRes as any).errors?.map((e: any) => e.message).join(', ') || regRes.message || 'Failed to create registration';
        setErrorMessage(errorMsg);
        setQuickAddSubmitting(false);
        return;
      }

      const createdReg = regRes.data;

      // If primary or accompanying Aadhaar provided, record securely
      if (newPersonAadhaar.trim().length >= 4 || accompanyingMembersData.some(m => m.aadhaarNumber && m.aadhaarNumber.trim().length >= 4)) {
        try {
          const detailRes = await api.getRegistration(createdReg.id);
          const primaryParticipant = detailRes.data?.participants?.find((p) => p.isPrimary);
          if (primaryParticipant && newPersonAadhaar.trim().length >= 4) {
            await api.collectReceptionAadhaar({
              participantId: primaryParticipant.id,
              aadhaarNumber: newPersonAadhaar.trim(),
              retentionConsent: true,
            });
          }
          const otherParticipants = detailRes.data?.participants?.filter((p) => !p.isPrimary) || [];
          for (let i = 0; i < otherParticipants.length; i++) {
            const memberAadhaar = accompanyingMembersData[i]?.aadhaarNumber?.trim();
            if (memberAadhaar && memberAadhaar.length >= 4 && otherParticipants[i]) {
              await api.collectReceptionAadhaar({
                participantId: otherParticipants[i].id,
                aadhaarNumber: memberAadhaar,
                retentionConsent: true,
              });
            }
          }
        } catch (e) {
          console.warn('Aadhaar save notice:', e);
        }
      }

      // 2. Allocate selected beds to this new registration with selected date & time
      const entryISO = newPersonCheckInTime ? `${newPersonCheckInTime}:00.000Z` : `${entryDate}T10:00:00.000Z`;
      const exitISO = newPersonCheckOutTime ? `${newPersonCheckOutTime}:00.000Z` : `${exitDate}T10:00:00.000Z`;

      const allocRes = await api.createAllocation({
        registrationId: createdReg.registrationId,
        entryDate: entryISO,
        exitDate: exitISO,
        unitIds: selectedUnits.map((u) => u.unitId),
        status: newPersonCheckInNow ? 'CONFIRMED' : allocationStatus,
        notes: combinedNotes,
      });

      if (!allocRes.success || !allocRes.data) {
        const allocErr = (allocRes as any).errors?.map((e: any) => e.message).join(', ') || allocRes.message || 'Registration created, but failed to assign beds.';
        setErrorMessage(allocErr);
        setQuickAddSubmitting(false);
        return;
      }

      // 3. If immediate check-in was requested, activate check-in now!
      if (newPersonCheckInNow && selectedUnits.length > 0) {
        await api.rewriteUnitStatus(selectedUnits[0].unitId, 'CHECK_IN', {
          checkInDateTime: entryISO,
          checkOutDateTime: exitISO,
        });
      }

      setSuccessMessage(
        newPersonCheckInNow
          ? `✓ Checked In! ${selectedUnits.length} bed(s) confirmed and occupied for ${createdReg.primaryName}!`
          : `✓ Reserved! ${selectedUnits.length} bed(s) assigned to ${createdReg.primaryName} (${allocRes.data.allocationNumber})!`
      );

      // Reset form
      setSelectedUnits([]);
      setSelectedReg(null);
      setNewPersonName('');
      setNewPersonMobile('');
      setNewPersonAadhaar('');
      setNewPersonCity('');
      setNewPersonCheckInNow(false);
      setAccompanyingMembersData([]);
      setNotes('');
      await fetchAvailability();
      await fetchAllocations();
      setActiveTab('DIRECTORY');
    } catch (err: any) {
      setErrorMessage(err.message || 'Error creating person and assigning beds');
    } finally {
      setQuickAddSubmitting(false);
    }
  };

  // Cancel Allocation
  const handleConfirmCancel = async () => {
    if (!cancellingAllocation) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.cancelAllocation(cancellingAllocation.id, cancelReason);
      if (res.success) {
        setSuccessMessage(`Allocation ${cancellingAllocation.allocationNumber} cancelled and units released immediately.`);
        setCancellingAllocation(null);
        await fetchAllocations();
      } else {
        setErrorMessage(res.message || 'Failed to cancel allocation');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error cancelling allocation');
    } finally {
      setActionLoading(false);
    }
  };

  // WhatsApp Click-to-Chat Handlers
  const openWhatsAppModal = async (alc: AllocationListItem) => {
    setWhatsappAllocation(alc);
    setWhatsappModalOpen(true);
    setWhatsappTab('PREVIEW');
    setWhatsappOpenedState(false);
    setWhatsappConfirmNotes('');
    setWhatsappFailureReason('');
    setWhatsappActionSuccess(null);
    setWhatsappActionError(null);
    await loadWhatsAppPreview(alc.id);
    await loadWhatsAppHistory(alc.registrationId);
  };

  const loadWhatsAppPreview = async (allocationId: string) => {
    setWhatsappLoading(true);
    setWhatsappActionError(null);
    try {
      const res = await api.prepareWhatsAppMessage({
        allocationId,
        helpdeskContact: whatsappHelpdeskContact,
        customNotes: whatsappCustomNotes,
      });
      if (res.success && res.data) {
        setWhatsappPreparedData(res.data);
      } else {
        setWhatsappActionError(res.message || 'Failed to prepare WhatsApp message.');
      }
    } catch (err: any) {
      setWhatsappActionError(err.message || 'Error preparing WhatsApp message');
    } finally {
      setWhatsappLoading(false);
    }
  };

  const loadWhatsAppHistory = async (registrationId: string) => {
    try {
      const res = await api.getWhatsAppMessages({ registrationId, limit: 10 });
      if (res.success && res.data) {
        setWhatsappHistoryLogs(res.data.logs || []);
      }
    } catch {
      // Non-blocking history load
    }
  };

  const handleOpenWhatsAppLink = async () => {
    if (!whatsappPreparedData) return;
    try {
      await api.recordWhatsAppOpened(whatsappPreparedData.messageLogId);
      setWhatsappOpenedState(true);
      window.open(whatsappPreparedData.whatsappUrl, '_blank', 'noopener,noreferrer');
      if (whatsappAllocation) {
        loadWhatsAppHistory(whatsappAllocation.registrationId);
      }
    } catch (err: any) {
      setWhatsappActionError(err.message || 'Failed to record WhatsApp link opening');
    }
  };

  const handleConfirmSent = async () => {
    if (!whatsappPreparedData) return;
    setWhatsappActionSubmitting(true);
    setWhatsappActionError(null);
    try {
      const res = await api.confirmWhatsAppSent(whatsappPreparedData.messageLogId, whatsappConfirmNotes);
      if (res.success && res.data) {
        setWhatsappActionSuccess('Message sending confirmed! Status updated to STAFF_CONFIRMED_SENT.');
        setWhatsappPreparedData((prev) => prev ? { ...prev, status: 'STAFF_CONFIRMED_SENT' } : null);
        if (whatsappAllocation) {
          await loadWhatsAppHistory(whatsappAllocation.registrationId);
        }
      } else {
        setWhatsappActionError(res.message || 'Failed to confirm message sent.');
      }
    } catch (err: any) {
      setWhatsappActionError(err.message || 'Error confirming message sent');
    } finally {
      setWhatsappActionSubmitting(false);
    }
  };

  const handleReportFailed = async () => {
    if (!whatsappPreparedData) return;
    if (!whatsappFailureReason.trim()) {
      setWhatsappActionError('Please provide a reason why sending failed.');
      return;
    }
    setWhatsappActionSubmitting(true);
    setWhatsappActionError(null);
    try {
      const res = await api.recordWhatsAppFailed(whatsappPreparedData.messageLogId, whatsappFailureReason);
      if (res.success && res.data) {
        setWhatsappActionSuccess('Message failure recorded.');
        setWhatsappPreparedData((prev) => prev ? { ...prev, status: 'FAILED' } : null);
        if (whatsappAllocation) {
          await loadWhatsAppHistory(whatsappAllocation.registrationId);
        }
      } else {
        setWhatsappActionError(res.message || 'Failed to record failure.');
      }
    } catch (err: any) {
      setWhatsappActionError(err.message || 'Error recording failure');
    } finally {
      setWhatsappActionSubmitting(false);
    }
  };

  const getAllocBadge = (status: AllocationStatus) => {
    switch (status) {
      case 'TENTATIVE':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">Tentative</span>;
      case 'CONFIRMED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">Confirmed</span>;
      case 'CANCELLED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">Cancelled</span>;
      case 'COMPLETED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">Completed</span>;
    }
  };

  // Dynamic buildings from rooms
  const availableBuildings = useMemo(() => {
    const set = new Set<string>();
    availabilityRooms.forEach((r) => {
      if (r.building?.trim()) set.add(r.building.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [availabilityRooms]);

  // Live Metrics for Reception Desk Summary
  const liveMetrics = useMemo(() => {
    const totalRooms = availabilityRooms.length;
    const totalUnits = availabilityRooms.reduce((acc, r) => acc + (r.totalUnitsInRoom || 0), 0);
    const availableUnits = availabilityRooms.reduce((acc, r) => acc + (r.availableCount || 0), 0);
    const bookedUnits = totalUnits - availableUnits;
    const occupancyRate = totalUnits > 0 ? Math.round((bookedUnits / totalUnits) * 100) : 0;
    const availableBeds = availabilityRooms.reduce((acc, r) => acc + (r.availableBeds || 0), 0);
    const availableMats = availabilityRooms.reduce((acc, r) => acc + (r.availableMats || 0), 0);

    const maleRooms = availabilityRooms.filter((r) => r.genderPreference === 'MALE');
    const femaleRooms = availabilityRooms.filter((r) => r.genderPreference === 'FEMALE');
    const familyRooms = availabilityRooms.filter((r) => r.genderPreference === 'FAMILY');
    const guestRooms = availabilityRooms.filter((r) => r.genderPreference === 'GUEST');

    return {
      totalRooms,
      totalUnits,
      availableUnits,
      bookedUnits,
      occupancyRate,
      availableBeds,
      availableMats,
      male: {
        totalRooms: maleRooms.length,
        availableBeds: maleRooms.reduce((acc, r) => acc + (r.availableBeds || 0), 0),
        availableMats: maleRooms.reduce((acc, r) => acc + (r.availableMats || 0), 0),
        availableUnits: maleRooms.reduce((acc, r) => acc + (r.availableCount || 0), 0),
      },
      female: {
        totalRooms: femaleRooms.length,
        availableBeds: femaleRooms.reduce((acc, r) => acc + (r.availableBeds || 0), 0),
        availableMats: femaleRooms.reduce((acc, r) => acc + (r.availableMats || 0), 0),
        availableUnits: femaleRooms.reduce((acc, r) => acc + (r.availableCount || 0), 0),
      },
      family: {
        totalRooms: familyRooms.length,
        availableBeds: familyRooms.reduce((acc, r) => acc + (r.availableBeds || 0), 0),
        availableMats: familyRooms.reduce((acc, r) => acc + (r.availableMats || 0), 0),
        availableUnits: familyRooms.reduce((acc, r) => acc + (r.availableCount || 0), 0),
      },
      guest: {
        totalRooms: guestRooms.length,
        availableBeds: guestRooms.reduce((acc, r) => acc + (r.availableBeds || 0), 0),
        availableMats: guestRooms.reduce((acc, r) => acc + (r.availableMats || 0), 0),
        availableUnits: guestRooms.reduce((acc, r) => acc + (r.availableCount || 0), 0),
      },
    };
  }, [availabilityRooms]);

  // Filtered and Naturally Sorted Rooms
  const displayedRooms = useMemo(() => {
    let list = [...availabilityRooms];

    // Search room number
    if (roomSearchQuery.trim()) {
      const q = roomSearchQuery.trim().toLowerCase();
      list = list.filter((r) => r.roomNumber.toLowerCase().includes(q));
    }

    // Occupancy Percentage Filter
    if (occupancyFilter !== 'ALL') {
      if (occupancyFilter === '0') {
        // 0% Booked (100% Free)
        list = list.filter((r) => r.availableCount === r.totalUnitsInRoom && r.totalUnitsInRoom > 0);
      } else if (occupancyFilter === '25') {
        // <= 25% Booked
        list = list.filter((r) => {
          const occ = r.occupancyPercentage ?? (r.totalUnitsInRoom > 0 ? Math.round(((r.totalUnitsInRoom - r.availableCount) / r.totalUnitsInRoom) * 100) : 0);
          return occ <= 25;
        });
      } else if (occupancyFilter === '50') {
        // <= 50% Booked
        list = list.filter((r) => {
          const occ = r.occupancyPercentage ?? (r.totalUnitsInRoom > 0 ? Math.round(((r.totalUnitsInRoom - r.availableCount) / r.totalUnitsInRoom) * 100) : 0);
          return occ <= 50;
        });
      } else if (occupancyFilter === '75') {
        // <= 75% Booked
        list = list.filter((r) => {
          const occ = r.occupancyPercentage ?? (r.totalUnitsInRoom > 0 ? Math.round(((r.totalUnitsInRoom - r.availableCount) / r.totalUnitsInRoom) * 100) : 0);
          return occ <= 75;
        });
      } else if (occupancyFilter === '100') {
        // 100% Full / Occupied
        list = list.filter((r) => r.availableCount === 0);
      }
    }

    // Natural numeric ascending sort: 13, 14, 15... 104, 105
    list.sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true, sensitivity: 'base' }));

    return list;
  }, [availabilityRooms, roomSearchQuery, occupancyFilter]);

  // Bulk select / deselect all free beds in a specific room
  const handleSelectAllInRoom = (room: AvailabilityRoom) => {
    const availableUnitsInRoom = room.units.filter((u) => u.isAvailable);
    if (availableUnitsInRoom.length === 0) return;

    const allSelected = availableUnitsInRoom.every((u) => selectedUnits.some((su) => su.unitId === u.id));

    if (allSelected) {
      setSelectedUnits((prev) => prev.filter((su) => su.roomId !== room.id));
    } else {
      const toAdd = availableUnitsInRoom
        .filter((u) => !selectedUnits.some((su) => su.unitId === u.id))
        .map((u) => ({
          unitId: u.id,
          unitNumber: u.unitNumber,
          unitType: u.type,
          genderCategory: u.genderCategory,
          roomId: room.id,
          roomNumber: room.roomNumber,
          building: room.building,
          roomCategory: room.genderPreference,
        }));
      setSelectedUnits((prev) => [...prev, ...toAdd]);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* ------------------------------------------------------------------ */}
      {/* HEADER & TAB NAVIGATION                                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Book &amp; Allocate Beds
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
              Bed Booking
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Select rooms and beds for your guests or families, save tentative bookings, and send WhatsApp confirmations.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-200/80 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveTab('WORKBENCH')}
            className={`px-4 py-2 rounded-lg transition ${
              activeTab === 'WORKBENCH'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🛏️ Book Beds (Room Grid)
          </button>
          <button
            onClick={() => setActiveTab('DIRECTORY')}
            className={`px-4 py-2 rounded-lg transition ${
              activeTab === 'DIRECTORY'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📋 View All Booked Allocations
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* ALERTS                                                             */}
      {/* ------------------------------------------------------------------ */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start justify-between shadow-sm animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-900">Allocation Notice</p>
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
            <p className="text-xs text-emerald-700 font-medium">{successMessage}</p>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 1: ALLOCATION WORKBENCH                                        */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'WORKBENCH' && (
        <div className={`space-y-6 ${selectedUnits.length > 0 ? 'pb-24 md:pb-60' : ''}`}>
          {/* Top Config Row: Step 1 & Step 2 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Step 1: Registration Selector */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">1</span>
                  Select Registration
                </h3>
                {selectedReg && (
                  <button
                    onClick={() => setSelectedReg(null)}
                    className="text-[11px] text-rose-600 hover:underline"
                  >
                    Change
                  </button>
                )}
              </div>

              {!selectedReg ? (
                <div className="space-y-2 relative">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search Reg ID, Primary Name or Mobile..."
                      value={regSearchQuery}
                      onChange={(e) => {
                        setRegSearchQuery(e.target.value);
                        setShowRegDropdown(true);
                      }}
                      onFocus={() => setShowRegDropdown(true)}
                      className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {showRegDropdown && registrations.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 bg-white border border-slate-300 rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100">
                      {registrations.map((r) => (
                        <div
                          key={r.id}
                          onClick={() => handleSelectRegistration(r)}
                          className="p-3 hover:bg-blue-50/70 cursor-pointer text-xs transition"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-blue-700">{r.registrationId}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700">
                              {r.totalMembers} {r.totalMembers === 1 ? 'member' : 'members'}
                            </span>
                          </div>
                          <p className="font-semibold text-slate-900 mt-0.5">{r.primaryName}</p>
                          <p className="text-[10px] text-slate-500">
                            {r.mobile} {r.city ? `• ${r.city}` : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-blue-900 text-sm">{selectedReg.registrationId}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="px-2.5 py-0.5 rounded-full font-bold bg-indigo-100 text-indigo-800 text-[11px]">
                        {selectedReg.totalMembers} Members Required
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedReg(null);
                          setSelectedRegDetail(null);
                        }}
                        className="text-[11px] text-rose-600 hover:underline font-bold ml-1"
                      >
                        Change
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{selectedReg.primaryName}</p>
                    <p className="text-slate-600 text-[11px]">{selectedReg.mobile} {selectedReg.city ? `• ${selectedReg.city}` : ''}</p>
                    {selectedReg.notes && <p className="text-amber-800 italic text-[11px] mt-1">&quot;{selectedReg.notes}&quot;</p>}
                  </div>

                  {/* Dynamic Category Allocation Guidance */}
                  {selectedRegDetail && (() => {
                    const males = selectedRegDetail.participants.filter(p => p.gender === 'MALE').length;
                    const females = selectedRegDetail.participants.filter(p => p.gender === 'FEMALE').length;
                    const notesUpper = `${selectedRegDetail.notes || ''}`.toUpperCase();
                    const isFamily = notesUpper.includes('FAMILY');
                    const isGuest = notesUpper.includes('GUEST');

                    const selectedMaleBeds = selectedUnits.filter(u => u.roomCategory === 'MALE' || u.genderCategory === 'MALE').length;
                    const selectedFemaleBeds = selectedUnits.filter(u => u.roomCategory === 'FEMALE' || u.genderCategory === 'FEMALE').length;

                    return (
                      <div className="mt-2 pt-2 border-t border-blue-200/60 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-bold uppercase text-slate-500">Members:</span>
                          {males > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px]">
                              👦 {males} Male
                            </span>
                          )}
                          {females > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-pink-100 text-pink-800 font-bold text-[10px]">
                              👩 {females} Female
                            </span>
                          )}
                          {isFamily && (
                            <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold text-[10px]">
                              👨‍👩‍👧‍👦 Family
                            </span>
                          )}
                          {isGuest && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                              🌟 Guest
                            </span>
                          )}
                        </div>

                        <div className="p-2 rounded-lg bg-white/90 border border-blue-200 text-[11px]">
                          {isFamily ? (
                            <p className="text-purple-800 font-semibold flex items-center gap-1.5">
                              <span>👨‍👩‍👧‍👦</span>
                              <span><strong>Family Allocation:</strong> Assign members together to a <strong>Family Room</strong>.</span>
                            </p>
                          ) : isGuest ? (
                            <p className="text-amber-800 font-semibold flex items-center gap-1.5">
                              <span>🌟</span>
                              <span><strong>Guest Allocation:</strong> Assign to a designated <strong>Guest Room</strong>.</span>
                            </p>
                          ) : males > 0 && females === 0 ? (
                            <p className="text-blue-800 font-semibold flex items-center gap-1.5">
                              <span>👦</span>
                              <span><strong>Male Group:</strong> Assign all {males} members to a <strong>Male Room only</strong>.</span>
                            </p>
                          ) : females > 0 && males === 0 ? (
                            <p className="text-pink-800 font-semibold flex items-center gap-1.5">
                              <span>👩</span>
                              <span><strong>Female Group:</strong> Assign all {females} members to a <strong>Female Room only</strong>.</span>
                            </p>
                          ) : males > 0 && females > 0 ? (
                            <div>
                              <p className="text-indigo-800 font-semibold flex items-center gap-1.5">
                                <span>🚻</span>
                                <span><strong>Category Split:</strong> Assign {males} Male(s) to <strong>Male Room</strong> and {females} Female(s) to <strong>Female Room</strong> (or designate as Family Room).</span>
                              </p>
                              <div className="mt-2 pt-2 border-t border-indigo-100 flex flex-wrap items-center gap-2">
                                <span className="font-bold text-slate-700">Live Selection:</span>
                                <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${selectedMaleBeds === males ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-blue-50 text-blue-800 border border-blue-200'}`}>
                                  👦 Male Beds: {selectedMaleBeds}/{males} {selectedMaleBeds === males ? '✓' : `(Select ${males - selectedMaleBeds} more)`}
                                </span>
                                <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${selectedFemaleBeds === females ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-pink-50 text-pink-800 border border-pink-200'}`}>
                                  👩 Female Beds: {selectedFemaleBeds}/{females} {selectedFemaleBeds === females ? '✓' : `(Select ${females - selectedFemaleBeds})`}
                                </span>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Step 2: Stay Window Dates */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">2</span>
                  Select Stay Window
                </h3>
                <span className="text-[11px] text-slate-500 font-medium">
                  {entryDate && exitDate && (
                    `${Math.max(1, Math.round((new Date(exitDate).getTime() - new Date(entryDate).getTime()) / (1000 * 3600 * 24)))} Nights Stay`
                  )}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Entry Date</label>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Exit Date (Exclusive)</label>
                  <input
                    type="date"
                    value={exitDate}
                    min={entryDate}
                    onChange={(e) => setExitDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-400">
                Inventory availability is automatically updated for the interval [entryDate, exitDate).
              </p>
            </div>
          </div>

          {/* TOP HELPER BANNER WHEN UNITS ARE SELECTED */}
          {selectedUnits.length > 0 && (
            <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-md border border-blue-500/40 flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <BookmarkCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="text-xs font-bold">
                  {selectedUnits.length} {selectedUnits.length === 1 ? 'Bed' : 'Beds'} Selected
                </span>
                <span className="text-[11px] text-blue-200 hidden sm:inline">
                  &bull; Assignment form is docked at the bottom of your screen &darr; (No scrolling needed!)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedUnits([])}
                  className="text-xs text-rose-300 hover:text-white hover:underline px-2 py-0.5"
                >
                  Clear Selection
                </button>
                <button
                  type="button"
                  onClick={() => setIsTrayMinimized(false)}
                  className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded-lg shadow-sm"
                >
                  Open Bottom Form &darr;
                </button>
              </div>
            </div>
          )}

          {/* Selected Units Pills */}
          {selectedUnits.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 p-3 bg-white rounded-xl border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 mr-1">Basket:</span>
              {selectedUnits.map((u) => (
                <span
                  key={u.unitId}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-blue-50 text-blue-900 border border-blue-200"
                >
                  <span>{u.roomNumber} &bull; {u.unitNumber} ({u.unitType})</span>
                  <button
                    onClick={() => handleRemoveSelectedUnit(u.unitId)}
                    className="text-blue-400 hover:text-rose-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* ================================================================ */}
          {/* RECEPTION DESK LIVE CAPACITY DASHBOARD (Six Summary Cards)       */}
          {/* ================================================================ */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Reception Desk &bull; Live Capacity Overview
                </span>
                <span className="text-[11px] font-semibold text-slate-500">
                  ({entryDate} &rarr; {exitDate})
                </span>
              </div>
              <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                ⚡ {liveMetrics.totalRooms} Rooms in Scope
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5">
              {/* Card 1: Booked Units & Occupancy % */}
              <div className="p-3 rounded-xl border border-rose-200 bg-rose-50/50 text-slate-800 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-rose-800">Booked Units</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-200 text-rose-900">
                    {liveMetrics.occupancyRate}% Full
                  </span>
                </div>
                <p className="text-xl font-black text-rose-700 mt-1">
                  {liveMetrics.bookedUnits} <span className="text-xs font-normal text-slate-500">/ {liveMetrics.totalUnits}</span>
                </p>
                <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">Assigned / Occupied</p>
              </div>

              {/* Card 2: Total Free Capacity */}
              <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 text-slate-800 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-emerald-800">Free Capacity</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <p className="text-xl font-black text-emerald-700 mt-1">
                  {liveMetrics.availableUnits} <span className="text-xs font-semibold text-emerald-600">Free</span>
                </p>
                <p className="text-[10px] text-emerald-950 font-semibold truncate mt-0.5">
                  {liveMetrics.availableBeds} Beds &bull; {liveMetrics.availableMats} Mats
                </p>
              </div>

              {/* Card 3: Male Rooms */}
              <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/50 text-slate-800 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-blue-800">👦 Gents Rooms</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-200 text-blue-900">Male</span>
                </div>
                <p className="text-xl font-black text-blue-700 mt-1">
                  {liveMetrics.male.availableUnits} <span className="text-xs font-semibold text-blue-600">Free</span>
                </p>
                <p className="text-[10px] text-blue-950 font-semibold truncate mt-0.5">
                  {liveMetrics.male.availableBeds} Beds &bull; {liveMetrics.male.availableMats} Mats
                </p>
              </div>

              {/* Card 4: Female Rooms */}
              <div className="p-3 rounded-xl border border-pink-200 bg-pink-50/50 text-slate-800 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-pink-800">👩 Ladies Rooms</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-pink-200 text-pink-900">Female</span>
                </div>
                <p className="text-xl font-black text-pink-700 mt-1">
                  {liveMetrics.female.availableUnits} <span className="text-xs font-semibold text-pink-600">Free</span>
                </p>
                <p className="text-[10px] text-pink-950 font-semibold truncate mt-0.5">
                  {liveMetrics.female.availableBeds} Beds &bull; {liveMetrics.female.availableMats} Mats
                </p>
              </div>

              {/* Card 5: Family Rooms */}
              <div className="p-3 rounded-xl border border-purple-200 bg-purple-50/50 text-slate-800 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-purple-800">👨‍👩‍👧‍👦 Family Rooms</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-200 text-purple-900">Family</span>
                </div>
                <p className="text-xl font-black text-purple-700 mt-1">
                  {liveMetrics.family.availableUnits} <span className="text-xs font-semibold text-purple-600">Free</span>
                </p>
                <p className="text-[10px] text-purple-950 font-semibold truncate mt-0.5">
                  {liveMetrics.family.availableBeds} Beds &bull; {liveMetrics.family.availableMats} Mats
                </p>
              </div>

              {/* Card 6: Guest Rooms */}
              <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/50 text-slate-800 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-amber-800">🌟 Guest Rooms</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-200 text-amber-900">VIP</span>
                </div>
                <p className="text-xl font-black text-amber-700 mt-1">
                  {liveMetrics.guest.availableUnits} <span className="text-xs font-semibold text-amber-600">Free</span>
                </p>
                <p className="text-[10px] text-amber-950 font-semibold truncate mt-0.5">
                  {liveMetrics.guest.availableBeds} Beds &bull; {liveMetrics.guest.availableMats} Mats
                </p>
              </div>
            </div>
          </div>

          {/* ================================================================ */}
          {/* STEP 3: AVAILABILITY EXPLORER & ADVANCED UNIT GRID               */}
          {/* ================================================================ */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5">
            <div className="space-y-3 border-b border-slate-200 pb-4">
              {/* Header & View Switcher */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">3</span>
                    Room &amp; Unit Availability Explorer
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Showing <strong className="text-slate-900">{displayedRooms.length}</strong> room{displayedRooms.length !== 1 ? 's' : ''} in ascending numeric order. Green cards are available for assignment.
                  </p>
                </div>

                {/* View Switcher Toggle - Detailed Grid is Default */}
                <div className="flex items-center gap-1.5 bg-slate-200/90 p-1 rounded-xl border border-slate-300 self-start md:self-auto shadow-xs">
                  <button
                    type="button"
                    onClick={() => setViewMode('DETAILED')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      viewMode === 'DETAILED'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                    title="Classic Bed Grid: Original horizontal layout with complete details"
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>🔲 Classic Bed Grid (Original View)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('COMPACT')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      viewMode === 'COMPACT'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                    title="Compact Matrix: Fast density view to avoid far scrolling"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>⚡ Compact Matrix View</span>
                  </button>
                </div>
              </div>

              {/* Primary Filters Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {/* 1. Hotel / Facility Selector */}
                <div className="sm:col-span-2">
                  <select
                    value={filterHotelId}
                    onChange={(e) => setFilterHotelId(e.target.value)}
                    className="w-full py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-bold focus:border-blue-500 focus:bg-white"
                  >
                    <option value="ALL">🏢 All Hotels &amp; Facilities</option>
                    {hotels.map((h) => (
                      <option key={h.id} value={h.id}>
                        🏢 {h.name} ({h.roomCount || 0} rooms)
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Dynamic Building / Block Selector */}
                <div>
                  <select
                    value={filterBuilding}
                    onChange={(e) => setFilterBuilding(e.target.value)}
                    className="w-full py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                  >
                    <option value="ALL">All Blocks / Buildings</option>
                    {availableBuildings.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Room Number Search Box */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={roomSearchQuery}
                    onChange={(e) => setRoomSearchQuery(e.target.value)}
                    placeholder="Search room # (e.g. 13)..."
                    className="w-full pl-8 pr-6 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:border-blue-500"
                  />
                  {roomSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setRoomSearchQuery('')}
                      className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      &times;
                    </button>
                  )}
                </div>

                {/* 4. Unit Type Selector */}
                <div>
                  <select
                    value={filterUnitType}
                    onChange={(e) => setFilterUnitType(e.target.value)}
                    className="w-full py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                  >
                    <option value="ALL">Beds &amp; Mats</option>
                    <option value="BED">🛏️ Beds Only</option>
                    <option value="MAT">🧘 Floor Mats Only</option>
                  </select>
                </div>

                {/* 5. Reload Button */}
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={fetchAvailability}
                    className="w-full py-1.5 px-3 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5"
                    title="Reload Availability"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
                    <span>Reload</span>
                  </button>
                </div>
              </div>

              {/* Category Quick Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase mr-1">Category:</span>
                {[
                  { key: 'ALL', label: 'All Categories' },
                  { key: 'MALE', label: '👦 Male Rooms' },
                  { key: 'FEMALE', label: '👩 Female Rooms' },
                  { key: 'FAMILY', label: '👨‍👩‍👧‍👦 Family Rooms' },
                  { key: 'GUEST', label: '🌟 Guest Rooms' },
                ].map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setFilterRoomCategory(cat.key)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                      filterRoomCategory === cat.key
                        ? 'bg-blue-600 text-white shadow-xs font-bold'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Dedicated Booking Percentage Quick Filter Bar (High Prominence) */}
              <div className="p-2.5 bg-blue-50/60 rounded-xl border border-blue-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-[11px] font-bold uppercase tracking-wide text-slate-800">
                    Booking % Filter:
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { key: 'ALL', label: 'All Rooms', activeCls: 'bg-slate-900 text-white border-slate-900' },
                    { key: '0', label: '🟢 0% Booked (100% Free)', activeCls: 'bg-emerald-600 text-white border-emerald-600' },
                    { key: '25', label: '≤ 25% Booked', activeCls: 'bg-blue-600 text-white border-blue-600' },
                    { key: '50', label: '≤ 50% Booked', activeCls: 'bg-indigo-600 text-white border-indigo-600' },
                    { key: '75', label: '≤ 75% Booked', activeCls: 'bg-amber-600 text-white border-amber-600' },
                    { key: '100', label: '🔴 100% Full', activeCls: 'bg-rose-600 text-white border-rose-600' },
                  ].map((pct) => {
                    const isActive = occupancyFilter === pct.key;
                    return (
                      <button
                        key={pct.key}
                        type="button"
                        onClick={() => setOccupancyFilter(pct.key as any)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                          isActive
                            ? `${pct.activeCls} shadow-xs font-bold`
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {pct.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* COLOR LEGEND BAR */}
            <div className="flex flex-wrap items-center gap-4 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wide">Status Legend:</span>
              <span className="inline-flex items-center gap-1.5 font-bold text-emerald-800 text-xs">
                <span className="w-3.5 h-3.5 rounded bg-emerald-500 border border-emerald-600 shadow-sm"></span>
                <span>Available (Free)</span>
              </span>
              <span className="inline-flex items-center gap-1.5 font-bold text-amber-900 text-xs">
                <span className="w-3.5 h-3.5 rounded bg-amber-400 border border-amber-500 shadow-sm"></span>
                <span>Reserved / Assigned (Awaiting Check-in)</span>
              </span>
              <span className="inline-flex items-center gap-1.5 font-bold text-purple-900 text-xs">
                <span className="w-3.5 h-3.5 rounded bg-purple-500 border border-purple-600 shadow-sm"></span>
                <span>Checked-In (Occupied)</span>
              </span>
              <span className="inline-flex items-center gap-1.5 font-bold text-slate-600 text-xs">
                <span className="w-3.5 h-3.5 rounded bg-slate-300 border border-slate-400 shadow-sm"></span>
                <span>Maintenance</span>
              </span>
              <span className="inline-flex items-center gap-1.5 font-bold text-blue-700 text-xs">
                <span className="w-3.5 h-3.5 rounded bg-blue-600 border border-blue-700 shadow-sm"></span>
                <span>Selected</span>
              </span>
            </div>

            {/* Room Availability Displays */}
            {loading ? (
              <div className="py-16 text-center text-slate-500 space-y-2">
                <RefreshCw className="w-7 h-7 animate-spin mx-auto text-blue-600" />
                <p className="text-xs font-medium">Resolving real-time unit availability against database interval locks...</p>
              </div>
            ) : displayedRooms.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Building className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-xs">No rooms found matching the current filter criteria.</p>
              </div>
            ) : viewMode === 'COMPACT' ? (
              /* ================================================================ */
              /* VIEW 1: COMPACT MATRIX VIEW (High Density, Easy to scan)         */
              /* ================================================================ */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                {displayedRooms.map((room) => {
                  const occPercent = room.occupancyPercentage ?? (room.totalUnitsInRoom > 0 ? Math.round(((room.totalUnitsInRoom - room.availableCount) / room.totalUnitsInRoom) * 100) : 0);
                  const freeUnits = room.units.filter((u) => u.isAvailable);
                  const allAvailableSelected = freeUnits.length > 0 && freeUnits.every((u) => selectedUnits.some((su) => su.unitId === u.id));

                  return (
                    <div
                      key={room.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-md transition space-y-3 flex flex-col justify-between"
                    >
                      <div>
                        {/* Header: Room Number + Building / Floor + Category */}
                        <div className="flex items-start justify-between gap-1.5">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-black text-slate-900 text-base">
                                Room {room.roomNumber}
                              </span>
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                                {room.building || 'Main'} &bull; F{room.floor ?? 1}
                              </span>
                            </div>
                            {room.hotelName && (
                              <p className="text-[10px] text-slate-400 font-medium truncate max-w-[170px]">
                                🏢 {room.hotelName}
                              </p>
                            )}
                          </div>

                          <div>
                            {room.genderPreference === 'MALE' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 whitespace-nowrap">
                                👦 Male
                              </span>
                            )}
                            {room.genderPreference === 'FEMALE' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-pink-100 text-pink-800 border border-pink-200 whitespace-nowrap">
                                👩 Female
                              </span>
                            )}
                            {room.genderPreference === 'FAMILY' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 whitespace-nowrap">
                                👨‍👩‍👧‍👦 Family
                              </span>
                            )}
                            {room.genderPreference === 'GUEST' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 whitespace-nowrap">
                                🌟 Guest
                              </span>
                            )}
                            {room.genderPreference === 'ANY' && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 whitespace-nowrap">
                                Flexible
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Occupancy Progress Bar */}
                        <div className="mt-2.5 space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-slate-700">
                              <strong className={room.availableCount > 0 ? 'text-emerald-700' : 'text-rose-600'}>
                                {room.availableCount}
                              </strong> / {room.totalUnitsInRoom} Free
                            </span>
                            <span className={`text-[10px] font-bold ${
                              occPercent === 0
                                ? 'text-emerald-700'
                                : occPercent === 100
                                ? 'text-rose-700'
                                : 'text-amber-700'
                            }`}>
                              {occPercent}% Booked
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                occPercent === 0
                                  ? 'bg-emerald-500'
                                  : occPercent >= 75
                                  ? 'bg-rose-500'
                                  : 'bg-amber-500'
                              }`}
                              style={{ width: `${occPercent}%` }}
                            />
                          </div>
                        </div>

                        {/* Compact Bed / Mat Units Badges */}
                        <div className="mt-3 grid grid-cols-3 gap-1.5">
                          {room.units.map((unit) => {
                            const isSelected = selectedUnits.some((u) => u.unitId === unit.id);
                            const isBed = unit.type === 'BED';
                            const isCheckedIn = unit.state === 'OCCUPIED';
                            const isReserved = unit.state === 'ALLOCATED' || unit.state === 'CONFIRMED';

                            return (
                              <button
                                key={unit.id}
                                type="button"
                                onClick={() => handleToggleUnit(room, unit)}
                                className={`py-1.5 px-2 rounded-lg border text-[11px] font-mono font-bold transition flex items-center justify-between gap-1 ${
                                  isSelected
                                    ? 'bg-blue-600 text-white border-blue-700 shadow-xs ring-2 ring-blue-300'
                                    : unit.isAvailable
                                    ? 'bg-emerald-50 text-emerald-950 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-500'
                                    : isCheckedIn
                                    ? 'bg-purple-100 text-purple-950 border-purple-300 hover:bg-purple-200'
                                    : isReserved
                                    ? 'bg-amber-100 text-amber-950 border-amber-300 hover:bg-amber-200'
                                    : 'bg-slate-100 text-slate-600 border-slate-300'
                                }`}
                                title={`${unit.unitNumber} (${unit.type}) - ${unit.state}`}
                              >
                                <span className="flex items-center gap-1 truncate">
                                  {isBed ? (
                                    <Bed className="w-3 h-3 opacity-70 shrink-0" />
                                  ) : (
                                    <Layers className="w-3 h-3 opacity-70 shrink-0" />
                                  )}
                                  <span>{unit.unitNumber}</span>
                                </span>
                                {isSelected ? (
                                  <Check className="w-3 h-3 text-white shrink-0" />
                                ) : (
                                  <span className="text-[9px] font-sans opacity-70 shrink-0">
                                    {unit.isAvailable ? '✓' : unit.state === 'OCCUPIED' ? 'In' : 'Res'}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Quick Room Action Bar */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                        <span className="text-[10px] text-slate-500">
                          {room.availableBeds ?? 0}B &bull; {room.availableMats ?? 0}M Free
                        </span>
                        {room.availableCount > 0 && (
                          <button
                            type="button"
                            onClick={() => handleSelectAllInRoom(room)}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded transition ${
                              allAvailableSelected
                                ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                            }`}
                          >
                            {allAvailableSelected ? 'Deselect All' : '+ Select All Free'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* ================================================================ */
              /* VIEW 2: DETAILED BED GRID (Classic Full Width View)              */
              /* ================================================================ */
              <div className="space-y-6">
                {displayedRooms.map((room) => (
                  <div key={room.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 space-y-3">
                    {/* Room Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 text-sm">{room.roomNumber}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-700">
                          {room.building || 'Main'} &bull; Floor {room.floor ?? 1}
                        </span>
                        {room.genderPreference === 'MALE' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            👦 Male Room
                          </span>
                        )}
                        {room.genderPreference === 'FEMALE' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-pink-100 text-pink-800 border border-pink-200">
                            👩 Female Room
                          </span>
                        )}
                        {room.genderPreference === 'FAMILY' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                            👨‍👩‍👧‍👦 Family Room
                          </span>
                        )}
                        {room.genderPreference === 'GUEST' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            🌟 Guest Room
                          </span>
                        )}
                        {room.genderPreference === 'ANY' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                            Flexible / Any
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleSelectAllInRoom(room)}
                          className="text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-0.5 rounded"
                        >
                          Select All Free
                        </button>
                        <span className="text-xs font-semibold text-slate-600">
                          <strong className="text-emerald-700">{room.availableCount}</strong> / {room.totalUnitsInRoom} Available
                        </span>
                      </div>
                    </div>

                    {/* Units in Room */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
                      {room.units.map((unit) => {
                        const isSelected = selectedUnits.some((u) => u.unitId === unit.id);
                        const isBed = unit.type === 'BED';
                        const isCheckedIn = unit.state === 'OCCUPIED';
                        const isReserved = unit.state === 'ALLOCATED' || unit.state === 'CONFIRMED';

                        return (
                          <div
                            key={unit.id}
                            onClick={() => handleToggleUnit(room, unit)}
                            className={`p-2.5 rounded-xl border text-xs transition duration-150 flex flex-col justify-between cursor-pointer ${
                              isSelected
                                ? 'bg-blue-600 text-white border-blue-700 shadow-md ring-2 ring-blue-400'
                                : unit.isAvailable
                                ? 'bg-emerald-50 text-emerald-950 border-emerald-300 hover:border-emerald-500 hover:bg-emerald-100/70 shadow-sm'
                                : isCheckedIn
                                ? 'bg-purple-100 text-purple-950 border-purple-400 hover:border-purple-500 ring-1 ring-purple-300 shadow-sm'
                                : isReserved
                                ? 'bg-amber-100 text-amber-950 border-amber-400 hover:border-amber-500 ring-1 ring-amber-300 shadow-sm'
                                : 'bg-slate-100 text-slate-700 border-slate-300 hover:border-slate-400'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-extrabold">{unit.unitNumber}</span>
                              <div className="flex items-center gap-1">
                                {isSelected ? (
                                  <Check className="w-3.5 h-3.5 text-white" />
                                ) : isBed ? (
                                  <Bed className="w-3 h-3 opacity-60" />
                                ) : (
                                  <Layers className="w-3 h-3 opacity-60" />
                                )}
                                {unit.isAvailable && !isSelected && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openBedModal(room, unit);
                                    }}
                                    title="Bed options"
                                    className="text-emerald-700/60 hover:text-emerald-900 ml-0.5 p-0.5 rounded"
                                  >
                                    <Wrench className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="mt-2 text-[10px]">
                              <div className="flex items-center justify-between">
                                <span className="uppercase font-semibold">{unit.genderCategory.slice(0, 1)}</span>
                                <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                  isSelected
                                    ? 'bg-blue-700 text-white'
                                    : unit.isAvailable
                                    ? 'bg-emerald-200 text-emerald-900'
                                    : isCheckedIn
                                    ? 'bg-purple-200 text-purple-900'
                                    : isReserved
                                    ? 'bg-amber-200 text-amber-900'
                                    : 'bg-slate-200 text-slate-700'
                                }`}>
                                  {isSelected
                                    ? 'Selected'
                                    : unit.isAvailable
                                    ? 'Available'
                                    : isCheckedIn
                                    ? 'Checked-In'
                                    : isReserved
                                    ? 'Reserved'
                                    : 'Maintenance'}
                                </span>
                              </div>

                              {!unit.isAvailable && (
                                <div className="mt-1 flex items-center justify-between text-[9px] font-bold">
                                  <span className="truncate max-w-[70px]">
                                    {unit.conflict?.primaryName || unit.conflict?.participantName || unit.conflict?.allocationNumber || 'Manage'}
                                  </span>
                                  <span className="text-[8px] bg-white/90 border border-slate-300 px-1 py-0.2 rounded text-slate-800 ml-1 shrink-0 font-sans shadow-xs">
                                    Options &rarr;
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ================================================================ */}
          {/* MOBILE ULTRA-SLIM FLOATING BAR (< md screens)                     */}
          {/* Extremely compact (height ~46px), does NOT obstruct scrolling or beds */}
          {/* ================================================================ */}
          {selectedUnits.length > 0 && !isMobileAssignOpen && (
            <div className="md:hidden fixed bottom-3 left-3 right-3 z-40 bg-slate-900 text-white rounded-xl px-3.5 py-2.5 shadow-2xl flex items-center justify-between border border-blue-500/40 animate-in slide-in-from-bottom duration-150">
              <div className="flex items-center gap-2 truncate mr-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                  {selectedUnits.length}
                </span>
                <span className="text-xs font-bold truncate">
                  {selectedUnits.length} Bed{selectedUnits.length > 1 ? 's' : ''} Selected
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsMobileAssignOpen(true)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm active:scale-95 transition"
                >
                  <span>Assign Guest &rarr;</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedUnits([])}
                  className="p-1.5 text-slate-400 hover:text-white"
                  title="Clear selection"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* MOBILE ASSIGNMENT MODAL / SHEET                                   */}
          {/* Slides up ONLY when user taps "Assign Guest" on mobile            */}
          {/* ================================================================ */}
          {isMobileAssignOpen && selectedUnits.length > 0 && (
            <div className="md:hidden fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex flex-col justify-end animate-in fade-in">
              <div className="bg-white rounded-t-2xl max-h-[90vh] overflow-y-auto p-5 space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-200">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-md bg-blue-600 text-white font-bold text-xs">
                      {selectedUnits.length} Bed{selectedUnits.length > 1 ? 's' : ''}
                    </span>
                    <span className="font-bold text-slate-900 text-sm">Assign to Guest</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMobileAssignOpen(false)}
                    className="p-1.5 text-slate-500 hover:text-slate-900 bg-slate-100 rounded-lg text-xs font-semibold flex items-center gap-1"
                  >
                    <span>Close</span>
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Selected Bed Chips */}
                <div className="flex flex-wrap items-center gap-1.5 max-h-20 overflow-y-auto">
                  {selectedUnits.map((u) => (
                    <span
                      key={u.unitId}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold font-mono bg-blue-50 text-blue-900 border border-blue-200"
                    >
                      <span>{u.roomNumber} &bull; {u.unitNumber}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSelectedUnit(u.unitId)}
                        className="text-blue-400 hover:text-rose-600 ml-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                {/* Mode Switcher */}
                <div className="flex rounded-lg bg-slate-100 p-1 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setAssignMode('NEW')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${
                      assignMode === 'NEW'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    ➕ New Guest / Family
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssignMode('EXISTING')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${
                      assignMode === 'EXISTING'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    🔍 Existing Reg
                  </button>
                </div>

                {assignMode === 'NEW' ? (
                  <div className="space-y-3">
                    {/* Guest Type Selector */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1.5">
                        Room / Member Category:
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setGuestCategory('MALE')}
                          className={`p-2 rounded-lg text-xs font-bold border text-center transition ${
                            guestCategory === 'MALE'
                              ? 'bg-blue-50 border-blue-600 text-blue-700 ring-1 ring-blue-600'
                              : 'bg-white border-slate-200 text-slate-600'
                          }`}
                        >
                          👦 Male ({selectedUnits.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setGuestCategory('FEMALE')}
                          className={`p-2 rounded-lg text-xs font-bold border text-center transition ${
                            guestCategory === 'FEMALE'
                              ? 'bg-pink-50 border-pink-600 text-pink-700 ring-1 ring-pink-600'
                              : 'bg-white border-slate-200 text-slate-600'
                          }`}
                        >
                          👩 Female ({selectedUnits.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setGuestCategory('FAMILY')}
                          className={`p-2 rounded-lg text-xs font-bold border text-center transition ${
                            guestCategory === 'FAMILY'
                              ? 'bg-purple-50 border-purple-600 text-purple-700 ring-1 ring-purple-600'
                              : 'bg-white border-slate-200 text-slate-600'
                          }`}
                        >
                          👨‍👩‍👧‍👦 Family ({selectedUnits.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setGuestCategory('GUEST')}
                          className={`p-2 rounded-lg text-xs font-bold border text-center transition ${
                            guestCategory === 'GUEST'
                              ? 'bg-amber-50 border-amber-600 text-amber-900 ring-1 ring-amber-600'
                              : 'bg-white border-slate-200 text-slate-600'
                          }`}
                        >
                          🌟 Guest ({selectedUnits.length})
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        {guestCategory === 'SINGLE' ? 'Full Name *' : guestCategory === 'MULTIPLE' ? 'Leader / Group Name *' : 'Family Head / Name *'}
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Rajesh Sharma"
                        value={newPersonName}
                        onChange={(e) => setNewPersonName(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        10-Digit Mobile Number *
                      </label>
                      <input
                        type="tel"
                        maxLength={15}
                        placeholder="e.g. 9876543210"
                        value={newPersonMobile}
                        onChange={(e) => setNewPersonMobile(e.target.value.replace(/[^\d+]/g, ''))}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Aadhaar Card Number (Optional)
                      </label>
                      <input
                        type="text"
                        maxLength={12}
                        placeholder="12-digit Aadhaar number"
                        value={newPersonAadhaar}
                        onChange={(e) => setNewPersonAadhaar(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-medium"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                          Check-In Date & Time
                        </label>
                        <input
                          type="datetime-local"
                          value={newPersonCheckInTime}
                          onChange={(e) => setNewPersonCheckInTime(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                          Check-Out Date & Time
                        </label>
                        <input
                          type="datetime-local"
                          value={newPersonCheckOutTime}
                          onChange={(e) => setNewPersonCheckOutTime(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        City / Town (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Ahmedabad"
                        value={newPersonCity}
                        onChange={(e) => setNewPersonCity(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                      />
                    </div>

                    {/* Immediate Check-In Toggle */}
                    <label className="flex items-center gap-2.5 p-2.5 bg-purple-50 border border-purple-200 rounded-xl cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newPersonCheckInNow}
                        onChange={(e) => setNewPersonCheckInNow(e.target.checked)}
                        className="w-4 h-4 text-purple-600 rounded"
                      />
                      <span className="text-xs font-bold text-purple-950">
                        Check In Immediately (Set directly to Checked-In Occupied)
                      </span>
                    </label>

                    {/* Accompanying Member Fields if > 1 Bed */}
                    {selectedUnits.length > 1 && (
                      <div className="space-y-2 pt-1 border-t border-slate-100">
                        <p className="text-[11px] font-bold text-slate-700 uppercase">
                          Other Persons Details (Beds 2 to {selectedUnits.length}):
                        </p>
                        {selectedUnits.slice(1).map((u, idx) => (
                          <div key={u.unitId} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                            <span className="font-bold text-blue-900 font-mono text-[11px]">
                              Bed {idx + 2}: {u.roomNumber} &bull; {u.unitNumber} ({u.unitType})
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <input
                                type="text"
                                placeholder={`Guest ${idx + 2} Full Name`}
                                value={accompanyingMembersData[idx]?.fullName || ''}
                                onChange={(e) => updateAccompanyingMember(idx, 'fullName', e.target.value)}
                                className="px-2 py-1 border border-slate-300 rounded-md bg-white text-xs"
                              />
                              <select
                                value={accompanyingMembersData[idx]?.gender || (u.roomCategory === 'MALE' ? 'MALE' : u.roomCategory === 'FEMALE' ? 'FEMALE' : 'MALE')}
                                onChange={(e) => updateAccompanyingMember(idx, 'gender', e.target.value)}
                                className="px-2 py-1 border border-slate-300 rounded-md bg-white text-xs font-semibold"
                              >
                                <option value="MALE">👦 Male</option>
                                <option value="FEMALE">👩 Female</option>
                              </select>
                              <input
                                type="text"
                                placeholder="Aadhaar Number"
                                maxLength={12}
                                value={accompanyingMembersData[idx]?.aadhaarNumber || ''}
                                onChange={(e) => updateAccompanyingMember(idx, 'aadhaarNumber', e.target.value.replace(/\D/g, ''))}
                                className="px-2 py-1 border border-slate-300 rounded-md bg-white text-xs font-mono"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={quickAddSubmitting || !newPersonName.trim() || newPersonMobile.length < 10}
                      onClick={async () => {
                        await handleQuickAddAndAssign();
                        setIsMobileAssignOpen(false);
                      }}
                      className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-1.5"
                    >
                      {quickAddSubmitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Assigning...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Save & Assign {selectedUnits.length} Bed(s) Now</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {!selectedReg ? (
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search guest name, mobile, Reg ID..."
                          value={regSearchQuery}
                          onChange={(e) => {
                            setRegSearchQuery(e.target.value);
                            setShowBasketRegDropdown(true);
                          }}
                          className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                        />
                        {showBasketRegDropdown && registrations.length > 0 && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-300 rounded-xl shadow-2xl max-h-48 overflow-y-auto divide-y divide-slate-100 z-50">
                            {registrations.map((r) => (
                              <div
                                key={r.id}
                                onClick={() => handleSelectRegistration(r)}
                                className="p-2.5 hover:bg-blue-50 cursor-pointer text-xs"
                              >
                                <div className="flex justify-between font-bold text-blue-700">
                                  <span>{r.registrationId}</span>
                                  <span>{r.totalMembers} members</span>
                                </div>
                                <p className="font-semibold text-slate-900">{r.primaryName}</p>
                                <p className="text-[10px] text-slate-500">{r.mobile}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-slate-900">{selectedReg.primaryName}</p>
                          <p className="text-slate-500">{selectedReg.registrationId} &bull; {selectedReg.mobile}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedReg(null)}
                          className="text-rose-600 font-bold hover:underline"
                        >
                          Change
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={actionLoading || !selectedReg}
                      onClick={async () => {
                        await handleCommitAllocation();
                        setIsMobileAssignOpen(false);
                      }}
                      className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-1.5"
                    >
                      {actionLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Assigning...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Assign {selectedUnits.length} Bed(s) to Guest</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* RESPONSIVE DOCKED BOTTOM ALLOCATION PANEL (Mobile & Desktop)     */}
          {/* ================================================================ */}
          {selectedUnits.length > 0 && (
            <div className="fixed bottom-0 left-0 right-0 md:left-64 z-40 bg-white border-t-4 border-blue-600 shadow-[0_-10px_30px_rgba(0,0,0,0.18)] animate-in slide-in-from-bottom duration-200 max-h-[88vh] flex flex-col">
              {/* MINIMIZED STATE BAR */}
              {isTrayMinimized ? (
                <div className="px-3 sm:px-5 py-2.5 sm:py-3 bg-slate-900 text-white flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center shrink-0">
                      {selectedUnits.length}
                    </span>
                    <span className="text-xs font-bold truncate">
                      {selectedUnits.length} Bed{selectedUnits.length > 1 ? 's' : ''} Selected
                    </span>
                    <span className="text-[11px] text-slate-300 hidden sm:inline truncate">
                      ({selectedUnits.map(u => `${u.roomNumber}-${u.unitNumber}`).slice(0, 3).join(', ')}{selectedUnits.length > 3 ? '...' : ''})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsTrayMinimized(false)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm active:scale-95"
                    >
                      <span>Assign Form</span>
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedUnits([])}
                      className="text-xs text-rose-300 hover:text-white px-2 py-1"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              ) : (
                /* EXPANDED ENTRY FORM */
                <div className="p-3 sm:p-4 max-w-7xl mx-auto space-y-3 overflow-y-auto w-full">
                  {/* Panel Top Row: Summary & Controls */}
                  <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-md bg-blue-600 text-white font-bold text-xs shadow-sm">
                        {selectedUnits.length} Bed{selectedUnits.length > 1 ? 's' : ''} Selected
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5 max-h-12 overflow-y-auto">
                        {selectedUnits.map((u) => (
                          <span
                            key={u.unitId}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold font-mono bg-blue-50 text-blue-900 border border-blue-200"
                          >
                            <span>{u.roomNumber} &bull; {u.unitNumber}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveSelectedUnit(u.unitId)}
                              className="text-blue-400 hover:text-rose-600 ml-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedUnits([])}
                        className="text-[11px] text-rose-600 hover:underline font-semibold ml-2"
                      >
                        Clear All
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Mode Toggle: New vs Existing */}
                      <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setAssignMode('NEW')}
                          className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                            assignMode === 'NEW'
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          ➕ Add New Guest
                        </button>
                        <button
                          type="button"
                          onClick={() => setAssignMode('EXISTING')}
                          className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                            assignMode === 'EXISTING'
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          🔍 Search Existing
                        </button>
                      </div>

                      {/* Minimize Button */}
                      <button
                        type="button"
                        onClick={() => setIsTrayMinimized(true)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                        title="Minimize tray"
                      >
                        <ChevronDown className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* FORM BODY */}
                  {assignMode === 'NEW' ? (
                    <div className="space-y-2.5">
                      {/* Guest Category Selector: Male, Female, Family, Guest */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wide mr-1">
                          Category:
                        </span>
                        <button
                          type="button"
                          onClick={() => setGuestCategory('MALE')}
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border transition ${
                            guestCategory === 'MALE'
                              ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-sm ring-1 ring-blue-600'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <span>👦 Male ({selectedUnits.length})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setGuestCategory('FEMALE')}
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border transition ${
                            guestCategory === 'FEMALE'
                              ? 'bg-pink-50 border-pink-600 text-pink-700 shadow-sm ring-1 ring-pink-600'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <span>👩 Female ({selectedUnits.length})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setGuestCategory('FAMILY')}
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border transition ${
                            guestCategory === 'FAMILY'
                              ? 'bg-purple-50 border-purple-600 text-purple-700 shadow-sm ring-1 ring-purple-600'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <Users className="w-3.5 h-3.5 text-purple-600" />
                          <span>👨‍👩‍👧‍👦 Family ({selectedUnits.length})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setGuestCategory('GUEST')}
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border transition ${
                            guestCategory === 'GUEST'
                              ? 'bg-amber-50 border-amber-600 text-amber-900 shadow-sm ring-1 ring-amber-600'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          <span>🌟 Guest ({selectedUnits.length})</span>
                        </button>
                        <span className="text-[11px] text-slate-400 ml-auto">
                          Dates: {entryDate} to {exitDate}
                        </span>
                      </div>

                      {/* Primary Guest Details: Name, Mobile, Aadhaar, City */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                            {guestCategory === 'SINGLE'
                              ? 'Guest Full Name *'
                              : guestCategory === 'MULTIPLE'
                              ? 'Group / Leader Name *'
                              : 'Family Head / Name *'}
                          </label>
                          <input
                            type="text"
                            placeholder={
                              guestCategory === 'SINGLE'
                                ? 'e.g. Rajesh Sharma'
                                : guestCategory === 'MULTIPLE'
                                ? 'e.g. Lohi & Friends'
                                : 'e.g. Lohi Family'
                            }
                            value={newPersonName}
                            onChange={(e) => setNewPersonName(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                            Mobile Number *
                          </label>
                          <input
                            type="tel"
                            maxLength={15}
                            placeholder="e.g. 9876543210"
                            value={newPersonMobile}
                            onChange={(e) => setNewPersonMobile(e.target.value.replace(/[^\d+]/g, ''))}
                            className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-medium"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                            Aadhaar Card Number (12 Digits)
                          </label>
                          <input
                            type="text"
                            maxLength={12}
                            placeholder="12-digit Aadhaar number"
                            value={newPersonAadhaar}
                            onChange={(e) => setNewPersonAadhaar(e.target.value.replace(/\D/g, ''))}
                            className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-medium"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                            City / Town (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Ahmedabad, Mumbai"
                            value={newPersonCity}
                            onChange={(e) => setNewPersonCity(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                          />
                        </div>
                      </div>

                      {/* Row 2: Check-In/Out Dates, Immediate Check-In Toggle, and Submit Button */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 items-end">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                            Check-In Date & Time
                          </label>
                          <input
                            type="datetime-local"
                            value={newPersonCheckInTime}
                            onChange={(e) => setNewPersonCheckInTime(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                            Check-Out Date & Time
                          </label>
                          <input
                            type="datetime-local"
                            value={newPersonCheckOutTime}
                            onChange={(e) => setNewPersonCheckOutTime(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                          />
                        </div>

                        <div>
                          <label className="flex items-center gap-2 p-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg cursor-pointer transition">
                            <input
                              type="checkbox"
                              checked={newPersonCheckInNow}
                              onChange={(e) => setNewPersonCheckInNow(e.target.checked)}
                              className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                            />
                            <div className="text-[11px] leading-tight">
                              <span className="font-bold text-purple-950 block">Immediate Check-In</span>
                              <span className="text-purple-700 text-[10px]">Mark beds Checked-In (Purple)</span>
                            </div>
                          </label>
                        </div>

                        <div>
                          <button
                            type="button"
                            disabled={quickAddSubmitting || !newPersonName.trim() || newPersonMobile.length < 10}
                            onClick={handleQuickAddAndAssign}
                            className={`w-full py-2 px-3 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold rounded-lg shadow-md hover:shadow-lg transition flex items-center justify-center gap-1.5 ${
                              newPersonCheckInNow
                                ? 'bg-purple-600 hover:bg-purple-500'
                                : 'bg-emerald-600 hover:bg-emerald-500'
                            }`}
                          >
                            {quickAddSubmitting ? (
                              <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span>Assigning...</span>
                              </>
                            ) : newPersonCheckInNow ? (
                              <>
                                <CheckSquare className="w-4 h-4" />
                                <span>Check In & Occupy {selectedUnits.length} Bed{selectedUnits.length > 1 ? 's' : ''} Now</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Reserve {selectedUnits.length} Bed{selectedUnits.length > 1 ? 's' : ''} (Tentative)</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Accompanying Members Details for Multi-Bed Bookings */}
                      {selectedUnits.length > 1 && (
                        <div className="pt-2 border-t border-slate-100 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                              Other Persons Details (Beds 2 to {selectedUnits.length}):
                            </span>
                            <span className="text-[10px] text-slate-400">
                              (Optional: Enter details for companions in {selectedUnits.slice(1).map(u => `${u.roomNumber}-${u.unitNumber}`).join(', ')})
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-32 overflow-y-auto pr-1">
                            {selectedUnits.slice(1).map((u, idx) => (
                              <div
                                key={u.unitId}
                                className="p-2 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5 text-xs"
                              >
                                <div className="flex items-center justify-between font-mono text-[11px]">
                                  <span className="font-bold text-blue-900">
                                    Bed {idx + 2}: {u.roomNumber} &bull; {u.unitNumber}
                                  </span>
                                  <span className="text-slate-500 text-[10px]">
                                    {u.unitType} ({u.genderCategory})
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                                  <input
                                    type="text"
                                    placeholder={`Person ${idx + 2} Name`}
                                    value={accompanyingMembersData[idx]?.fullName || ''}
                                    onChange={(e) => updateAccompanyingMember(idx, 'fullName', e.target.value)}
                                    className="px-2 py-1 bg-white border border-slate-300 rounded text-[11px]"
                                  />
                                  <select
                                    value={accompanyingMembersData[idx]?.gender || (u.roomCategory === 'MALE' ? 'MALE' : u.roomCategory === 'FEMALE' ? 'FEMALE' : 'MALE')}
                                    onChange={(e) => updateAccompanyingMember(idx, 'gender', e.target.value)}
                                    className="px-2 py-1 bg-white border border-slate-300 rounded text-[11px] font-semibold"
                                  >
                                    <option value="MALE">👦 Male</option>
                                    <option value="FEMALE">👩 Female</option>
                                  </select>
                                  <input
                                    type="text"
                                    maxLength={12}
                                    placeholder="12-digit Aadhaar"
                                    value={accompanyingMembersData[idx]?.aadhaarNumber || ''}
                                    onChange={(e) => updateAccompanyingMember(idx, 'aadhaarNumber', e.target.value.replace(/\D/g, ''))}
                                    className="px-2 py-1 bg-white border border-slate-300 rounded text-[11px] font-mono"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* ASSIGN TO EXISTING REGISTRATION */
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-3 gap-3 items-end">
                        <div className="col-span-2 relative">
                          <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                            Select Existing Registration
                          </label>
                          {!selectedReg ? (
                            <div className="relative">
                              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                              <input
                                ref={basketSearchRef}
                                type="text"
                                placeholder="Type guest name, Reg ID (e.g. REG-001) or mobile..."
                                value={regSearchQuery}
                                onChange={(e) => {
                                  setRegSearchQuery(e.target.value);
                                  setShowBasketRegDropdown(true);
                                }}
                                onFocus={() => setShowBasketRegDropdown(true)}
                                className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />

                              {showBasketRegDropdown && registrations.length > 0 && (
                                <div className="absolute bottom-full mb-1 left-0 right-0 bg-white border border-slate-300 rounded-xl shadow-2xl max-h-56 overflow-y-auto divide-y divide-slate-100 z-50">
                                  {registrations.map((r) => (
                                    <div
                                      key={r.id}
                                      onClick={() => handleSelectRegistration(r)}
                                      className="p-3 hover:bg-blue-50 cursor-pointer text-xs transition"
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="font-mono font-bold text-blue-700">{r.registrationId}</span>
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700">
                                          {r.totalMembers} members
                                        </span>
                                      </div>
                                      <p className="font-semibold text-slate-900 mt-0.5">{r.primaryName}</p>
                                      <p className="text-[10px] text-slate-500">
                                        {r.mobile} {r.city ? `• ${r.city}` : ''}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center justify-between p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs">
                              <div>
                                <span className="font-mono font-bold text-blue-700 mr-2">{selectedReg.registrationId}</span>
                                <span className="font-bold text-slate-900">{selectedReg.primaryName}</span>
                                <span className="text-slate-500 ml-2">({selectedReg.mobile})</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setSelectedReg(null)}
                                className="text-rose-600 hover:underline text-xs font-semibold"
                              >
                                Change
                              </button>
                            </div>
                          )}
                        </div>

                        <div>
                          <button
                            type="button"
                            disabled={actionLoading || !selectedReg}
                            onClick={handleCommitAllocation}
                            className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold rounded-lg shadow-md hover:shadow-lg transition flex items-center justify-center gap-1.5"
                          >
                            {actionLoading ? (
                              <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span>Assigning...</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Assign {selectedUnits.length} Bed{selectedUnits.length > 1 ? 's' : ''} to Guest</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ================================================================ */}
          {/* BED OCCUPANCY & STATUS REWRITE MODAL                             */}
          {/* 1-click Check-In, Check-Out, Free Bed, & Maintenance Options     */}
          {/* ================================================================ */}
          {activeBedModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
                {/* Modal Header */}
                <div className="bg-slate-900 text-white p-4 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-blue-600 rounded-lg text-white font-mono font-bold text-sm">
                      {activeBedModal.room.roomNumber} &bull; {activeBedModal.unit.unitNumber}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white flex items-center gap-2">
                        <span>Bed Details & Group Occupancy</span>
                        {modalParticipants.length > 1 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500 text-white">
                            {modalParticipants.length} Beds Linked
                          </span>
                        )}
                      </h3>
                      <p className="text-[11px] text-slate-300">
                        {activeBedModal.room.building || 'Main Wing'} &bull; Floor {activeBedModal.room.floor ?? 1} &bull; {activeBedModal.unit.type} ({activeBedModal.unit.genderCategory})
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveBedModal(null)}
                    className="text-slate-400 hover:text-white p-1 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Modal Scrollable Body */}
                <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
                  {/* Status Indicator */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <span className="font-semibold text-slate-500 uppercase tracking-wide">Current Status</span>
                    <span className={`px-2.5 py-1 rounded-full font-bold text-xs ${
                      activeBedModal.unit.state === 'OCCUPIED'
                        ? 'bg-purple-100 text-purple-950 border border-purple-400'
                        : activeBedModal.unit.state === 'CONFIRMED' || activeBedModal.unit.state === 'ALLOCATED'
                        ? 'bg-amber-100 text-amber-950 border border-amber-400'
                        : activeBedModal.unit.state === 'MAINTENANCE'
                        ? 'bg-slate-200 text-slate-700'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {activeBedModal.unit.state === 'OCCUPIED'
                        ? 'Checked In (Physically Occupied - Purple)'
                        : activeBedModal.unit.state === 'CONFIRMED'
                        ? 'Confirmed Reservation (Amber)'
                        : activeBedModal.unit.state === 'ALLOCATED'
                        ? 'Tentative Reservation (Amber)'
                        : activeBedModal.unit.state === 'MAINTENANCE'
                        ? 'Under Maintenance'
                        : 'Available for Booking (Green)'}
                    </span>
                  </div>

                  {/* Multi-bed group banner if Lohi / group booked multiple beds */}
                  {modalParticipants.length > 1 && (
                    <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl space-y-1.5 text-xs">
                      <div className="flex items-center justify-between font-bold text-indigo-950">
                        <span className="flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-indigo-600" />
                          <span>Group Reservation: {modalParticipants.length} Beds Booked Together</span>
                        </span>
                        <span className="text-[11px] font-mono text-indigo-700">
                          {activeBedModal.unit.conflict?.registrationId}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 pt-1">
                        {modalParticipants.map((p) => (
                          <span
                            key={p.unitId}
                            className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] border ${
                              p.unitId === activeBedModal.unit.id
                                ? 'bg-indigo-600 text-white border-indigo-700 ring-2 ring-indigo-400'
                                : 'bg-white text-indigo-900 border-indigo-200'
                            }`}
                          >
                            {p.roomNumber}-{p.unitNumber} ({p.fullName || 'Guest'})
                          </span>
                        ))}
                      </div>
                      <p className="text-[10px] text-indigo-600">
                        Check-in and check-out actions will apply to all {modalParticipants.length} linked beds simultaneously.
                      </p>
                    </div>
                  )}

                  {/* Reservation & Guest Overview */}
                  {activeBedModal.unit.conflict && (
                    <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-sm">
                          {activeBedModal.unit.conflict.primaryName || activeBedModal.unit.conflict.participantName || 'Guest'}
                        </span>
                        <span className="font-mono text-[11px] text-blue-700 font-semibold">
                          {activeBedModal.unit.conflict.allocationNumber || activeBedModal.unit.conflict.registrationId}
                        </span>
                      </div>
                      {activeBedModal.unit.conflict.mobile && (
                        <p className="text-slate-600 text-xs">
                          📞 {activeBedModal.unit.conflict.mobile}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Check-In and Check-Out Dates / Times */}
                  <div className="space-y-1.5">
                    <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                      Stay Schedule (Date & Time):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Check-In Date & Time
                        </label>
                        <input
                          type="datetime-local"
                          value={modalCheckInTime}
                          onChange={(e) => setModalCheckInTime(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Expected Check-Out Date & Time
                        </label>
                        <input
                          type="datetime-local"
                          value={modalCheckOutTime}
                          onChange={(e) => setModalCheckOutTime(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Guest and Accompanying Persons Details with Aadhaar */}
                  <div className="space-y-2">
                    <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                      Occupant & Aadhaar Details for Each Bed:
                    </span>
                    <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                      {modalParticipants.map((p, idx) => (
                        <div
                          key={p.unitId || idx}
                          className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-blue-900 font-mono text-[11px]">
                              Bed {idx + 1}: Room {p.roomNumber} &bull; Unit {p.unitNumber} ({p.unitType})
                            </span>
                            {idx === 0 ? (
                              <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold">
                                Primary Guest
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-bold">
                                Companion
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Full Name
                              </label>
                              <input
                                type="text"
                                placeholder="Full Name"
                                value={p.fullName}
                                onChange={(e) => updateModalParticipant(idx, 'fullName', e.target.value)}
                                className="w-full px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs text-slate-900"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                12-Digit Aadhaar Card Number
                              </label>
                              <input
                                type="text"
                                maxLength={14}
                                placeholder="12-digit Aadhaar number"
                                value={p.aadhaarNumber}
                                onChange={(e) => updateModalParticipant(idx, 'aadhaarNumber', e.target.value)}
                                className="w-full px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Gender
                              </label>
                              <select
                                value={p.gender || ''}
                                onChange={(e) => updateModalParticipant(idx, 'gender', e.target.value)}
                                className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs text-slate-900"
                              >
                                <option value="">Select Gender</option>
                                <option value="MALE">Male</option>
                                <option value="FEMALE">Female</option>
                                <option value="OTHER">Other</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Age
                              </label>
                              <input
                                type="number"
                                placeholder="Age"
                                min={1}
                                max={120}
                                value={p.age}
                                onChange={(e) => updateModalParticipant(idx, 'age', e.target.value)}
                                className="w-full px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs text-slate-900"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Direct Action Rewrite Buttons */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Select Action to Rewrite Bed Status:
                    </p>

                    {/* CHECK IN OPTION (if not occupied) */}
                    {activeBedModal.unit.state !== 'OCCUPIED' && (
                      <button
                        type="button"
                        disabled={bedActionLoading}
                        onClick={() => handleRewriteUnitStatus('CHECK_IN')}
                        className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-2"
                      >
                        {bedActionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
                        <span>Check In All {modalParticipants.length} Bed{modalParticipants.length > 1 ? 's' : ''} Now (Mark Occupied - Purple)</span>
                      </button>
                    )}

                    {/* CHECK OUT OPTION (if occupied) */}
                    {activeBedModal.unit.state === 'OCCUPIED' && (
                      <button
                        type="button"
                        disabled={bedActionLoading}
                        onClick={() => handleRewriteUnitStatus('CHECK_OUT')}
                        className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-2"
                      >
                        {bedActionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                        <span>Check Out All {modalParticipants.length} Bed{modalParticipants.length > 1 ? 's' : ''} (Frees to Green)</span>
                      </button>
                    )}

                    {/* RELEASE / FREE BED OPTION (if allocated/reserved/occupied) */}
                    {(activeBedModal.unit.state === 'ALLOCATED' || activeBedModal.unit.state === 'CONFIRMED' || activeBedModal.unit.state === 'OCCUPIED') && (
                      <button
                        type="button"
                        disabled={bedActionLoading}
                        onClick={() => handleRewriteUnitStatus('RELEASE_ALLOCATION')}
                        className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-2"
                      >
                        {bedActionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                        <span>Cancel Reservation & Release All {modalParticipants.length} Bed{modalParticipants.length > 1 ? 's' : ''} (Frees to Green)</span>
                      </button>
                    )}

                    {/* MAINTENANCE TOGGLE */}
                    {activeBedModal.unit.state !== 'MAINTENANCE' ? (
                      <button
                        type="button"
                        disabled={bedActionLoading}
                        onClick={() => handleRewriteUnitStatus('SET_MAINTENANCE')}
                        className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition flex items-center justify-center gap-2"
                      >
                        <Wrench className="w-3.5 h-3.5 text-slate-500" />
                        <span>Mark Bed Under Maintenance</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={bedActionLoading}
                        onClick={() => handleRewriteUnitStatus('SET_ACTIVE')}
                        className="w-full py-2 px-3 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Mark Bed Active & Available</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex items-center justify-between">
                  <Link
                    href="/dashboard/reception"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium"
                  >
                    <span>Open Arrivals & Checkout</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setActiveBedModal(null)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 2: ACTIVE ALLOCATIONS DIRECTORY                                */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'DIRECTORY' && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Allocations</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">{allocMetrics.totalAllocations}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Active reservation master records</p>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <BookmarkCheck className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tentative</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">{allocMetrics.TENTATIVE}</h3>
                <p className="text-[11px] text-blue-600 mt-0.5">Awaiting reception confirmation</p>
              </div>
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                <Clock className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Confirmed</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">{allocMetrics.CONFIRMED}</h3>
                <p className="text-[11px] text-emerald-600 mt-0.5">Confirmed for check-in</p>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cancelled</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">{allocMetrics.CANCELLED}</h3>
                <p className="text-[11px] text-rose-600 mt-0.5">Capacity released</p>
              </div>
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                <Ban className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by Allocation Number (ALC-XXXX), Registration ID, Name, Mobile..."
                value={allocSearch}
                onChange={(e) => setAllocSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={allocStatusFilter}
                onChange={(e) => setAllocStatusFilter(e.target.value)}
                className="py-1.5 px-3 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="TENTATIVE">Tentative</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>

              <button
                onClick={fetchAllocations}
                className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600"
                title="Refresh Directory"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
              </button>
            </div>
          </div>

          {/* Allocations Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/80 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Allocation No.</th>
                    <th className="py-3 px-4">Registration</th>
                    <th className="py-3 px-4">Rooms &amp; Units Allocated</th>
                    <th className="py-3 px-4">Stay Dates</th>
                    <th className="py-3 px-4 text-center">Units</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {loading && allocations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                        Loading allocations...
                      </td>
                    </tr>
                  ) : allocations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No allocations found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    allocations.map((alc) => (
                      <tr key={alc.id} className="hover:bg-slate-50 transition">
                        <td className="py-3.5 px-4 font-mono font-bold text-blue-700">
                          {alc.allocationNumber}
                        </td>

                        <td className="py-3.5 px-4">
                          <div>
                            <Link
                              href={`/dashboard/registrations/${alc.registrationId}`}
                              className="font-semibold text-slate-900 hover:text-blue-600 hover:underline"
                            >
                              {alc.primaryName}
                            </Link>
                            <p className="text-[10px] text-slate-500 font-mono">
                              {alc.registrationId} &bull; {alc.mobile}
                            </p>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1">
                            {alc.roomsSummary.map((rs, i) => (
                              <span key={i} className="px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-800 border border-slate-200">
                                {rs.roomNumber} ({rs.beds}B, {rs.mats}M)
                              </span>
                            ))}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-slate-600">
                          {new Date(alc.entryDate).toLocaleDateString()} &rarr; {new Date(alc.exitDate).toLocaleDateString()}
                        </td>

                        <td className="py-3.5 px-4 text-center font-bold text-slate-900">
                          {alc.totalUnits}
                        </td>

                        <td className="py-3.5 px-4">
                          {getAllocBadge(alc.status)}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setViewingAllocation(alc)}
                              className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
                              title="View Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {canSendWhatsApp && alc.status !== 'CANCELLED' && (
                              <button
                                onClick={() => openWhatsAppModal(alc)}
                                className="p-1.5 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border border-emerald-200 rounded-lg transition flex items-center gap-1 font-semibold text-[11px]"
                                title="Send WhatsApp Message"
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="hidden sm:inline">WhatsApp</span>
                              </button>
                            )}

                            {canManage && alc.status !== 'CANCELLED' && (
                              <button
                                onClick={() => setCancellingAllocation(alc)}
                                className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-lg transition"
                                title="Cancel Allocation"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 bg-slate-50/50">
              <span>
                Page {allocPage} of {allocTotalPages} ({allocTotalCount} total)
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setAllocPage((p) => Math.max(1, p - 1))}
                  disabled={allocPage <= 1}
                  className="px-2.5 py-1 border border-slate-300 rounded hover:bg-white disabled:opacity-40"
                >
                  Prev
                </button>
                <button
                  onClick={() => setAllocPage((p) => Math.min(allocTotalPages, p + 1))}
                  disabled={allocPage >= allocTotalPages}
                  className="px-2.5 py-1 border border-slate-300 rounded hover:bg-white disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 1: VIEW ALLOCATION DOSSIER                                   */}
      {/* ------------------------------------------------------------------ */}
      {viewingAllocation && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookmarkCheck className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold">Allocation {viewingAllocation.allocationNumber}</h3>
              </div>
              <button onClick={() => setViewingAllocation(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <p className="font-bold text-slate-900 text-sm">{viewingAllocation.primaryName}</p>
                  <p className="text-slate-500 font-mono">{viewingAllocation.registrationId} &bull; {viewingAllocation.mobile}</p>
                </div>
                {getAllocBadge(viewingAllocation.status)}
              </div>

              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Stay Window</p>
                <p className="font-semibold text-slate-800 mt-0.5">
                  {new Date(viewingAllocation.entryDate).toLocaleDateString()} to {new Date(viewingAllocation.exitDate).toLocaleDateString()}
                </p>
              </div>

              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1.5">
                  Reserved Physical Units ({viewingAllocation.units?.length || 0})
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {viewingAllocation.units?.map((u: any, i: number) => (
                    <div key={i} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-slate-900">{u.unitNumber}</span>
                        <span className="text-[10px] text-slate-500 uppercase">{u.unitType}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1">
                        Room {u.roomNumber} ({u.building || 'Main'})
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {viewingAllocation.notes && (
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Notes</p>
                  <p className="italic text-slate-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200 mt-1">
                    &quot;{viewingAllocation.notes}&quot;
                  </p>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                {canSendWhatsApp && viewingAllocation.status !== 'CANCELLED' ? (
                  <button
                    onClick={() => {
                      const alc = viewingAllocation;
                      setViewingAllocation(null);
                      openWhatsAppModal(alc);
                    }}
                    className="px-3.5 py-2 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm flex items-center gap-1.5 transition text-xs"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Send WhatsApp Notification</span>
                  </button>
                ) : <div />}
                <button
                  onClick={() => setViewingAllocation(null)}
                  className="px-4 py-2 font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 2: CANCEL ALLOCATION DIALOG                                  */}
      {/* ------------------------------------------------------------------ */}
      {cancellingAllocation && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Cancel Allocation {cancellingAllocation.allocationNumber}?
              </h3>
              <p className="text-xs text-slate-500">
                This will cancel the reservation and immediately release its {cancellingAllocation.totalUnits} physical units back into active inventory.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Reason for Cancellation
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setCancellingAllocation(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
              >
                Keep Allocation
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Yes, Release Capacity
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 3: WHATSAPP CLICK-TO-CHAT INTEGRATION                        */}
      {/* ------------------------------------------------------------------ */}
      {whatsappModalOpen && whatsappAllocation && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-5 bg-emerald-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-700/80 border border-emerald-600 flex items-center justify-center text-white">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold flex items-center gap-2">
                    WhatsApp Allocation Notification
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-900/80 text-emerald-200 border border-emerald-700">
                      wa.me Click-to-Chat
                    </span>
                  </h3>
                  <p className="text-xs text-emerald-100 font-mono mt-0.5">
                    {whatsappAllocation.allocationNumber} &bull; {whatsappAllocation.primaryName} ({whatsappAllocation.mobile})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setWhatsappModalOpen(false)}
                className="text-emerald-200 hover:text-white p-1 rounded-lg hover:bg-emerald-700/60 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub-Tabs */}
            <div className="flex items-center border-b border-slate-200 bg-slate-50 px-5 pt-2 text-xs font-semibold">
              <button
                onClick={() => setWhatsappTab('PREVIEW')}
                className={`pb-2.5 px-3 border-b-2 transition flex items-center gap-1.5 ${
                  whatsappTab === 'PREVIEW'
                    ? 'border-emerald-600 text-emerald-700 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                Message Preview &amp; Send
              </button>
              <button
                onClick={() => setWhatsappTab('HISTORY')}
                className={`pb-2.5 px-3 border-b-2 transition flex items-center gap-1.5 ${
                  whatsappTab === 'HISTORY'
                    ? 'border-emerald-600 text-emerald-700 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                Message History ({whatsappHistoryLogs.length})
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              {whatsappActionError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center justify-between">
                  <span className="font-medium">{whatsappActionError}</span>
                  <button onClick={() => setWhatsappActionError(null)} className="text-rose-500 hover:text-rose-700">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {whatsappActionSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center justify-between">
                  <span className="font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    {whatsappActionSuccess}
                  </span>
                  <button onClick={() => setWhatsappActionSuccess(null)} className="text-emerald-500 hover:text-emerald-700">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* -------------------------------------------------------- */}
              {/* TAB 1: PREVIEW & SEND                                    */}
              {/* -------------------------------------------------------- */}
              {whatsappTab === 'PREVIEW' && (
                <div className="space-y-4">
                  {/* Mandatory Legal & Tentative Notice */}
                  <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-300 text-amber-900 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-amber-950 text-xs uppercase tracking-wide">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      Mandatory Disclaimer Enforced
                    </div>
                    <p className="text-[11px] leading-relaxed text-amber-900">
                      <strong>TENTATIVE ACCOMMODATION ALLOCATION – NOT CONFIRMED:</strong> Final accommodation confirmation happens strictly at the Reception Desk after on-site identity verification.
                    </p>
                    <p className="text-[10px] text-amber-800 font-medium">
                      &bull; Privacy Safeguard: Zero Aadhaar numbers or KYC tokens are included in WhatsApp communications.
                    </p>
                  </div>

                  {/* Customizable Options */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Reception Helpdesk Contact
                      </label>
                      <input
                        type="text"
                        value={whatsappHelpdeskContact}
                        onChange={(e) => setWhatsappHelpdeskContact(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Optional Staff Note
                      </label>
                      <input
                        type="text"
                        value={whatsappCustomNotes}
                        onChange={(e) => setWhatsappCustomNotes(e.target.value)}
                        placeholder="e.g. Please arrive before 6 PM"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-2 flex justify-end">
                      <button
                        onClick={() => loadWhatsAppPreview(whatsappAllocation.id)}
                        disabled={whatsappLoading}
                        className="px-3 py-1 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-[11px] font-medium flex items-center gap-1 transition"
                      >
                        <RefreshCw className={`w-3 h-3 ${whatsappLoading ? 'animate-spin text-emerald-600' : ''}`} />
                        Refresh Template
                      </button>
                    </div>
                  </div>

                  {/* Live WhatsApp Chat Bubble Preview */}
                  {whatsappLoading ? (
                    <div className="p-8 text-center text-slate-400 space-y-2">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-600" />
                      <p className="text-xs">Generating verified WhatsApp template...</p>
                    </div>
                  ) : whatsappPreparedData ? (
                    <div className="space-y-3">
                      <div className="text-[11px] font-semibold text-slate-600 flex items-center justify-between">
                        <span>Message Preview:</span>
                        <span className="font-mono text-[10px] text-slate-400">
                          Recipient: {whatsappPreparedData.recipientMobile}
                        </span>
                      </div>

                      {/* Mockup Chat Screen */}
                      <div className="rounded-xl border border-slate-300 bg-[#efeae2] p-4 shadow-inner max-h-64 overflow-y-auto">
                        <div className="max-w-md mx-auto space-y-2">
                          <div className="text-center">
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-100/90 text-emerald-900 border border-emerald-200">
                              🔒 Standard End-to-End Encrypted Message
                            </span>
                          </div>

                          <div className="bg-white p-3.5 rounded-xl rounded-tl-xs shadow-sm border border-slate-200/80 space-y-2 text-[11px] text-slate-900">
                            <pre className="font-sans whitespace-pre-wrap leading-relaxed select-text">
                              {whatsappPreparedData.templateContent}
                            </pre>
                            <div className="text-right text-[9px] text-slate-400 font-mono">
                              Just now &bull; Prepared
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Click to Chat Action Step 1 */}
                      <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <p className="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-full bg-emerald-700 text-white text-[10px] flex items-center justify-center font-bold">1</span>
                              Launch WhatsApp Click-to-Chat Link
                            </p>
                            <p className="text-[11px] text-emerald-800 mt-0.5">
                              Opens WhatsApp Web or App with the pre-filled template. Staff must press Send.
                            </p>
                          </div>

                          <button
                            onClick={handleOpenWhatsAppLink}
                            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-98 shrink-0"
                          >
                            <Share2 className="w-4 h-4" />
                            <span>Open WhatsApp</span>
                            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                          </button>
                        </div>

                        <div className="p-2 bg-white rounded-lg border border-emerald-200/80 flex items-center justify-between text-[10px] text-slate-600 font-mono truncate">
                          <span className="truncate mr-2">{whatsappPreparedData.whatsappUrl}</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(whatsappPreparedData.templateContent);
                              setWhatsappActionSuccess('Message text copied to clipboard!');
                            }}
                            className="text-emerald-700 hover:underline shrink-0 font-sans font-semibold"
                          >
                            Copy Text
                          </button>
                        </div>
                      </div>

                      {/* Step 2: Staff Confirmation Workflow */}
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-300 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-800 text-white text-[10px] flex items-center justify-center font-bold">2</span>
                          <h4 className="font-bold text-slate-900 text-xs">
                            Staff Delivery Confirmation
                          </h4>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            whatsappPreparedData.status === 'STAFF_CONFIRMED_SENT'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : whatsappPreparedData.status === 'OPENED'
                              ? 'bg-blue-100 text-blue-800 border border-blue-300'
                              : whatsappPreparedData.status === 'FAILED'
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}>
                            Current: {whatsappPreparedData.status}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-600">
                          Did you press Send in WhatsApp? WhatsApp Click-to-Chat deep links require manual staff dispatch. Explicitly record whether the message was sent to the registrant:
                        </p>

                        <div className="space-y-2">
                          <input
                            type="text"
                            value={whatsappConfirmNotes}
                            onChange={(e) => setWhatsappConfirmNotes(e.target.value)}
                            placeholder="Optional notes: e.g. Sent from reception counter tablet, primary registrant acknowledged"
                            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />

                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <button
                              onClick={handleConfirmSent}
                              disabled={whatsappActionSubmitting || whatsappPreparedData.status === 'STAFF_CONFIRMED_SENT'}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>{whatsappPreparedData.status === 'STAFF_CONFIRMED_SENT' ? 'Already Confirmed Sent' : 'Yes, Confirm Message Sent'}</span>
                            </button>

                            <button
                              onClick={() => {
                                const reason = prompt('Please enter the failure reason (e.g. Number not registered on WhatsApp, network error):');
                                if (reason && reason.trim()) {
                                  setWhatsappFailureReason(reason.trim());
                                  api.recordWhatsAppFailed(whatsappPreparedData.messageLogId, reason.trim()).then((res) => {
                                    if (res.success) {
                                      setWhatsappActionSuccess('Failure recorded.');
                                      setWhatsappPreparedData((prev) => prev ? { ...prev, status: 'FAILED' } : null);
                                      if (whatsappAllocation) loadWhatsAppHistory(whatsappAllocation.registrationId);
                                    }
                                  });
                                }
                              }}
                              disabled={whatsappActionSubmitting}
                              className="px-3.5 py-2 bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
                            >
                              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                              <span>Report Failed / Not Sent</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {/* -------------------------------------------------------- */}
              {/* TAB 2: HISTORY LOGS                                      */}
              {/* -------------------------------------------------------- */}
              {whatsappTab === 'HISTORY' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-slate-700">
                      Message Communication History for {whatsappAllocation.registrationId}
                    </p>
                    <button
                      onClick={() => loadWhatsAppHistory(whatsappAllocation.registrationId)}
                      className="text-emerald-700 hover:underline text-[11px] font-semibold flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> Refresh
                    </button>
                  </div>

                  {whatsappHistoryLogs.length === 0 ? (
                    <div className="py-10 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                      <History className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="text-xs">No previous WhatsApp communications recorded for this registration.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {whatsappHistoryLogs.map((log) => (
                        <div key={log.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-slate-800 text-[11px]">
                              To: {log.recipientMobile}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              log.status === 'STAFF_CONFIRMED_SENT'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : log.status === 'OPENED'
                                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                : log.status === 'FAILED'
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}>
                              {log.status}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                            <span>Prepared: {new Date(log.createdAt).toLocaleString()}</span>
                            {log.sentAt && (
                              <span className="text-emerald-700 font-medium">
                                Confirmed: {new Date(log.sentAt).toLocaleString()}
                              </span>
                            )}
                            {log.sentByUser && (
                              <span className="text-slate-700 font-medium">
                                Staff: {log.sentByUser.name} ({log.sentByUser.role})
                              </span>
                            )}
                          </div>

                          {log.notes && (
                            <p className="text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-200 mt-1 font-mono">
                              {log.notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setWhatsappModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
              >
                Done / Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
