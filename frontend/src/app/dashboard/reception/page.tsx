'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  CheckSquare,
  Users,
  Search,
  Building,
  Bed,
  Layers,
  Calendar,
  Clock,
  ShieldCheck,
  ShieldAlert,
  ArrowRightLeft,
  LogOut,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Plus,
  Trash2,
  ExternalLink,
  ChevronRight,
  UserCheck,
  UserX,
  FileText,
  AlertTriangle,
  X,
  Sparkles,
  BookmarkCheck,
  Smartphone,
  Eye,
  EyeOff,
  UserPlus,
  SlidersHorizontal,
  Info,
  Check,
  Phone,
  RotateCcw,
  Undo2
} from 'lucide-react';
import {
  api,
  ReceptionMetrics,
  ReceptionDossierData,
  ReceptionParticipant,
  AllocationStatus,
  AvailabilityRoom,
  AvailabilityUnit,
  GenderPreference,
  UnitType,
  GenderCategory,
  HotelListItem,
  UnifiedParticipantProfile,
} from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';

export default function ReceptionPage() {
  const { user } = useAuth();
  const { success: notifySuccess, error: notifyError, warning: notifyWarning, info: notifyInfo, loading: notifyLoading } = useNotification();
  const canOperateReception = user?.role === 'SUPER_ADMIN' || user?.role === 'ALLOCATION_MANAGER' || user?.role === 'RECEPTION_STAFF';

  // Navigation queue tab
  const [activeTab, setActiveTab] = useState<'TODAY_ARRIVALS' | 'TENTATIVE' | 'CHECKED_IN' | 'CHECKED_OUT'>('TODAY_ARRIVALS');

  // Synchronized Tab Switcher (State, URL query parameter, and scroll behavior)
  const handleTabSwitch = (
    tab: 'TODAY_ARRIVALS' | 'TENTATIVE' | 'CHECKED_IN' | 'CHECKED_OUT',
    shouldScroll: boolean = true
  ) => {
    setActiveTab(tab);
    setQueuePage(1);
    setSelectedStayingStayIds([]);

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      let tabParam = 'arrivals';
      if (tab === 'CHECKED_IN') tabParam = 'staying';
      else if (tab === 'TENTATIVE') tabParam = 'tentative';
      else if (tab === 'CHECKED_OUT') tabParam = 'checked_out';
      url.searchParams.set('tab', tabParam);
      window.history.pushState(null, '', url.toString());
    }

    if (shouldScroll) {
      setTimeout(() => {
        const el = document.getElementById('primary-queue-tabs');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 50);
    }
  };

  // Sync tab with URL search parameter on mount and popstate (refresh & back/forward navigation)
  useEffect(() => {
    const syncTabFromUrl = () => {
      if (typeof window === 'undefined') return;
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab')?.toLowerCase();
      if (tabParam === 'arrivals' || tabParam === 'today_arrivals') {
        setActiveTab('TODAY_ARRIVALS');
      } else if (tabParam === 'staying' || tabParam === 'checked_in' || tabParam === 'in_house') {
        setActiveTab('CHECKED_IN');
      } else if (tabParam === 'tentative') {
        setActiveTab('TENTATIVE');
      } else if (tabParam === 'checked_out') {
        setActiveTab('CHECKED_OUT');
      }
    };

    syncTabFromUrl();
    window.addEventListener('popstate', syncTabFromUrl);
    return () => window.removeEventListener('popstate', syncTabFromUrl);
  }, []);

  // Loading & Alerts
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

  // Reception Overview & Queue data
  const [metrics, setMetrics] = useState<ReceptionMetrics>({
    expectedArrivalsCount: 0,
    tentativeAwaitingCount: 0,
    confirmedParticipantsCount: 0,
    checkedInCount: 0,
    expectedDeparturesCount: 0,
    checkedOutTodayCount: 0,
  });
  const [records, setRecords] = useState<any[]>([]);
  const [queuePage, setQueuePage] = useState<number>(1);
  const [queueTotalPages, setQueueTotalPages] = useState<number>(1);
  const [queueTotalCount, setQueueTotalCount] = useState<number>(0);

  // Search input & rapid results
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchParticipantResults, setSearchParticipantResults] = useState<any[]>([]);
  const [searchDropdownOpen, setSearchDropdownOpen] = useState<boolean>(false);

  // Unified Participant Profile State (Requirement 1)
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState<boolean>(false);
  const [profileData, setProfileData] = useState<UnifiedParticipantProfile | null>(null);
  const [isEditPhoneOpen, setIsEditPhoneOpen] = useState<boolean>(false);
  const [newPhoneValue, setNewPhoneValue] = useState<string>('');

  // Daily Operations Overdue Dialog State (Requirement 6)
  const [isOverdueModalOpen, setIsOverdueModalOpen] = useState<boolean>(false);

  // Standalone Visual Room Finder Section (Requirement 4)
  const [isVisualFinderSectionOpen, setIsVisualFinderSectionOpen] = useState<boolean>(false);
  const [finderCategory, setFinderCategory] = useState<GenderPreference>('MALE');
  const [finderPersons, setFinderPersons] = useState<number>(1);
  const [finderUnitType, setFinderUnitType] = useState<'ALL' | 'BED' | 'MAT'>('ALL');
  const [finderHotelId, setFinderHotelId] = useState<string>('ALL');
  const [finderEntryDate, setFinderEntryDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [finderExitDate, setFinderExitDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [finderRooms, setFinderRooms] = useState<AvailabilityRoom[]>([]);
  const [finderLoading, setFinderLoading] = useState<boolean>(false);

  // Available Hotels list for tab filtering & assignment
  const [hotels, setHotels] = useState<HotelListItem[]>([]);

  // Purpose-based filters per tab
  const [filterHotelId, setFilterHotelId] = useState<string>('');
  const [filterBuilding, setFilterBuilding] = useState<string>('');
  const [filterRoomCategory, setFilterRoomCategory] = useState<string>('');
  const [filterRoomNumber, setFilterRoomNumber] = useState<string>('');
  const [filterRegistrationId, setFilterRegistrationId] = useState<string>('');
  const [filterPrimaryName, setFilterPrimaryName] = useState<string>('');
  const [filterPhone, setFilterPhone] = useState<string>('');
  const [filterGender, setFilterGender] = useState<string>('ALL');
  const [filterCheckInStatus, setFilterCheckInStatus] = useState<string>('ALL');
  const [filterCheckOutStatus, setFilterCheckOutStatus] = useState<string>('ALL');
  const [filterArrivalDate, setFilterArrivalDate] = useState<string>('');
  const [filterCheckInDate, setFilterCheckInDate] = useState<string>('');
  const [filterCheckOutDate, setFilterCheckOutDate] = useState<string>('');
  const [filterArrivalStatus, setFilterArrivalStatus] = useState<string>('');
  const [filterAllocationStatus, setFilterAllocationStatus] = useState<string>('');

  // Accidental Checkout Recovery (Check In Again) State
  const [isCheckInAgainOpen, setIsCheckInAgainOpen] = useState<boolean>(false);
  const [recoveryTargetStay, setRecoveryTargetStay] = useState<any | null>(null);
  const [recoveryCheckInDate, setRecoveryCheckInDate] = useState<string>('');
  const [recoveryNotes, setRecoveryNotes] = useState<string>('Accidental checkout recovery / re-checkin');
  const [recoverySelectedUnitId, setRecoverySelectedUnitId] = useState<string>('');
  const [recoveryAvailableRooms, setRecoveryAvailableRooms] = useState<AvailabilityRoom[]>([]);
  const [recoveryLoadingRooms, setRecoveryLoadingRooms] = useState<boolean>(false);
  // Accidental Recovery Filters
  const [recoveryBuildingFilter, setRecoveryBuildingFilter] = useState<string>('ALL');
  const [recoveryRoomSearch, setRecoveryRoomSearch] = useState<string>('');
  const [recoveryGenderFilter, setRecoveryGenderFilter] = useState<'ALL' | 'MALE' | 'FEMALE'>('ALL');
  const [recoveryUnitTypeFilter, setRecoveryUnitTypeFilter] = useState<'ALL' | 'BED' | 'MAT'>('ALL');
  const [recoveryAvailabilityFilter, setRecoveryAvailabilityFilter] = useState<'AVAILABLE_ONLY' | 'ALL'>('AVAILABLE_ONLY');

  // Group Checkout by Primary Participant State
  const [groupCheckoutModalOpen, setGroupCheckoutModalOpen] = useState<boolean>(false);
  const [groupCheckoutReg, setGroupCheckoutReg] = useState<any | null>(null);
  const [groupCheckoutMembers, setGroupCheckoutMembers] = useState<any[]>([]);
  const [groupCheckoutSelectedStayIds, setGroupCheckoutSelectedStayIds] = useState<string[]>([]);
  const [groupCheckoutNotes, setGroupCheckoutNotes] = useState<string>('Group departure checkout');
  const [groupCheckoutConfirmOpen, setGroupCheckoutConfirmOpen] = useState<boolean>(false);
  const [groupCheckoutLoading, setGroupCheckoutLoading] = useState<boolean>(false);

  // Active Reception Dossier Modal
  const [selectedDossierId, setSelectedDossierId] = useState<string | null>(null);
  const [dossierLoading, setDossierLoading] = useState<boolean>(false);
  const [dossier, setDossier] = useState<ReceptionDossierData | null>(null);
  const [dossierActiveTab, setDossierActiveTab] = useState<'ARRIVALS' | 'ASSIGNMENTS' | 'ACTIONS'>('ARRIVALS');

  // --------------------------------------------------------------------------
  // LIVE ROOM AVAILABILITY & WALK-IN ALLOCATION STATE
  // --------------------------------------------------------------------------
  const [isWalkInOpen, setIsWalkInOpen] = useState<boolean>(false);
  const [walkInName, setWalkInName] = useState<string>('');
  const [walkInMobile, setWalkInMobile] = useState<string>('');
  const [walkInCity, setWalkInCity] = useState<string>('');
  const [walkInAadhaar, setWalkInAadhaar] = useState<string>('');
  const [walkInCheckInNow, setWalkInCheckInNow] = useState<boolean>(true);
  
  // Search parameters for Live Room Availability
  const [walkInCategory, setWalkInCategory] = useState<GenderPreference>('MALE');
  const [walkInMemberCount, setWalkInMemberCount] = useState<number>(1);
  const [walkInUnitType, setWalkInUnitType] = useState<'ALL' | 'BED' | 'MAT'>('ALL');
  const [walkInEntryDate, setWalkInEntryDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [walkInExitDate, setWalkInExitDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });

  // Live availability data
  const [availableRooms, setAvailableRooms] = useState<AvailabilityRoom[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState<boolean>(false);

  // Flexible manual unit selection across different rooms & unit types
  const [selectedWalkInUnits, setSelectedWalkInUnits] = useState<Array<{
    unitId: string;
    unitNumber: string;
    unitType: UnitType;
    roomId: string;
    roomNumber: string;
    building?: string | null;
    roomCategory: GenderPreference;
  }>>([]);

  // Accompanying participants data for multi-person walk-ins
  const [walkInCompanions, setWalkInCompanions] = useState<Array<{
    fullName: string;
    phone?: string;
    gender: 'MALE' | 'FEMALE';
    aadhaarNumber?: string;
  }>>([]);

  const fetchLiveRoomAvailability = async () => {
    if (!walkInEntryDate || !walkInExitDate) return;
    setAvailabilityLoading(true);
    try {
      const res = await api.checkAvailability({
        entryDate: `${walkInEntryDate}T10:00:00.000Z`,
        exitDate: `${walkInExitDate}T10:00:00.000Z`,
        roomCategory: walkInCategory,
        unitType: walkInUnitType !== 'ALL' ? (walkInUnitType as UnitType) : undefined,
      });

      if (res.success && res.data) {
        setAvailableRooms(res.data.rooms);
      }
    } catch (e) {
      console.error('Error fetching live room availability:', e);
    } finally {
      setAvailabilityLoading(false);
    }
  };

  useEffect(() => {
    if (isWalkInOpen) {
      fetchLiveRoomAvailability();
    }
  }, [isWalkInOpen, walkInCategory, walkInUnitType, walkInEntryDate, walkInExitDate]);

  // Sync companion fields with selected units count
  useEffect(() => {
    if (selectedWalkInUnits.length > 1) {
      setWalkInCompanions((prev) => {
        const next = [...prev];
        while (next.length < selectedWalkInUnits.length - 1) {
          const companionUnit = selectedWalkInUnits[next.length + 1];
          next.push({
            fullName: '',
            phone: '',
            gender: companionUnit?.roomCategory === 'FEMALE' ? 'FEMALE' : 'MALE',
            aadhaarNumber: '',
          });
        }
        return next.slice(0, selectedWalkInUnits.length - 1);
      });
    } else {
      setWalkInCompanions([]);
    }
  }, [selectedWalkInUnits.length]);

  const handleToggleWalkInUnit = (room: AvailabilityRoom, unit: AvailabilityUnit) => {
    if (!unit.isAvailable) return;
    const exists = selectedWalkInUnits.some((u) => u.unitId === unit.id);
    if (exists) {
      setSelectedWalkInUnits(selectedWalkInUnits.filter((u) => u.unitId !== unit.id));
    } else {
      setSelectedWalkInUnits([
        ...selectedWalkInUnits,
        {
          unitId: unit.id,
          unitNumber: unit.unitNumber,
          unitType: unit.type,
          roomId: room.id,
          roomNumber: room.roomNumber,
          building: room.building,
          roomCategory: room.genderPreference,
        },
      ]);
    }
  };

  const handleCompanionFieldChange = (index: number, field: string, value: string) => {
    setWalkInCompanions((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], [field]: value };
      }
      return next;
    });
  };

  const handleSubmitWalkInAllocation = async () => {
    if (!walkInName.trim()) {
      setErrorMessage('Primary participant full name is required.');
      return;
    }
    if (!walkInMobile.trim() || walkInMobile.replace(/\D/g, '').length < 10) {
      setErrorMessage('Valid 10-digit mobile phone number is required.');
      return;
    }
    if (selectedWalkInUnits.length === 0) {
      setErrorMessage('Please select at least one available bed or mat from the room inventory.');
      return;
    }

    setActionLoading(true);
    setErrorMessage(null);
    try {
      const totalMembers = Math.max(1, selectedWalkInUnits.length);
      const categoryTag = walkInCategory === 'MALE'
        ? `[Category: Male Group (${totalMembers} Persons)]`
        : walkInCategory === 'FEMALE'
        ? `[Category: Female Group (${totalMembers} Persons)]`
        : walkInCategory === 'FAMILY'
        ? `[Guest: Family (${totalMembers} Members)]`
        : `[Guest: Special / VIP (${totalMembers} Members)]`;

      // Build companion list
      const accompanyingMembers = selectedWalkInUnits.slice(1).map((u, idx) => ({
        fullName: walkInCompanions[idx]?.fullName?.trim() || `Guest ${idx + 2}`,
        phone: walkInCompanions[idx]?.phone?.trim() || null,
        gender: walkInCompanions[idx]?.gender || (u.roomCategory === 'FEMALE' ? 'FEMALE' : 'MALE'),
        relationToPrimary: 'Accompanying',
      }));

      // 1. Create walk-in registration
      const regRes = await api.createRegistration({
        primaryName: walkInName.trim(),
        gender: walkInCategory === 'FEMALE' ? 'FEMALE' : 'MALE',
        mobile: walkInMobile.trim(),
        city: walkInCity.trim() || undefined,
        totalMembers,
        notes: `${categoryTag} Walk-in registered at Reception Desk`,
        accompanyingMembers,
      });

      if (!regRes.success || !regRes.data) {
        throw new Error(regRes.message || 'Failed to create walk-in registration');
      }

      const createdReg = regRes.data;

      // 2. Create allocation with manually chosen units
      const allocRes = await api.createAllocation({
        registrationId: createdReg.registrationId,
        entryDate: `${walkInEntryDate}T10:00:00.000Z`,
        exitDate: `${walkInExitDate}T10:00:00.000Z`,
        unitIds: selectedWalkInUnits.map((u) => u.unitId),
        status: walkInCheckInNow ? 'CONFIRMED' : 'TENTATIVE',
        notes: `${categoryTag} Walk-in allocated at Reception Desk`,
      });

      if (!allocRes.success || !allocRes.data) {
        throw new Error(allocRes.message || 'Failed to allocate selected units');
      }

      // 3. If immediate check-in requested, perform check-in on all units
      if (walkInCheckInNow) {
        // Collect Aadhaar for primary if provided
        if (walkInAadhaar.trim().length >= 4) {
          const detailRes = await api.getRegistration(createdReg.id);
          const primaryP = detailRes.data?.participants?.find((p) => p.isPrimary);
          if (primaryP) {
            await api.collectReceptionAadhaar({
              participantId: primaryP.id,
              aadhaarNumber: walkInAadhaar.trim(),
              retentionConsent: true,
            });
          }
        }

        for (const u of selectedWalkInUnits) {
          await api.rewriteUnitStatus(u.unitId, 'CHECK_IN', {
            checkInDateTime: new Date().toISOString(),
          });
        }
      }

      const roomCount = new Set(selectedWalkInUnits.map((u) => u.roomNumber)).size;
      setSuccessMessage(`Walk-in guest ${walkInName} successfully registered and allocated ${selectedWalkInUnits.length} unit(s) across ${roomCount} room(s)${walkInCheckInNow ? ' and checked in' : ''}!`);
      setIsWalkInOpen(false);
      // Reset form
      setWalkInName('');
      setWalkInMobile('');
      setWalkInAadhaar('');
      setWalkInCity('');
      setSelectedWalkInUnits([]);
      setWalkInCompanions([]);
      await fetchOverview();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to complete walk-in allocation.');
    } finally {
      setActionLoading(false);
    }
  };

  // Form State: Arriving Participants
  const [arrivingGroup, setArrivingGroup] = useState<Array<{
    id?: string;
    fullName: string;
    phone?: string;
    gender: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';
    age: number | null;
    relationToPrimary: string;
    isPrimary: boolean;
  }>>([]);

  // Form State: Unit Assignments
  const [unitAssignments, setUnitAssignments] = useState<Record<string, string>>({}); // participantId -> unitId

  // Form State: Aadhaar Collection Modal
  const [aadhaarModalOpen, setAadhaarModalOpen] = useState<boolean>(false);
  const [aadhaarParticipant, setAadhaarParticipant] = useState<{ id: string; fullName: string } | null>(null);
  const [aadhaarNumber, setAadhaarNumber] = useState<string>('');
  const [aadhaarConsent, setAadhaarConsent] = useState<boolean>(false);
  const [showAadhaarNumber, setShowAadhaarNumber] = useState<boolean>(false);

  // --------------------------------------------------------------------------
  // CHANGE ROOM / BED / MAT MODAL STATE (Pre & Post Check-In)
  // Supports Single or Multiple Persons transfer, Hotel filter, Room Search
  // --------------------------------------------------------------------------
  const [changeModalOpen, setChangeModalOpen] = useState<boolean>(false);
  const [changeGroupInfo, setChangeGroupInfo] = useState<{
    registrationId: string;
    displayRegId?: string;
    primaryName: string;
    mobile?: string | null;
    totalMembers: number;
    entryDate?: string;
    exitDate?: string;
  } | null>(null);
  const [changeMembers, setChangeMembers] = useState<Array<{
    key: string;
    participantId?: string | null;
    allocationItemId?: string | null;
    stayRecordId?: string | null;
    fullName: string;
    gender?: string | null;
    phone?: string | null;
    isPrimary?: boolean;
    currentRoomNumber: string;
    currentUnitNumber: string;
    currentUnitType: UnitType;
    currentHotelName?: string | null;
    currentUnitId: string;
    stage: 'PRE_CHECK_IN' | 'CHECKED_IN';
  }>>([]);
  const [selectedMemberKeys, setSelectedMemberKeys] = useState<string[]>([]);
  const [activeAssigningKey, setActiveAssigningKey] = useState<string | null>(null);
  const [memberTargetMap, setMemberTargetMap] = useState<Record<string, {
    unitId: string;
    unitNumber: string;
    unitType: UnitType;
    roomId: string;
    roomNumber: string;
    hotelName?: string | null;
  }>>({});
  const [changeHotelFilter, setChangeHotelFilter] = useState<string>('ALL');
  const [changeCategoryFilter, setChangeCategoryFilter] = useState<GenderPreference>('ANY');
  const [changeTypeFilter, setChangeTypeFilter] = useState<'ALL' | 'BED' | 'MAT'>('ALL');
  const [changeRoomSearchQuery, setChangeRoomSearchQuery] = useState<string>('');
  const [changeAvailableRooms, setChangeAvailableRooms] = useState<any[]>([]);
  const [changeAvailabilityLoading, setChangeAvailabilityLoading] = useState<boolean>(false);
  const [changeReason, setChangeReason] = useState<string>('Guest Room Reassignment');
  // Legacy compatibility pointer
  const [changeParticipant, setChangeParticipant] = useState<any | null>(null);
  const [changeCurrentAssignment, setChangeCurrentAssignment] = useState<any | null>(null);
  const [changeSelectedUnit, setChangeSelectedUnit] = useState<any | null>(null);

  // --------------------------------------------------------------------------
  // EDIT PARTICIPANT PHONE MODAL STATE
  // --------------------------------------------------------------------------
  const [phoneModalOpen, setPhoneModalOpen] = useState<boolean>(false);
  const [phoneParticipant, setPhoneParticipant] = useState<{ id: string; fullName: string; phone?: string | null } | null>(null);
  const [phoneInputVal, setPhoneInputVal] = useState<string>('');

  // --------------------------------------------------------------------------
  // EXTEND STAY MODAL STATE
  // --------------------------------------------------------------------------
  const [extendStayModalOpen, setExtendStayModalOpen] = useState<boolean>(false);
  const [extendStayTarget, setExtendStayTarget] = useState<{
    stayRecordId: string;
    participantName: string;
    roomNumber: string;
    unitNumber: string;
    unitType: string;
    hotelName?: string;
    currentExitDate?: string;
  } | null>(null);
  const [extendStayNewDate, setExtendStayNewDate] = useState<string>('');
  const [extendStayNotes, setExtendStayNotes] = useState<string>('Stay extended per guest request');
  const [extendStayLoading, setExtendStayLoading] = useState<boolean>(false);

  // Group Check-out Selection State
  const [selectedStayingStayIds, setSelectedStayingStayIds] = useState<string[]>([]);
  const [groupCheckOutLoading, setGroupCheckOutLoading] = useState<boolean>(false);

  // --------------------------------------------------------------------------
  // TOUCH-FRIENDLY QUICK ACTION MODAL STATES (CHECK IN, CHANGE ROOM, CHECK OUT)
  // --------------------------------------------------------------------------
  const [quickCheckInOpen, setQuickCheckInOpen] = useState<boolean>(false);
  const [quickCheckInSearch, setQuickCheckInSearch] = useState<string>('');
  const [quickCheckInTarget, setQuickCheckInTarget] = useState<any | null>(null);

  const [quickCheckOutOpen, setQuickCheckOutOpen] = useState<boolean>(false);
  const [quickCheckOutSearch, setQuickCheckOutSearch] = useState<string>('');
  const [quickCheckOutTarget, setQuickCheckOutTarget] = useState<any | null>(null);
  const [quickCheckOutSelectedIds, setQuickCheckOutSelectedIds] = useState<string[]>([]);
  // Enhanced Check-Out Modal Filters & Complete In-House List
  const [quickCheckOutInHouseList, setQuickCheckOutInHouseList] = useState<any[]>([]);
  const [quickCheckOutLoadingList, setQuickCheckOutLoadingList] = useState<boolean>(false);
  const [quickCheckOutBuildingFilter, setQuickCheckOutBuildingFilter] = useState<string>('ALL');
  const [quickCheckOutHotelFilter, setQuickCheckOutHotelFilter] = useState<string>('ALL');
  const [quickCheckOutRoomSearch, setQuickCheckOutRoomSearch] = useState<string>('');
  const [quickCheckOutGenderFilter, setQuickCheckOutGenderFilter] = useState<'ALL' | 'MALE' | 'FEMALE'>('ALL');
  const [quickCheckOutUnitTypeFilter, setQuickCheckOutUnitTypeFilter] = useState<'ALL' | 'BED' | 'MAT'>('ALL');

  // --------------------------------------------------------------------------
  // HANDWRITTEN REFERENCE SKETCH AVAILABILITY SEARCH CONTROLS
  // --------------------------------------------------------------------------
  const [sketchCategory, setSketchCategory] = useState<GenderPreference>('FEMALE');
  const [sketchPersons, setSketchPersons] = useState<string>('1');
  const [sketchCustomPersons, setSketchCustomPersons] = useState<number>(11);
  const [sketchUnitType, setSketchUnitType] = useState<'ALL' | 'BED' | 'MAT'>('ALL');
  const [sketchEntryDate, setSketchEntryDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [sketchExitDate, setSketchExitDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [sketchAvailableRooms, setSketchAvailableRooms] = useState<AvailabilityRoom[]>([]);
  const [sketchSearching, setSketchSearching] = useState<boolean>(false);
  const [sketchHasSearched, setSketchHasSearched] = useState<boolean>(false);
  const [sketchSelectedUnits, setSketchSelectedUnits] = useState<Array<{
    unitId: string;
    unitNumber: string;
    unitType: UnitType;
    roomId: string;
    roomNumber: string;
    building?: string | null;
    roomCategory: GenderPreference;
  }>>([]);

  const targetRequiredPersons = sketchPersons === 'CUSTOM' ? Math.max(1, sketchCustomPersons) : parseInt(sketchPersons, 10) || 1;

  const handleSearchRoomAvailability = async () => {
    if (!sketchEntryDate || !sketchExitDate) return;
    setSketchSearching(true);
    setSketchHasSearched(true);
    setErrorMessage(null);
    try {
      const res = await api.checkAvailability({
        entryDate: `${sketchEntryDate}T10:00:00.000Z`,
        exitDate: `${sketchExitDate}T10:00:00.000Z`,
        roomCategory: sketchCategory,
        unitType: sketchUnitType !== 'ALL' ? (sketchUnitType as UnitType) : undefined,
      });

      if (res.success && res.data) {
        setSketchAvailableRooms(res.data.rooms);
      } else {
        setErrorMessage(res.message || 'Failed to search available rooms.');
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'Error querying room availability.');
    } finally {
      setSketchSearching(false);
    }
  };

  const handleToggleSketchUnit = (room: AvailabilityRoom, unit: AvailabilityUnit) => {
    if (!unit.isAvailable) return;
    const exists = sketchSelectedUnits.some((u) => u.unitId === unit.id);
    if (exists) {
      setSketchSelectedUnits(sketchSelectedUnits.filter((u) => u.unitId !== unit.id));
    } else {
      setSketchSelectedUnits([
        ...sketchSelectedUnits,
        {
          unitId: unit.id,
          unitNumber: unit.unitNumber,
          unitType: unit.type,
          roomId: room.id,
          roomNumber: room.roomNumber,
          building: room.building,
          roomCategory: room.genderPreference,
        },
      ]);
    }
  };

  const handleProceedToAllocateFromSearch = () => {
    if (sketchSelectedUnits.length === 0) return;
    setWalkInCategory(sketchCategory);
    setWalkInEntryDate(sketchEntryDate);
    setWalkInExitDate(sketchExitDate);
    setSelectedWalkInUnits(sketchSelectedUnits);
    setIsWalkInOpen(true);
  };

  // --------------------------------------------------------------------------
  // DATA FETCHING
  // --------------------------------------------------------------------------
  useEffect(() => {
    api.getHotels().then((res) => {
      if (res.success && res.data) {
        setHotels(res.data);
      }
    });
  }, []);

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const res = await api.getReceptionOverview({
        tab: activeTab,
        q: searchQuery,
        hotelId: filterHotelId || undefined,
        building: filterBuilding || undefined,
        roomCategory: filterRoomCategory || undefined,
        roomNumber: filterRoomNumber || undefined,
        registrationId: filterRegistrationId || undefined,
        primaryName: filterPrimaryName || undefined,
        phone: filterPhone || undefined,
        gender: filterGender !== 'ALL' ? filterGender : undefined,
        checkInStatus: filterCheckInStatus !== 'ALL' ? filterCheckInStatus : undefined,
        checkOutStatus: filterCheckOutStatus !== 'ALL' ? filterCheckOutStatus : undefined,
        arrivalDate: filterArrivalDate || undefined,
        checkInDate: filterCheckInDate || undefined,
        checkOutDate: filterCheckOutDate || undefined,
        arrivalStatus: filterArrivalStatus || undefined,
        allocationStatus: filterAllocationStatus || undefined,
        page: queuePage,
        limit: 15,
      });

      if (res.success && res.data) {
        setMetrics(res.data.metrics);
        setRecords(res.data.records);
        setQueuePage(res.data.pagination.page);
        setQueueTotalPages(res.data.pagination.totalPages);
        setQueueTotalCount(res.data.pagination.total);
      } else {
        setErrorMessage(res.message || 'Failed to load reception overview.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error fetching reception overview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [
    activeTab,
    queuePage,
    searchQuery,
    filterHotelId,
    filterBuilding,
    filterRoomCategory,
    filterRoomNumber,
    filterRegistrationId,
    filterPrimaryName,
    filterPhone,
    filterGender,
    filterCheckInStatus,
    filterCheckOutStatus,
    filterArrivalDate,
    filterCheckInDate,
    filterCheckOutDate,
    filterArrivalStatus,
    filterAllocationStatus,
  ]);

  // Accidental Checkout Recovery Handlers
  const openCheckInAgainModal = async (stayRecord: any) => {
    setRecoveryTargetStay(stayRecord);
    setRecoveryNotes('Accidental checkout recovery / re-checkin');
    setRecoveryCheckInDate(new Date().toISOString().slice(0, 16));
    setRecoverySelectedUnitId(stayRecord.unit?.id || '');

    // Reset filters
    setRecoveryBuildingFilter('ALL');
    setRecoveryRoomSearch('');
    const guestGender = stayRecord.participant?.gender || stayRecord.registration?.gender || stayRecord.unit?.room?.genderPreference;
    if (guestGender === 'FEMALE') {
      setRecoveryGenderFilter('FEMALE');
    } else if (guestGender === 'MALE') {
      setRecoveryGenderFilter('MALE');
    } else {
      setRecoveryGenderFilter('ALL');
    }
    setRecoveryUnitTypeFilter('ALL');
    setRecoveryAvailabilityFilter('AVAILABLE_ONLY');

    setIsCheckInAgainOpen(true);
    setRecoveryLoadingRooms(true);

    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().slice(0, 10);

      // Fetch all available inventory without restricting roomCategory to ensure all rooms are available for filtering
      const res = await api.checkAvailability({
        entryDate: `${todayStr}T10:00:00.000Z`,
        exitDate: `${tomorrowStr}T10:00:00.000Z`,
      });

      if (res.success && res.data) {
        setRecoveryAvailableRooms(res.data.rooms || []);
      }
    } catch (err: any) {
      console.error('Error querying rooms for re-checkin:', err);
    } finally {
      setRecoveryLoadingRooms(false);
    }
  };

  // Extract unique building/hotel names from loaded recovery rooms
  const recoveryAvailableBuildings = useMemo(() => {
    if (!recoveryAvailableRooms || recoveryAvailableRooms.length === 0) return [];
    const set = new Set<string>();
    recoveryAvailableRooms.forEach((r) => {
      const b = (r.building || r.hotelName || '').trim();
      if (b) set.add(b);
    });
    return Array.from(set).sort();
  }, [recoveryAvailableRooms]);

  // Accidental Recovery Filtered Rooms
  const filteredRecoveryRooms = useMemo(() => {
    if (!recoveryAvailableRooms || recoveryAvailableRooms.length === 0) return [];

    return recoveryAvailableRooms
      .filter((room) => {
        // Building Name filter
        if (recoveryBuildingFilter !== 'ALL') {
          const bldg = (room.building || room.hotelName || '').trim().toLowerCase();
          if (bldg !== recoveryBuildingFilter.toLowerCase()) return false;
        }

        // Room Number partial search
        if (recoveryRoomSearch.trim()) {
          const q = recoveryRoomSearch.trim().toLowerCase();
          const matchNum = room.roomNumber.toLowerCase().includes(q);
          const matchBldg = (room.building || room.hotelName || '').toLowerCase().includes(q);
          if (!matchNum && !matchBldg) return false;
        }

        // Gender Filter
        if (recoveryGenderFilter === 'MALE' && room.genderPreference !== 'MALE') return false;
        if (recoveryGenderFilter === 'FEMALE' && room.genderPreference !== 'FEMALE') return false;

        return true;
      })
      .map((room) => {
        // Filter units inside the room
        const filteredUnits = room.units.filter((u) => {
          // Unit Type Filter
          if (recoveryUnitTypeFilter === 'BED' && u.type !== 'BED') return false;
          if (recoveryUnitTypeFilter === 'MAT' && u.type !== 'MAT') return false;

          // Availability Filter: when AVAILABLE_ONLY, only show available units
          if (recoveryAvailabilityFilter === 'AVAILABLE_ONLY' && !u.isAvailable) return false;

          return true;
        });

        return {
          ...room,
          units: filteredUnits,
        };
      })
      .filter((room) => room.units.length > 0);
  }, [
    recoveryAvailableRooms,
    recoveryBuildingFilter,
    recoveryRoomSearch,
    recoveryGenderFilter,
    recoveryUnitTypeFilter,
    recoveryAvailabilityFilter,
  ]);

  // Accurate matching counts of rooms and units
  const recoverySummaryStats = useMemo(() => {
    let totalMatchingRooms = filteredRecoveryRooms.length;
    let availableUnits = 0;
    let availableBeds = 0;
    let availableMats = 0;

    filteredRecoveryRooms.forEach((r) => {
      r.units.forEach((u) => {
        if (u.isAvailable) {
          availableUnits++;
          if (u.type === 'BED') availableBeds++;
          if (u.type === 'MAT') availableMats++;
        }
      });
    });

    return { totalMatchingRooms, availableUnits, availableBeds, availableMats };
  }, [filteredRecoveryRooms]);

  // Group Checkout Handlers
  const openGroupCheckoutForRegistration = async (registrationIdOrRecord: any) => {
    setActionLoading(true);
    try {
      const regId = typeof registrationIdOrRecord === 'string'
        ? registrationIdOrRecord
        : registrationIdOrRecord.registration?.registrationId || registrationIdOrRecord.registrationId || registrationIdOrRecord.id;

      const res = await api.getReceptionDossier(regId);
      if (res.success && res.data) {
        setGroupCheckoutReg(res.data.registration);

        const members = (res.data.registration.participants || []).map((p: any) => {
          const isCheckedIn = p.checkInStatus === 'CHECKED_IN' && !!p.activeStay?.id && !p.activeStay?.actualCheckOut;
          return {
            participantId: p.id,
            fullName: p.fullName,
            phone: p.phone,
            gender: p.gender,
            age: p.age,
            isPrimary: p.isPrimary,
            checkInStatus: p.checkInStatus,
            stayRecord: p.activeStay,
            stayRecordId: p.activeStay?.id,
            roomNumber: p.activeStay?.unit?.room?.roomNumber,
            building: p.activeStay?.unit?.room?.building || p.activeStay?.unit?.room?.hotel?.name,
            unitNumber: p.activeStay?.unit?.unitNumber,
            unitType: p.activeStay?.unit?.type,
            isCheckedIn,
          };
        });

        setGroupCheckoutMembers(members);
        const checkedInStayIds = members.filter((m: any) => m.isCheckedIn).map((m: any) => m.stayRecordId);
        setGroupCheckoutSelectedStayIds(checkedInStayIds);
        setGroupCheckoutNotes('Group departure checkout');
        setGroupCheckoutModalOpen(true);
      } else {
        setErrorMessage(res.message || 'Could not load group members for checkout.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error opening group checkout.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteGroupCheckout = async () => {
    if (groupCheckoutSelectedStayIds.length === 0) {
      notifyWarning('Please select at least one member to check out.');
      setErrorMessage('Please select at least one member to check out.');
      return;
    }

    const selectedMembers = groupCheckoutMembers.filter((m) =>
      groupCheckoutSelectedStayIds.includes(m.stayRecordId)
    );
    const selectedNames = selectedMembers.map((m) => m.fullName).join(', ');

    setGroupCheckoutLoading(true);
    try {
      const res = await api.batchCheckOutParticipants({
        stayRecordIds: groupCheckoutSelectedStayIds,
        notes: groupCheckoutNotes,
      });

      if (res.success) {
        const msg = res.message || `Checked out ${groupCheckoutSelectedStayIds.length} guest(s) successfully: ${selectedNames}`;
        setSuccessMessage(msg);
        notifySuccess(msg);
        setGroupCheckoutConfirmOpen(false);
        setGroupCheckoutModalOpen(false);
        setGroupCheckoutSelectedStayIds([]);
        await fetchOverview();
      } else {
        const msg = res.message || 'Failed to complete group checkout.';
        setErrorMessage(msg);
        notifyError(msg);
      }
    } catch (err: any) {
      const msg = err.message || 'Error executing group checkout.';
      setErrorMessage(msg);
      notifyError(msg);
    } finally {
      setGroupCheckoutLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // QUICK CHECK-OUT MODAL LOGIC & IN-HOUSE GUEST FILTERING
  // --------------------------------------------------------------------------
  const handleOpenQuickCheckOut = async () => {
    setQuickCheckOutOpen(true);
    setQuickCheckOutSearch('');
    setQuickCheckOutBuildingFilter('ALL');
    setQuickCheckOutHotelFilter('ALL');
    setQuickCheckOutRoomSearch('');
    setQuickCheckOutGenderFilter('ALL');
    setQuickCheckOutUnitTypeFilter('ALL');
    setQuickCheckOutSelectedIds([]);
    setQuickCheckOutTarget(null);
    setQuickCheckOutLoadingList(true);

    try {
      const res = await api.getReceptionOverview({
        tab: 'CHECKED_IN',
        limit: 500,
      });
      if (res.success && res.data?.records) {
        setQuickCheckOutInHouseList(res.data.records);
      } else {
        const inHouse = records.filter(
          (r) => r.status === 'CHECKED_IN' || r.status === 'EXTENDED' || (r.actualCheckIn && !r.actualCheckOut)
        );
        setQuickCheckOutInHouseList(inHouse);
      }
    } catch {
      const inHouse = records.filter(
        (r) => r.status === 'CHECKED_IN' || r.status === 'EXTENDED' || (r.actualCheckIn && !r.actualCheckOut)
      );
      setQuickCheckOutInHouseList(inHouse);
    } finally {
      setQuickCheckOutLoadingList(false);
    }
  };

  const quickCheckOutAvailableBuildings = useMemo(() => {
    const bldgs = new Set<string>();
    quickCheckOutInHouseList.forEach((r) => {
      const bldg = r.unit?.room?.building || r.unit?.room?.hotel?.name;
      if (bldg && typeof bldg === 'string' && bldg.trim()) {
        bldgs.add(bldg.trim());
      }
    });
    return Array.from(bldgs).sort();
  }, [quickCheckOutInHouseList]);

  const filteredQuickCheckOutGuests = useMemo(() => {
    return quickCheckOutInHouseList.filter((item) => {
      // 1. Text search
      if (quickCheckOutSearch.trim()) {
        const q = quickCheckOutSearch.toLowerCase().trim();
        const nameMatch = (item.participant?.fullName || item.registration?.primaryName || '').toLowerCase().includes(q);
        const regMatch = (item.registration?.registrationId || '').toLowerCase().includes(q);
        const roomMatch = (item.unit?.room?.roomNumber || '').toLowerCase().includes(q);
        const bldgMatch = (item.unit?.room?.building || item.unit?.room?.hotel?.name || '').toLowerCase().includes(q);
        const phoneMatch = (item.participant?.phone || item.registration?.mobile || '').includes(q);
        if (!nameMatch && !regMatch && !roomMatch && !bldgMatch && !phoneMatch) return false;
      }

      // 2. Building filter
      if (quickCheckOutBuildingFilter !== 'ALL') {
        const bldg = (item.unit?.room?.building || item.unit?.room?.hotel?.name || '').trim().toLowerCase();
        if (bldg !== quickCheckOutBuildingFilter.toLowerCase()) return false;
      }

      // 3. Hotel filter
      if (quickCheckOutHotelFilter !== 'ALL') {
        const hId = item.unit?.room?.hotelId || item.unit?.room?.hotel?.id;
        if (hId !== quickCheckOutHotelFilter) return false;
      }

      // 4. Room search
      if (quickCheckOutRoomSearch.trim()) {
        const q = quickCheckOutRoomSearch.toLowerCase().trim();
        const rNum = (item.unit?.room?.roomNumber || '').toLowerCase();
        if (!rNum.includes(q)) return false;
      }

      // 5. Gender filter
      if (quickCheckOutGenderFilter !== 'ALL') {
        const g = item.participant?.gender || item.registration?.gender || item.unit?.room?.genderPreference;
        if (g !== quickCheckOutGenderFilter) return false;
      }

      // 6. Unit type filter
      if (quickCheckOutUnitTypeFilter !== 'ALL') {
        if (item.unit?.type !== quickCheckOutUnitTypeFilter) return false;
      }

      return true;
    });
  }, [
    quickCheckOutInHouseList,
    quickCheckOutSearch,
    quickCheckOutBuildingFilter,
    quickCheckOutHotelFilter,
    quickCheckOutRoomSearch,
    quickCheckOutGenderFilter,
    quickCheckOutUnitTypeFilter,
  ]);

  const handleExecuteQuickCheckOutSelected = async () => {
    if (quickCheckOutSelectedIds.length === 0) {
      notifyWarning('Please select at least one guest to check out.');
      return;
    }

    const selectedStays = quickCheckOutInHouseList.filter((s) => quickCheckOutSelectedIds.includes(s.id));
    const selectedNames = selectedStays.map((s) => s.participant?.fullName || s.registration?.primaryName).join(', ');

    setActionLoading(true);
    setGroupCheckOutLoading(true);
    try {
      const res = await api.batchCheckOutParticipants({
        stayRecordIds: quickCheckOutSelectedIds,
        notes: 'Reception quick check-out desk',
      });

      if (res.success) {
        const msg = res.message || `Checked out ${quickCheckOutSelectedIds.length} guest(s) successfully: ${selectedNames}`;
        setSuccessMessage(msg);
        notifySuccess(msg);
        setQuickCheckOutOpen(false);
        setQuickCheckOutSelectedIds([]);
        await fetchOverview();
      } else {
        const msg = res.message || 'Failed to complete checkout for selected guests.';
        setErrorMessage(msg);
        notifyError(msg);
      }
    } catch (err: any) {
      const msg = err.message || 'Error executing checkout.';
      setErrorMessage(msg);
      notifyError(msg);
    } finally {
      setActionLoading(false);
      setGroupCheckOutLoading(false);
    }
  };

  // Selected unit details across all loaded recovery rooms to ensure selection visibility
  const selectedRecoveryUnitInfo = useMemo(() => {
    if (!recoverySelectedUnitId || !recoveryAvailableRooms) return null;
    for (const room of recoveryAvailableRooms) {
      const u = room.units.find((unit) => unit.id === recoverySelectedUnitId);
      if (u) {
        const isVisible = filteredRecoveryRooms.some((r) =>
          r.units.some((unit) => unit.id === recoverySelectedUnitId)
        );
        return {
          unit: u,
          room,
          isVisible,
        };
      }
    }
    return null;
  }, [recoverySelectedUnitId, recoveryAvailableRooms, filteredRecoveryRooms]);

  const handleExecuteCheckInAgain = async () => {
    if (!recoveryTargetStay || !recoverySelectedUnitId) {
      setErrorMessage('Please select a bed or mat unit for check-in.');
      return;
    }

    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.checkInAgain({
        participantId: recoveryTargetStay.participant?.id,
        unitId: recoverySelectedUnitId,
        checkInDateTime: recoveryCheckInDate ? new Date(recoveryCheckInDate).toISOString() : new Date().toISOString(),
        notes: recoveryNotes,
      });

      if (res.success) {
        setSuccessMessage(res.message || `Checked in ${recoveryTargetStay.participant?.fullName} again successfully.`);
        setIsCheckInAgainOpen(false);
        setActiveTab('CHECKED_IN');
        setQueuePage(1);
        fetchOverview();
      } else {
        setErrorMessage(res.message || 'Failed to check in again.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error executing accidental checkout recovery.');
    } finally {
      setActionLoading(false);
    }
  };

  // Debounced Rapid Search
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setSearchParticipantResults([]);
      setSearchDropdownOpen(false);
      return;
    }

    const handler = setTimeout(async () => {
      try {
        const res = await api.searchReception(searchQuery.trim());
        if (res.success) {
          const regs = Array.isArray(res.data) ? res.data : (res.data?.registrations || []);
          const parts = (res as any).participants || res.data?.participants || [];
          setSearchResults(regs);
          setSearchParticipantResults(parts);
          setSearchDropdownOpen(regs.length > 0 || parts.length > 0);
        }
      } catch {
        // silent search
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Unified Participant Profile loader (Requirement 1)
  const openParticipantProfile = async (participantId: string) => {
    setSelectedProfileId(participantId);
    setProfileLoading(true);
    setSearchDropdownOpen(false);
    setIsEditPhoneOpen(false);
    try {
      const res = await api.getParticipantProfile(participantId);
      if (res.success && res.data) {
        setProfileData(res.data);
        setNewPhoneValue(res.data.participant.phone || '');
      } else {
        setErrorMessage(res.message || 'Failed to load participant profile');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error loading profile.');
    } finally {
      setProfileLoading(false);
    }
  };

  // Update phone handler from Profile
  const handleUpdatePhone = async () => {
    if (!profileData || !newPhoneValue.trim() || newPhoneValue.replace(/\D/g, '').length < 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await api.updateParticipantPhone(profileData.participant.id, newPhoneValue.trim());
      if (res.success) {
        setSuccessMessage(`Phone number for ${profileData.participant.fullName} updated to ${newPhoneValue.trim()}!`);
        setIsEditPhoneOpen(false);
        openParticipantProfile(profileData.participant.id);
        fetchOverview();
      } else {
        setErrorMessage(res.message || 'Failed to update phone number.');
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'Error updating phone.');
    } finally {
      setActionLoading(false);
    }
  };

  // Standalone Room Availability Finder fetcher (Requirement 4)
  const fetchVisualFinderRooms = async () => {
    if (!finderEntryDate || !finderExitDate) return;
    setFinderLoading(true);
    try {
      const res = await api.checkAvailability({
        entryDate: `${finderEntryDate}T10:00:00.000Z`,
        exitDate: `${finderExitDate}T10:00:00.000Z`,
        roomCategory: finderCategory,
        unitType: finderUnitType !== 'ALL' ? (finderUnitType as UnitType) : undefined,
      });
      if (res.success && res.data) {
        let rooms = res.data.rooms;
        if (finderHotelId !== 'ALL') {
          rooms = rooms.filter((r) => r.hotelId === finderHotelId);
        }
        setFinderRooms(rooms);
      }
    } catch (e) {
      console.error('Error fetching visual finder rooms:', e);
    } finally {
      setFinderLoading(false);
    }
  };

  // Load Dossier
  const openDossier = async (identifier: string) => {
    setSelectedDossierId(identifier);
    setDossierLoading(true);
    setSearchDropdownOpen(false);
    setDossierActiveTab('ARRIVALS');
    try {
      const res = await api.getReceptionDossier(identifier);
      if (res.success && res.data) {
        setDossier(res.data);

        // Prepopulate arriving group with existing participants or primary registrant
        const initialGroup: Array<{
          id?: string;
          fullName: string;
          phone?: string;
          gender: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';
          age: number | null;
          relationToPrimary: string;
          isPrimary: boolean;
        }> = res.data.registration.participants.map((p) => ({
          id: p.id,
          fullName: p.fullName,
          phone: p.phone || '',
          gender: (p.gender as any) || 'UNKNOWN',
          age: p.age,
          relationToPrimary: p.relationToPrimary || 'Self',
          isPrimary: p.isPrimary,
        }));

        if (initialGroup.length === 0) {
          initialGroup.push({
            fullName: res.data.registration.primaryName,
            phone: res.data.registration.mobile,
            gender: 'UNKNOWN',
            age: null,
            relationToPrimary: 'Self',
            isPrimary: true,
          });
        }
        setArrivingGroup(initialGroup);

        // Prepopulate assignments if allocation has items
        const initialAssignments: Record<string, string> = {};
        if (res.data.activeAllocation) {
          res.data.activeAllocation.items.forEach((item: any) => {
            if (item.participantId) {
              initialAssignments[item.participantId] = item.unitId;
            }
          });
        }
        setUnitAssignments(initialAssignments);
      } else {
        setErrorMessage(res.message || 'Failed to load reception dossier.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error loading reception dossier.');
    } finally {
      setDossierLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // RECEPTION WORKFLOW ACTIONS
  // --------------------------------------------------------------------------

  // 1. Save Arriving Group
  const handleSaveArrivingGroup = async () => {
    if (!dossier) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.recordReceptionParticipants({
        registrationId: dossier.registration.id,
        participants: arrivingGroup,
      });

      if (res.success) {
        setSuccessMessage('Arriving participants updated successfully.');
        await openDossier(dossier.registration.id);
        setDossierActiveTab('ASSIGNMENTS');
      } else {
        setErrorMessage(res.message || 'Failed to update arriving participants.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error updating arriving participants.');
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Collect Aadhaar
  const handleSaveAadhaar = async () => {
    if (!aadhaarParticipant || !aadhaarNumber.trim()) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.collectReceptionAadhaar({
        participantId: aadhaarParticipant.id,
        aadhaarNumber: aadhaarNumber.trim(),
        retentionConsent: aadhaarConsent,
      });

      if (res.success) {
        setSuccessMessage(`Aadhaar encrypted and recorded for ${aadhaarParticipant.fullName} (Masked: ${res.data.maskedAadhaar}).`);
        setAadhaarModalOpen(false);
        setAadhaarNumber('');
        setAadhaarConsent(false);
        if (dossier) await openDossier(dossier.registration.id);
      } else {
        setErrorMessage(res.message || 'Failed to save Aadhaar record.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error saving Aadhaar record.');
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Confirm Reception
  const handleConfirmReception = async () => {
    if (!dossier || !dossier.activeAllocation) return;

    // Build assignment list
    const participantAssignments = Object.entries(unitAssignments).map(([pId, uId]) => {
      const allocItem = dossier.activeAllocation.items.find((i: any) => i.unitId === uId);
      return {
        participantId: pId,
        unitId: uId,
        allocationItemId: allocItem?.id,
      };
    });

    if (participantAssignments.length === 0) {
      setErrorMessage('Please map at least one arriving participant to an allocated unit before confirming.');
      return;
    }

    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.confirmReception({
        allocationId: dossier.activeAllocation.id,
        participantAssignments,
      });

      if (res.success) {
        setSuccessMessage(`Allocation ${dossier.activeAllocation.allocationNumber} confirmed successfully.`);
        await openDossier(dossier.registration.id);
        await fetchOverview();
        setDossierActiveTab('ACTIONS');
      } else {
        setErrorMessage(res.message || 'Failed to confirm reception.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error confirming reception.');
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Execute Check-in
  const handleExecuteCheckIn = async () => {
    if (!dossier) return;

    // Collect participants ready for check-in
    const checkIns = Object.entries(unitAssignments)
      .map(([pId, uId]) => {
        const participant = dossier.registration.participants.find((p) => p.id === pId);
        // Only check in participants not already checked in
        if (participant?.activeStay) return null;
        const allocItem = dossier.activeAllocation?.items.find((i: any) => i.unitId === uId);
        return {
          participantId: pId,
          unitId: uId,
          allocationItemId: allocItem?.id,
          notes: 'Checked in at reception desk',
        };
      })
      .filter(Boolean) as any[];

    if (checkIns.length === 0) {
      setErrorMessage('No new participants ready for check-in.');
      return;
    }

    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.checkInParticipants({
        registrationId: dossier.registration.id,
        allocationId: dossier.activeAllocation?.id,
        checkIns,
      });

      if (res.success) {
        setSuccessMessage(`Checked in ${res.data.length} participants successfully.`);
        await openDossier(dossier.registration.id);
        await fetchOverview();
      } else {
        setErrorMessage(res.message || 'Failed to execute check-in.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error processing check-in.');
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Checkout
  const handleCheckOut = async (stayRecordId: string, name: string) => {
    if (!confirm(`Confirm checkout for ${name}? This will release the bed/mat immediately.`)) return;

    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.checkOutParticipant(stayRecordId, 'Standard reception checkout');
      if (res.success) {
        setSuccessMessage(`${name} checked out successfully. Unit released.`);
        if (dossier) await openDossier(dossier.registration.id);
        await fetchOverview();
      } else {
        setErrorMessage(res.message || 'Failed to check out participant.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error during checkout.');
    } finally {
      setActionLoading(false);
    }
  };

  // 5b. Group Check-out Handler (Multiple participants checked out at once)
  const handleExecuteGroupCheckOut = async (stayIds?: string[], label?: string) => {
    const targets = stayIds || selectedStayingStayIds;
    if (targets.length === 0) {
      setErrorMessage('Please select at least one staying guest to check out.');
      return;
    }

    const desc = label || `${targets.length} selected guest(s)`;
    if (!confirm(`Confirm Group Check-Out for ${desc}? This will release ${targets.length} bed/mat unit(s) back into active inventory immediately.`)) {
      return;
    }

    setGroupCheckOutLoading(true);
    setActionLoading(true);
    setErrorMessage(null);
    let successCount = 0;
    let failedCount = 0;

    try {
      for (const stayId of targets) {
        try {
          const res = await api.checkOutParticipant(stayId, 'Group reception checkout');
          if (res.success) {
            successCount++;
          } else {
            failedCount++;
          }
        } catch {
          failedCount++;
        }
      }

      if (successCount > 0) {
        setSuccessMessage(`Group Check-Out complete: ${successCount} guest(s) checked out and units released.`);
        setSelectedStayingStayIds([]);
        if (dossier?.registration?.id) {
          await openDossier(dossier.registration.id);
        }
        await fetchOverview();
      } else {
        setErrorMessage('Failed to check out selected guests.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error executing group checkout.');
    } finally {
      setGroupCheckOutLoading(false);
      setActionLoading(false);
    }
  };

  // 6. Change Room / Bed / Mat Modal & Action (Pre & Post Check-In)
  // Supports Single or Multiple Persons transfer, Hotel filter, Room Search
  const fetchChangeAvailabilityRooms = async (
    entryDateStr?: string,
    exitDateStr?: string,
    hotelId?: string,
    category?: GenderPreference,
    unitType?: 'ALL' | 'BED' | 'MAT'
  ) => {
    setChangeAvailabilityLoading(true);
    try {
      const entryDate = entryDateStr || (changeGroupInfo?.entryDate ? new Date(changeGroupInfo.entryDate).toISOString() : new Date().toISOString());
      const exitDate = exitDateStr || (changeGroupInfo?.exitDate ? new Date(changeGroupInfo.exitDate).toISOString() : new Date(Date.now() + 86400000).toISOString());

      const res = await api.checkAvailability({
        entryDate,
        exitDate,
        hotelId: hotelId && hotelId !== 'ALL' ? hotelId : undefined,
        roomCategory: category && category !== 'ANY' ? category : undefined,
        unitType: unitType && unitType !== 'ALL' ? (unitType as UnitType) : undefined,
      });

      if (res.success && res.data) {
        const rooms = res.data.rooms || [];
        // Natural numeric sorting for destination rooms
        rooms.sort((a: any, b: any) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true, sensitivity: 'base' }));
        setChangeAvailableRooms(rooms);
      }
    } catch (e) {
      console.error('Error checking availability for change unit:', e);
    } finally {
      setChangeAvailabilityLoading(false);
    }
  };

  const openChangeUnitModal = async (participantOrItem: any) => {
    return handleLaunchChangeUnit(participantOrItem);
  };

  const handleSelectUnitForMember = (memberKey: string, unit: any, room: any) => {
    setMemberTargetMap((prev) => {
      const next = { ...prev };
      // If this unit was assigned to another member in the group, clear it first
      Object.keys(next).forEach((k) => {
        if (next[k]?.unitId === unit.id) {
          delete next[k];
        }
      });
      next[memberKey] = {
        unitId: unit.id,
        unitNumber: unit.unitNumber,
        unitType: unit.type,
        roomId: room.id,
        roomNumber: room.roomNumber,
        hotelName: room.hotel?.name || room.hotelName || 'Main Property',
      };
      return next;
    });

    // Ensure member is in selectedMemberKeys
    setSelectedMemberKeys((prev) => (prev.includes(memberKey) ? prev : [...prev, memberKey]));

    // If multiple members are selected, automatically advance active assigning key to next unassigned member
    const unassigned = selectedMemberKeys.filter((k) => k !== memberKey && !memberTargetMap[k]);
    if (unassigned.length > 0) {
      setActiveAssigningKey(unassigned[0]);
    }
  };

  const handleAutoAssignRoomToSelected = (room: any) => {
    // Collect all unassigned selected members
    const unassignedKeys = selectedMemberKeys.filter((k) => !memberTargetMap[k]);
    const targetKeys = unassignedKeys.length > 0 ? unassignedKeys : selectedMemberKeys;

    // Get available units in this room that aren't already mapped
    const currentlyMappedUnitIds = new Set(Object.values(memberTargetMap).map((m) => m.unitId));
    const freeUnits = room.units.filter((u: any) => u.isAvailable && !currentlyMappedUnitIds.has(u.id));

    if (freeUnits.length === 0) {
      setErrorMessage(`No available units in Room ${room.roomNumber}.`);
      return;
    }

    const newMap = { ...memberTargetMap };
    let assignedCount = 0;

    targetKeys.forEach((key, idx) => {
      if (idx < freeUnits.length) {
        const unit = freeUnits[idx];
        newMap[key] = {
          unitId: unit.id,
          unitNumber: unit.unitNumber,
          unitType: unit.type,
          roomId: room.id,
          roomNumber: room.roomNumber,
          hotelName: room.hotel?.name || room.hotelName || 'Main Property',
        };
        assignedCount++;
      }
    });

    setMemberTargetMap(newMap);
    setSuccessMessage(`Mapped ${assignedCount} selected member(s) to Room ${room.roomNumber}.`);
  };

  const handleExecuteBatchChangeUnits = async () => {
    // Only transfer members who actually have a destination unit chosen
    const mappedKeys = Object.keys(memberTargetMap).filter((k) => Boolean(memberTargetMap[k]?.unitId));
    if (mappedKeys.length === 0) {
      setErrorMessage('Please select a destination bed/mat for at least one guest.');
      return;
    }

    if (!changeReason.trim()) {
      setErrorMessage('Please provide a reason for the transfer.');
      return;
    }

    setActionLoading(true);
    setErrorMessage(null);
    try {
      const assignments = mappedKeys.map((key) => {
        const m = changeMembers.find((mem) => mem.key === key);
        const target = memberTargetMap[key];
        return {
          participantId: m?.participantId || null,
          allocationItemId: m?.allocationItemId || null,
          stayRecordId: m?.stayRecordId || null,
          newUnitId: target.unitId,
        };
      });

      let res = await api.batchChangeAssignment({
        assignments,
        reason: changeReason.trim(),
      });

      // Resilient Fallback: If backend deployment is in progress or returned 404 for batch route, fallback to classic /change-assignment
      if (!res.success && res.message && (res.message.includes('Cannot POST') || res.message.includes('404'))) {
        let allSuccess = true;
        let lastError = '';
        for (const item of assignments) {
          const singleRes = await api.changeAssignment({
            participantId: item.participantId || undefined,
            allocationItemId: item.allocationItemId || undefined,
            stayRecordId: item.stayRecordId || undefined,
            newUnitId: item.newUnitId,
            reason: changeReason.trim(),
          });
          if (!singleRes.success) {
            allSuccess = false;
            lastError = singleRes.message || 'Failed to update assignment';
          }
        }
        res = {
          success: allSuccess,
          message: allSuccess ? `Successfully transferred ${assignments.length} guest assignment(s).` : lastError,
        };
      }

      if (res.success) {
        setSuccessMessage(res.message || `Successfully transferred ${assignments.length} guest assignment(s).`);
        setChangeModalOpen(false);
        setMemberTargetMap({});
        setSelectedMemberKeys([]);
        if (changeGroupInfo?.registrationId) {
          await openDossier(changeGroupInfo.registrationId);
        }
        await fetchOverview();
      } else {
        setErrorMessage(res.message || 'Failed to update assignments.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error updating unit assignments.');
    } finally {
      setActionLoading(false);
    }
  };

  // Legacy single unit change handler (for backward compatibility)
  const handleExecuteChangeUnit = handleExecuteBatchChangeUnits;

  // 7. Update Participant Phone
  const openPhoneEditModal = (p: any) => {
    setPhoneParticipant({
      id: p.id,
      fullName: p.fullName,
      phone: p.phone,
    });
    setPhoneInputVal(p.phone || '');
    setPhoneModalOpen(true);
  };

  const handleSavePhone = async () => {
    if (!phoneParticipant || !phoneInputVal.trim()) {
      setErrorMessage('Please enter a valid phone number.');
      return;
    }

    if (phoneInputVal.replace(/\D/g, '').length < 10) {
      setErrorMessage('Phone number must contain at least 10 digits.');
      return;
    }

    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.updateParticipantPhone(phoneParticipant.id, phoneInputVal.trim());
      if (res.success) {
        setSuccessMessage(`Phone number updated for ${phoneParticipant.fullName}.`);
        setPhoneModalOpen(false);
        if (dossier) await openDossier(dossier.registration.id);
        await fetchOverview();
      } else {
        setErrorMessage(res.message || 'Failed to update phone number.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error updating phone number.');
    } finally {
      setActionLoading(false);
    }
  };

  // 8. Extend Stay Duration for Checked-in Guest
  const openExtendStayModal = (item: any) => {
    const stayId = item.id || item.stayRecordId || item.stayId;
    const pName = item.participant?.fullName || item.participantName || item.fullName || 'Guest';
    const roomNum = item.unit?.room?.roomNumber || item.roomNumber || '—';
    const unitNum = item.unit?.unitNumber || item.unitNumber || '—';
    const uType = item.unit?.type || item.unitType || 'BED';
    const hName = item.unit?.room?.hotel?.name || item.hotelName || item.unit?.room?.hotelName || 'Main Property';
    const currentExit = item.exitDate || item.scheduledExit || item.actualCheckIn || new Date().toISOString();

    const currExitDateObj = new Date(currentExit);
    const nextDate = new Date(currExitDateObj.getTime() + 24 * 60 * 60 * 1000);
    const defaultDateStr = nextDate.toISOString().slice(0, 10);

    setExtendStayTarget({
      stayRecordId: stayId,
      participantName: pName,
      roomNumber: roomNum,
      unitNumber: unitNum,
      unitType: uType,
      hotelName: hName,
      currentExitDate: currentExit,
    });
    setExtendStayNewDate(defaultDateStr);
    setExtendStayNotes('Stay extended per guest request');
    setExtendStayModalOpen(true);
  };

  const handleExecuteExtendStay = async () => {
    if (!extendStayTarget || !extendStayNewDate) {
      setErrorMessage('Please choose a valid new checkout date.');
      return;
    }
    setExtendStayLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.extendStay({
        stayRecordId: extendStayTarget.stayRecordId,
        newExitDate: `${extendStayNewDate}T12:00:00.000Z`,
        notes: extendStayNotes.trim() || undefined,
      });

      if (res.success) {
        setSuccessMessage(`Stay extended for ${extendStayTarget.participantName} until ${new Date(extendStayNewDate).toLocaleDateString()}.`);
        setExtendStayModalOpen(false);
        setExtendStayTarget(null);
        await fetchOverview();
        if (dossier?.registration?.id) {
          await openDossier(dossier.registration.id);
        }
      } else {
        setErrorMessage(res.message || 'Failed to extend stay.');
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'Error processing stay extension.');
    } finally {
      setExtendStayLoading(false);
    }
  };

  // Quick Check-In direct handler
  const handleExecuteQuickCheckIn = async (item: any) => {
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const regId = item.registration?.id || item.id;
      const dossierRes = await api.getReceptionDossier(regId);
      if (!dossierRes.success || !dossierRes.data) {
        throw new Error(dossierRes.message || 'Failed to retrieve guest details.');
      }

      const d = dossierRes.data;
      const pAssignments: any[] = [];

      d.registration.participants.forEach((p) => {
        if (!p.activeStay) {
          const allocItem = d.activeAllocation?.items?.find(
            (it: any) => it.participantId === p.id || !pAssignments.some((pa) => pa.unitId === it.unitId)
          );
          if (allocItem) {
            pAssignments.push({
              participantId: p.id,
              unitId: allocItem.unitId,
              allocationItemId: allocItem.id,
            });
          }
        }
      });

      if (pAssignments.length === 0 && d.activeAllocation?.items?.[0]) {
        const primary = d.registration.participants.find((p) => p.isPrimary) || d.registration.participants[0];
        if (primary) {
          pAssignments.push({
            participantId: primary.id,
            unitId: d.activeAllocation.items[0].unitId,
            allocationItemId: d.activeAllocation.items[0].id,
          });
        }
      }

      if (pAssignments.length > 0) {
        const checkRes = await api.checkInParticipants({
          registrationId: d.registration.id,
          allocationId: d.activeAllocation?.id,
          checkIns: pAssignments,
        });

        if (checkRes.success) {
          setSuccessMessage(`Check-In successful! ${d.registration.primaryName} is now checked into Room ${d.activeAllocation?.items?.[0]?.unit?.room?.roomNumber || 'assigned room'}.`);
          setQuickCheckInOpen(false);
          setQuickCheckInTarget(null);
          await fetchOverview();
        } else {
          setErrorMessage(checkRes.message || 'Failed to execute check-in.');
        }
      } else {
        setQuickCheckInOpen(false);
        openDossier(regId);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error executing check-in.');
    } finally {
      setActionLoading(false);
    }
  };

  // Launch Change Room / Bed / Mat for an item (Group or Individual)
  const handleLaunchChangeUnit = async (item: any) => {
    setActionLoading(true);
    try {
      const isStay = activeTab === 'CHECKED_IN' || activeTab === 'CHECKED_OUT' || Boolean(item.participant && item.unit);
      const regId = isStay ? (item.registrationId || item.registration?.id) : (item.registration?.id || item.id);

      let dossierData: any = null;
      if (regId) {
        try {
          const res = await api.getReceptionDossier(regId);
          if (res.success && res.data) {
            dossierData = res.data;
            setDossier(res.data);
          }
        } catch (e) {
          console.error('Error fetching dossier for change unit:', e);
        }
      }

      const members: any[] = [];
      let defaultHotelId = 'ALL';

      // 1. If Checked-in Stays exist
      if (isStay || (dossierData?.registration?.participants && dossierData.registration.participants.some((p: any) => p.stayRecords?.length > 0))) {
        const participants = dossierData?.registration?.participants || [];
        participants.forEach((p: any, idx: number) => {
          const activeStay = p.stayRecords?.find((s: any) => s.status === 'CHECKED_IN' || s.status === 'EXTENDED');
          if (activeStay?.unit) {
            if (activeStay.unit.room?.hotelId && defaultHotelId === 'ALL') {
              defaultHotelId = activeStay.unit.room.hotelId;
            }
            members.push({
              key: `stay-${activeStay.id}`,
              participantId: p.id,
              stayRecordId: activeStay.id,
              allocationItemId: activeStay.allocationItemId || null,
              fullName: p.fullName || `Guest ${idx + 1}`,
              gender: p.gender,
              phone: p.phone,
              isPrimary: p.isPrimary,
              currentRoomNumber: activeStay.unit.room?.roomNumber || 'Unknown',
              currentUnitNumber: activeStay.unit.unitNumber,
              currentUnitType: activeStay.unit.type,
              currentHotelName: activeStay.unit.room?.hotel?.name || 'Main Property',
              currentUnitId: activeStay.unit.id,
              stage: 'CHECKED_IN',
            });
          }
        });

        // Fallback for single stay row if dossier didn't include other participants
        if (members.length === 0 && item.unit) {
          members.push({
            key: `stay-${item.id}`,
            participantId: item.participant?.id || item.participantId,
            stayRecordId: item.id,
            allocationItemId: item.allocationItemId || null,
            fullName: item.participant?.fullName || 'Guest',
            gender: item.participant?.gender,
            phone: item.participant?.phone,
            isPrimary: item.participant?.isPrimary ?? true,
            currentRoomNumber: item.unit.room?.roomNumber || 'Unknown',
            currentUnitNumber: item.unit.unitNumber,
            currentUnitType: item.unit.type,
            currentHotelName: item.unit.room?.hotel?.name || 'Main Property',
            currentUnitId: item.unit.id,
            stage: 'CHECKED_IN',
          });
        }
      }

      // 2. Pre-arrival allocations (Allocated, Tentative, Confirmed)
      if (members.length === 0) {
        const allocItems = dossierData?.activeAllocation?.items || item.items || [];
        const participants = dossierData?.registration?.participants || item.registration?.participants || [];

        allocItems.forEach((it: any, idx: number) => {
          const matchedP = participants.find((p: any) => p.id === it.participantId) || participants[idx];
          if (it.unit?.room?.hotelId && defaultHotelId === 'ALL') {
            defaultHotelId = it.unit.room.hotelId;
          }
          members.push({
            key: `alloc-${it.id || idx}`,
            participantId: matchedP?.id || it.participantId || null,
            allocationItemId: it.id,
            stayRecordId: null,
            fullName: matchedP ? matchedP.fullName : `${item.primaryName || item.registration?.primaryName || 'Guest'} (Person ${idx + 1})`,
            gender: matchedP?.gender || item.genderPreference || 'MALE',
            phone: matchedP?.phone || item.mobile || item.registration?.mobile,
            isPrimary: matchedP?.isPrimary ?? (idx === 0),
            currentRoomNumber: it.unit?.room?.roomNumber || 'Unknown',
            currentUnitNumber: it.unit?.unitNumber || `U${idx + 1}`,
            currentUnitType: it.unit?.type || 'BED',
            currentHotelName: it.unit?.room?.hotel?.name || 'Main Property',
            currentUnitId: it.unit?.id,
            stage: 'PRE_CHECK_IN',
          });
        });
      }

      // Group header info
      const reg = dossierData?.registration || item.registration || item;
      const groupInfo = {
        registrationId: reg.id || regId || '—',
        displayRegId: reg.registrationId || item.registrationId || '—',
        primaryName: reg.primaryName || item.primaryName || item.participant?.fullName || 'Guest',
        mobile: reg.mobile || item.mobile || item.phone,
        totalMembers: reg.totalMembers || members.length || 1,
        entryDate: item.entryDate || dossierData?.activeAllocation?.entryDate || new Date().toISOString(),
        exitDate: item.exitDate || dossierData?.activeAllocation?.exitDate || new Date(Date.now() + 86400000).toISOString(),
      };

      setChangeGroupInfo(groupInfo);
      setChangeMembers(members);
      setMemberTargetMap({});
      setChangeReason('Room / Bed Reassignment');
      setChangeRoomSearchQuery('');

      // Default selection: select the first member
      if (members.length > 0) {
        setSelectedMemberKeys([members[0].key]);
        setActiveAssigningKey(members[0].key);
      } else {
        setSelectedMemberKeys([]);
        setActiveAssigningKey(null);
      }

      const defaultCat: GenderPreference = members[0]?.gender === 'FEMALE' ? 'FEMALE' : members[0]?.gender === 'MALE' ? 'MALE' : 'ANY';
      setChangeCategoryFilter(defaultCat);
      setChangeTypeFilter('ALL');
      setChangeHotelFilter('ALL');
      setChangeModalOpen(true);

      // Fetch available destination rooms
      await fetchChangeAvailabilityRooms(groupInfo.entryDate, groupInfo.exitDate, 'ALL', defaultCat, 'ALL');
    } catch (e: any) {
      console.error('Failed to launch change unit modal:', e);
      setErrorMessage(e.message || 'Failed to open change room modal.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* ------------------------------------------------------------------ */}
      {/* HEADER                                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
              <CheckSquare className="w-7 h-7 text-blue-600" />
              <span>Reception Desk</span>
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-bold bg-blue-100 text-blue-800 rounded-full border border-blue-200">
              Reception Services
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Simple, touch-friendly guest arrivals, room assignments, unit changes, and check-outs.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={fetchOverview}
            className="px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs flex items-center gap-1.5 transition active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh Live Data</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* QUICK ACTIONS BAR (Requirement 3)                                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5">
        <button
          type="button"
          onClick={() => setIsWalkInOpen(true)}
          className="p-3 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl shadow-xs transition flex flex-col items-center justify-center gap-1.5 min-h-[56px] text-center"
        >
          <UserPlus className="w-5 h-5 text-blue-100" />
          <span className="text-xs font-bold leading-tight">New Walk-In</span>
          <span className="text-[10px] text-blue-200">Register &amp; Assign</span>
        </button>

        <button
          type="button"
          onClick={() => {
            const el = document.getElementById('unified-reception-search');
            el?.focus();
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="p-3 bg-purple-600 hover:bg-purple-700 active:scale-98 text-white rounded-xl shadow-xs transition flex flex-col items-center justify-center gap-1.5 min-h-[56px] text-center"
        >
          <Search className="w-5 h-5 text-purple-100" />
          <span className="text-xs font-bold leading-tight">Find Guest</span>
          <span className="text-[10px] text-purple-200">Unified Profile</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabSwitch('TODAY_ARRIVALS')}
          className="p-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl shadow-xs transition flex flex-col items-center justify-center gap-1.5 min-h-[56px] text-center"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-100" />
          <span className="text-xs font-bold leading-tight">Check In</span>
          <span className="text-[10px] text-emerald-200">Arriving Guests</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabSwitch('CHECKED_IN')}
          className="p-3 bg-amber-600 hover:bg-amber-700 active:scale-98 text-white rounded-xl shadow-xs transition flex flex-col items-center justify-center gap-1.5 min-h-[56px] text-center"
        >
          <ArrowRightLeft className="w-5 h-5 text-amber-100" />
          <span className="text-xs font-bold leading-tight">Change Room</span>
          <span className="text-[10px] text-amber-200">Bed / Mat Reassign</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabSwitch('CHECKED_IN')}
          className="p-3 bg-rose-600 hover:bg-rose-700 active:scale-98 text-white rounded-xl shadow-xs transition flex flex-col items-center justify-center gap-1.5 min-h-[56px] text-center"
        >
          <LogOut className="w-5 h-5 text-rose-100" />
          <span className="text-xs font-bold leading-tight">Check Out</span>
          <span className="text-[10px] text-rose-200">Departing Guests</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabSwitch('CHECKED_OUT')}
          className="p-3 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-xl shadow-xs transition flex flex-col items-center justify-center gap-1.5 min-h-[56px] text-center"
        >
          <RotateCcw className="w-5 h-5 text-indigo-100" />
          <span className="text-xs font-bold leading-tight">Check In Again</span>
          <span className="text-[10px] text-indigo-200">Accidental Recovery</span>
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* PROMINENT PARTICIPANT SEARCH FIELD (Name, REG ID, Mobile)          */}
      {/* ------------------------------------------------------------------ */}
      <div className="relative">
        <div className="relative shadow-xs rounded-2xl">
          <Search className="w-6 h-6 absolute left-4 top-3.5 text-slate-400" />
          <input
            id="unified-reception-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 Search participant by Name, Registration ID (e.g. REG-0001), or 10-digit Mobile Number..."
            className="w-full pl-13 pr-10 py-3.5 bg-white border-2 border-slate-300 hover:border-blue-400 focus:border-blue-600 rounded-2xl text-sm font-semibold text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none transition"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSearchResults([]);
                setSearchParticipantResults([]);
                setSearchDropdownOpen(false);
              }}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Rapid Search Results Dropdown with Instant Action Buttons */}
        {searchDropdownOpen && (searchResults.length > 0 || searchParticipantResults.length > 0) && (
          <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-40 max-h-96 overflow-y-auto animate-in fade-in">
            {/* Direct Participant Matches (Requirement 1) */}
            {searchParticipantResults.length > 0 && (
              <div>
                <div className="p-3 bg-purple-50 border-b border-purple-100 text-xs font-bold text-purple-900 uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-purple-700" />
                    <span>Matched Guests &amp; Participants ({searchParticipantResults.length})</span>
                  </span>
                  <span className="text-[11px] font-normal text-purple-700">Click to open Unified Profile</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {searchParticipantResults.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => openParticipantProfile(p.id)}
                      className="p-3.5 hover:bg-purple-50/60 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                    >
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm">{p.fullName}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            p.checkInStatus === 'CHECKED_IN'
                              ? 'bg-purple-100 text-purple-800'
                              : p.checkInStatus === 'CHECKED_OUT'
                              ? 'bg-slate-100 text-slate-700'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {p.checkInStatus === 'CHECKED_IN' ? 'Staying Now' : p.checkInStatus === 'CHECKED_OUT' ? 'Checked Out' : 'Expected'}
                          </span>
                          {p.currentRoomNumber && (
                            <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                              Room {p.currentRoomNumber} &bull; Unit {p.currentUnitNumber} ({p.hotelName})
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                          <span>📱 {p.phone || 'No individual phone'}</span>
                          <span>&bull;</span>
                          <span>Reg: <strong className="font-mono text-slate-700">{p.registrationId}</strong></span>
                          <span>&bull;</span>
                          <span>Group: {p.primaryName}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openParticipantProfile(p.id);
                          }}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1 transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Profile</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Registration Matches */}
            {searchResults.length > 0 && (
              <div>
                <div className="p-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                  <span>Registration Groups ({searchResults.length})</span>
                  <span className="text-[11px] font-normal text-slate-500">Group actions</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {searchResults.map((reg) => {
                    const latestAlloc = reg.allocations?.[0];
                    return (
                      <div
                        key={reg.id}
                        className="p-3.5 hover:bg-blue-50/70 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-sm">{reg.primaryName}</span>
                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                              {reg.registrationId}
                            </span>
                            {latestAlloc && (
                              <span className={`font-mono text-xs font-semibold px-2 py-0.5 rounded ${
                                latestAlloc.status === 'CONFIRMED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}>
                                {latestAlloc.allocationNumber} ({latestAlloc.status})
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 mt-1 flex items-center gap-2">
                            <span>📱 <strong>{reg.mobile}</strong></span>
                            <span>&bull;</span>
                            <span>👥 {reg.totalMembers} Member(s)</span>
                            {reg.city && (
                              <>
                                <span>&bull;</span>
                                <span>📍 {reg.city}</span>
                              </>
                            )}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setSearchDropdownOpen(false);
                              handleExecuteQuickCheckIn(reg);
                            }}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1 transition"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Check In</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSearchDropdownOpen(false);
                              handleLaunchChangeUnit(reg);
                            }}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1 transition"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                            <span>Change Room</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSearchDropdownOpen(false);
                              const p = reg.participants?.[0];
                              if (p) {
                                openParticipantProfile(p.id);
                              } else {
                                openDossier(reg.id);
                              }
                            }}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold border border-slate-300 transition"
                          >
                            <span>Profile</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* SYSTEM ALERTS                                                      */}
      {/* ------------------------------------------------------------------ */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start justify-between shadow-xs animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-rose-900">Reception Notice</p>
              <p className="mt-0.5">{errorMessage}</p>
            </div>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-rose-700 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start justify-between shadow-xs animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="font-bold text-emerald-900">{successMessage}</p>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-700 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* ROOM AVAILABILITY DASHBOARD (SIX SUMMARY CARDS FROM SKETCH)         */}
      {/* ------------------------------------------------------------------ */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Building className="w-4 h-4 text-blue-600" />
            <span>Room Availability Dashboard</span>
          </h2>
          <span className="text-xs text-slate-500 font-medium">Live Inventory &amp; Occupancy</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          {/* Card 1: Total Booked Units */}
          <div className="p-2.5 sm:p-4 rounded-xl border-2 border-slate-200 bg-white text-slate-800 shadow-xs hover:border-slate-300 transition">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase text-slate-500 leading-tight">Total Booked</span>
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            </div>
            <p className="text-xl sm:text-2xl font-black text-rose-700 mt-1">
              {metrics.totalBookedUnits ?? metrics.checkedInCount}
            </p>
            <p className="text-[9px] sm:text-[10px] text-slate-500 font-medium mt-0.5 truncate">Units Booked / Stays</p>
          </div>

          {/* Card 2: Total Rooms */}
          <div className="p-2.5 sm:p-4 rounded-xl border-2 border-slate-200 bg-white text-slate-800 shadow-xs hover:border-slate-300 transition">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase text-slate-500 leading-tight">Total Rooms</span>
              <Building className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
              {metrics.totalRooms ?? 0}
            </p>
            <p className="text-[9px] sm:text-[10px] text-slate-500 font-medium mt-0.5 truncate">Active Rooms in System</p>
          </div>

          {/* Card 3: Ladies Room Availability (Female Rooms Availability) */}
          <div className="p-2.5 sm:p-4 rounded-xl border-2 border-pink-200 bg-pink-50/50 text-slate-800 shadow-xs hover:border-pink-300 transition">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase text-pink-800 leading-tight">👩 Ladies Rooms</span>
              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-pink-100 text-pink-900 rounded">Female</span>
            </div>
            <p className="text-xl sm:text-2xl font-black text-pink-700 mt-1">
              {metrics.femaleRoomAvailability?.availableRooms ?? 0} <span className="text-xs font-semibold text-pink-600">Free</span>
            </p>
            <p className="text-[9px] sm:text-[10px] text-pink-950 font-semibold mt-0.5 leading-tight">
              {metrics.femaleRoomAvailability?.availableBeds ?? 0} Beds &bull; {metrics.femaleRoomAvailability?.availableMats ?? 0} Mats
            </p>
          </div>

          {/* Card 4: Gents Room Availability (Male Rooms Availability) */}
          <div className="p-2.5 sm:p-4 rounded-xl border-2 border-blue-200 bg-blue-50/50 text-slate-800 shadow-xs hover:border-blue-300 transition">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase text-blue-800 leading-tight">👦 Gents Rooms</span>
              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-blue-100 text-blue-900 rounded">Male</span>
            </div>
            <p className="text-xl sm:text-2xl font-black text-blue-700 mt-1">
              {metrics.maleRoomAvailability?.availableRooms ?? 0} <span className="text-xs font-semibold text-blue-600">Free</span>
            </p>
            <p className="text-[9px] sm:text-[10px] text-blue-950 font-semibold mt-0.5 leading-tight">
              {metrics.maleRoomAvailability?.availableBeds ?? 0} Beds &bull; {metrics.maleRoomAvailability?.availableMats ?? 0} Mats
            </p>
          </div>

          {/* Card 5: Family Room Availability */}
          <div className="p-2.5 sm:p-4 rounded-xl border-2 border-purple-200 bg-purple-50/50 text-slate-800 shadow-xs hover:border-purple-300 transition">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase text-purple-800 leading-tight">👨‍👩‍👧 Family Rooms</span>
              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-purple-100 text-purple-900 rounded">Family</span>
            </div>
            <p className="text-xl sm:text-2xl font-black text-purple-700 mt-1">
              {metrics.familyRoomAvailability?.availableRooms ?? 0} <span className="text-xs font-semibold text-purple-600">Free</span>
            </p>
            <p className="text-[9px] sm:text-[10px] text-purple-950 font-semibold mt-0.5 leading-tight">
              {metrics.familyRoomAvailability?.availableBeds ?? 0} Beds &bull; {metrics.familyRoomAvailability?.availableMats ?? 0} Mats
            </p>
          </div>

          {/* Card 6: Guest Room Availability */}
          <div className="p-2.5 sm:p-4 rounded-xl border-2 border-amber-200 bg-amber-50/50 text-slate-800 shadow-xs hover:border-amber-300 transition">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase text-amber-800 leading-tight">🌟 Guest Rooms</span>
              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-900 rounded">Guest</span>
            </div>
            <p className="text-xl sm:text-2xl font-black text-amber-700 mt-1">
              {metrics.guestRoomAvailability?.availableRooms ?? 0} <span className="text-xs font-semibold text-amber-600">Free</span>
            </p>
            <p className="text-[9px] sm:text-[10px] text-amber-950 font-semibold mt-0.5 leading-tight">
              {metrics.guestRoomAvailability?.availableBeds ?? 0} Beds &bull; {metrics.guestRoomAvailability?.availableMats ?? 0} Mats
            </p>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* DAILY OPERATIONS & RECENT ACTIVITY (Requirements 6 & 7)             */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Today's Tasks (2 Columns on large screens) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border-2 border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Today&apos;s Operations &amp; Tasks</h3>
                <p className="text-[11px] text-slate-500">Live reception priorities for {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</p>
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
              Live Tasks
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* Task 1: Expected Arrivals */}
            <div
              onClick={() => handleTabSwitch('TODAY_ARRIVALS')}
              className="p-3 rounded-xl bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200 cursor-pointer transition active:scale-95 text-center flex flex-col justify-between"
            >
              <div className="text-[10px] font-bold text-blue-800 uppercase flex items-center justify-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Arrivals Today</span>
              </div>
              <p className="text-2xl font-black text-blue-900 my-1">
                {metrics.dailyTasks?.expectedArrivals ?? metrics.expectedArrivalsCount}
              </p>
              <span className="text-[10px] text-blue-700 font-semibold underline">View Queue</span>
            </div>

            {/* Task 2: Expected Departures */}
            <div
              onClick={() => {
                setFilterCheckOutDate(new Date().toISOString().slice(0, 10));
                handleTabSwitch('CHECKED_IN');
              }}
              className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 cursor-pointer transition active:scale-95 text-center flex flex-col justify-between"
            >
              <div className="text-[10px] font-bold text-slate-700 uppercase flex items-center justify-center gap-1">
                <LogOut className="w-3.5 h-3.5 text-slate-600" />
                <span>Departures Today</span>
              </div>
              <p className="text-2xl font-black text-slate-900 my-1">
                {metrics.dailyTasks?.expectedDepartures ?? metrics.expectedDeparturesCount}
              </p>
              <span className="text-[10px] text-slate-600 font-semibold underline">View Staying</span>
            </div>

            {/* Task 3: Not Yet Arrived */}
            <div
              onClick={() => {
                setFilterArrivalStatus('PENDING');
                handleTabSwitch('TODAY_ARRIVALS');
              }}
              className="p-3 rounded-xl bg-amber-50/70 hover:bg-amber-100/70 border border-amber-200 cursor-pointer transition active:scale-95 text-center flex flex-col justify-between"
            >
              <div className="text-[10px] font-bold text-amber-800 uppercase flex items-center justify-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Awaiting Arrival</span>
              </div>
              <p className="text-2xl font-black text-amber-900 my-1">
                {metrics.dailyTasks?.notYetArrived ?? 0}
              </p>
              <span className="text-[10px] text-amber-700 font-semibold underline">Pending Check-in</span>
            </div>

            {/* Task 4: Overdue Checkouts */}
            <div
              onClick={() => {
                if ((metrics.dailyTasks?.overdueCheckouts ?? 0) > 0) {
                  setIsOverdueModalOpen(true);
                } else {
                  handleTabSwitch('CHECKED_IN');
                }
              }}
              className={`p-3 rounded-xl border cursor-pointer transition active:scale-95 text-center flex flex-col justify-between ${
                (metrics.dailyTasks?.overdueCheckouts ?? 0) > 0
                  ? 'bg-rose-50 border-rose-300 hover:bg-rose-100 ring-2 ring-rose-400/50'
                  : 'bg-emerald-50/60 border-emerald-200 hover:bg-emerald-100/60'
              }`}
            >
              <div className="text-[10px] font-bold uppercase flex items-center justify-center gap-1">
                <AlertTriangle className={`w-3.5 h-3.5 ${(metrics.dailyTasks?.overdueCheckouts ?? 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`} />
                <span className={(metrics.dailyTasks?.overdueCheckouts ?? 0) > 0 ? 'text-rose-800' : 'text-emerald-800'}>
                  Overdue Checkouts
                </span>
              </div>
              <p className={`text-2xl font-black my-1 ${(metrics.dailyTasks?.overdueCheckouts ?? 0) > 0 ? 'text-rose-900 animate-pulse' : 'text-emerald-900'}`}>
                {metrics.dailyTasks?.overdueCheckouts ?? 0}
              </p>
              <span className={`text-[10px] font-semibold underline ${(metrics.dailyTasks?.overdueCheckouts ?? 0) > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                {(metrics.dailyTasks?.overdueCheckouts ?? 0) > 0 ? 'Review & Follow Up' : 'All on Schedule'}
              </span>
            </div>
          </div>

          {(metrics.dailyTasks?.overdueCheckouts ?? 0) > 0 && (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between text-xs text-amber-900">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>{metrics.dailyTasks?.overdueCheckouts} guest(s)</strong> have passed their planned checkout date but are still physically checked in.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsOverdueModalOpen(true)}
                className="px-2.5 py-1 text-[11px] font-bold bg-amber-700 hover:bg-amber-800 text-white rounded-lg transition"
              >
                View Overdue List
              </button>
            </div>
          )}
        </div>

        {/* Recent Activity Log (Requirement 7) */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 sm:p-5 shadow-xs space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">Recent Activity</h3>
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase">Last 5 Actions</span>
          </div>

          <div className="space-y-2">
            {metrics.recentActivity && metrics.recentActivity.length > 0 ? (
              metrics.recentActivity.slice(0, 5).map((act) => {
                const actionBadgeClass = act.action === 'CHECK_IN'
                  ? 'bg-emerald-100 text-emerald-800'
                  : act.action === 'CHECK_OUT'
                  ? 'bg-rose-100 text-rose-800'
                  : act.action === 'TRANSFER'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-blue-100 text-blue-800';

                const detailsDesc = (act.details as any)?.description || `${act.action} on ${act.entityType}`;

                return (
                  <div key={act.id} className="p-2 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100/70 transition flex items-start justify-between gap-2 text-xs">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${actionBadgeClass}`}>
                          {act.action}
                        </span>
                        <span className="font-semibold text-slate-900 truncate">
                          {act.staffName}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 truncate">{detailsDesc}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                      {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-slate-400 text-center py-6">No recent reception logs yet</p>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* SIMPLE AVAILABILITY SEARCH SECTION (FROM HANDWRITTEN SKETCH)       */}
      {/* ------------------------------------------------------------------ */}
      <div className="p-5 rounded-2xl bg-white border-2 border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Search className="w-4 h-4 text-blue-600" />
              <span>Search Room Availability</span>
            </h3>
            <p className="text-xs text-slate-500">
              Select category, number of persons, accommodation type, and stay dates to query compatible rooms
            </p>
          </div>
        </div>

        {/* The 3 Primary Controls from Handwritten Reference Sketch */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* 1. Category Dropdown: Ladies, Gents, Family, Guest */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Category *
            </label>
            <select
              value={sketchCategory}
              onChange={(e) => setSketchCategory(e.target.value as GenderPreference)}
              className="w-full px-3 py-2.5 text-xs bg-white border-2 border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-blue-600"
            >
              <option value="FEMALE">👩 Ladies (Female)</option>
              <option value="MALE">👦 Gents (Male)</option>
              <option value="FAMILY">👨‍👩‍👧 Family</option>
              <option value="GUEST">🌟 Guest</option>
            </select>
          </div>

          {/* 2. Number of Persons Dropdown: 1 to 10 + Custom */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              No. of Persons *
            </label>
            <select
              value={sketchPersons}
              onChange={(e) => setSketchPersons(e.target.value)}
              className="w-full px-3 py-2.5 text-xs bg-white border-2 border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-blue-600"
            >
              <option value="1">1 Person</option>
              <option value="2">2 Persons</option>
              <option value="3">3 Persons</option>
              <option value="4">4 Persons</option>
              <option value="5">5 Persons</option>
              <option value="6">6 Persons</option>
              <option value="7">7 Persons</option>
              <option value="8">8 Persons</option>
              <option value="9">9 Persons</option>
              <option value="10">10 Persons</option>
              <option value="CUSTOM">Custom (More than 10)</option>
            </select>

            {sketchPersons === 'CUSTOM' && (
              <input
                type="number"
                min={11}
                max={500}
                value={sketchCustomPersons}
                onChange={(e) => setSketchCustomPersons(parseInt(e.target.value, 10) || 11)}
                placeholder="Enter exact count..."
                className="w-full mt-1.5 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-bold"
              />
            )}
          </div>

          {/* 3. Accommodation Type Dropdown: Beds, Mats, Either */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Beds / Mats *
            </label>
            <select
              value={sketchUnitType}
              onChange={(e) => setSketchUnitType(e.target.value as any)}
              className="w-full px-3 py-2.5 text-xs bg-white border-2 border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-blue-600"
            >
              <option value="ALL">Either (Beds or Mats)</option>
              <option value="BED">🛏️ Bed (Beds Only)</option>
              <option value="MAT">🧘 Mat (Mats Only)</option>
            </select>
          </div>

          {/* Check-In Date */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Check-In Date *
            </label>
            <input
              type="date"
              value={sketchEntryDate}
              onChange={(e) => setSketchEntryDate(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border-2 border-slate-300 rounded-xl text-slate-900 font-medium focus:outline-none focus:border-blue-600"
            />
          </div>

          {/* Planned Check-Out Date */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Check-Out Date *
            </label>
            <input
              type="date"
              value={sketchExitDate}
              onChange={(e) => setSketchExitDate(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border-2 border-slate-300 rounded-xl text-slate-900 font-medium focus:outline-none focus:border-blue-600"
            />
          </div>
        </div>

        {/* Prominent Search Availability Button (The Rectangle from Sketch) */}
        <div className="pt-2 flex justify-center">
          <button
            type="button"
            onClick={handleSearchRoomAvailability}
            disabled={sketchSearching}
            className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl text-sm font-black shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 active:scale-98"
          >
            {sketchSearching ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Checking Real-Time Inventory...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Search Availability</span>
              </>
            )}
          </button>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* SEARCH RESULTS: MATCHING AVAILABLE ROOMS & MANUAL UNIT SELECTION   */}
        {/* ------------------------------------------------------------------ */}
        {sketchHasSearched && (
          <div className="pt-4 border-t border-slate-200 space-y-3 animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <span>Matching Rooms for {sketchCategory} ({sketchAvailableRooms.length} Rooms Found)</span>
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Tap individual bed/mat badges to select units across rooms for <strong>{targetRequiredPersons} person(s)</strong>
              </span>
            </div>

            {/* Selection Banner if units are clicked */}
            {sketchSelectedUnits.length > 0 && (
              <div className="p-3.5 bg-blue-50 border-2 border-blue-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-bold text-blue-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    Selected {sketchSelectedUnits.length} of {targetRequiredPersons} Person(s) Required:
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {sketchSelectedUnits.map((u) => (
                      <span
                        key={u.unitId}
                        className="px-2 py-0.5 rounded bg-white border border-blue-300 text-blue-900 font-mono font-bold"
                      >
                        Room {u.roomNumber} &bull; {u.unitType} {u.unitNumber}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSketchSelectedUnits([])}
                    className="px-3 py-1.5 text-slate-600 hover:text-slate-900 font-semibold"
                  >
                    Clear Selection
                  </button>
                  <button
                    type="button"
                    onClick={handleProceedToAllocateFromSearch}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs transition active:scale-95"
                  >
                    Proceed to Allocate Selected Units &rarr;
                  </button>
                </div>
              </div>
            )}

            {/* Rooms Cards List */}
            {sketchAvailableRooms.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-xs">
                No available rooms found for the selected category, dates, or unit type.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {sketchAvailableRooms.map((room) => {
                  const availBeds = room.availableBeds ?? room.units.filter((u) => u.isAvailable && u.type === 'BED').length;
                  const availMats = room.availableMats ?? room.units.filter((u) => u.isAvailable && u.type === 'MAT').length;
                  const totalFree = availBeds + availMats;

                  return (
                    <div
                      key={room.id}
                      className={`p-3.5 rounded-xl border-2 transition ${
                        totalFree > 0 ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-50 border-slate-200 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div>
                          <p className="font-bold font-mono text-sm text-slate-900">
                            Room {room.roomNumber}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {room.building ? `${room.building} &bull; ` : ''}Floor {room.floor ?? '-'}
                          </p>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          room.genderPreference === 'FEMALE'
                            ? 'bg-pink-100 text-pink-800'
                            : room.genderPreference === 'MALE'
                            ? 'bg-blue-100 text-blue-800'
                            : room.genderPreference === 'FAMILY'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-amber-100 text-amber-900'
                        }`}>
                          {room.genderPreference === 'FEMALE' ? 'Ladies' : room.genderPreference === 'MALE' ? 'Gents' : room.genderPreference}
                        </span>
                      </div>

                      {/* Room Available Counts */}
                      <div className="py-2 flex items-center justify-between text-xs font-semibold text-slate-700">
                        <span className="text-blue-700">🛏️ {availBeds} Beds Free</span>
                        <span className="text-emerald-700">🧘 {availMats} Mats Free</span>
                      </div>

                      {/* Clickable Unit Badges for Manual Selection */}
                      <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                        {room.units.map((unit) => {
                          const isSelected = sketchSelectedUnits.some((u) => u.unitId === unit.id);
                          const isAvailable = unit.isAvailable;
                          const isBed = unit.type === 'BED';

                          return (
                            <button
                              key={unit.id}
                              type="button"
                              disabled={!isAvailable}
                              onClick={() => handleToggleSketchUnit(room, unit)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1 ${
                                isSelected
                                  ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-400'
                                  : isAvailable
                                  ? isBed
                                    ? 'bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 cursor-pointer'
                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 cursor-pointer'
                                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-40 line-through'
                              }`}
                            >
                              <span>{isBed ? '🛏️' : '🧘'} {unit.unitNumber}</span>
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* FIVE PROMINENT TOUCH-FRIENDLY ACTION BUTTONS                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Action 1: New Registration & Room Assignment */}
        <button
          type="button"
          onClick={() => setIsWalkInOpen(true)}
          className="p-5 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white shadow-md hover:shadow-xl transition flex flex-col justify-between text-left active:scale-98 group"
        >
          <div className="flex items-center justify-between w-full">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white">
              <UserPlus className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20">
              Action 1
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-base font-black leading-tight text-white group-hover:underline">
              New Registration &amp; Room Assignment
            </h3>
            <p className="text-xs text-blue-100 mt-1 leading-snug">
              Register walk-in guests &amp; manually assign beds/mats across rooms
            </p>
          </div>
        </button>

        {/* Action 2: Check In */}
        <button
          type="button"
          onClick={() => setQuickCheckInOpen(true)}
          className="p-5 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white shadow-md hover:shadow-xl transition flex flex-col justify-between text-left active:scale-98 group"
        >
          <div className="flex items-center justify-between w-full">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20">
              Action 2
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-base font-black leading-tight text-white group-hover:underline">
              Check In Guest
            </h3>
            <p className="text-xs text-emerald-100 mt-1 leading-snug">
              Search participant, verify assigned room &amp; 1-click Check In
            </p>
          </div>
        </button>

        {/* Action 3: Change Room / Bed / Mat */}
        <button
          type="button"
          onClick={() => {
            // Find an active participant or open search
            const firstStay = records.find((r) => r.participant && r.unit);
            if (firstStay) {
              handleLaunchChangeUnit(firstStay);
            } else if (records[0]) {
              handleLaunchChangeUnit(records[0]);
            } else {
              setQuickCheckInOpen(true);
            }
          }}
          className="p-5 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md hover:shadow-xl transition flex flex-col justify-between text-left active:scale-98 group"
        >
          <div className="flex items-center justify-between w-full">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white">
              <ArrowRightLeft className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20">
              Action 3
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-base font-black leading-tight text-white group-hover:underline">
              Change Room / Bed / Mat
            </h3>
            <p className="text-xs text-amber-100 mt-1 leading-snug">
              Switch Mat to Bed, Bed to Mat, or move across rooms safely
            </p>
          </div>
        </button>

        {/* Action 4: Check Out */}
        <button
          type="button"
          onClick={handleOpenQuickCheckOut}
          className="p-5 rounded-2xl bg-gradient-to-br from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 text-white shadow-md hover:shadow-xl transition flex flex-col justify-between text-left active:scale-98 group"
        >
          <div className="flex items-center justify-between w-full">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white">
              <LogOut className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20">
              Action 4
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-base font-black leading-tight text-white group-hover:underline">
              Check Out Guest
            </h3>
            <p className="text-xs text-rose-100 mt-1 leading-snug">
              Search staying guest &amp; release bed/mat back into inventory
            </p>
          </div>
        </button>

        {/* Action 5: Extend Stay */}
        <button
          type="button"
          onClick={() => handleTabSwitch('CHECKED_IN')}
          className="p-5 rounded-2xl bg-gradient-to-br from-cyan-600 to-blue-700 hover:from-cyan-700 hover:to-blue-800 text-white shadow-md hover:shadow-xl transition flex flex-col justify-between text-left active:scale-98 group"
        >
          <div className="flex items-center justify-between w-full">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white">
              <Calendar className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20">
              Action 5
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-base font-black leading-tight text-white group-hover:underline">
              Extend Stay
            </h3>
            <p className="text-xs text-cyan-100 mt-1 leading-snug">
              View currently staying guests &amp; extend checkout dates in 1 click
            </p>
          </div>
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* QUEUE & RECEPTION ACTIVITY FEED (CLEAN, MINIMAL TABLE)             */}
      {/* ------------------------------------------------------------------ */}
      <div id="primary-queue-tabs" className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden scroll-mt-24">
        {/* Simple Tabs Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-slate-200/80 p-1 rounded-xl text-xs font-bold flex-wrap">
            <button
              onClick={() => handleTabSwitch('TODAY_ARRIVALS')}
              className={`px-4 py-2 rounded-lg transition ${
                activeTab === 'TODAY_ARRIVALS' ? 'bg-white text-blue-700 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Today&apos;s Arrivals ({metrics.tabCounts?.todayArrivals ?? metrics.expectedArrivalsCount})
            </button>
            <button
              onClick={() => handleTabSwitch('CHECKED_IN')}
              className={`px-4 py-2 rounded-lg transition ${
                activeTab === 'CHECKED_IN' ? 'bg-white text-emerald-700 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Currently Staying ({metrics.tabCounts?.currentlyStaying ?? metrics.checkedInCount})
            </button>
            <button
              onClick={() => handleTabSwitch('TENTATIVE')}
              className={`px-4 py-2 rounded-lg transition ${
                activeTab === 'TENTATIVE' ? 'bg-white text-amber-700 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tentative Bookings ({metrics.tabCounts?.tentative ?? metrics.tentativeAwaitingCount})
            </button>
            <button
              onClick={() => handleTabSwitch('CHECKED_OUT')}
              className={`px-4 py-2 rounded-lg transition ${
                activeTab === 'CHECKED_OUT' ? 'bg-white text-slate-800 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Checked Out Records ({metrics.tabCounts?.checkedOut ?? metrics.totalCheckedOutCount ?? metrics.checkedOutTodayCount ?? 0})
            </button>
          </div>

          <span className="text-xs text-slate-500 font-semibold">
            {records.length} records in this view
          </span>
        </div>

        {/* Dedicated Tab Search & Purpose-Based Filter Controls */}
        <div className="p-3.5 bg-slate-50/90 border-b border-slate-200 space-y-3">
          {/* Prominent Tab Search Field */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setQueuePage(1);
              }}
              placeholder={
                activeTab === 'TODAY_ARRIVALS'
                  ? '🔍 Filter arrivals by Guest Name, Mobile, Registration ID, or Room...'
                  : activeTab === 'CHECKED_IN'
                  ? '🔍 Search current occupants by Name, Mobile, Room, or Bed...'
                  : activeTab === 'TENTATIVE'
                  ? '🔍 Search tentative bookings by Primary Guest, Mobile, or Allocation ID...'
                  : '🔍 Search completed checkouts by Guest Name, Phone, or Registration ID...'
              }
              className="w-full pl-10 pr-10 py-2 bg-white border border-slate-300 hover:border-blue-400 focus:border-blue-600 rounded-xl text-xs font-semibold text-slate-900 placeholder-slate-400 shadow-xs focus:outline-none transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Purpose-based Filter Row based on activeTab */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filter: Hotel */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Hotel:</span>
              <select
                value={filterHotelId}
                onChange={(e) => { setFilterHotelId(e.target.value); setQueuePage(1); }}
                className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-semibold focus:outline-none focus:border-blue-600"
              >
                <option value="">All Hotels</option>
                {hotels.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>

            {/* Filter: Building Name */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Building:</span>
              <input
                type="text"
                value={filterBuilding}
                onChange={(e) => { setFilterBuilding(e.target.value); setQueuePage(1); }}
                placeholder="Building..."
                className="w-24 px-2 py-1 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-semibold focus:outline-none focus:border-blue-600"
              />
            </div>

            {/* Filter: Room Number */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Room:</span>
              <input
                type="text"
                value={filterRoomNumber}
                onChange={(e) => { setFilterRoomNumber(e.target.value); setQueuePage(1); }}
                placeholder="Room #..."
                className="w-20 px-2 py-1 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-semibold focus:outline-none focus:border-blue-600"
              />
            </div>

            {/* Filter: Registration ID */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Reg ID:</span>
              <input
                type="text"
                value={filterRegistrationId}
                onChange={(e) => { setFilterRegistrationId(e.target.value); setQueuePage(1); }}
                placeholder="REG-..."
                className="w-20 px-2 py-1 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-semibold focus:outline-none focus:border-blue-600 font-mono"
              />
            </div>

            {/* Filter: Primary Participant Name */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Primary:</span>
              <input
                type="text"
                value={filterPrimaryName}
                onChange={(e) => { setFilterPrimaryName(e.target.value); setQueuePage(1); }}
                placeholder="Name..."
                className="w-24 px-2 py-1 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-semibold focus:outline-none focus:border-blue-600"
              />
            </div>

            {/* Filter: Phone Number */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Phone:</span>
              <input
                type="text"
                value={filterPhone}
                onChange={(e) => { setFilterPhone(e.target.value); setQueuePage(1); }}
                placeholder="Phone..."
                className="w-24 px-2 py-1 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-semibold focus:outline-none focus:border-blue-600 font-mono"
              />
            </div>

            {/* Filter: Gender */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Gender:</span>
              <select
                value={filterGender}
                onChange={(e) => { setFilterGender(e.target.value); setQueuePage(1); }}
                className="px-2 py-1 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-semibold focus:outline-none focus:border-blue-600"
              >
                <option value="ALL">All</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </select>
            </div>

            {/* Filter: Room Category */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Category:</span>
              <select
                value={filterRoomCategory}
                onChange={(e) => { setFilterRoomCategory(e.target.value); setQueuePage(1); }}
                className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-semibold focus:outline-none focus:border-blue-600"
              >
                <option value="">All Categories</option>
                <option value="FEMALE">👩 Ladies (Female)</option>
                <option value="MALE">👦 Gents (Male)</option>
                <option value="FAMILY">👨‍👩‍👧 Family</option>
                <option value="GUEST">🌟 Guest</option>
              </select>
            </div>

            {/* Tab-specific filters */}
            {activeTab === 'TODAY_ARRIVALS' && (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Arrival Date:</span>
                  <input
                    type="date"
                    value={filterArrivalDate}
                    onChange={(e) => { setFilterArrivalDate(e.target.value); setQueuePage(1); }}
                    className="px-2 py-1 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-semibold focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Status:</span>
                  <select
                    value={filterArrivalStatus}
                    onChange={(e) => { setFilterArrivalStatus(e.target.value); setQueuePage(1); }}
                    className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-semibold focus:outline-none focus:border-blue-600"
                  >
                    <option value="">All Statuses</option>
                    <option value="EXPECTED">⏳ Expected / Arriving</option>
                    <option value="CHECKED_IN">✅ Checked In</option>
                  </select>
                </div>
              </>
            )}

            {activeTab === 'CHECKED_IN' && (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Check-in Date:</span>
                  <input
                    type="date"
                    value={filterCheckInDate}
                    onChange={(e) => { setFilterCheckInDate(e.target.value); setQueuePage(1); }}
                    className="px-2 py-1 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-semibold focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Status:</span>
                  <select
                    value={filterCheckInStatus}
                    onChange={(e) => { setFilterCheckInStatus(e.target.value); setQueuePage(1); }}
                    className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-semibold focus:outline-none focus:border-blue-600"
                  >
                    <option value="ALL">All Stays</option>
                    <option value="CHECKED_IN">Checked In</option>
                    <option value="EXTENDED">Extended</option>
                  </select>
                </div>
              </>
            )}

            {activeTab === 'TENTATIVE' && (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Expected Arrival:</span>
                  <input
                    type="date"
                    value={filterArrivalDate}
                    onChange={(e) => { setFilterArrivalDate(e.target.value); setQueuePage(1); }}
                    className="px-2 py-1 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-semibold focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Hold Status:</span>
                  <select
                    value={filterAllocationStatus}
                    onChange={(e) => { setFilterAllocationStatus(e.target.value); setQueuePage(1); }}
                    className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-semibold focus:outline-none focus:border-blue-600"
                  >
                    <option value="">All Holds</option>
                    <option value="TENTATIVE">Tentative Hold</option>
                    <option value="CONFIRMED">Confirmed Hold</option>
                  </select>
                </div>
              </>
            )}

            {activeTab === 'CHECKED_OUT' && (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Check-out Date:</span>
                  <input
                    type="date"
                    value={filterCheckOutDate}
                    onChange={(e) => { setFilterCheckOutDate(e.target.value); setQueuePage(1); }}
                    className="px-2 py-1 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-semibold focus:outline-none focus:border-blue-600"
                  />
                </div>
              </>
            )}

            {(filterHotelId || filterBuilding || filterRoomCategory || filterRoomNumber || filterRegistrationId || filterPrimaryName || filterPhone || filterGender !== 'ALL' || filterCheckInStatus !== 'ALL' || filterArrivalDate || filterCheckInDate || filterCheckOutDate || filterArrivalStatus || filterAllocationStatus) && (
              <button
                type="button"
                onClick={() => {
                  setFilterHotelId('');
                  setFilterBuilding('');
                  setFilterRoomCategory('');
                  setFilterRoomNumber('');
                  setFilterRegistrationId('');
                  setFilterPrimaryName('');
                  setFilterPhone('');
                  setFilterGender('ALL');
                  setFilterCheckInStatus('ALL');
                  setFilterCheckOutStatus('ALL');
                  setFilterArrivalDate('');
                  setFilterCheckInDate('');
                  setFilterCheckOutDate('');
                  setFilterArrivalStatus('');
                  setFilterAllocationStatus('');
                  setQueuePage(1);
                }}
                className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Clear Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* Floating Bulk Action Bar for Group Check-Out (When Guests are Selected) */}
        {activeTab === 'CHECKED_IN' && selectedStayingStayIds.length > 0 && (
          <div className="mx-4 my-2 p-3 bg-slate-900 text-white rounded-xl shadow-lg flex items-center justify-between animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-rose-600 text-white font-bold text-xs flex items-center justify-center">
                {selectedStayingStayIds.length}
              </span>
              <span className="text-xs font-semibold">
                {selectedStayingStayIds.length} staying guest{selectedStayingStayIds.length > 1 ? 's' : ''} selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedStayingStayIds([])}
                className="px-3 py-1.5 text-xs text-slate-300 hover:text-white"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handleExecuteGroupCheckOut()}
                disabled={groupCheckOutLoading}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {groupCheckOutLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                <span>Group Check Out ({selectedStayingStayIds.length})</span>
              </button>
            </div>
          </div>
        )}

        {/* Minimal Table Content (Desktop) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                {activeTab === 'CHECKED_IN' && (
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={records.length > 0 && records.every((r) => selectedStayingStayIds.includes(r.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedStayingStayIds(records.map((r) => r.id));
                        } else {
                          setSelectedStayingStayIds([]);
                        }
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      title="Select all on this page for group check-out"
                    />
                  </th>
                )}
                <th className="py-3 px-4">Guest / Group</th>
                <th className="py-3 px-4">Category &amp; Members</th>
                <th className="py-3 px-4">Assigned Room &amp; Bed/Mat</th>
                <th className="py-3 px-4">Schedule</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && records.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'CHECKED_IN' ? 7 : 6} className="py-16 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                    Loading reception data...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'CHECKED_IN' ? 7 : 6} className="py-16 text-center text-slate-400">
                    No records found in this queue.
                  </td>
                </tr>
              ) : (
                records.map((item) => {
                  const isStay = activeTab === 'CHECKED_IN' || activeTab === 'CHECKED_OUT';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      {activeTab === 'CHECKED_IN' && (
                        <td className="py-3.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedStayingStayIds.includes(item.id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              setSelectedStayingStayIds((prev) =>
                                e.target.checked ? [...prev, item.id] : prev.filter((id) => id !== item.id)
                              );
                            }}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                      )}
                      {/* Guest details */}
                      <td className="py-3.5 px-4">
                        {isStay ? (
                          <div>
                            <button
                              type="button"
                              onClick={() => openParticipantProfile(item.participant?.id)}
                              className="font-bold text-blue-700 hover:text-blue-900 hover:underline text-sm text-left flex items-center gap-1 group"
                              title="Click to view full Unified Participant Profile"
                            >
                              <span>{item.participant?.fullName}</span>
                              <ExternalLink className="w-3 h-3 text-blue-400 group-hover:text-blue-600" />
                            </button>
                            <p className="text-[11px] text-slate-500">
                              Phone: <strong className="font-mono text-slate-700">{item.participant?.phone || item.registration?.mobile}</strong>
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              Reg ID: {item.registration?.registrationId}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <button
                              type="button"
                              onClick={() => {
                                const p = item.registration?.participants?.[0];
                                if (p) {
                                  openParticipantProfile(p.id);
                                } else {
                                  openDossier(item.registration?.id || item.id);
                                }
                              }}
                              className="font-bold text-blue-700 hover:text-blue-900 hover:underline text-sm text-left flex items-center gap-1 group"
                              title="Click to view full Unified Participant Profile"
                            >
                              <span>{item.registration?.primaryName}</span>
                              <ExternalLink className="w-3 h-3 text-blue-400 group-hover:text-blue-600" />
                            </button>
                            <p className="text-[11px] text-slate-500 font-mono">
                              Phone: <strong className="text-slate-700">{item.registration?.mobile}</strong>
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              {item.registration?.registrationId} &bull; {item.allocationNumber}
                            </p>
                          </div>
                        )}
                      </td>

                      {/* Category & Members */}
                      <td className="py-3.5 px-4">
                        {isStay ? (
                          <div className="space-y-1">
                            <span className="font-bold text-slate-700 text-xs">1 Person</span>
                            <div>
                              {item.unit?.room?.genderPreference === 'MALE' && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                                  👦 Male
                                </span>
                              )}
                              {item.unit?.room?.genderPreference === 'FEMALE' && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-pink-100 text-pink-800">
                                  👩 Female
                                </span>
                              )}
                              {item.unit?.room?.genderPreference === 'FAMILY' && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                                  👨‍👩‍👧 Family
                                </span>
                              )}
                              {item.unit?.room?.genderPreference === 'GUEST' && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900">
                                  🌟 Guest
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="font-bold text-slate-800 text-xs">{item.registration?.totalMembers} Persons</span>
                            <div className="flex flex-wrap gap-1">
                              {item.items?.[0]?.unit?.room?.genderPreference === 'MALE' && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                                  👦 Male
                                </span>
                              )}
                              {item.items?.[0]?.unit?.room?.genderPreference === 'FEMALE' && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-pink-100 text-pink-800">
                                  👩 Female
                                </span>
                              )}
                              {item.items?.[0]?.unit?.room?.genderPreference === 'FAMILY' && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                                  👨‍👩‍👧 Family
                                </span>
                              )}
                              {item.items?.[0]?.unit?.room?.genderPreference === 'GUEST' && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900">
                                  🌟 Guest
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Room & Bed Assignment */}
                      <td className="py-3.5 px-4">
                        {isStay ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200 font-mono font-bold">
                            <span>Room {item.unit?.room?.roomNumber}</span>
                            <span className="text-[10px] font-sans font-medium text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded">
                              {item.unit?.room?.hotel?.name || item.unit?.room?.building || 'Main'}
                            </span>
                            <span>&bull;</span>
                            <span>{item.unit?.type === 'MAT' ? '🧘 Mat' : '🛏️ Bed'} {item.unit?.unitNumber}</span>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {item.items?.map((it: any, idx: number) => (
                              <span
                                key={idx}
                                className="px-2.5 py-1 rounded-lg text-xs bg-slate-100 text-slate-800 border border-slate-200 font-mono font-bold inline-flex items-center gap-1"
                              >
                                <span>Room {it.unit?.room?.roomNumber}</span>
                                <span className="text-[9px] font-sans font-semibold text-slate-500 bg-white px-1 py-0.5 rounded border border-slate-200">
                                  {it.unit?.room?.hotel?.name || it.unit?.room?.building || 'Main'}
                                </span>
                                <span>&bull;</span>
                                <span>{it.unit?.type === 'MAT' ? 'Mat' : 'Bed'} {it.unit?.unitNumber}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Stay dates */}
                      <td className="py-3.5 px-4 text-slate-600">
                        {isStay ? (
                          <div>
                            <p className="font-semibold text-slate-800">In: {new Date(item.actualCheckIn).toLocaleDateString()}</p>
                            {item.actualCheckOut && (
                              <p className="text-[10px] text-slate-400">Out: {new Date(item.actualCheckOut).toLocaleDateString()}</p>
                            )}
                          </div>
                        ) : (
                          <div>
                            <p className="font-semibold text-slate-800">
                              {new Date(item.entryDate).toLocaleDateString()} &rarr; {new Date(item.exitDate).toLocaleDateString()}
                            </p>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          item.status === 'CHECKED_IN'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : item.status === 'CONFIRMED'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : item.status === 'TENTATIVE'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {item.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isStay ? (
                            <>
                              {canOperateReception && item.status === 'CHECKED_IN' && (
                                <>
                                  <button
                                    onClick={() => handleLaunchChangeUnit(item)}
                                    className="px-2.5 py-1.5 text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition font-bold flex items-center gap-1 text-xs"
                                    title="Change assigned room, bed, or mat"
                                  >
                                    <ArrowRightLeft className="w-3.5 h-3.5" />
                                    <span>Change Room/Bed</span>
                                  </button>

                                  <button
                                    onClick={() => openExtendStayModal(item)}
                                    className="px-2.5 py-1.5 text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition font-bold flex items-center gap-1 text-xs"
                                    title="Extend stay duration for this guest"
                                  >
                                    <Calendar className="w-3.5 h-3.5" />
                                    <span>Extend Stay</span>
                                  </button>

                                  <button
                                    onClick={() => handleCheckOut(item.id, item.participant?.fullName)}
                                    className="px-2.5 py-1.5 text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition font-bold flex items-center gap-1 text-xs"
                                    title="Check out guest and release bed/mat"
                                  >
                                    <LogOut className="w-3.5 h-3.5" />
                                    <span>Check Out</span>
                                  </button>

                                  <button
                                    onClick={() => openGroupCheckoutForRegistration(item)}
                                    className="px-2.5 py-1.5 text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition font-bold flex items-center gap-1 text-xs"
                                    title="Group checkout: select and check out party members associated with this registration"
                                  >
                                    <Users className="w-3.5 h-3.5" />
                                    <span>Group Check-Out</span>
                                  </button>
                                </>
                              )}

                              {canOperateReception && item.status === 'CHECKED_OUT' && (
                                <button
                                  onClick={() => openCheckInAgainModal(item)}
                                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs transition flex items-center gap-1.5 text-xs active:scale-95"
                                  title="Accidental checkout recovery: check in this guest again with same participant ID"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>Check In Again</span>
                                </button>
                              )}
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleExecuteQuickCheckIn(item)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs transition flex items-center gap-1 text-xs"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Check In</span>
                              </button>

                              <button
                                onClick={() => handleLaunchChangeUnit(item)}
                                className="px-2.5 py-1.5 text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg font-bold transition flex items-center gap-1 text-xs"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                                <span>Change Room</span>
                              </button>

                              <button
                                onClick={() => openDossier(item.registration?.id || item.id)}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold transition text-xs"
                              >
                                Details
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

        {/* Mobile View: Clean Touch-Friendly Stacked Cards */}
        <div className="block md:hidden divide-y divide-slate-100 p-3 space-y-3">
          {loading && records.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
              Loading reception data...
            </div>
          ) : records.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No records found in this queue.
            </div>
          ) : (
            records.map((item) => {
              const isStay = activeTab === 'CHECKED_IN' || activeTab === 'CHECKED_OUT';
              const phone = isStay ? (item.participant?.phone || item.registration?.mobile) : item.registration?.mobile;
              const name = isStay ? item.participant?.fullName : item.registration?.primaryName;
              const regId = item.registration?.registrationId;
              const genderPref = isStay ? item.unit?.room?.genderPreference : item.items?.[0]?.unit?.room?.genderPreference;

              return (
                <div key={item.id} className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <button
                        type="button"
                        onClick={() => {
                          if (isStay && item.participant?.id) {
                            openParticipantProfile(item.participant.id);
                          } else {
                            const p = item.registration?.participants?.[0];
                            if (p) openParticipantProfile(p.id);
                            else openDossier(item.registration?.id || item.id);
                          }
                        }}
                        className="font-bold text-blue-700 hover:text-blue-900 text-sm leading-tight text-left flex items-center gap-1"
                      >
                        <span>{name}</span>
                        <ExternalLink className="w-3 h-3 text-blue-400" />
                      </button>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="font-mono text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 font-bold">
                          {regId}
                        </span>
                        {!isStay && item.allocationNumber && (
                          <span className="font-mono text-[10px] text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                            {item.allocationNumber}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Status badge */}
                    {isStay ? (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                        item.status === 'CHECKED_IN'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {item.status}
                      </span>
                    ) : (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                        item.status === 'CONFIRMED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.status === 'TENTATIVE'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {item.status}
                      </span>
                    )}
                  </div>

                  {/* Phone & Category */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 pt-1 border-t border-slate-200/60">
                    {phone ? (
                      <a href={`tel:${phone}`} className="font-mono text-blue-600 font-bold flex items-center gap-1 hover:underline">
                        <Phone className="w-3.5 h-3.5 text-blue-500" />
                        <span>{phone}</span>
                      </a>
                    ) : (
                      <span className="text-slate-400 text-[11px]">No phone listed</span>
                    )}
                    <span className="text-[11px] font-bold text-slate-700">
                      {isStay ? '1 Person' : `${item.registration?.totalMembers || 1} Persons`}
                      {genderPref && (
                        <span className={`ml-1.5 px-1.5 py-0.2 rounded text-[10px] ${
                          genderPref === 'FEMALE' ? 'bg-pink-100 text-pink-800' :
                          genderPref === 'MALE' ? 'bg-blue-100 text-blue-800' :
                          genderPref === 'FAMILY' ? 'bg-purple-100 text-purple-800' : 'bg-amber-100 text-amber-900'
                        }`}>
                          {genderPref === 'FEMALE' ? 'Ladies' : genderPref === 'MALE' ? 'Gents' : genderPref}
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Room & Bed Allocation */}
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Assigned Accommodation:</span>
                    {isStay ? (
                      <div className="font-mono font-bold text-emerald-800 flex items-center gap-1.5">
                        <span>Room {item.unit?.room?.roomNumber}</span>
                        <span>&bull;</span>
                        <span>{item.unit?.type === 'MAT' ? '🧘 Mat' : '🛏️ Bed'} {item.unit?.unitNumber}</span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {item.items?.map((it: any, idx: number) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-800 border border-slate-200 font-mono font-bold"
                          >
                            Room {it.unit?.room?.roomNumber} &bull; {it.unit?.type === 'MAT' ? 'Mat' : 'Bed'} {it.unit?.unitNumber}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Touch Action Buttons */}
                  <div className="pt-1 flex flex-wrap gap-2">
                    {isStay ? (
                      item.status === 'CHECKED_OUT' ? (
                        <button
                          type="button"
                          onClick={() => openCheckInAgainModal(item)}
                          className="w-full min-h-[44px] px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs transition flex items-center justify-center gap-1.5 text-xs active:scale-98"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span>Check In Again (Accidental Recovery)</span>
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleLaunchChangeUnit(item)}
                            className="flex-1 min-h-[44px] px-3 py-2 text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition font-bold flex items-center justify-center gap-1 text-xs active:scale-98"
                          >
                            <ArrowRightLeft className="w-4 h-4" />
                            <span>Change Room/Bed</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openExtendStayModal(item)}
                            className="flex-1 min-h-[44px] px-3 py-2 text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition font-bold flex items-center justify-center gap-1 text-xs active:scale-98"
                            title="Extend stay"
                          >
                            <Calendar className="w-4 h-4" />
                            <span>Extend</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCheckOut(item.id, item.participant?.fullName)}
                            className="flex-1 min-h-[44px] px-3 py-2 text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition font-bold flex items-center justify-center gap-1 text-xs active:scale-98"
                          >
                            <LogOut className="w-4 h-4" />
                            <span>Check Out</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openGroupCheckoutForRegistration(item)}
                            className="w-full min-h-[44px] px-3 py-2 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition font-bold flex items-center justify-center gap-1 text-xs active:scale-98"
                            title="Group checkout by primary participant"
                          >
                            <Users className="w-4 h-4" />
                            <span>Group Check-Out (Party Members)</span>
                          </button>
                        </>
                      )
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleExecuteQuickCheckIn(item)}
                          className="flex-1 min-h-[44px] px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs transition flex items-center justify-center gap-1.5 text-xs active:scale-98"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Check In</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleLaunchChangeUnit(item)}
                          className="px-3 py-2 min-h-[44px] text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl font-bold transition flex items-center justify-center gap-1 text-xs active:scale-98"
                        >
                          <ArrowRightLeft className="w-4 h-4" />
                          <span>Change</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openDossier(item.registration?.id || item.id)}
                          className="px-3 py-2 min-h-[44px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition text-xs active:scale-98"
                        >
                          Details
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 bg-slate-50/50">
          <span>
            Page {queuePage} of {queueTotalPages} ({queueTotalCount} total records)
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setQueuePage((p) => Math.max(1, p - 1))}
              disabled={queuePage <= 1}
              className="px-3 py-1 border border-slate-300 rounded-lg hover:bg-white disabled:opacity-40 font-semibold"
            >
              Previous
            </button>
            <button
              onClick={() => setQueuePage((p) => Math.min(queueTotalPages, p + 1))}
              disabled={queuePage >= queueTotalPages}
              className="px-3 py-1 border border-slate-300 rounded-lg hover:bg-white disabled:opacity-40 font-semibold"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* TOUCH-FRIENDLY ACTION 2 MODAL: CHECK IN GUEST                      */}
      {/* ------------------------------------------------------------------ */}
      {quickCheckInOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 my-4 sm:my-8">
            <div className="p-4 sm:p-5 bg-emerald-600 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-6 h-6" />
                <div>
                  <h3 className="text-base font-black">Check In Guest</h3>
                  <p className="text-xs text-emerald-100">Confirm arrival and check guest into assigned rooms/beds</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setQuickCheckInOpen(false);
                  setQuickCheckInTarget(null);
                  setQuickCheckInSearch('');
                }}
                className="text-emerald-100 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
              {!quickCheckInTarget ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Search Arriving Participant / Booking
                    </label>
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Type guest name, mobile, or REG-0001..."
                        value={quickCheckInSearch}
                        onChange={(e) => setQuickCheckInSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Arriving Guests Ready for Check-In ({records.filter((r) => !r.actualCheckIn).length}):
                    </p>
                    {records
                      .filter((r) => !r.actualCheckIn)
                      .filter((r) => {
                        if (!quickCheckInSearch.trim()) return true;
                        const q = quickCheckInSearch.toLowerCase();
                        return (
                          r.registration?.primaryName?.toLowerCase().includes(q) ||
                          r.registration?.mobile?.includes(q) ||
                          r.registration?.registrationId?.toLowerCase().includes(q) ||
                          r.allocationNumber?.toLowerCase().includes(q)
                        );
                      })
                      .map((item) => (
                        <div
                          key={item.id}
                          onClick={() => setQuickCheckInTarget(item)}
                          className="p-3 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl cursor-pointer transition flex items-center justify-between"
                        >
                          <div>
                            <p className="font-bold text-slate-900 text-xs">
                              {item.registration?.primaryName} ({item.registration?.totalMembers} Person)
                            </p>
                            <p className="text-[11px] text-slate-500 font-mono">
                              Mobile: {item.registration?.mobile} &bull; {item.registration?.registrationId}
                            </p>
                          </div>
                          <span className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold">
                            Select
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Selected Card */}
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-900 uppercase text-[10px] tracking-wider">
                        Guest Selected for Check-In
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuickCheckInTarget(null)}
                        className="text-emerald-700 underline text-xs font-semibold"
                      >
                        Change Selection
                      </button>
                    </div>

                    <p className="font-black text-slate-900 text-base">
                      {quickCheckInTarget.registration?.primaryName}
                    </p>
                    <p className="text-slate-600 font-mono">
                      Mobile: <strong>{quickCheckInTarget.registration?.mobile}</strong> &bull; Registration: <strong>{quickCheckInTarget.registration?.registrationId}</strong>
                    </p>

                    <div className="pt-2 border-t border-emerald-200/60">
                      <p className="font-bold text-slate-700 mb-1">Assigned Rooms &amp; Units:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {quickCheckInTarget.items?.map((it: any, idx: number) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 bg-white border border-emerald-300 rounded-lg font-mono font-bold text-emerald-950"
                          >
                            Room {it.unit?.room?.roomNumber} &bull; {it.unit?.type === 'MAT' ? 'Mat' : 'Bed'} {it.unit?.unitNumber}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleExecuteQuickCheckIn(quickCheckInTarget)}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl font-bold text-sm shadow-md transition flex items-center justify-center gap-2 active:scale-98"
                    >
                      {actionLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Processing Check-In...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-5 h-5" />
                          <span>Confirm Check In Now</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TOUCH-FRIENDLY ACTION 4 MODAL: CHECK OUT GUEST                     */}
      {/* ------------------------------------------------------------------ */}
      {quickCheckOutOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 my-4 sm:my-8">
            <div className="p-4 sm:p-5 bg-gradient-to-r from-rose-600 via-rose-700 to-red-700 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/20 rounded-xl">
                  <LogOut className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-black">Check Out Guest</h3>
                  <p className="text-xs text-rose-100">Filter staying guests &amp; release occupied beds/mats back into active inventory</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setQuickCheckOutOpen(false);
                  setQuickCheckOutTarget(null);
                  setQuickCheckOutSearch('');
                }}
                className="text-rose-100 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-3.5 overflow-y-auto">
              {!quickCheckOutTarget ? (
                <div className="space-y-3">
                  {/* Search Bar */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Search Currently Staying Guest
                    </label>
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search by guest name, room number, mobile, or registration ID..."
                        value={quickCheckOutSearch}
                        onChange={(e) => setQuickCheckOutSearch(e.target.value)}
                        className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-300 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-rose-500 shadow-xs"
                      />
                      {quickCheckOutSearch && (
                        <button
                          type="button"
                          onClick={() => setQuickCheckOutSearch('')}
                          className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* OCCUPANT & ROOM FILTERS */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-rose-600" />
                        <span>Occupant &amp; Room Filters</span>
                      </div>
                      {(quickCheckOutBuildingFilter !== 'ALL' || quickCheckOutHotelFilter !== 'ALL' || quickCheckOutRoomSearch || quickCheckOutGenderFilter !== 'ALL' || quickCheckOutUnitTypeFilter !== 'ALL' || quickCheckOutSearch) && (
                        <button
                          type="button"
                          onClick={() => {
                            setQuickCheckOutBuildingFilter('ALL');
                            setQuickCheckOutHotelFilter('ALL');
                            setQuickCheckOutRoomSearch('');
                            setQuickCheckOutGenderFilter('ALL');
                            setQuickCheckOutUnitTypeFilter('ALL');
                            setQuickCheckOutSearch('');
                          }}
                          className="text-[11px] font-bold text-rose-600 hover:text-rose-800 hover:underline flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Clear Filters</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      {/* A. Search Room Number Filter */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={quickCheckOutRoomSearch}
                          onChange={(e) => setQuickCheckOutRoomSearch(e.target.value)}
                          placeholder="Room #..."
                          className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1.5 focus:ring-rose-500 font-medium"
                        />
                        {quickCheckOutRoomSearch && (
                          <button
                            type="button"
                            onClick={() => setQuickCheckOutRoomSearch('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* B. Building Name Filter */}
                      <div>
                        <select
                          value={quickCheckOutBuildingFilter}
                          onChange={(e) => setQuickCheckOutBuildingFilter(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:ring-1.5 focus:ring-rose-500"
                        >
                          <option value="ALL">🏢 All Buildings</option>
                          {quickCheckOutAvailableBuildings.map((b) => (
                            <option key={b} value={b}>🏢 {b}</option>
                          ))}
                        </select>
                      </div>

                      {/* C. Gender Filter */}
                      <div className="flex items-center rounded-lg bg-slate-200/80 p-0.5 text-xs">
                        {(['ALL', 'MALE', 'FEMALE'] as const).map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setQuickCheckOutGenderFilter(g)}
                            className={`flex-1 py-1 text-[11px] font-bold rounded-md transition text-center ${
                              quickCheckOutGenderFilter === g
                                ? 'bg-white text-rose-700 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {g === 'ALL' ? 'All' : g === 'MALE' ? 'Male' : 'Female'}
                          </button>
                        ))}
                      </div>

                      {/* D. Unit Type Filter */}
                      <div className="flex items-center rounded-lg bg-slate-200/80 p-0.5 text-xs">
                        {(['ALL', 'BED', 'MAT'] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setQuickCheckOutUnitTypeFilter(t)}
                            className={`flex-1 py-1 text-[11px] font-bold rounded-md transition text-center ${
                              quickCheckOutUnitTypeFilter === t
                                ? 'bg-white text-rose-700 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {t === 'ALL' ? 'All' : t === 'BED' ? '🛏️ Bed' : '🧘 Mat'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* In-House List Header */}
                  <div className="flex items-center justify-between pb-1 pt-1">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      In-House Occupants ({filteredQuickCheckOutGuests.length} matching • {quickCheckOutInHouseList.length} total):
                    </p>
                    {filteredQuickCheckOutGuests.length > 0 && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const filteredIds = filteredQuickCheckOutGuests.map((s) => s.id);
                            const allFilteredSelected = filteredIds.every((id) => quickCheckOutSelectedIds.includes(id));
                            if (allFilteredSelected) {
                              setQuickCheckOutSelectedIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
                            } else {
                              setQuickCheckOutSelectedIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
                            }
                          }}
                          className="text-xs font-bold text-rose-600 hover:text-rose-800 underline"
                        >
                          {filteredQuickCheckOutGuests.every((s) => quickCheckOutSelectedIds.includes(s.id))
                            ? 'Deselect All'
                            : 'Select All'}
                        </button>
                        {quickCheckOutSelectedIds.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setQuickCheckOutSelectedIds([])}
                            className="text-xs font-medium text-slate-500 hover:text-slate-800 underline"
                          >
                            Clear ({quickCheckOutSelectedIds.length})
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* List Content */}
                  {quickCheckOutLoadingList ? (
                    <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center gap-2 border border-slate-200 rounded-xl bg-slate-50">
                      <RefreshCw className="w-5 h-5 animate-spin text-rose-600" />
                      <span className="text-xs font-medium">Loading currently in-house guests...</span>
                    </div>
                  ) : filteredQuickCheckOutGuests.length === 0 ? (
                    <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-2">
                      <p className="text-xs text-slate-600 font-medium">
                        No in-house guests match the active filters ({quickCheckOutInHouseList.length} total in-house guests loaded).
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setQuickCheckOutBuildingFilter('ALL');
                          setQuickCheckOutHotelFilter('ALL');
                          setQuickCheckOutRoomSearch('');
                          setQuickCheckOutGenderFilter('ALL');
                          setQuickCheckOutUnitTypeFilter('ALL');
                          setQuickCheckOutSearch('');
                        }}
                        className="px-3 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50 transition"
                      >
                        Reset All Filters
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                      {filteredQuickCheckOutGuests.map((item) => {
                        const isSelected = quickCheckOutSelectedIds.includes(item.id);
                        return (
                          <div
                            key={item.id}
                            onClick={() => {
                              setQuickCheckOutSelectedIds((prev) =>
                                prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]
                              );
                            }}
                            className={`p-3 rounded-xl cursor-pointer transition flex items-center justify-between border ${
                              isSelected
                                ? 'bg-rose-50 border-rose-400 ring-1 ring-rose-300'
                                : 'bg-slate-50 hover:bg-rose-50/50 border-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 pointer-events-none"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 truncate">
                                  <p className="font-bold text-slate-900 text-xs truncate">
                                    {item.participant?.fullName || item.registration?.primaryName}
                                  </p>
                                  {item.participant?.isPrimary && (
                                    <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 text-[9px] font-bold rounded shrink-0">
                                      Primary
                                    </span>
                                  )}
                                  <span className="text-[10px] text-slate-400 font-mono shrink-0">
                                    {item.registration?.registrationId}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                                  Room {item.unit?.room?.roomNumber} {item.unit?.room?.building ? `(${item.unit?.room?.building})` : ''} &bull; {item.unit?.type === 'MAT' ? '🧘 Mat' : '🛏️ Bed'} {item.unit?.unitNumber}
                                  {(item.participant?.phone || item.registration?.mobile) && (
                                    <span className="ml-2 text-slate-400">&bull; {item.participant?.phone || item.registration?.mobile}</span>
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setQuickCheckOutTarget(item);
                                }}
                                className="px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 rounded-md transition"
                                title="Inspect single guest checkout details"
                              >
                                Details
                              </button>
                              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                                isSelected ? 'bg-rose-600 text-white shadow-2xs' : 'bg-slate-200 text-slate-700'
                              }`}>
                                {isSelected ? '✓ Selected' : 'Select'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Multi-Checkout Selected Action Button */}
                  {quickCheckOutSelectedIds.length > 0 && (
                    <div className="pt-2 border-t border-slate-200">
                      <button
                        type="button"
                        disabled={groupCheckOutLoading || actionLoading}
                        onClick={handleExecuteQuickCheckOutSelected}
                        className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-sm shadow-md transition flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
                      >
                        {(groupCheckOutLoading || actionLoading) ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <LogOut className="w-5 h-5" />
                        )}
                        <span>Check Out {quickCheckOutSelectedIds.length} Selected Guest{quickCheckOutSelectedIds.length > 1 ? 's' : ''} Now</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Selected Card */}
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-rose-900 uppercase text-[10px] tracking-wider">
                        Guest Selected for Checkout
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuickCheckOutTarget(null)}
                        className="text-rose-700 underline text-xs font-semibold"
                      >
                        Change Selection
                      </button>
                    </div>

                    <p className="font-black text-slate-900 text-base">
                      {quickCheckOutTarget.participant?.fullName || quickCheckOutTarget.registration?.primaryName}
                    </p>
                    <p className="text-slate-600">
                      Room <strong>{quickCheckOutTarget.unit?.room?.roomNumber}</strong> &bull; {quickCheckOutTarget.unit?.type === 'MAT' ? 'Mat' : 'Bed'} <strong>{quickCheckOutTarget.unit?.unitNumber}</strong>
                    </p>
                    <p className="text-slate-500 text-[11px]">
                      Checked in: {new Date(quickCheckOutTarget.actualCheckIn).toLocaleString()}
                    </p>

                    <div className="p-2.5 bg-white rounded-lg border border-rose-200 text-rose-800 text-[11px]">
                      Confirming check-out will mark this stay record as completed and immediately release the unit into available inventory for new guests.
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={async () => {
                        await handleCheckOut(quickCheckOutTarget.id, quickCheckOutTarget.participant?.fullName);
                        setQuickCheckOutOpen(false);
                        setQuickCheckOutTarget(null);
                      }}
                      className="w-full py-3 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white rounded-xl font-bold text-sm shadow-md transition flex items-center justify-center gap-2 active:scale-98"
                    >
                      {actionLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Processing Check-Out...</span>
                        </>
                      ) : (
                        <>
                          <LogOut className="w-5 h-5" />
                          <span>Confirm Check Out &amp; Release Bed</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 1: RECEPTION DESK & OCCUPANCY DOSSIER                         */}
      {/* ------------------------------------------------------------------ */}
      {selectedDossierId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white">
                  <CheckSquare className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold flex items-center gap-2">
                    {dossier?.registration.primaryName}
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-blue-300 border border-slate-700">
                      {dossier?.registration.registrationId}
                    </span>
                    {dossier?.activeAllocation && (
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                        {dossier.activeAllocation.allocationNumber} ({dossier.activeAllocation.status})
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Phone: {dossier?.registration.mobile} &bull; City: {dossier?.registration.city || 'N/A'}, {dossier?.registration.state || 'N/A'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => { setSelectedDossierId(null); setDossier(null); }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Capacity & Partial Arrival Notice Strip */}
            {dossier && (
              <div className="px-6 py-3 bg-blue-50/80 border-b border-blue-200/80 flex flex-wrap items-center justify-between text-xs text-blue-900">
                <div className="flex items-center gap-4">
                  <span><strong>Total Registered:</strong> {dossier.capacitySummary.totalRegisteredMembers} Members</span>
                  <span><strong>Allocated Units:</strong> {dossier.capacitySummary.allocatedUnitsCount} Beds/Mats</span>
                  <span><strong>Actual Arrived:</strong> {dossier.capacitySummary.actualParticipantsCount} People</span>
                  <span><strong>Checked In:</strong> {dossier.capacitySummary.checkedInCount} In-House</span>
                </div>
                {dossier.capacitySummary.difference > 0 && (
                  <span className="text-amber-800 font-semibold bg-amber-100 px-2 py-0.5 rounded text-[11px]">
                    Partial Arrival: {dossier.capacitySummary.difference} registered members not arriving
                  </span>
                )}
              </div>
            )}

            {/* Sub-Tabs */}
            <div className="flex items-center border-b border-slate-200 bg-slate-50 px-6 pt-2 text-xs font-semibold">
              <button
                onClick={() => setDossierActiveTab('ARRIVALS')}
                className={`pb-2.5 px-4 border-b-2 transition flex items-center gap-1.5 ${
                  dossierActiveTab === 'ARRIVALS'
                    ? 'border-blue-600 text-blue-700 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                1. Actual Arriving Group ({arrivingGroup.length})
              </button>
              <button
                onClick={() => setDossierActiveTab('ASSIGNMENTS')}
                className={`pb-2.5 px-4 border-b-2 transition flex items-center gap-1.5 ${
                  dossierActiveTab === 'ASSIGNMENTS'
                    ? 'border-blue-600 text-blue-700 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Bed className="w-3.5 h-3.5" />
                2. Unit &amp; Bed Mapping
              </button>
              <button
                onClick={() => setDossierActiveTab('ACTIONS')}
                className={`pb-2.5 px-4 border-b-2 transition flex items-center gap-1.5 ${
                  dossierActiveTab === 'ACTIONS'
                    ? 'border-blue-600 text-blue-700 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                3. Confirmation &amp; Live Stays
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto text-xs">
              {dossierLoading ? (
                <div className="py-16 text-center text-slate-400">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
                  Loading dossier records...
                </div>
              ) : !dossier ? (
                <div className="py-12 text-center text-rose-500">
                  Dossier information could not be loaded.
                </div>
              ) : (
                <>
                  {/* ---------------------------------------------------- */}
                  {/* TAB 1: ARRIVING GROUP & AADHAAR COMPLIANCE           */}
                  {/* ---------------------------------------------------- */}
                  {dossierActiveTab === 'ARRIVALS' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">
                            Arriving Group Members
                          </h4>
                          <p className="text-[11px] text-slate-500">
                            Record actual people presenting at reception. Non-arrived registered members are not forced into records.
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setArrivingGroup([
                              ...arrivingGroup,
                              {
                                fullName: '',
                                gender: 'UNKNOWN',
                                age: null,
                                relationToPrimary: 'Family Member',
                                isPrimary: false,
                              },
                            ]);
                          }}
                          className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-semibold flex items-center gap-1 border border-blue-200 transition"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Arriving Person
                        </button>
                      </div>

                      <div className="space-y-3">
                        {arrivingGroup.map((person, idx) => {
                          const existingParticipant = dossier.registration.participants.find((p) => p.id === person.id);

                          return (
                            <div
                              key={idx}
                              className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3"
                            >
                              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
                                <div>
                                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                                    Full Name {person.isPrimary && '(Primary)'}
                                  </label>
                                  <input
                                    type="text"
                                    value={person.fullName}
                                    onChange={(e) => {
                                      const updated = [...arrivingGroup];
                                      updated[idx].fullName = e.target.value;
                                      setArrivingGroup(updated);
                                    }}
                                    placeholder="Guest full name"
                                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                                    Individual Phone
                                  </label>
                                  <input
                                    type="tel"
                                    value={person.phone || ''}
                                    onChange={(e) => {
                                      const updated = [...arrivingGroup];
                                      updated[idx].phone = e.target.value;
                                      setArrivingGroup(updated);
                                    }}
                                    placeholder="Mobile number"
                                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                                    Gender
                                  </label>
                                  <select
                                    value={person.gender || 'UNKNOWN'}
                                    onChange={(e) => {
                                      const updated = [...arrivingGroup];
                                      updated[idx].gender = e.target.value as any;
                                      setArrivingGroup(updated);
                                    }}
                                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  >
                                    <option value="UNKNOWN">Unknown</option>
                                    <option value="MALE">Male (M)</option>
                                    <option value="FEMALE">Female (F)</option>
                                    <option value="OTHER">Other</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                                    Relationship
                                  </label>
                                  <input
                                    type="text"
                                    value={person.relationToPrimary || ''}
                                    onChange={(e) => {
                                      const updated = [...arrivingGroup];
                                      updated[idx].relationToPrimary = e.target.value;
                                      setArrivingGroup(updated);
                                    }}
                                    placeholder="e.g. Spouse, Son, Self"
                                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                </div>
                              </div>

                              {/* Aadhaar status & remove action */}
                              <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-[11px]">
                                <div>
                                  {existingParticipant?.maskedAadhaar ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono font-bold">
                                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                      Aadhaar: {existingParticipant.maskedAadhaar}
                                    </span>
                                  ) : person.id ? (
                                    <button
                                      onClick={() => {
                                        setAadhaarParticipant({ id: person.id!, fullName: person.fullName });
                                        setAadhaarNumber('');
                                        setAadhaarConsent(false);
                                        setAadhaarModalOpen(true);
                                      }}
                                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 hover:bg-amber-200 transition font-semibold"
                                    >
                                      <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                                      Collect Aadhaar Proof
                                    </button>
                                  ) : (
                                    <span className="text-slate-400 italic">Save member to collect ID proof</span>
                                  )}
                                </div>

                                {!person.isPrimary && (
                                  <button
                                    onClick={() => {
                                      setArrivingGroup(arrivingGroup.filter((_, i) => i !== idx));
                                    }}
                                    className="text-rose-600 hover:text-rose-800 flex items-center gap-1"
                                  >
                                    <Trash2 className="w-3 h-3" /> Remove
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="pt-2 flex justify-end">
                        <button
                          onClick={handleSaveArrivingGroup}
                          disabled={actionLoading}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                          Save Arriving Group
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ---------------------------------------------------- */}
                  {/* TAB 2: UNIT & BED MAPPING                            */}
                  {/* ---------------------------------------------------- */}
                  {dossierActiveTab === 'ASSIGNMENTS' && (
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">
                          Participant-to-Unit Bed Mapping
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Assign each verified arriving member to one of the reserved physical beds or mats.
                        </p>
                      </div>

                      <div className="space-y-3">
                        {dossier.registration.participants.map((participant) => {
                          const currentUnitId = unitAssignments[participant.id] || '';

                          return (
                            <div
                              key={participant.id}
                              className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div>
                                <p className="font-bold text-slate-900 text-sm">
                                  {participant.fullName}
                                  {participant.isPrimary && (
                                    <span className="ml-2 px-2 py-0.5 rounded text-[10px] bg-blue-100 text-blue-800 font-semibold">
                                      Primary
                                    </span>
                                  )}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                                  <span>Gender: {participant.gender || 'Unknown'} &bull; Relation: {participant.relationToPrimary || 'Self'}</span>
                                  <span className="text-slate-300">&bull;</span>
                                  <span className="font-mono text-slate-700">Phone: {participant.phone || (participant.isPrimary ? dossier.registration.mobile : 'Not set')}</span>
                                  {canOperateReception && (
                                    <button
                                      type="button"
                                      onClick={() => openPhoneEditModal(participant)}
                                      className="text-blue-600 hover:underline font-semibold"
                                    >
                                      Edit
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                                <div className="w-full sm:w-64">
                                  <select
                                    value={currentUnitId}
                                    onChange={(e) => {
                                      setUnitAssignments({
                                        ...unitAssignments,
                                        [participant.id]: e.target.value,
                                      });
                                    }}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  >
                                    <option value="">-- Select Allocated Bed/Mat --</option>
                                    {dossier.activeAllocation?.items.map((item: any) => (
                                      <option key={item.unit.id} value={item.unit.id}>
                                        Room {item.unit.room.roomNumber} ({item.unit.room.building || 'Main'}) - {item.unit.type === 'MAT' ? 'Mat' : 'Bed'} {item.unit.unitNumber}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                {canOperateReception && (
                                  <button
                                    type="button"
                                    onClick={() => openChangeUnitModal(participant)}
                                    className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0"
                                    title="Switch to another room, bed or mat across entire inventory"
                                  >
                                    <ArrowRightLeft className="w-3.5 h-3.5 text-amber-700" />
                                    <span>Change Room/Bed</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="pt-2 flex justify-between items-center">
                        <span className="text-xs text-slate-500">
                          {Object.keys(unitAssignments).length} of {dossier.registration.participants.length} members mapped to physical units
                        </span>
                        <button
                          onClick={handleConfirmReception}
                          disabled={actionLoading || Object.keys(unitAssignments).length === 0}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                          Confirm Reception Mapping
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ---------------------------------------------------- */}
                  {/* TAB 3: CONFIRMATION & LIVE STAYS                     */}
                  {/* ---------------------------------------------------- */}
                  {dossierActiveTab === 'ACTIONS' && (
                    <div className="space-y-4">
                      {/* Live Stays List */}
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">
                          Live In-House Stays &amp; Access Status
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Physical check-in activation creates live stay records and marks units occupied.
                        </p>
                      </div>

                      <div className="space-y-3">
                        {dossier.registration.participants.map((participant) => {
                          const activeStay = participant.activeStay;

                          return (
                            <div
                              key={participant.id}
                              className={`p-4 rounded-xl border transition ${
                                activeStay
                                  ? 'bg-emerald-50/70 border-emerald-300'
                                  : 'bg-slate-50 border-slate-200'
                              }`}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-900 text-sm">{participant.fullName}</span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                      participant.checkInStatus === 'CHECKED_IN'
                                        ? 'bg-emerald-200 text-emerald-900'
                                        : participant.checkInStatus === 'CONFIRMED'
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-slate-200 text-slate-700'
                                    }`}>
                                      {participant.checkInStatus}
                                    </span>
                                  </div>

                                  {activeStay ? (
                                    <p className="text-xs text-emerald-800 font-medium mt-1">
                                      Occupying: <strong>Room {activeStay.unit?.room?.roomNumber}</strong> ({activeStay.unit?.unitNumber}) &bull; Checked in: {new Date(activeStay.actualCheckIn).toLocaleString()}
                                    </p>
                                  ) : (
                                    <p className="text-xs text-slate-500 mt-1">
                                      Ready for physical check-in activation.
                                    </p>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  {canOperateReception && (
                                    <button
                                      type="button"
                                      onClick={() => openChangeUnitModal(participant)}
                                      className="px-2.5 py-1 bg-white border border-amber-300 hover:bg-amber-50 rounded-lg text-xs font-semibold text-amber-800 flex items-center gap-1 transition shadow-2xs"
                                      title="Change assigned room, bed or mat"
                                    >
                                      <ArrowRightLeft className="w-3.5 h-3.5 text-amber-600" />
                                      <span>Change Unit</span>
                                    </button>
                                  )}

                                  {activeStay ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => openExtendStayModal({
                                          id: activeStay.id,
                                          participant: { fullName: participant.fullName },
                                          unit: (participant as any).assignedUnit || activeStay.unit,
                                          exitDate: activeStay.scheduledExit || (dossier.registration as any).exitDate,
                                        })}
                                        className="px-2.5 py-1 bg-white border border-blue-300 hover:bg-blue-50 rounded-lg text-xs font-semibold text-blue-700 flex items-center gap-1 transition shadow-2xs"
                                        title="Extend stay duration"
                                      >
                                        <Calendar className="w-3.5 h-3.5" />
                                        Extend Stay
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleCheckOut(activeStay.id, participant.fullName)}
                                        className="px-2.5 py-1 bg-white border border-rose-300 hover:bg-rose-50 rounded-lg text-xs font-semibold text-rose-700 flex items-center gap-1 transition shadow-2xs"
                                      >
                                        <LogOut className="w-3.5 h-3.5" />
                                        Check Out
                                      </button>
                                    </>
                                  ) : (
                                    <span className="text-xs text-slate-400 italic">Not checked in</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Execute Group Check-in Button */}
                      {dossier.registration.participants.some((p) => !p.activeStay) && (
                        <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between">
                          <div>
                            <p className="font-bold text-blue-950 text-xs">Execute Physical Check-in</p>
                            <p className="text-[11px] text-blue-800">
                              Activates physical bed occupancy and records timestamps for verified arrivals.
                            </p>
                          </div>
                          <button
                            onClick={handleExecuteCheckIn}
                            disabled={actionLoading}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                            Check In Arriving Members
                          </button>
                        </div>
                      )}

                      {/* Execute Group Check-out Button */}
                      {dossier.registration.participants.some((p) => p.activeStay) && (
                        <div className="p-4 bg-indigo-50/80 border border-indigo-200 rounded-xl flex items-center justify-between">
                          <div>
                            <p className="font-bold text-indigo-950 text-xs">Execute Group Check-Out</p>
                            <p className="text-[11px] text-indigo-800">
                              Check out individual or all currently staying party members and safely release beds back into inventory.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              openGroupCheckoutForRegistration(dossier.registration);
                            }}
                            disabled={actionLoading || groupCheckOutLoading}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs transition flex items-center gap-1.5 disabled:opacity-50 text-xs"
                          >
                            {(actionLoading || groupCheckOutLoading) && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                            <Users className="w-4 h-4" />
                            <span>Select &amp; Check Out Members ({dossier.registration.participants.filter((p) => p.activeStay).length})</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => { setSelectedDossierId(null); setDossier(null); }}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
              >
                Close Desk
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 2: AADHAAR COMPLIANCE & ENCRYPTED COLLECTION                 */}
      {/* ------------------------------------------------------------------ */}
      {aadhaarModalOpen && aadhaarParticipant && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2.5 text-emerald-800">
              <ShieldCheck className="w-6 h-6 text-emerald-600" />
              <h3 className="text-base font-bold text-slate-900">
                Aadhaar Compliance Collection
              </h3>
            </div>

            {/* Statutory Privacy Notice */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-slate-700 text-[11px] leading-relaxed">
              <p className="font-bold text-slate-900">Statutory Notice &amp; Legal Basis:</p>
              <p>
                Aadhaar collection is conducted exclusively for on-site identity verification and statutory guest registration. Plaintext Aadhaar numbers are never stored in the database and are encrypted using AES-256-GCM application-side. Only masked values (XXXX-XXXX-1234) are displayed.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Guest Full Name
                </label>
                <input
                  type="text"
                  disabled
                  value={aadhaarParticipant.fullName}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  12-Digit Aadhaar Number
                </label>
                <div className="relative">
                  <input
                    type={showAadhaarNumber ? 'text' : 'password'}
                    maxLength={12}
                    value={aadhaarNumber}
                    onChange={(e) => setAadhaarNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 12 digits (e.g. 555544443333)"
                    className="w-full pl-3 pr-10 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAadhaarNumber((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 rounded-md transition"
                    aria-label={showAadhaarNumber ? 'Hide Aadhaar number' : 'Show Aadhaar number'}
                    title={showAadhaarNumber ? 'Hide Aadhaar digits' : 'Show Aadhaar digits'}
                  >
                    {showAadhaarNumber ? (
                      <EyeOff className="w-4 h-4 text-emerald-700" />
                    ) : (
                      <Eye className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                </div>
                {aadhaarNumber.length > 0 && (
                  <p className="text-[10px] text-slate-500 font-mono mt-1">
                    Masked preview: XXXX-XXXX-{aadhaarNumber.slice(-4) || '****'}
                  </p>
                )}
              </div>

              {/* Explicit Opt-in Consent */}
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={aadhaarConsent}
                    onChange={(e) => setAadhaarConsent(e.target.checked)}
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-[11px] text-amber-950 font-medium leading-tight">
                    Participant has voluntarily presented this document and consented to statutory identity verification.
                  </span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setAadhaarModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAadhaar}
                disabled={actionLoading || aadhaarNumber.length !== 12 || !aadhaarConsent}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Encrypt &amp; Save Aadhaar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 3: CHANGE ASSIGNED ROOM / BED / MAT (Pre & Post Check-In)     */}
      {/* Supports Single or Multiple Persons transfer, Hotel filter, Room Search */}
      {/* ------------------------------------------------------------------ */}
      {changeModalOpen && changeGroupInfo && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 my-6 flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500 rounded-lg text-white">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Change Assigned Room / Bed / Mat</h3>
                  <p className="text-[11px] text-slate-400">
                    Transfer single or multiple party members across hotels, buildings, and rooms safely
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setChangeModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              {/* REGISTRATION GROUP BANNER */}
              <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider">
                      Registration Group
                    </span>
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white border border-amber-300 text-slate-900">
                      {changeGroupInfo.displayRegId}
                    </span>
                  </div>
                  <p className="font-bold text-slate-900 text-sm mt-0.5">
                    {changeGroupInfo.primaryName}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Phone: <span className="font-mono font-medium">{changeGroupInfo.mobile || 'Not provided'}</span> &bull; Total Party Size: <strong>{changeGroupInfo.totalMembers} Persons</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => {
                      const allKeys = changeMembers.map((m) => m.key);
                      setSelectedMemberKeys(allKeys);
                      if (allKeys.length > 0) setActiveAssigningKey(allKeys[0]);
                    }}
                    className="px-2.5 py-1 text-xs font-bold bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg shadow-2xs transition"
                  >
                    Select All ({changeMembers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMemberKeys([]);
                      setActiveAssigningKey(null);
                      setMemberTargetMap({});
                    }}
                    className="px-2.5 py-1 text-xs font-semibold bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg shadow-2xs transition"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* MEMBERS SELECTION LIST (SINGLE OR MULTIPLE PERSONS) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-700">
                  <span className="font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    Assigned Party Members ({selectedMemberKeys.length} of {changeMembers.length} Selected):
                  </span>
                  <span className="text-[11px] text-slate-500 italic">
                    Check the box for each member you want to transfer
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {changeMembers.map((member) => {
                    const isSelected = selectedMemberKeys.includes(member.key);
                    const target = memberTargetMap[member.key];
                    const isActiveTarget = activeAssigningKey === member.key;

                    return (
                      <div
                        key={member.key}
                        onClick={() => {
                          if (!isSelected) {
                            setSelectedMemberKeys([...selectedMemberKeys, member.key]);
                            setActiveAssigningKey(member.key);
                          } else {
                            setActiveAssigningKey(member.key);
                          }
                        }}
                        className={`p-3 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                          isActiveTarget
                            ? 'bg-amber-50/90 border-amber-400 ring-2 ring-amber-300 shadow-sm'
                            : isSelected
                            ? 'bg-blue-50/70 border-blue-300 shadow-2xs'
                            : 'bg-white border-slate-200 hover:bg-slate-50 opacity-80'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                e.stopPropagation();
                                if (e.target.checked) {
                                  setSelectedMemberKeys([...selectedMemberKeys, member.key]);
                                  setActiveAssigningKey(member.key);
                                } else {
                                  setSelectedMemberKeys(selectedMemberKeys.filter((k) => k !== member.key));
                                  if (activeAssigningKey === member.key) {
                                    setActiveAssigningKey(selectedMemberKeys.find((k) => k !== member.key) || null);
                                  }
                                  const copy = { ...memberTargetMap };
                                  delete copy[member.key];
                                  setMemberTargetMap(copy);
                                }
                              }}
                              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                            />
                            <div>
                              <p className="font-bold text-xs text-slate-900 leading-tight">
                                {member.fullName} {member.isPrimary && <span className="text-[10px] text-blue-600 font-bold">(Primary)</span>}
                              </p>
                              <p className="text-[10px] text-slate-500">
                                {member.gender || 'Any'} &bull; {member.phone || 'No phone'}
                              </p>
                            </div>
                          </div>

                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            member.stage === 'CHECKED_IN' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {member.stage === 'CHECKED_IN' ? 'Checked-In' : 'Pre-Arrival'}
                          </span>
                        </div>

                        {/* Current vs Target Assignment */}
                        <div className="mt-2 pt-2 border-t border-slate-200/80 text-[11px] space-y-1">
                          <div className="flex items-center justify-between text-slate-600">
                            <span className="text-[10px] text-slate-400 uppercase font-semibold">Current:</span>
                            <span className="font-mono font-bold text-slate-800 text-right">
                              Room {member.currentRoomNumber} &bull; {member.currentUnitType} {member.currentUnitNumber}
                              <span className="text-[9px] font-sans font-normal text-slate-500 block">({member.currentHotelName || 'Main'})</span>
                            </span>
                          </div>

                          {target ? (
                            <div className="flex items-center justify-between p-1.5 bg-emerald-50 rounded border border-emerald-200 text-emerald-900 font-semibold text-[11px]">
                              <div>
                                <span className="text-[10px] uppercase font-bold text-emerald-700 mr-1">Target:</span>
                                <span className="font-mono font-bold">
                                  Room {target.roomNumber} &bull; {target.unitType} {target.unitNumber}
                                </span>
                                <span className="text-[9px] font-sans font-normal text-emerald-700 block">({target.hotelName})</span>
                              </div>
                              <button
                                type="button"
                                title="Remove target assignment"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMemberTargetMap((prev) => {
                                    const copy = { ...prev };
                                    delete copy[member.key];
                                    return copy;
                                  });
                                  setActiveAssigningKey(member.key);
                                }}
                                className="px-1.5 py-0.5 text-[10px] font-bold text-rose-600 hover:text-rose-800 hover:bg-rose-100 rounded transition shrink-0 ml-1.5"
                              >
                                ✕ Clear
                              </button>
                            </div>
                          ) : isSelected ? (
                            <p className={`text-[10px] font-medium text-right ${isActiveTarget ? 'text-amber-800 font-bold' : 'text-slate-400 italic'}`}>
                              {isActiveTarget ? '👈 Selecting Bed Below' : 'Pending Selection'}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SEARCH & FILTER CONTROLS (HOTEL SELECTOR, ROOM SEARCH, CATEGORY, UNIT TYPE) */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                    Destination Inventory Filters
                  </span>
                  {changeAvailabilityLoading && (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  {/* Hotel / Property Filter */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <Building className="w-3 h-3 text-blue-600" />
                      Destination Hotel / Property
                    </label>
                    <select
                      value={changeHotelFilter}
                      onChange={(e) => {
                        const newHotel = e.target.value;
                        setChangeHotelFilter(newHotel);
                        fetchChangeAvailabilityRooms(
                          changeGroupInfo?.entryDate,
                          changeGroupInfo?.exitDate,
                          newHotel,
                          changeCategoryFilter,
                          changeTypeFilter
                        );
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="ALL">All Hotels &amp; Buildings</option>
                      {/* Available Hotel & Building Options */}
                      {(() => {
                        const propertyOptions: Array<{ value: string; label: string }> = [];
                        const seen = new Set<string>();

                        hotels.forEach((h) => {
                          seen.add(h.id.toLowerCase());
                          seen.add(h.name.toLowerCase());
                          propertyOptions.push({ value: h.id, label: h.name });
                        });

                        changeAvailableRooms.forEach((r) => {
                          const b = (r.building || '').trim();
                          if (b && !seen.has(b.toLowerCase())) {
                            seen.add(b.toLowerCase());
                            propertyOptions.push({ value: b, label: b });
                          }
                          const hn = (r.hotelName || '').trim();
                          if (hn && !seen.has(hn.toLowerCase())) {
                            seen.add(hn.toLowerCase());
                            propertyOptions.push({ value: hn, label: hn });
                          }
                        });

                        return propertyOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ));
                      })()}
                    </select>
                  </div>

                  {/* Room Search Box */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <Search className="w-3 h-3 text-blue-600" />
                      Search Room Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 104, 105, 1..."
                      value={changeRoomSearchQuery}
                      onChange={(e) => setChangeRoomSearchQuery(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>

                  {/* Room Category Filter */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Category Filter
                    </label>
                    <div className="grid grid-cols-5 gap-1">
                      {(['ANY', 'MALE', 'FEMALE', 'FAMILY', 'GUEST'] as GenderPreference[]).map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            setChangeCategoryFilter(cat);
                            fetchChangeAvailabilityRooms(
                              changeGroupInfo?.entryDate,
                              changeGroupInfo?.exitDate,
                              changeHotelFilter,
                              cat,
                              changeTypeFilter
                            );
                          }}
                          className={`py-1.5 px-1 rounded-lg text-[10px] font-bold border text-center transition ${
                            changeCategoryFilter === cat
                              ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {cat === 'ANY' ? 'All' : cat.slice(0, 4)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Unit Type Filter (Bed vs Mat) */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Unit Type
                    </label>
                    <div className="grid grid-cols-3 gap-1">
                      {(['ALL', 'BED', 'MAT'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            setChangeTypeFilter(t);
                            fetchChangeAvailabilityRooms(
                              changeGroupInfo?.entryDate,
                              changeGroupInfo?.exitDate,
                              changeHotelFilter,
                              changeCategoryFilter,
                              t
                            );
                          }}
                          className={`py-1.5 px-1.5 rounded-lg text-[10px] font-bold border text-center transition ${
                            changeTypeFilter === t
                              ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {t === 'ALL' ? 'All' : t === 'BED' ? '🛏️ Beds' : '🧘 Mats'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* LIVE AVAILABLE ROOMS GRID */}
              <div className="space-y-3">
                {(() => {
                  // Instant Client-Side Filter: Matches Hotel ID, Hotel Name, or Building string
                  const filteredAvailableRooms = changeAvailableRooms.filter((r) => {
                    // 1. Hotel / Property Filter
                    if (changeHotelFilter !== 'ALL') {
                      const selectedHotel = hotels.find((h) => h.id === changeHotelFilter);
                      const targetName = (selectedHotel?.name || changeHotelFilter).toLowerCase().trim();
                      const matchesId = r.hotelId === changeHotelFilter;
                      const matchesHotelName = (r.hotelName || '').toLowerCase().trim().includes(targetName) ||
                                               (r.hotel?.name || '').toLowerCase().trim().includes(targetName);
                      const matchesBuilding = (r.building || '').toLowerCase().trim().includes(targetName);
                      if (!matchesId && !matchesHotelName && !matchesBuilding) return false;
                    }

                    // 2. Room Category Filter
                    if (changeCategoryFilter !== 'ANY') {
                      if (r.genderPreference !== changeCategoryFilter) return false;
                    }

                    // 3. Unit Type Filter
                    if (changeTypeFilter === 'BED') {
                      const availBeds = r.availableBeds ?? r.units?.filter((u: any) => u.isAvailable && u.type === 'BED').length;
                      if (availBeds <= 0) return false;
                    } else if (changeTypeFilter === 'MAT') {
                      const availMats = r.availableMats ?? r.units?.filter((u: any) => u.isAvailable && u.type === 'MAT').length;
                      if (availMats <= 0) return false;
                    }

                    // 4. Room Search Box (matches room number, building, or hotel name)
                    if (changeRoomSearchQuery.trim()) {
                      const q = changeRoomSearchQuery.toLowerCase().trim();
                      const matchesNum = r.roomNumber.toLowerCase().includes(q);
                      const matchesH = (r.hotelName || '').toLowerCase().includes(q);
                      const matchesB = (r.building || '').toLowerCase().includes(q);
                      if (!matchesNum && !matchesH && !matchesB) return false;
                    }

                    return true;
                  });

                  // Group rooms by Property / Building when viewing multiple properties
                  const groupedByProperty: Record<string, any[]> = {};
                  filteredAvailableRooms.forEach((r) => {
                    const key = r.hotelName || r.building || r.hotel?.name || 'Main Property';
                    if (!groupedByProperty[key]) groupedByProperty[key] = [];
                    groupedByProperty[key].push(r);
                  });
                  const propertyKeys = Object.keys(groupedByProperty);

                  const renderRoomCard = (room: any) => {
                    const availBeds = room.availableBeds ?? room.units.filter((u: any) => u.isAvailable && u.type === 'BED').length;
                    const availMats = room.availableMats ?? room.units.filter((u: any) => u.isAvailable && u.type === 'MAT').length;
                    const hasAvailableUnits = (room.availableCount ?? 0) > 0 || (availBeds + availMats) > 0;

                    return (
                      <div
                        key={room.id}
                        className={`p-3 rounded-xl border transition ${
                          hasAvailableUnits ? 'bg-white border-slate-200 shadow-2xs' : 'bg-slate-50 border-slate-200 opacity-60'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-sm text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                              Room {room.roomNumber}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-200 flex items-center gap-1">
                              <Building className="w-3 h-3 text-blue-700" />
                              <span>{room.hotelName || room.hotel?.name || room.building || 'Main Property'}</span>
                            </span>
                            {room.building && room.building !== (room.hotelName || room.hotel?.name) && (
                              <span className="text-[11px] text-slate-600 font-semibold">
                                &bull; {room.building}
                              </span>
                            )}
                            <span className="text-[11px] text-slate-500 font-medium">
                              &bull; Floor {room.floor ?? '-'}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                              {room.genderPreference}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[11px]">
                            <span className="font-semibold text-blue-700">
                              🛏️ {availBeds} Bed(s) Free
                            </span>
                            <span className="text-slate-300">&bull;</span>
                            <span className="font-semibold text-emerald-700">
                              🧘 {availMats} Mat(s) Free
                            </span>

                            {/* Quick Auto-Assign Selected Members Button */}
                            {selectedMemberKeys.length > 1 && (availBeds + availMats) >= selectedMemberKeys.length && (
                              <button
                                type="button"
                                onClick={() => handleAutoAssignRoomToSelected(room)}
                                className="ml-2 px-2 py-1 text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition shadow-2xs"
                                title={`Assign ${selectedMemberKeys.length} selected members to Room ${room.roomNumber}`}
                              >
                                Assign Selected Here
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Unit Buttons */}
                        <div className="flex flex-wrap gap-1.5">
                          {room.units.map((unit: any) => {
                            // Check if this unit is currently assigned to one of our party members
                            const currentPartyMember = changeMembers.find((m) => m.currentUnitId === unit.id);
                            const isCurrent = Boolean(currentPartyMember);

                            // Check if this unit is selected as target for one of our members
                            const assignedToMemberKey = Object.keys(memberTargetMap).find(
                              (k) => memberTargetMap[k].unitId === unit.id
                            );
                            const assignedMember = assignedToMemberKey
                              ? changeMembers.find((m) => m.key === assignedToMemberKey)
                              : null;
                            const isTargetSelected = Boolean(assignedMember);

                            const isAvailable = unit.isAvailable && !isCurrent;
                            const isBed = unit.type === 'BED';

                            return (
                              <button
                                key={unit.id}
                                type="button"
                                disabled={!isAvailable && !isTargetSelected}
                                onClick={() => {
                                  if (isTargetSelected) {
                                    // unassign
                                    const copy = { ...memberTargetMap };
                                    delete copy[assignedToMemberKey!];
                                    setMemberTargetMap(copy);
                                  } else if (activeAssigningKey) {
                                    handleSelectUnitForMember(activeAssigningKey, unit, room);
                                  } else if (selectedMemberKeys.length > 0) {
                                    handleSelectUnitForMember(selectedMemberKeys[0], unit, room);
                                  } else {
                                    setErrorMessage('Please select a member above first.');
                                  }
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 ${
                                  isTargetSelected
                                    ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400'
                                    : isCurrent
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300 cursor-not-allowed opacity-75'
                                    : isAvailable
                                    ? isBed
                                      ? 'bg-blue-50 text-blue-900 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 cursor-pointer'
                                      : 'bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 cursor-pointer'
                                    : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-50'
                                }`}
                              >
                                <span>{isBed ? '🛏️' : '🧘'} {unit.unitNumber}</span>
                                {isTargetSelected && (
                                  <span className="text-[10px] font-sans font-medium text-emerald-100 flex items-center gap-0.5">
                                    <Check className="w-3 h-3" />
                                    {assignedMember?.fullName.split(' ')[0]}
                                  </span>
                                )}
                                {isCurrent && (
                                  <span className="text-[9px] font-sans font-normal">(Current)</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  };

                  return (
                    <>
                      <div className="flex items-center justify-between text-xs text-slate-700">
                        <span className="font-bold uppercase tracking-wider block">
                          Select Destination Bed or Mat ({filteredAvailableRooms.length} Compatible Rooms):
                        </span>
                        {activeAssigningKey && (
                          <span className="text-[11px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                            Currently Assigning: <strong>{changeMembers.find((m) => m.key === activeAssigningKey)?.fullName}</strong>
                          </span>
                        )}
                      </div>

                      {filteredAvailableRooms.length === 0 ? (
                        <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-xs">
                          {changeAvailabilityLoading ? (
                            <p>Searching inventory for available units...</p>
                          ) : (
                            <p>No available units found matching the selected hotel, room number, or category filters.</p>
                          )}
                        </div>
                      ) : propertyKeys.length > 1 && changeHotelFilter === 'ALL' ? (
                        // Grouped property sections when viewing All Buildings / Hotels
                        <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
                          {propertyKeys.map((propName) => (
                            <div key={propName} className="space-y-2">
                              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800 sticky top-0 z-10 backdrop-blur-xs">
                                <div className="flex items-center gap-1.5">
                                  <Building className="w-4 h-4 text-blue-600" />
                                  <span>{propName}</span>
                                </div>
                                <span className="text-[11px] font-medium text-slate-500">
                                  {groupedByProperty[propName].length} room{groupedByProperty[propName].length !== 1 ? 's' : ''} available
                                </span>
                              </div>
                              <div className="space-y-2.5">
                                {groupedByProperty[propName].map(renderRoomCard)}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                          {filteredAvailableRooms.map(renderRoomCard)}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* DESTINATION SELECTION SUMMARY */}
              {Object.keys(memberTargetMap).length > 0 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1.5 text-xs text-blue-950 font-medium">
                  <div className="flex items-center justify-between font-bold text-blue-900 border-b border-blue-200/80 pb-1">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                      Pending Destination Mappings ({Object.keys(memberTargetMap).length} Member(s)):
                    </span>
                    <span className="text-emerald-700 font-bold">Ready to Transfer</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                    {Object.entries(memberTargetMap).map(([key, target]) => {
                      const m = changeMembers.find((mem) => mem.key === key);
                      return (
                        <div key={key} className="flex items-center justify-between p-1.5 bg-white rounded border border-blue-200 text-[11px]">
                          <span>
                            <strong>{m?.fullName}</strong>: Room {m?.currentRoomNumber} &rarr;{' '}
                            <strong className="text-blue-700">Room {target.roomNumber} ({target.unitType} {target.unitNumber})</strong>
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">({target.hotelName})</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* REASON INPUT */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Reason for Unit Change <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  placeholder="e.g. Guest requested Bed instead of Mat, room reassignment, inter-hotel transfer"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-600 font-medium">
                {Object.keys(memberTargetMap).length === selectedMemberKeys.length ? (
                  <span className="text-emerald-700 font-bold">✓ All {selectedMemberKeys.length} selected guest(s) mapped</span>
                ) : (
                  <span>
                    <strong className="text-amber-800">{Object.keys(memberTargetMap).length}</strong> guest(s) mapped &bull; <span className="text-slate-500 italic">only mapped guests will be transferred</span>
                  </span>
                )}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setChangeModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteBatchChangeUnits}
                  disabled={actionLoading || Object.keys(memberTargetMap).length === 0 || !changeReason.trim()}
                  className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Unit Change ({Object.keys(memberTargetMap).length || 0})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 4: EDIT PARTICIPANT PHONE NUMBER                             */}
      {/* ------------------------------------------------------------------ */}
      {phoneModalOpen && phoneParticipant && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2 text-slate-900">
              <Smartphone className="w-5 h-5 text-blue-600" />
              <h3 className="text-sm font-bold">Update Participant Phone</h3>
            </div>

            <div className="text-xs text-slate-600">
              Update direct phone number for <strong>{phoneParticipant.fullName}</strong>.
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                Phone Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                maxLength={15}
                value={phoneInputVal}
                onChange={(e) => setPhoneInputVal(e.target.value)}
                placeholder="10-digit mobile number"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPhoneModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePhone}
                disabled={actionLoading || !phoneInputVal.trim()}
                className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Save Phone
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL: EXTEND STAY DURATION                                        */}
      {/* ------------------------------------------------------------------ */}
      {extendStayModalOpen && extendStayTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Extend Guest Stay</h3>
                  <p className="text-[11px] text-slate-500">Update scheduled departure date and retain current unit</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExtendStayModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Guest Name:</span>
                <strong className="text-slate-900">{extendStayTarget.participantName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Assigned Unit:</span>
                <span className="font-mono font-bold text-slate-800">
                  Room {extendStayTarget.roomNumber} &bull; {extendStayTarget.unitType} {extendStayTarget.unitNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Hotel / Building:</span>
                <span className="text-slate-700 font-medium">{extendStayTarget.hotelName}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200">
                <span className="text-slate-500">Current Exit Date:</span>
                <span className="font-semibold text-rose-600">
                  {extendStayTarget.currentExitDate ? new Date(extendStayTarget.currentExitDate).toLocaleDateString() : '—'}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                  New Checkout Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={extendStayNewDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setExtendStayNewDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                  Extension Reason / Notes
                </label>
                <input
                  type="text"
                  value={extendStayNotes}
                  onChange={(e) => setExtendStayNotes(e.target.value)}
                  placeholder="e.g. Guest requested additional night"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setExtendStayModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteExtendStay}
                disabled={extendStayLoading || !extendStayNewDate}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {extendStayLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Confirm Stay Extension
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* WALK-IN REGISTRATION & LIVE ROOM AVAILABILITY ALLOCATION MODAL       */}
      {/* ------------------------------------------------------------------ */}
      {isWalkInOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 my-6 flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-600 rounded-lg text-white">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Walk-In Registration &amp; Live Room Allocation</h3>
                  <p className="text-[11px] text-slate-400">Search live room availability, manually pick beds/mats across rooms, and check in guests</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsWalkInOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
              {/* SECTION 1: SEARCH & COMPATIBILITY FILTERS */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                    1. Live Room Availability Search Filters
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Select criteria to query compatible rooms with available beds/mats
                  </span>
                </div>

                {/* Criteria Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {/* Category Selector */}
                  <div className="lg:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Room Category *
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setWalkInCategory('MALE')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition text-center ${
                          walkInCategory === 'MALE'
                            ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        👦 Male
                      </button>
                      <button
                        type="button"
                        onClick={() => setWalkInCategory('FEMALE')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition text-center ${
                          walkInCategory === 'FEMALE'
                            ? 'bg-pink-600 text-white border-pink-700 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        👩 Female
                      </button>
                      <button
                        type="button"
                        onClick={() => setWalkInCategory('FAMILY')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition text-center ${
                          walkInCategory === 'FAMILY'
                            ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        👨‍👩‍👧 Family
                      </button>
                      <button
                        type="button"
                        onClick={() => setWalkInCategory('GUEST')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition text-center ${
                          walkInCategory === 'GUEST'
                            ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        🌟 Guest
                      </button>
                    </div>
                  </div>

                  {/* Unit Type Filter */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Unit Type
                    </label>
                    <select
                      value={walkInUnitType}
                      onChange={(e) => setWalkInUnitType(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="ALL">All (Beds &amp; Mats)</option>
                      <option value="BED">🛏️ Beds Only</option>
                      <option value="MAT">🧘 Mats Only</option>
                    </select>
                  </div>

                  {/* Check-In Date */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Check-In Date *
                    </label>
                    <input
                      type="date"
                      value={walkInEntryDate}
                      onChange={(e) => setWalkInEntryDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  {/* Planned Check-Out Date */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Planned Check-Out *
                    </label>
                    <input
                      type="date"
                      value={walkInExitDate}
                      onChange={(e) => setWalkInExitDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: LIVE AVAILABLE ROOMS & MANUAL UNIT SELECTION */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <Bed className="w-4 h-4 text-blue-600" />
                      2. Available Rooms &amp; Units ({availableRooms.length} Compatible Rooms Found)
                    </span>
                    {availabilityLoading && (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Click any available bed or mat to manually distribute participants
                  </span>
                </div>

                {availableRooms.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-xs">
                    {availabilityLoading ? (
                      <p>Searching inventory for {walkInCategory} rooms...</p>
                    ) : (
                      <p>No compatible {walkInCategory} rooms found with available units for these dates.</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {availableRooms.map((room) => {
                      const availBeds = room.availableBeds ?? room.units.filter((u) => u.isAvailable && u.type === 'BED').length;
                      const availMats = room.availableMats ?? room.units.filter((u) => u.isAvailable && u.type === 'MAT').length;
                      const hasAvailableUnits = room.availableCount > 0;

                      return (
                        <div
                          key={room.id}
                          className={`p-3.5 rounded-xl border transition ${
                            hasAvailableUnits
                              ? 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                              : 'bg-slate-50/70 border-slate-200/60 opacity-60'
                          }`}
                        >
                          {/* Room Header with Category & Available Breakdown */}
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-sm text-slate-900">
                                Room {room.roomNumber}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                                {room.building || 'Main'} &bull; Floor {room.floor ?? 1}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                room.genderPreference === 'MALE'
                                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                  : room.genderPreference === 'FEMALE'
                                  ? 'bg-pink-100 text-pink-800 border border-pink-200'
                                  : room.genderPreference === 'FAMILY'
                                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                  : 'bg-amber-100 text-amber-800 border border-amber-200'
                              }`}>
                                {room.genderPreference} Room
                              </span>
                            </div>

                            {/* Quantities in Room */}
                            <div className="flex items-center gap-2 text-xs">
                              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-bold border border-emerald-200 text-[11px]">
                                🛏️ {availBeds} Bed{availBeds === 1 ? '' : 's'} Avail
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-bold border border-emerald-200 text-[11px]">
                                🧘 {availMats} Mat{availMats === 1 ? '' : 's'} Avail
                              </span>
                              <span className="text-slate-500 text-[11px] font-medium">
                                ({room.availableCount}/{room.totalUnitsInRoom} Total)
                              </span>
                            </div>
                          </div>

                          {/* Individual Units in Room */}
                          <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 gap-2">
                            {room.units.map((unit) => {
                              const isSelected = selectedWalkInUnits.some((u) => u.unitId === unit.id);
                              const isBed = unit.type === 'BED';

                              return (
                                <button
                                  type="button"
                                  key={unit.id}
                                  disabled={!unit.isAvailable}
                                  onClick={() => handleToggleWalkInUnit(room, unit)}
                                  className={`p-2 rounded-lg text-xs font-mono font-bold flex flex-col items-center justify-between gap-1 transition ${
                                    isSelected
                                      ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-400 scale-95'
                                      : unit.isAvailable
                                      ? 'bg-emerald-50 text-emerald-950 border border-emerald-300 hover:bg-emerald-100 hover:border-emerald-500 cursor-pointer shadow-xs'
                                      : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-50'
                                  }`}
                                  title={`${unit.unitNumber} (${unit.type}): ${unit.state}`}
                                >
                                  <div className="flex items-center gap-1 w-full justify-between">
                                    <span className="text-[11px] truncate">{unit.unitNumber}</span>
                                    {isSelected ? (
                                      <Check className="w-3 h-3 text-white" />
                                    ) : isBed ? (
                                      <Bed className="w-3 h-3 opacity-60" />
                                    ) : (
                                      <Layers className="w-3 h-3 opacity-60" />
                                    )}
                                  </div>
                                  <span className="text-[9px] font-sans font-medium uppercase opacity-75">
                                    {unit.type}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SECTION 3: SELECTED UNITS BASKET & GUEST DETAILS */}
              <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-200/80 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">
                      {selectedWalkInUnits.length}
                    </span>
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                      Selected Units Across Rooms:
                    </span>
                  </div>

                  {selectedWalkInUnits.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedWalkInUnits([])}
                      className="text-[11px] text-rose-600 font-bold hover:underline"
                    >
                      Clear Selection
                    </button>
                  )}
                </div>

                {/* Selected Unit Chips (Multi-Room Flexible Allocation Display) */}
                {selectedWalkInUnits.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">
                    No units selected yet. Click any available bed or mat above to manually allocate (e.g. 1 bed in Room 101, 1 mat in Room 102).
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {selectedWalkInUnits.map((u, idx) => (
                      <span
                        key={u.unitId}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold bg-white text-blue-900 border border-blue-300 shadow-xs"
                      >
                        <span>Person {idx + 1}: Room {u.roomNumber} &bull; {u.unitType} {u.unitNumber}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedWalkInUnits(selectedWalkInUnits.filter((x) => x.unitId !== u.unitId))}
                          className="text-slate-400 hover:text-rose-600 ml-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Primary Guest Details Form */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Primary Guest Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Chandra"
                      value={walkInName}
                      onChange={(e) => setWalkInName(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      10-Digit Mobile Number *
                    </label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      placeholder="e.g. 9876543210"
                      value={walkInMobile}
                      onChange={(e) => setWalkInMobile(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Aadhaar Number (Optional)
                    </label>
                    <input
                      type="text"
                      maxLength={12}
                      placeholder="12-digit Aadhaar"
                      value={walkInAadhaar}
                      onChange={(e) => setWalkInAadhaar(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      City / Town (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Varanasi, Patna"
                      value={walkInCity}
                      onChange={(e) => setWalkInCity(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Accompanying Companions for Multi-Unit Booking */}
                {selectedWalkInUnits.length > 1 && (
                  <div className="pt-2 border-t border-blue-200/70 space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block">
                      Accompanying Group Members (Beds/Mats 2 to {selectedWalkInUnits.length}):
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-36 overflow-y-auto pr-1">
                      {selectedWalkInUnits.slice(1).map((u, idx) => (
                        <div
                          key={u.unitId}
                          className="p-2.5 bg-white border border-slate-200 rounded-lg text-xs space-y-1.5 shadow-xs"
                        >
                          <div className="flex items-center justify-between font-mono font-bold text-[11px] text-blue-900">
                            <span>Person {idx + 2}: Room {u.roomNumber} &bull; {u.unitNumber}</span>
                            <span className="text-[10px] text-slate-500 font-sans font-medium">{u.unitType}</span>
                          </div>
                          <div className="grid grid-cols-4 gap-1.5">
                            <input
                              type="text"
                              placeholder={`Guest ${idx + 2} Name`}
                              value={walkInCompanions[idx]?.fullName || ''}
                              onChange={(e) => handleCompanionFieldChange(idx, 'fullName', e.target.value)}
                              className="px-2 py-1 text-xs border border-slate-300 rounded text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <input
                              type="tel"
                              placeholder="Phone"
                              value={walkInCompanions[idx]?.phone || ''}
                              onChange={(e) => handleCompanionFieldChange(idx, 'phone', e.target.value.replace(/\D/g, ''))}
                              className="px-2 py-1 text-xs border border-slate-300 rounded font-mono text-slate-900"
                            />
                            <select
                              value={walkInCompanions[idx]?.gender || (u.roomCategory === 'FEMALE' ? 'FEMALE' : 'MALE')}
                              onChange={(e) => handleCompanionFieldChange(idx, 'gender', e.target.value)}
                              className="px-1.5 py-1 text-xs border border-slate-300 rounded font-semibold text-slate-800"
                            >
                              <option value="MALE">👦 Male</option>
                              <option value="FEMALE">👩 Female</option>
                            </select>
                            <input
                              type="text"
                              maxLength={12}
                              placeholder="Aadhaar"
                              value={walkInCompanions[idx]?.aadhaarNumber || ''}
                              onChange={(e) => handleCompanionFieldChange(idx, 'aadhaarNumber', e.target.value.replace(/\D/g, ''))}
                              className="px-2 py-1 text-xs border border-slate-300 rounded font-mono text-slate-900"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Immediate Check-In Toggle */}
                <label className="flex items-center gap-2 p-2.5 bg-purple-50 hover:bg-purple-100/70 border border-purple-200 rounded-xl cursor-pointer transition">
                  <input
                    type="checkbox"
                    checked={walkInCheckInNow}
                    onChange={(e) => setWalkInCheckInNow(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-purple-950 block">Check In Immediately</span>
                    <span className="text-purple-700 text-[11px]">Mark allocated beds occupied and generate stay records right now</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-xs font-semibold text-slate-600">
                {selectedWalkInUnits.length} unit(s) selected across {new Set(selectedWalkInUnits.map(u => u.roomNumber)).size} room(s)
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsWalkInOpen(false)}
                  className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading || selectedWalkInUnits.length === 0 || !walkInName.trim() || walkInMobile.length < 10}
                  onClick={handleSubmitWalkInAllocation}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 disabled:text-slate-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-md active:scale-95"
                >
                  {actionLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Processing Walk-in...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        {walkInCheckInNow
                          ? `Allocate & Check In ${selectedWalkInUnits.length} Bed/Mat(s)`
                          : `Reserve Allocation (${selectedWalkInUnits.length} Units)`}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* ACCIDENTAL CHECKOUT RECOVERY MODAL (CHECK IN AGAIN)                */}
      {/* ------------------------------------------------------------------ */}
      {isCheckInAgainOpen && recoveryTargetStay && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/20 rounded-xl">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black leading-tight">Accidental Checkout Recovery</h3>
                  <p className="text-xs text-blue-100">Check in guest again reusing original Participant ID</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCheckInAgainOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              {/* Protocol Alert */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Workflow Integrity &amp; Accidental Recovery Protocol</p>
                  <p className="mt-0.5 text-blue-800 leading-relaxed">
                    This guest was checked out. Checking in again reuses the <strong>exact same participant record</strong> (ID: {recoveryTargetStay.participant?.id?.slice(0, 8)}...) and registration. The previous checkout record is strictly preserved in history.
                  </p>
                </div>
              </div>

              {/* Guest Profile Summary */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Guest Name</span>
                  <span className="font-bold text-slate-900">{recoveryTargetStay.participant?.fullName}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Phone</span>
                  <span className="font-mono font-bold text-slate-900">{recoveryTargetStay.participant?.phone || recoveryTargetStay.registration?.mobile || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Registration ID</span>
                  <span className="font-mono font-bold text-blue-800">{recoveryTargetStay.registration?.registrationId}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Previous Checkout</span>
                  <span className="text-slate-600 font-medium">
                    {recoveryTargetStay.actualCheckOut ? new Date(recoveryTargetStay.actualCheckOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                  </span>
                </div>
              </div>

              {/* Filters Toolbar Directly Above Room & Bed Selection */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wide">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                    <span>Room &amp; Unit Filters</span>
                  </div>
                  {(recoveryBuildingFilter !== 'ALL' || recoveryRoomSearch || recoveryGenderFilter !== 'ALL' || recoveryUnitTypeFilter !== 'ALL' || recoveryAvailabilityFilter !== 'AVAILABLE_ONLY') && (
                    <button
                      type="button"
                      onClick={() => {
                        setRecoveryBuildingFilter('ALL');
                        setRecoveryRoomSearch('');
                        setRecoveryGenderFilter('ALL');
                        setRecoveryUnitTypeFilter('ALL');
                        setRecoveryAvailabilityFilter('ALL');
                      }}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Clear Filters</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                  {/* A. Search Room Number Filter */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={recoveryRoomSearch}
                      onChange={(e) => setRecoveryRoomSearch(e.target.value)}
                      placeholder="Search Room #..."
                      className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1.5 focus:ring-blue-500 font-medium"
                    />
                    {recoveryRoomSearch && (
                      <button
                        type="button"
                        onClick={() => setRecoveryRoomSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                        aria-label="Clear room search"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* B. Building Name Filter */}
                  <div>
                    <select
                      value={recoveryBuildingFilter}
                      onChange={(e) => setRecoveryBuildingFilter(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:ring-1.5 focus:ring-blue-500"
                    >
                      <option value="ALL">🏢 All Buildings</option>
                      {recoveryAvailableBuildings.map((b) => (
                        <option key={b} value={b}>🏢 {b}</option>
                      ))}
                    </select>
                  </div>

                  {/* C. Gender Filter */}
                  <div className="flex items-center rounded-lg bg-slate-200/80 p-0.5 text-xs">
                    {(['ALL', 'MALE', 'FEMALE'] as const).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setRecoveryGenderFilter(g)}
                        className={`flex-1 py-1 text-[11px] font-bold rounded-md transition text-center ${
                          recoveryGenderFilter === g
                            ? 'bg-white text-blue-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {g === 'ALL' ? 'All' : g === 'MALE' ? 'Male' : 'Female'}
                      </button>
                    ))}
                  </div>

                  {/* D. Unit Type Filter */}
                  <div className="flex items-center rounded-lg bg-slate-200/80 p-0.5 text-xs">
                    {(['ALL', 'BED', 'MAT'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setRecoveryUnitTypeFilter(t)}
                        className={`flex-1 py-1 text-[11px] font-bold rounded-md transition text-center ${
                          recoveryUnitTypeFilter === t
                            ? 'bg-white text-blue-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {t === 'ALL' ? 'All' : t === 'BED' ? '🛏️ Bed' : '🧘 Mat'}
                      </button>
                    ))}
                  </div>

                  {/* E. Availability Filter */}
                  <div className="flex items-center rounded-lg bg-slate-200/80 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setRecoveryAvailabilityFilter('AVAILABLE_ONLY')}
                      className={`flex-1 py-1 text-[11px] font-bold rounded-md transition text-center ${
                        recoveryAvailabilityFilter === 'AVAILABLE_ONLY'
                          ? 'bg-white text-blue-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Available Only
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecoveryAvailabilityFilter('ALL')}
                      className={`flex-1 py-1 text-[11px] font-bold rounded-md transition text-center ${
                        recoveryAvailabilityFilter === 'ALL'
                          ? 'bg-white text-blue-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All Units
                    </button>
                  </div>
                </div>

                {/* Active Selection Indicator (when hidden by active filters) */}
                {selectedRecoveryUnitInfo && !selectedRecoveryUnitInfo.isVisible && (
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-xs text-amber-900">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Check className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      <span className="truncate">
                        Selected: <strong>Room {selectedRecoveryUnitInfo.room.roomNumber} ({selectedRecoveryUnitInfo.room.genderPreference})</strong> &bull; {selectedRecoveryUnitInfo.unit.type === 'BED' ? 'Bed' : 'Mat'} {selectedRecoveryUnitInfo.unit.unitNumber} <span className="opacity-75">(Hidden by current filters)</span>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setRecoveryBuildingFilter('ALL');
                        setRecoveryRoomSearch('');
                        setRecoveryGenderFilter('ALL');
                        setRecoveryUnitTypeFilter('ALL');
                        setRecoveryAvailabilityFilter('ALL');
                      }}
                      className="ml-2 text-[11px] font-bold text-amber-800 hover:underline shrink-0"
                    >
                      View Selected
                    </button>
                  </div>
                )}
              </div>

              {/* Bed / Mat Unit Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase">
                    Select Room &amp; Bed / Mat Unit *
                  </label>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {recoverySummaryStats.totalMatchingRooms} {recoverySummaryStats.totalMatchingRooms === 1 ? 'room' : 'rooms'} matching &bull; {recoverySummaryStats.availableUnits} available ({recoverySummaryStats.availableBeds} beds, {recoverySummaryStats.availableMats} mats)
                  </span>
                </div>

                {recoveryLoadingRooms ? (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                    <span>Searching compatible available units...</span>
                  </div>
                ) : recoveryAvailableRooms.length === 0 ? (
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-center text-xs text-amber-800">
                    No room inventory records loaded in system. Please verify room configurations.
                  </div>
                ) : filteredRecoveryRooms.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-2">
                    <p className="text-xs text-slate-600 font-medium">
                      No rooms or units match the active filters ({recoveryAvailableRooms.length} total rooms loaded).
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setRecoveryBuildingFilter('ALL');
                        setRecoveryRoomSearch('');
                        setRecoveryGenderFilter('ALL');
                        setRecoveryUnitTypeFilter('ALL');
                        setRecoveryAvailabilityFilter('ALL');
                      }}
                      className="px-3 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-blue-600 hover:bg-blue-50 transition"
                    >
                      Reset All Filters
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {filteredRecoveryRooms.map((room) => {
                      return (
                        <div key={room.id} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-900">
                              Room {room.roomNumber} {room.building ? `(${room.building})` : ''}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              room.genderPreference === 'MALE'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : room.genderPreference === 'FEMALE'
                                ? 'bg-pink-50 text-pink-700 border border-pink-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}>
                              {room.genderPreference}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {room.units.map((u) => {
                              const isSelected = recoverySelectedUnitId === u.id;
                              const canSelect = u.isAvailable;
                              return (
                                <button
                                  key={u.id}
                                  type="button"
                                  disabled={!canSelect}
                                  onClick={() => canSelect && setRecoverySelectedUnitId(u.id)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 ${
                                    isSelected
                                      ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400'
                                      : canSelect
                                      ? 'bg-slate-100 hover:bg-blue-50 text-slate-800 border border-slate-300'
                                      : 'bg-slate-100/60 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                                  }`}
                                >
                                  <span>{u.type === 'BED' ? '🛏️ Bed' : '🧘 Mat'} {u.unitNumber}</span>
                                  {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                                  {!canSelect && <span className="text-[10px] font-sans font-normal text-slate-400">(Occupied)</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Check-In Date & Time & Recovery Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Check-In Date &amp; Time
                  </label>
                  <input
                    type="datetime-local"
                    value={recoveryCheckInDate}
                    onChange={(e) => setRecoveryCheckInDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Reason / Notes
                  </label>
                  <input
                    type="text"
                    value={recoveryNotes}
                    onChange={(e) => setRecoveryNotes(e.target.value)}
                    placeholder="e.g. Guest returned / Accidental checkout error corrected"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setIsCheckInAgainOpen(false)}
                className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading || !recoverySelectedUnitId}
                onClick={handleExecuteCheckInAgain}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold shadow-md transition flex items-center gap-1.5 active:scale-95"
              >
                {actionLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Restoring Check In...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore &amp; Check In Again</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL: UNIFIED PARTICIPANT PROFILE (Requirement 1)                */}
      {/* ------------------------------------------------------------------ */}
      {selectedProfileId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 my-4">
            {/* Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-xs flex items-center justify-center text-blue-300 font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-black">
                      {profileData?.participant.fullName || 'Guest Profile'}
                    </h3>
                    {profileData?.participant.isPrimary && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-400 text-slate-950">
                        Primary Registrant
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-blue-200 mt-0.5">
                    Unified Guest Record &bull; {profileData?.registration.registrationId}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedProfileId(null);
                  setProfileData(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Content */}
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              {profileLoading ? (
                <div className="py-16 text-center text-slate-400">
                  <RefreshCw className="w-7 h-7 animate-spin mx-auto text-blue-600 mb-2" />
                  <p className="text-xs font-semibold">Loading complete guest profile...</p>
                </div>
              ) : !profileData ? (
                <div className="py-12 text-center text-rose-500">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-xs font-bold">Failed to load profile record</p>
                </div>
              ) : (
                <>
                  {/* Status & Key Overview Pill */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-600">Current Status:</span>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        profileData.participant.checkInStatus === 'CHECKED_IN'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : profileData.participant.checkInStatus === 'CHECKED_OUT'
                          ? 'bg-slate-100 text-slate-700 border border-slate-300'
                          : 'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}>
                        {profileData.participant.checkInStatus === 'CHECKED_IN'
                          ? '🟣 Staying In-House'
                          : profileData.participant.checkInStatus === 'CHECKED_OUT'
                          ? '⚪ Checked Out'
                          : '🔵 Expected / Reserved'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
                      <span>Relation: {profileData.participant.relationToPrimary || 'Self'}</span>
                      {profileData.participant.age && <span>&bull; Age {profileData.participant.age}</span>}
                      {profileData.participant.gender && <span>&bull; {profileData.participant.gender}</span>}
                    </div>
                  </div>

                  {/* Section 1: Individual Phone & Contact Information */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-blue-600" />
                        <span>Individual Mobile Phone</span>
                      </span>
                      {!isEditPhoneOpen && (
                        <button
                          type="button"
                          onClick={() => setIsEditPhoneOpen(true)}
                          className="text-xs font-bold text-blue-600 hover:text-blue-800 underline"
                        >
                          Change Phone
                        </button>
                      )}
                    </div>

                    {isEditPhoneOpen ? (
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="tel"
                          value={newPhoneValue}
                          onChange={(e) => setNewPhoneValue(e.target.value)}
                          placeholder="Enter 10-digit mobile number"
                          className="flex-1 px-3 py-1.5 text-xs bg-white border-2 border-blue-400 rounded-lg font-mono font-bold focus:outline-none"
                        />
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={handleUpdatePhone}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditPhoneOpen(false);
                            setNewPhoneValue(profileData.participant.phone || '');
                          }}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm font-mono font-bold text-slate-900">
                        <span>{profileData.participant.phone || 'No individual phone recorded'}</span>
                        {profileData.participant.phone && (
                          <a
                            href={`tel:${profileData.participant.phone}`}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            title="Call Guest"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Section 2: Current Accommodation Details */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Bed className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Current Accommodation</span>
                    </span>

                    {profileData.currentAccommodation ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                        <div className="p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-xl">
                          <span className="text-[10px] uppercase font-bold text-indigo-700 block">Hotel / Building</span>
                          <span className="font-bold text-slate-900">{profileData.currentAccommodation.hotelName}</span>
                        </div>
                        <div className="p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-xl">
                          <span className="text-[10px] uppercase font-bold text-indigo-700 block">Room Number</span>
                          <span className="font-black text-indigo-900 text-sm">Room {profileData.currentAccommodation.roomNumber}</span>
                        </div>
                        <div className="p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-xl">
                          <span className="text-[10px] uppercase font-bold text-indigo-700 block">Bed / Mat Unit</span>
                          <span className="font-black text-indigo-900 text-sm font-mono">
                            {profileData.currentAccommodation.unitType === 'BED' ? '🛏️ Bed' : '🧘 Mat'} {profileData.currentAccommodation.unitNumber}
                          </span>
                        </div>
                        <div className="p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-xl">
                          <span className="text-[10px] uppercase font-bold text-indigo-700 block">Checked In At</span>
                          <span className="font-bold text-slate-900">
                            {new Date(profileData.currentAccommodation.actualCheckIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 flex items-center justify-between">
                        <span>Not currently assigned to an active physical room unit.</span>
                        {profileData.allowedActions.includes('CHECK_IN') && (
                          <span className="text-[11px] font-bold text-emerald-700">Ready for Check-In</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Section 3: Registration & Stay Dates */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      <span>Registration Details &amp; Stay Window</span>
                    </span>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Registration ID</span>
                        <span className="font-mono font-bold text-blue-700">{profileData.registration.registrationId}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Primary Registrant</span>
                        <span className="font-bold text-slate-900">{profileData.registration.primaryName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Group Size</span>
                        <span className="font-bold text-slate-900">{profileData.registration.totalMembers} Member(s)</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Primary Contact</span>
                        <span className="font-mono font-bold text-slate-900">{profileData.registration.mobile}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">City / Origin</span>
                        <span className="font-bold text-slate-900">{profileData.registration.city || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Planned Stay Dates</span>
                        <span className="font-bold text-slate-900">
                          {profileData.registration.stayDates
                            ? `${new Date(profileData.registration.stayDates.arrivalDate).toLocaleDateString()} - ${new Date(profileData.registration.stayDates.departureDate).toLocaleDateString()}`
                            : 'Open Stay'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Section 4: Previous Room Changes & Reassignments */}
                  {profileData.previousRoomChanges.length > 0 && (
                    <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 space-y-2.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                        <ArrowRightLeft className="w-3.5 h-3.5 text-amber-700" />
                        <span>Previous Room Changes ({profileData.previousRoomChanges.length})</span>
                      </span>

                      <div className="space-y-2">
                        {profileData.previousRoomChanges.map((change, idx) => (
                          <div key={idx} className="p-2.5 bg-white border border-amber-200 rounded-xl text-xs space-y-1">
                            <div className="flex items-center justify-between font-bold">
                              <span className="text-amber-900">
                                {change.fromUnit ? `Room ${change.fromUnit.roomNumber} (${change.fromUnit.unitNumber})` : 'Initial Assignment'} &rarr; Room {change.toUnit.roomNumber} ({change.toUnit.unitNumber})
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {new Date(change.changedAt).toLocaleDateString()} {new Date(change.changedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600">
                              Reason: <em>{change.transferReason}</em> &bull; Staff: <strong>{change.staffName}</strong>
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Section 5: Complete Stay History */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-600" />
                      <span>Stay History ({profileData.stayHistory.length} Record{profileData.stayHistory.length !== 1 ? 's' : ''})</span>
                    </span>

                    {profileData.stayHistory.length === 0 ? (
                      <p className="text-xs text-slate-400">No physical stay records logged yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {profileData.stayHistory.map((s, idx) => (
                          <div key={s.stayRecordId || idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900">
                                  Room {s.roomNumber} &bull; {s.unitType === 'BED' ? '🛏️ Bed' : '🧘 Mat'} {s.unitNumber}
                                </span>
                                <span className={`px-2 py-0.2 rounded text-[10px] font-bold ${
                                  s.status === 'CHECKED_IN' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                                }`}>
                                  {s.status}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                In: {new Date(s.actualCheckIn).toLocaleString()} {s.actualCheckOut && `• Out: ${new Date(s.actualCheckOut).toLocaleString()}`}
                              </p>
                            </div>
                            <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                              Staff: {s.recordedByStaff}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Profile Action Footer (Only shows actions appropriate to status) */}
            {profileData && (
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <span className="text-xs font-bold text-slate-500 uppercase">Available Actions:</span>

                <div className="flex items-center gap-2 flex-wrap">
                  {profileData.allowedActions.includes('CHECK_IN') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProfileId(null);
                        openDossier(profileData.registration.id);
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Check In Now</span>
                    </button>
                  )}

                  {profileData.allowedActions.includes('CHANGE_ROOM') && profileData.currentAccommodation && (
                    <button
                      type="button"
                      onClick={() => {
                        const acc = profileData.currentAccommodation;
                        if (!acc) return;
                        const targetItem = records.find((r) => r.id === acc.stayRecordId) || {
                          id: acc.stayRecordId,
                          participant: profileData.participant,
                          unit: { id: acc.unitId, unitNumber: acc.unitNumber, room: { roomNumber: acc.roomNumber } },
                        };
                        setSelectedProfileId(null);
                        handleLaunchChangeUnit(targetItem);
                      }}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition"
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                      <span>Change Room / Bed</span>
                    </button>
                  )}

                  {profileData.allowedActions.includes('CHECK_OUT') && profileData.currentAccommodation && (
                    <button
                      type="button"
                      onClick={() => {
                        const stayId = profileData.currentAccommodation!.stayRecordId;
                        const name = profileData.participant.fullName;
                        setSelectedProfileId(null);
                        handleCheckOut(stayId, name);
                      }}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Check Out</span>
                    </button>
                  )}

                  {profileData.allowedActions.includes('CHECK_IN_AGAIN') && (
                    <button
                      type="button"
                      onClick={() => {
                        const pastStay = profileData.stayHistory[0];
                        setSelectedProfileId(null);
                        openCheckInAgainModal({
                          id: pastStay?.stayRecordId,
                          participant: profileData.participant,
                          registration: profileData.registration,
                          unit: { room: { genderPreference: profileData.participant.gender === 'FEMALE' ? 'FEMALE' : 'MALE' } },
                        });
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Check In Again</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL: OVERDUE CHECKOUTS LIST (Requirement 6)                     */}
      {/* ------------------------------------------------------------------ */}
      {isOverdueModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 my-4">
            <div className="p-4 sm:p-5 bg-rose-700 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-6 h-6 text-rose-200" />
                <div>
                  <h3 className="text-base font-black">Overdue Checkouts ({metrics.dailyTasks?.overdueCheckouts ?? 0})</h3>
                  <p className="text-xs text-rose-200">Guests past their planned departure date who are still staying</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOverdueModalOpen(false)}
                className="text-rose-200 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-3 overflow-y-auto flex-1">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900">
                <strong>MMDK System Policy:</strong> Never automatically check out participants. Please contact the guest to confirm whether they wish to extend their stay or proceed with manual checkout.
              </div>

              {metrics.dailyTasks?.overdueList && metrics.dailyTasks.overdueList.length > 0 ? (
                <div className="space-y-2">
                  {metrics.dailyTasks.overdueList.map((item) => (
                    <div key={item.stayId} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs">
                      <div>
                        <p className="font-bold text-slate-900">{item.participantName}</p>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          Room <strong>{item.roomNumber}</strong> (Unit {item.unitNumber}) &bull; {item.hotelName}
                        </p>
                        <p className="text-[10px] text-rose-700 font-semibold mt-0.5">
                          Scheduled Exit: {item.scheduledExitDate ? new Date(item.scheduledExitDate).toLocaleDateString() : 'Overdue'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.phone && (
                          <a
                            href={`tel:${item.phone}`}
                            className="p-2 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg text-slate-700 font-bold"
                            title="Call Guest"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setIsOverdueModalOpen(false);
                            openExtendStayModal(item);
                          }}
                          className="px-2.5 py-1.5 bg-blue-50 border border-blue-300 text-blue-700 hover:bg-blue-100 rounded-lg font-bold"
                          title="Extend stay"
                        >
                          Extend
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsOverdueModalOpen(false);
                            openParticipantProfile(item.participantId);
                          }}
                          className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold"
                        >
                          Profile
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsOverdueModalOpen(false);
                            handleCheckOut(item.stayId, item.participantName);
                          }}
                          className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold"
                        >
                          Check Out
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-8">No overdue checkouts currently logged.</p>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 text-right">
              <button
                type="button"
                onClick={() => setIsOverdueModalOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* GROUP CHECKOUT BY PRIMARY PARTICIPANT MODAL                        */}
      {/* ------------------------------------------------------------------ */}
      {groupCheckoutModalOpen && groupCheckoutReg && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-indigo-700 via-indigo-800 to-purple-800 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-black leading-tight">Group Check-Out</h3>
                  <p className="text-xs text-indigo-100">
                    Registration: <span className="font-mono font-bold text-white">{groupCheckoutReg.registrationId}</span> &bull; Primary: <strong className="text-white">{groupCheckoutReg.primaryName}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGroupCheckoutModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              {/* Registration / Primary Info Card */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Primary Contact</span>
                  <span className="font-bold text-slate-900">{groupCheckoutReg.primaryName} ({groupCheckoutReg.mobile || 'No mobile'})</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Group Members</span>
                  <span className="font-bold text-slate-900">{groupCheckoutMembers.length} Members</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Currently Checked In</span>
                  <span className="font-bold text-emerald-700">
                    {groupCheckoutMembers.filter((m) => m.isCheckedIn).length} In-House
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Selected for Check-Out</span>
                  <span className="font-mono font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    {groupCheckoutSelectedStayIds.length} Selected
                  </span>
                </div>
              </div>

              {/* Notice Banner */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Select individual members or the entire party for check-out.</p>
                  <p className="text-[11px] text-blue-800">
                    Unselected party members will safely remain checked in and their beds will not be released.
                  </p>
                </div>
              </div>

              {/* Members Selection List */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <div className="bg-slate-100/90 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="select-all-group-members"
                      checked={
                        groupCheckoutMembers.filter((m) => m.isCheckedIn).length > 0 &&
                        groupCheckoutMembers
                          .filter((m) => m.isCheckedIn)
                          .every((m) => groupCheckoutSelectedStayIds.includes(m.stayRecordId))
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          const allCheckedInStayIds = groupCheckoutMembers
                            .filter((m) => m.isCheckedIn)
                            .map((m) => m.stayRecordId);
                          setGroupCheckoutSelectedStayIds(allCheckedInStayIds);
                        } else {
                          setGroupCheckoutSelectedStayIds([]);
                        }
                      }}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                    />
                    <label htmlFor="select-all-group-members" className="cursor-pointer select-none">
                      Select All Checked-In Members
                    </label>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {groupCheckoutSelectedStayIds.length} of {groupCheckoutMembers.filter((m) => m.isCheckedIn).length} selected
                  </span>
                </div>

                <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                  {groupCheckoutMembers.map((member) => {
                    const isSelected = groupCheckoutSelectedStayIds.includes(member.stayRecordId);
                    const canSelect = member.isCheckedIn;

                    return (
                      <div
                        key={member.participantId}
                        className={`p-3 sm:px-4 flex items-center justify-between gap-3 text-xs transition ${
                          !canSelect
                            ? 'bg-slate-50/70 opacity-60'
                            : isSelected
                            ? 'bg-indigo-50/40'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            disabled={!canSelect}
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setGroupCheckoutSelectedStayIds((prev) => [...prev, member.stayRecordId]);
                              } else {
                                setGroupCheckoutSelectedStayIds((prev) =>
                                  prev.filter((id) => id !== member.stayRecordId)
                                );
                              }
                            }}
                            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 disabled:opacity-40"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 truncate">{member.fullName}</span>
                              {member.isPrimary && (
                                <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 text-[10px] font-bold rounded">
                                  Primary
                                </span>
                              )}
                              <span className="text-[11px] text-slate-400">
                                {member.gender} &bull; {member.age ? `${member.age} yrs` : ''}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 truncate flex items-center gap-2 mt-0.5">
                              {member.roomNumber ? (
                                <span className="font-medium text-slate-700">
                                  Room {member.roomNumber} ({member.building || 'Main'}) &bull;{' '}
                                  <span className="font-mono font-bold">
                                    {member.unitType === 'BED' ? 'Bed' : 'Mat'} {member.unitNumber}
                                  </span>
                                </span>
                              ) : (
                                <span className="italic text-slate-400">No active room assignment</span>
                              )}
                              {member.phone && <span>&bull; {member.phone}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          {member.isCheckedIn ? (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px] inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Checked In
                            </span>
                          ) : member.checkInStatus === 'CHECKED_OUT' ? (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-medium text-[10px]">
                              Already Checked Out
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full font-medium text-[10px]">
                              Not Checked In
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Checkout Reason / Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Checkout Reason / Staff Notes
                </label>
                <input
                  type="text"
                  value={groupCheckoutNotes}
                  onChange={(e) => setGroupCheckoutNotes(e.target.value)}
                  placeholder="e.g. Group departure checkout"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setGroupCheckoutModalOpen(false)}
                className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={groupCheckoutSelectedStayIds.length === 0}
                onClick={() => setGroupCheckoutConfirmOpen(true)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold shadow-md transition flex items-center gap-1.5 active:scale-95"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Check Out Selected ({groupCheckoutSelectedStayIds.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* GROUP CHECKOUT CONFIRMATION DIALOG                                 */}
      {/* ------------------------------------------------------------------ */}
      {groupCheckoutConfirmOpen && groupCheckoutReg && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-[60] animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-slate-900">Confirm Group Check-Out</h4>
                <p className="text-xs text-slate-500">
                  Verify members before releasing bed assignments
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
              <p className="text-slate-700 font-semibold">
                You are checking out <strong>{groupCheckoutSelectedStayIds.length}</strong> member(s):
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1">
                {groupCheckoutMembers
                  .filter((m) => groupCheckoutSelectedStayIds.includes(m.stayRecordId))
                  .map((m) => (
                    <span
                      key={m.participantId}
                      className="px-2 py-1 bg-white border border-slate-300 rounded-md font-bold text-slate-800 text-[11px] shadow-2xs"
                    >
                      {m.fullName} {m.roomNumber ? `(Room ${m.roomNumber})` : ''}
                    </span>
                  ))}
              </div>
              {groupCheckoutMembers.filter((m) => m.isCheckedIn && !groupCheckoutSelectedStayIds.includes(m.stayRecordId)).length > 0 && (
                <p className="text-[11px] text-amber-800 pt-1 border-t border-slate-200">
                  Note: {groupCheckoutMembers.filter((m) => m.isCheckedIn && !groupCheckoutSelectedStayIds.includes(m.stayRecordId)).length} member(s) will remain checked in.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setGroupCheckoutConfirmOpen(false)}
                className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                Back to Selection
              </button>
              <button
                type="button"
                disabled={groupCheckoutLoading}
                onClick={handleExecuteGroupCheckout}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold shadow-md transition flex items-center gap-1.5 active:scale-95"
              >
                {groupCheckoutLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Checking Out...</span>
                  </>
                ) : (
                  <>
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Confirm &amp; Check Out ({groupCheckoutSelectedStayIds.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MOBILE BOTTOM NAVIGATION BAR (Requirement 1 & 8)                   */}
      {/* ------------------------------------------------------------------ */}
      <div 
        role="navigation"
        aria-label="Mobile reception bottom navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-2xl safe-area-bottom"
      >
        {/* 1. Desk */}
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex flex-col items-center gap-0.5 text-slate-600 hover:text-blue-600 active:text-blue-700 min-w-[50px] min-h-[48px] justify-center transition active:scale-95"
          title="Scroll to Desk Top"
        >
          <CheckSquare className="w-5 h-5 text-slate-500" />
          <span className="text-[10px] font-bold">Desk</span>
        </button>

        {/* 2. Today's Arrivals */}
        <button
          type="button"
          id="btn-mobile-nav-arrivals"
          onClick={() => handleTabSwitch('TODAY_ARRIVALS')}
          className={`flex flex-col items-center gap-0.5 min-w-[56px] min-h-[48px] justify-center transition active:scale-95 rounded-xl px-2 py-1 ${
            activeTab === 'TODAY_ARRIVALS'
              ? 'bg-blue-50 text-blue-700 font-extrabold ring-1 ring-blue-300 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
          title="Today's Arrivals"
        >
          <div className="relative">
            <UserCheck className={`w-5 h-5 ${activeTab === 'TODAY_ARRIVALS' ? 'text-blue-600 stroke-[2.5]' : 'text-slate-500'}`} />
            {(metrics.tabCounts?.todayArrivals ?? metrics.expectedArrivalsCount) > 0 && (
              <span className="absolute -top-1.5 -right-2 px-1 py-0.2 bg-blue-600 text-white text-[8px] font-black rounded-full min-w-[14px] text-center">
                {metrics.tabCounts?.todayArrivals ?? metrics.expectedArrivalsCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold leading-tight">Arrivals</span>
        </button>

        {/* 3. Currently Staying */}
        <button
          type="button"
          id="btn-mobile-nav-staying"
          onClick={() => handleTabSwitch('CHECKED_IN')}
          className={`flex flex-col items-center gap-0.5 min-w-[56px] min-h-[48px] justify-center transition active:scale-95 rounded-xl px-2 py-1 ${
            activeTab === 'CHECKED_IN'
              ? 'bg-emerald-50 text-emerald-700 font-extrabold ring-1 ring-emerald-300 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
          title="Currently Staying"
        >
          <div className="relative">
            <Bed className={`w-5 h-5 ${activeTab === 'CHECKED_IN' ? 'text-emerald-600 stroke-[2.5]' : 'text-slate-500'}`} />
            {(metrics.tabCounts?.currentlyStaying ?? metrics.checkedInCount) > 0 && (
              <span className="absolute -top-1.5 -right-2 px-1 py-0.2 bg-emerald-600 text-white text-[8px] font-black rounded-full min-w-[14px] text-center">
                {metrics.tabCounts?.currentlyStaying ?? metrics.checkedInCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold leading-tight">Staying</span>
        </button>

        {/* 4. Search */}
        <button
          type="button"
          onClick={() => {
            const el = document.getElementById('unified-reception-search');
            el?.focus();
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
          className="flex flex-col items-center gap-0.5 text-slate-600 hover:text-blue-600 active:text-blue-700 min-w-[50px] min-h-[48px] justify-center transition active:scale-95"
          title="Unified Search"
        >
          <Search className="w-5 h-5 text-slate-500" />
          <span className="text-[10px] font-bold">Search</span>
        </button>

        {/* 5. Walk-In */}
        <button
          type="button"
          onClick={() => setIsWalkInOpen(true)}
          className="flex flex-col items-center gap-0.5 text-blue-600 hover:text-blue-700 active:scale-95 min-w-[50px] min-h-[48px] justify-center transition"
          title="Walk-In Registration"
        >
          <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <UserPlus className="w-4 h-4 text-white" />
          </div>
          <span className="text-[10px] font-bold text-blue-700">Walk-In</span>
        </button>
      </div>
    </div>
  );
}
