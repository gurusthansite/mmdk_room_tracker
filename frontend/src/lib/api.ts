/**
 * Central API Client for Accommodation Management System
 * Exclusively communicates with Backend REST API
 * Security: Uses HttpOnly Cookies. Never stores tokens in localStorage.
 */

// In browser runtime, always use relative '/api' to enforce the same-origin proxy.
// Backend URLs are strictly resolved server-side to prevent credential/cookie isolation leaks.
const API_BASE_URL = typeof window !== 'undefined' ? '/api' : (process.env.INTERNAL_API_URL || 'http://localhost:5000/api');

export type UserRole = 'SUPER_ADMIN' | 'ALLOCATION_MANAGER' | 'RECEPTION_STAFF' | 'VIEWER';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone: string | null;
  status: UserStatus;
  mustChangePassword?: boolean;
  tokenVersion?: number;
  lastLoginAt: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type RoomStatus = 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE';
export type GenderPreference = 'MALE' | 'FEMALE' | 'ANY' | 'FAMILY' | 'GUEST';
export type UnitType = 'BED' | 'MAT';
export type GenderCategory = 'MALE' | 'FEMALE' | 'ANY';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type UnitStatus = 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE';
export type VisualUnitState = 'AVAILABLE' | 'ALLOCATED' | 'CONFIRMED' | 'CHECKED_IN' | 'MAINTENANCE';

export interface AccommodationUnitItem {
  id: string;
  unitNumber: string;
  type: UnitType;
  genderCategory: GenderCategory;
  status: UnitStatus;
  notes: string | null;
  visualState: VisualUnitState;
  occupantInfo?: {
    type: string;
    registrationId?: string;
    primaryName?: string;
    participantName?: string;
    entryDate?: string;
    exitDate?: string;
    actualCheckIn?: string;
  } | null;
}

export interface HotelListItem {
  id: string;
  name: string;
  address: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  roomCount: number;
  activeRooms: number;
  totalBeds: number;
  totalMats: number;
  totalCapacity: number;
  rooms?: Array<{
    id: string;
    roomNumber: string;
    floor: number | null;
    genderPreference: GenderPreference;
    status: RoomStatus;
    totalBeds: number;
    totalMats: number;
  }>;
}

export interface CreateHotelInput {
  name: string;
  address?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  notes?: string | null;
}

export interface UpdateHotelInput {
  name?: string;
  address?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  notes?: string | null;
}

export interface RoomListItem {
  id: string;
  roomNumber: string;
  hotelId?: string | null;
  hotel?: { id: string; name: string } | null;
  building: string | null;
  floor: number | null;
  totalBeds: number;
  totalMats: number;
  totalCapacity: number;
  breakdown: {
    bedsMale: number;
    bedsFemale: number;
    bedsAny: number;
    matsMale: number;
    matsFemale: number;
    matsAny: number;
  };
  genderPreference: GenderPreference;
  status: RoomStatus;
  notes: string | null;
  unitCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RoomDetail extends RoomListItem {
  units: AccommodationUnitItem[];
}

export interface CreateRoomInput {
  roomNumber: string;
  hotelId?: string | null;
  building?: string;
  floor?: number;
  genderPreference?: GenderPreference;
  status?: RoomStatus;
  notes?: string;
  totalBeds?: number;
  totalMats?: number;
  maleBeds?: number;
  femaleBeds?: number;
  anyBeds?: number;
  maleMats?: number;
  femaleMats?: number;
  anyMats?: number;
}

export interface BulkRoomGroupInput {
  roomNumbers: string | string[];
  building?: string;
  floor?: number;
  genderPreference?: GenderPreference;
  status?: RoomStatus;
  notes?: string;
  totalBeds: number;
  totalMats: number;
}

export interface CreateBulkRoomsInput {
  hotelId?: string | null;
  groups: BulkRoomGroupInput[];
}

export interface BulkRoomsResponse {
  createdCount: number;
  totalUnits: number;
  rooms: any[];
}

export interface UpdateRoomInput {
  hotelId?: string | null;
  building?: string | null;
  floor?: number | null;
  genderPreference?: GenderPreference;
  status?: RoomStatus;
  notes?: string | null;
}

export interface AddUnitInput {
  unitNumber: string;
  type?: UnitType;
  genderCategory?: GenderCategory;
  status?: UnitStatus;
  notes?: string;
}

export type RegistrationStatus = 'REGISTERED' | 'ALLOCATED' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED';
export type ParticipantStatus = 'REGISTERED' | 'VERIFIED' | 'ACCOMMODATED' | 'CHECKED_OUT' | 'CANCELLED';

export interface ParticipantItem {
  id: string;
  fullName: string;
  phone?: string | null;
  gender: 'MALE' | 'FEMALE' | null;
  age: number | null;
  relationToPrimary: string | null;
  isPrimary: boolean;
  checkInStatus: ParticipantStatus;
  notes?: string | null;
  createdAt: string;
  aadhaarRecord?: {
    lastFourDigits: string;
    complianceStatus: string;
    retentionConsent: boolean;
  } | null;
}

export interface RegistrationListItem {
  id: string;
  registrationId: string;
  primaryName: string;
  mobile: string;
  email: string | null;
  city: string | null;
  state: string | null;
  totalMembers: number;
  registrationDate: string;
  status: RegistrationStatus;
  isArchived: boolean;
  notes: string | null;
  participantsCount: number;
  allocationsCount: number;
  stayRecordsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RegistrationDetail extends RegistrationListItem {
  participants: ParticipantItem[];
  allocationSummary: Array<{
    id: string;
    allocationNumber: string;
    status: string;
    entryDate: string;
    exitDate: string;
    totalUnits: number;
    units: Array<{
      unitId: string;
      unitNumber: string;
      unitType: string;
      genderCategory: string;
      roomNumber: string;
      building: string | null;
      floor: number | null;
      status: string;
    }>;
  }>;
  staySummary: Array<{
    id: string;
    participantName: string;
    participantGender: string | null;
    roomNumber: string;
    unitNumber: string;
    unitType: string;
    actualCheckIn: string;
    actualCheckOut: string | null;
    status: string;
    transferReason: string | null;
  }>;
  messageLogs?: Array<{
    id: string;
    messageType: string;
    recipientMobile: string;
    status: string;
    sentAt: string | null;
    createdAt: string;
  }>;
}

export interface CreateRegistrationInput {
  primaryName: string;
  gender?: Gender | null;
  primaryGender?: Gender | null;
  mobile: string;
  email?: string;
  city?: string;
  state?: string;
  totalMembers?: number;
  registrationDate?: string;
  status?: RegistrationStatus;
  notes?: string;
  accompanyingMembers?: Array<{
    fullName: string;
    phone?: string | null;
    gender?: 'MALE' | 'FEMALE' | null;
    age?: number | null;
    relationToPrimary?: string | null;
  }>;
}

export interface UpdateRegistrationInput {
  primaryName?: string;
  gender?: Gender | null;
  primaryGender?: Gender | null;
  mobile?: string;
  email?: string | null;
  city?: string | null;
  state?: string | null;
  totalMembers?: number;
  status?: RegistrationStatus;
  notes?: string | null;
  isArchived?: boolean;
}

export type AllocationStatus = 'TENTATIVE' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

export interface AllocationRoomSummary {
  roomNumber: string;
  building: string | null;
  beds: number;
  mats: number;
}

export interface AllocationUnitBrief {
  unitId: string;
  unitNumber: string;
  unitType: UnitType;
  genderCategory: GenderCategory;
  roomId: string;
  roomNumber: string;
  building: string | null;
  floor: number | null;
}

export interface AllocationListItem {
  id: string;
  allocationNumber: string;
  registrationId: string;
  primaryName: string;
  mobile: string;
  totalMembers: number;
  city: string | null;
  status: AllocationStatus;
  entryDate: string;
  exitDate: string;
  totalUnits: number;
  roomsSummary: AllocationRoomSummary[];
  units: AllocationUnitBrief[];
  createdByName: string;
  notes: string | null;
  createdAt: string;
}

export interface AvailabilityUnit {
  id: string;
  unitNumber: string;
  type: UnitType;
  genderCategory: GenderCategory;
  status: UnitStatus;
  isAvailable: boolean;
  state: 'AVAILABLE' | 'ALLOCATED' | 'CONFIRMED' | 'OCCUPIED' | 'MAINTENANCE';
  conflict?: any;
  notes?: string | null;
}

export interface AvailabilityRoom {
  id: string;
  hotelId?: string | null;
  hotelName?: string | null;
  hotel?: { id: string; name: string } | null;
  roomNumber: string;
  building: string | null;
  floor: number | null;
  genderPreference: GenderPreference;
  status: RoomStatus;
  totalUnitsInRoom: number;
  availableCount: number;
  occupancyPercentage?: number;
  availableBeds?: number;
  availableMats?: number;
  totalBeds?: number;
  totalMats?: number;
  units: AvailabilityUnit[];
}

export interface CheckAvailabilityData {
  searchWindow: {
    entryDate: string;
    exitDate: string;
  };
  summary: {
    totalRooms: number;
    totalUnits: number;
    availableUnits: number;
    occupiedUnits: number;
    occupancyRate?: number;
    availableBeds?: number;
    totalBeds?: number;
    availableMats?: number;
    totalMats?: number;
    categoryBreakdown?: Record<string, { totalRooms: number; availableBeds: number; availableMats: number; availableUnits: number }>;
  };
  rooms: AvailabilityRoom[];
}

export interface CreateAllocationInput {
  registrationId: string;
  entryDate: string;
  exitDate: string;
  unitIds: string[];
  status?: AllocationStatus;
  notes?: string;
  participantAssignments?: Array<{ participantId: string; unitId: string }>;
}

export interface UpdateAllocationInput {
  status?: AllocationStatus;
  entryDate?: string;
  exitDate?: string;
  unitIds?: string[];
  notes?: string | null;
}

export type MessageStatus = 'PREPARED' | 'OPENED' | 'STAFF_CONFIRMED_SENT' | 'FAILED';
export type MessageType = 'WHATSAPP_ALLOCATION_TENTATIVE' | 'WHATSAPP_RECEPTION_CONFIRMATION' | 'SMS_NOTIFICATION';

export interface WhatsAppPreparedData {
  messageLogId: string;
  allocationId: string;
  allocationNumber: string;
  registrationId: string;
  recipientName: string;
  recipientMobile: string;
  templateContent: string;
  whatsappUrl: string;
  status: MessageStatus;
  createdAt: string;
}

export interface MessageLogItem {
  id: string;
  registrationId: string;
  recipientMobile: string;
  messageType: MessageType;
  templateContent: string;
  status: MessageStatus;
  sentByUserId: string | null;
  sentAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  registration?: {
    id: string;
    registrationId: string;
    primaryName: string;
    mobile: string;
  };
  sentByUser?: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
}

export interface RoomCategoryAvailabilityStats {
  totalRooms: number;
  availableRooms: number;
  totalBeds: number;
  availableBeds: number;
  totalMats: number;
  availableMats: number;
  availableUnits: number;
}

export interface RoomWiseSummaryItem {
  roomId: string;
  roomNumber: string;
  building: string | null;
  floor: number | null;
  category: GenderPreference;
  totalUnits: number;
  bookedUnitsCount: number;
  availableBeds: number;
  availableMats: number;
  availableUnits: number;
}

export interface ReceptionMetrics {
  expectedArrivalsCount: number;
  tentativeAwaitingCount: number;
  confirmedParticipantsCount: number;
  checkedInCount: number;
  expectedDeparturesCount: number;
  checkedOutTodayCount: number;
  totalCheckedOutCount?: number;
  tabCounts?: {
    todayArrivals: number;
    currentlyStaying: number;
    tentative: number;
    checkedOut: number;
  };
  availableAccommodationCount?: number;
  availableBedsCount?: number;
  availableMatsCount?: number;
  // 6 Summary Cards matching user's handwritten reference
  totalBookedUnits?: number;
  totalRooms?: number;
  femaleRoomAvailability?: RoomCategoryAvailabilityStats;
  maleRoomAvailability?: RoomCategoryAvailabilityStats;
  familyRoomAvailability?: RoomCategoryAvailabilityStats;
  guestRoomAvailability?: RoomCategoryAvailabilityStats;
  roomWiseSummary?: RoomWiseSummaryItem[];
  // Requirement 6: Daily Operations Tasks
  dailyTasks?: {
    expectedArrivals: number;
    expectedDepartures: number;
    notYetArrived: number;
    overdueCheckouts: number;
    overdueList: Array<{
      stayId: string;
      participantId: string;
      participantName: string;
      phone: string | null;
      roomNumber: string;
      unitNumber: string;
      hotelName: string;
      scheduledExitDate: string | null;
    }>;
  };
  // Requirement 7: Recent Activity
  recentActivity?: Array<{
    id: string;
    action: string;
    entityType: string;
    details: any;
    staffName: string;
    staffRole: string;
    createdAt: string;
  }>;
}

export interface UnifiedParticipantProfile {
  participant: {
    id: string;
    fullName: string;
    phone: string | null;
    gender: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN' | null;
    age: number | null;
    relationToPrimary: string;
    isPrimary: boolean;
    checkInStatus: string;
    notes: string | null;
  };
  registration: {
    id: string;
    registrationId: string;
    primaryName: string;
    mobile: string;
    city: string | null;
    state: string | null;
    totalMembers: number;
    status: string;
    stayDates: {
      arrivalDate: string;
      departureDate: string;
    } | null;
  };
  currentAccommodation: {
    stayRecordId: string;
    unitId: string;
    unitNumber: string;
    unitType: UnitType;
    roomId: string;
    roomNumber: string;
    building: string | null;
    floor: number | null;
    hotelName: string;
    actualCheckIn: string;
  } | null;
  previousRoomChanges: Array<{
    stayRecordId: string;
    transferReason: string;
    changedAt: string;
    staffName: string;
    fromUnit: {
      unitNumber: string;
      unitType: UnitType;
      roomNumber: string;
      hotelName: string;
    } | null;
    toUnit: {
      unitNumber: string;
      unitType: UnitType;
      roomNumber: string;
      hotelName: string;
    };
  }>;
  stayHistory: Array<{
    stayRecordId: string;
    unitNumber: string;
    unitType: UnitType;
    roomNumber: string;
    hotelName: string;
    actualCheckIn: string;
    actualCheckOut: string | null;
    status: string;
    notes: string | null;
    recordedByStaff: string;
  }>;
  allowedActions: string[];
}

export interface ReceptionParticipant {
  id: string;
  registrationId: string;
  fullName: string;
  phone?: string | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN' | null;
  age: number | null;
  relationToPrimary: string | null;
  isPrimary: boolean;
  checkInStatus: 'REGISTERED' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'NO_SHOW' | 'CANCELLED';
  notes: string | null;
  maskedAadhaar?: string | null;
  aadhaarRecord?: {
    id: string;
    lastFourDigits: string;
    complianceStatus: string;
    retentionConsent: boolean;
  } | null;
  activeStay?: any | null;
}

export interface ReceptionDossierData {
  registration: {
    id: string;
    registrationId: string;
    primaryName: string;
    mobile: string;
    email: string | null;
    city: string | null;
    state: string | null;
    totalMembers: number;
    status: string;
    notes: string | null;
    participants: ReceptionParticipant[];
    allocations: any[];
    messageLogs: any[];
  };
  activeAllocation: any | null;
  capacitySummary: {
    totalRegisteredMembers: number;
    allocatedUnitsCount: number;
    actualParticipantsCount: number;
    checkedInCount: number;
    difference: number;
  };
}

export interface ExcelPreviewRow {
  rowIndex: number;
  data: {
    primaryName: string;
    mobile: string;
    email: string | null;
    city: string | null;
    state: string | null;
    totalMembers: number;
    registrationDate: string;
    notes: string | null;
    accompanyingMembersText: string | null;
  };
  isValid: boolean;
  isDuplicate: boolean;
  errors: string[];
  warnings: string[];
}

export interface ExcelImportPreviewData {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  canImport: boolean;
  rows: ExcelPreviewRow[];
}

export interface RegistrationListResponse {
  data: RegistrationListItem[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
  metrics: {
    totalRegistrations: number;
    totalMembers: number;
    REGISTERED: number;
    ALLOCATED: number;
    CONFIRMED: number;
    CHECKED_IN: number;
    CHECKED_OUT: number;
    CANCELLED: number;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Array<{ path: string; message: string }>;
  meta?: any;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  retryAfterSeconds?: number;
}

export interface HealthCheckData {
  status: string;
  timestamp: string;
  environment: string;
  database: {
    status: string;
    latencyMs: number;
  };
  system: string;
  version: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include', // Automatically send & receive HttpOnly cookies
      });

      const data = await response.json();
      return data;
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Network request failed to backend API',
      };
    }
  }

  // Health
  async getHealth(): Promise<ApiResponse<HealthCheckData>> {
    return this.request<HealthCheckData>('/health');
  }

  // Auth Endpoints
  async login(credentials: { email: string; password: string }): Promise<ApiResponse<{ user: AdminUser }>> {
    return this.request<{ user: AdminUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async logout(): Promise<ApiResponse<void>> {
    return this.request<void>('/auth/logout', {
      method: 'POST',
    });
  }

  async getMe(): Promise<ApiResponse<{ user: AdminUser }>> {
    return this.request<{ user: AdminUser }>('/auth/me', {
      method: 'GET',
    });
  }

  // Hotels & Buildings Management
  async getHotels(q?: string): Promise<ApiResponse<HotelListItem[]>> {
    const query = new URLSearchParams();
    if (q) query.set('q', q);
    const qs = query.toString();
    return this.request<HotelListItem[]>(`/hotels${qs ? `?${qs}` : ''}`, { method: 'GET' });
  }

  async getHotel(id: string): Promise<ApiResponse<HotelListItem>> {
    return this.request<HotelListItem>(`/hotels/${id}`, { method: 'GET' });
  }

  async createHotel(data: CreateHotelInput): Promise<ApiResponse<HotelListItem>> {
    return this.request<HotelListItem>('/hotels', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateHotel(id: string, data: UpdateHotelInput): Promise<ApiResponse<HotelListItem>> {
    return this.request<HotelListItem>(`/hotels/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteHotel(id: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/hotels/${id}`, {
      method: 'DELETE',
    });
  }

  // Rooms & Inventory
  async getRooms(params: { q?: string; building?: string; hotelId?: string; status?: string } = {}): Promise<ApiResponse<RoomListItem[]>> {
    const query = new URLSearchParams();
    if (params.q) query.set('q', params.q);
    if (params.building) query.set('building', params.building);
    if (params.hotelId) query.set('hotelId', params.hotelId);
    if (params.status) query.set('status', params.status);
    const qs = query.toString();
    return this.request<RoomListItem[]>(`/rooms${qs ? `?${qs}` : ''}`, { method: 'GET' });
  }

  async getRoom(id: string): Promise<ApiResponse<RoomDetail>> {
    return this.request<RoomDetail>(`/rooms/${id}`, { method: 'GET' });
  }

  async createRoom(data: CreateRoomInput): Promise<ApiResponse<RoomDetail>> {
    return this.request<RoomDetail>('/rooms', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createBulkRooms(data: CreateBulkRoomsInput): Promise<ApiResponse<BulkRoomsResponse>> {
    return this.request<BulkRoomsResponse>('/rooms/bulk', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateRoom(id: string, data: UpdateRoomInput): Promise<ApiResponse<RoomDetail>> {
    return this.request<RoomDetail>(`/rooms/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async addUnit(roomId: string, data: AddUnitInput): Promise<ApiResponse<any>> {
    return this.request<any>(`/rooms/${roomId}/units`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateUnit(roomId: string, unitId: string, data: { status?: UnitStatus; genderCategory?: GenderCategory; notes?: string }): Promise<ApiResponse<any>> {
    return this.request<any>(`/rooms/${roomId}/units/${unitId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async rewriteUnitStatus(
    unitId: string, 
    action: 'CHECK_IN' | 'CHECK_OUT' | 'RELEASE_ALLOCATION' | 'SET_MAINTENANCE' | 'SET_ACTIVE', 
    options?: {
      notes?: string;
      checkInDateTime?: string;
      checkOutDateTime?: string;
      participants?: Array<{
        unitId?: string;
        fullName: string;
        gender?: string | null;
        age?: number | null;
        aadhaarNumber?: string | null;
      }>;
    }
  ): Promise<ApiResponse<any>> {
    return this.request<any>(`/rooms/units/${unitId}/rewrite-status`, {
      method: 'POST',
      body: JSON.stringify({ action, ...(options || {}) }),
    });
  }

  async deleteRoom(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/rooms/${id}`, { method: 'DELETE' });
  }

  async deleteBulkRooms(roomIds: string[]): Promise<ApiResponse<{ deletedCount: number; deletedRoomNumbers: string[] }>> {
    return this.request<{ deletedCount: number; deletedRoomNumbers: string[] }>('/rooms/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ roomIds }),
    });
  }

  async bulkAssignHotel(roomIds: string[], hotelId: string): Promise<ApiResponse<any>> {
    return this.request<any>('/rooms/bulk-assign-hotel', {
      method: 'POST',
      body: JSON.stringify({ roomIds, hotelId }),
    });
  }

  // Registrations Management (Phase 5)
  async getRegistrations(params: {
    page?: number;
    limit?: number;
    q?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    isArchived?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<ApiResponse<RegistrationListItem[]> & { pagination?: any; metrics?: any }> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page.toString());
    if (params.limit) query.set('limit', params.limit.toString());
    if (params.q) query.set('q', params.q);
    if (params.status && params.status !== 'ALL') query.set('status', params.status);
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    if (params.isArchived !== undefined) query.set('isArchived', params.isArchived.toString());
    if (params.sortBy) query.set('sortBy', params.sortBy);
    if (params.sortOrder) query.set('sortOrder', params.sortOrder);
    const qs = query.toString();
    return this.request<RegistrationListItem[]>(`/registrations${qs ? `?${qs}` : ''}`, { method: 'GET' });
  }

  async getRegistration(id: string): Promise<ApiResponse<RegistrationDetail>> {
    return this.request<RegistrationDetail>(`/registrations/${id}`, { method: 'GET' });
  }

  async createRegistration(data: CreateRegistrationInput): Promise<ApiResponse<RegistrationListItem>> {
    return this.request<RegistrationListItem>('/registrations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateRegistration(id: string, data: UpdateRegistrationInput): Promise<ApiResponse<RegistrationListItem>> {
    return this.request<RegistrationListItem>(`/registrations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async archiveRegistration(id: string): Promise<ApiResponse<RegistrationListItem>> {
    return this.request<RegistrationListItem>(`/registrations/${id}`, {
      method: 'DELETE',
    });
  }

  async restoreRegistration(id: string): Promise<ApiResponse<RegistrationListItem>> {
    return this.request<RegistrationListItem>(`/registrations/restore/${id}`, {
      method: 'POST',
    });
  }

  async previewRegistrationImport(body: { rows?: any[]; fileBase64?: string }): Promise<ApiResponse<ExcelImportPreviewData>> {
    return this.request<ExcelImportPreviewData>('/registrations/import/preview', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async executeRegistrationImport(rows: any[]): Promise<ApiResponse<{ importedCount: number; registrations: any[] }>> {
    return this.request<{ importedCount: number; registrations: any[] }>('/registrations/import', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    });
  }

  getExportRegistrationsUrl(params: { q?: string; status?: string; startDate?: string; endDate?: string } = {}): string {
    const query = new URLSearchParams();
    if (params.q) query.set('q', params.q);
    if (params.status && params.status !== 'ALL') query.set('status', params.status);
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    const qs = query.toString();
    return `${this.baseUrl}/registrations/export${qs ? `?${qs}` : ''}`;
  }

  getTemplateDownloadUrl(): string {
    return `${this.baseUrl}/registrations/template`;
  }

  // Allocation Engine (Phase 6)
  async checkAvailability(params: {
    entryDate: string;
    exitDate: string;
    hotelId?: string;
    genderCategory?: GenderCategory;
    unitType?: UnitType;
    building?: string;
    roomCategory?: GenderPreference;
    excludeAllocationId?: string;
  }): Promise<ApiResponse<CheckAvailabilityData>> {
    const query = new URLSearchParams();
    query.set('entryDate', params.entryDate);
    query.set('exitDate', params.exitDate);
    if (params.hotelId && params.hotelId !== 'ALL') query.set('hotelId', params.hotelId);
    if (params.genderCategory) query.set('genderCategory', params.genderCategory);
    if (params.unitType) query.set('unitType', params.unitType);
    if (params.building && params.building !== 'ALL') query.set('building', params.building);
    if (params.roomCategory && (params.roomCategory as any) !== 'ALL') query.set('roomCategory', params.roomCategory);
    if (params.excludeAllocationId) query.set('excludeAllocationId', params.excludeAllocationId);
    return this.request<CheckAvailabilityData>(`/allocations/availability?${query.toString()}`, { method: 'GET' });
  }

  async getAllocations(params: {
    page?: number;
    limit?: number;
    q?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    roomId?: string;
    registrationId?: string;
  } = {}): Promise<ApiResponse<AllocationListItem[]> & { pagination?: any; metrics?: any }> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page.toString());
    if (params.limit) query.set('limit', params.limit.toString());
    if (params.q) query.set('q', params.q);
    if (params.status && params.status !== 'ALL') query.set('status', params.status);
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    if (params.roomId) query.set('roomId', params.roomId);
    if (params.registrationId) query.set('registrationId', params.registrationId);
    const qs = query.toString();
    return this.request<AllocationListItem[]>(`/allocations${qs ? `?${qs}` : ''}`, { method: 'GET' });
  }

  async getAllocation(id: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/allocations/${id}`, { method: 'GET' });
  }

  async createAllocation(data: CreateAllocationInput): Promise<ApiResponse<any>> {
    return this.request<any>('/allocations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAllocation(id: string, data: UpdateAllocationInput): Promise<ApiResponse<any>> {
    return this.request<any>(`/allocations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async cancelAllocation(id: string, reason?: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/allocations/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // WhatsApp Click-to-Chat Integration
  async prepareWhatsAppMessage(data: {
    allocationId: string;
    helpdeskContact?: string;
    customNotes?: string;
  }): Promise<ApiResponse<WhatsAppPreparedData>> {
    return this.request<WhatsAppPreparedData>('/whatsapp/prepare', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async recordWhatsAppOpened(messageLogId: string): Promise<ApiResponse<MessageLogItem>> {
    return this.request<MessageLogItem>(`/whatsapp/messages/${messageLogId}/open`, {
      method: 'PATCH',
    });
  }

  async confirmWhatsAppSent(messageLogId: string, notes?: string): Promise<ApiResponse<MessageLogItem>> {
    return this.request<MessageLogItem>(`/whatsapp/messages/${messageLogId}/confirm-sent`, {
      method: 'PATCH',
      body: JSON.stringify({ notes }),
    });
  }

  async recordWhatsAppFailed(messageLogId: string, reason: string): Promise<ApiResponse<MessageLogItem>> {
    return this.request<MessageLogItem>(`/whatsapp/messages/${messageLogId}/failed`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
  }

  async getWhatsAppMessages(params: {
    registrationId?: string;
    allocationId?: string;
    status?: MessageStatus;
    page?: number;
    limit?: number;
  } = {}): Promise<ApiResponse<{ logs: MessageLogItem[]; pagination: any }>> {
    const query = new URLSearchParams();
    if (params.registrationId) query.set('registrationId', params.registrationId);
    if (params.allocationId) query.set('allocationId', params.allocationId);
    if (params.status) query.set('status', params.status);
    if (params.page) query.set('page', params.page.toString());
    if (params.limit) query.set('limit', params.limit.toString());
    const qs = query.toString();
    return this.request<{ logs: MessageLogItem[]; pagination: any }>(`/whatsapp/messages${qs ? `?${qs}` : ''}`, {
      method: 'GET',
    });
  }

  // Reception Desk & Occupancy Endpoints
  async getReceptionOverview(params: {
    tab?: string;
    q?: string;
    hotelId?: string;
    roomCategory?: string;
    roomNumber?: string;
    building?: string;
    registrationId?: string;
    primaryName?: string;
    phone?: string;
    gender?: string;
    checkInStatus?: string;
    checkOutStatus?: string;
    arrivalDate?: string;
    checkInDate?: string;
    checkOutDate?: string;
    arrivalStatus?: string;
    allocationStatus?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<ApiResponse<{ metrics: ReceptionMetrics; tab: string; records: any[]; pagination: any }>> {
    const query = new URLSearchParams();
    if (params.tab) query.set('tab', params.tab);
    if (params.q) query.set('q', params.q);
    if (params.hotelId) query.set('hotelId', params.hotelId);
    if (params.roomCategory) query.set('roomCategory', params.roomCategory);
    if (params.roomNumber) query.set('roomNumber', params.roomNumber);
    if (params.building) query.set('building', params.building);
    if (params.registrationId) query.set('registrationId', params.registrationId);
    if (params.primaryName) query.set('primaryName', params.primaryName);
    if (params.phone) query.set('phone', params.phone);
    if (params.gender) query.set('gender', params.gender);
    if (params.checkInStatus) query.set('checkInStatus', params.checkInStatus);
    if (params.checkOutStatus) query.set('checkOutStatus', params.checkOutStatus);
    if (params.arrivalDate) query.set('arrivalDate', params.arrivalDate);
    if (params.checkInDate) query.set('checkInDate', params.checkInDate);
    if (params.checkOutDate) query.set('checkOutDate', params.checkOutDate);
    if (params.arrivalStatus) query.set('arrivalStatus', params.arrivalStatus);
    if (params.allocationStatus) query.set('allocationStatus', params.allocationStatus);
    if (params.page) query.set('page', params.page.toString());
    if (params.limit) query.set('limit', params.limit.toString());
    const qs = query.toString();
    return this.request<any>(`/reception/overview${qs ? `?${qs}` : ''}`, { method: 'GET' });
  }

  async searchReception(q: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/reception/lookup?q=${encodeURIComponent(q)}`, { method: 'GET' });
  }

  async getParticipantProfile(id: string): Promise<ApiResponse<UnifiedParticipantProfile>> {
    return this.request<UnifiedParticipantProfile>(`/reception/participant-profile/${id}`, { method: 'GET' });
  }

  async getReceptionDossier(id: string): Promise<ApiResponse<ReceptionDossierData>> {
    return this.request<ReceptionDossierData>(`/reception/dossier/${id}`, { method: 'GET' });
  }

  async recordReceptionParticipants(data: {
    registrationId: string;
    participants: Array<{
      id?: string;
      fullName: string;
      phone?: string | null;
      gender?: string | null;
      age?: number | null;
      relationToPrimary?: string | null;
      isPrimary?: boolean;
      notes?: string | null;
    }>;
  }): Promise<ApiResponse<any>> {
    return this.request<any>('/reception/participants', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async collectReceptionAadhaar(data: {
    participantId: string;
    aadhaarNumber: string;
    retentionConsent: boolean;
    complianceStatus?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<any>('/reception/aadhaar', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async confirmReception(data: {
    allocationId: string;
    participantAssignments: Array<{
      participantId: string;
      unitId: string;
      allocationItemId?: string;
    }>;
  }): Promise<ApiResponse<any>> {
    return this.request<any>('/reception/confirm', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async checkInParticipants(data: {
    registrationId: string;
    allocationId?: string;
    checkIns: Array<{
      participantId: string;
      unitId: string;
      allocationItemId?: string;
      notes?: string;
    }>;
  }): Promise<ApiResponse<any>> {
    return this.request<any>('/reception/check-in', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async checkOutParticipant(stayRecordId: string, notes?: string): Promise<ApiResponse<any>> {
    return this.request<any>('/reception/check-out', {
      method: 'POST',
      body: JSON.stringify({ stayRecordId, notes }),
    });
  }

  async batchCheckOutParticipants(data: { stayRecordIds: string[]; notes?: string }): Promise<ApiResponse<any>> {
    return this.request<any>('/reception/batch-check-out', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async transferParticipantStay(data: {
    stayRecordId: string;
    newUnitId: string;
    reason: string;
  }): Promise<ApiResponse<any>> {
    return this.request<any>('/reception/transfer', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async extendParticipantStay(data: {
    stayRecordId: string;
    newExitDate: string;
    notes?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<any>('/reception/extend-stay', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async extendStay(data: {
    stayRecordId: string;
    newExitDate: string;
    notes?: string;
  }): Promise<ApiResponse<any>> {
    return this.extendParticipantStay(data);
  }

  async changeAssignment(data: {
    participantId?: string;
    allocationItemId?: string;
    stayRecordId?: string;
    newUnitId: string;
    reason: string;
  }): Promise<ApiResponse<any>> {
    return this.request<any>('/reception/change-assignment', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async batchChangeAssignment(data: {
    assignments: Array<{
      participantId?: string | null;
      allocationItemId?: string | null;
      stayRecordId?: string | null;
      newUnitId: string;
    }>;
    reason: string;
  }): Promise<ApiResponse<any>> {
    return this.request<any>('/reception/batch-change-assignment', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateParticipantPhone(participantId: string, phone: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/reception/participants/${participantId}/phone`, {
      method: 'PUT',
      body: JSON.stringify({ phone }),
    });
  }

  // Accidental Checkout Recovery (Check In Again)
  async checkInAgain(data: {
    participantId: string;
    unitId: string;
    checkInDateTime?: string | null;
    checkOutDateTime?: string | null;
    notes?: string | null;
  }): Promise<ApiResponse<any>> {
    return this.request<any>('/reception/check-in-again', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Phase 9: Global Search
  async globalSearch(q: string, type: string = 'ALL', limit: number = 15): Promise<ApiResponse<any[]>> {
    const query = new URLSearchParams({ q, type, limit: limit.toString() }).toString();
    return this.request<any[]>(`/search?${query}`, { method: 'GET' });
  }

  // Phase 9: Activity Logs & Audit Trail
  async getActivityLogs(params: Record<string, any> = {}): Promise<ApiResponse<any[]>> {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        searchParams.append(key, val.toString());
      }
    });
    return this.request<any[]>(`/activity?${searchParams.toString()}`, { method: 'GET' });
  }

  async getActivityInsights(): Promise<ApiResponse<any>> {
    return this.request<any>('/activity/insights', { method: 'GET' });
  }

  async getActivityStaff(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/activity/staff', { method: 'GET' });
  }

  // Phase 10: Reports & Analytics
  async getReportOverview(startDate?: string, endDate?: string, hotelId?: string): Promise<ApiResponse<any>> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (hotelId && hotelId !== 'ALL') params.append('hotelId', hotelId);
    return this.request<any>(`/reports/overview?${params.toString()}`, { method: 'GET' });
  }

  async getOccupancyReport(startDate?: string, endDate?: string, hotelId?: string): Promise<ApiResponse<any>> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (hotelId && hotelId !== 'ALL') params.append('hotelId', hotelId);
    return this.request<any>(`/reports/occupancy?${params.toString()}`, { method: 'GET' });
  }

  async getRegistrationReport(startDate?: string, endDate?: string, hotelId?: string): Promise<ApiResponse<any>> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (hotelId && hotelId !== 'ALL') params.append('hotelId', hotelId);
    return this.request<any>(`/reports/registrations?${params.toString()}`, { method: 'GET' });
  }

  async getParticipantReport(startDate?: string, endDate?: string, hotelId?: string): Promise<ApiResponse<any>> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (hotelId && hotelId !== 'ALL') params.append('hotelId', hotelId);
    return this.request<any>(`/reports/participants?${params.toString()}`, { method: 'GET' });
  }

  async getDailyOperationalReport(startDate?: string, endDate?: string, hotelId?: string): Promise<ApiResponse<any[]>> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (hotelId && hotelId !== 'ALL') params.append('hotelId', hotelId);
    return this.request<any[]>(`/reports/operational-daily?${params.toString()}`, { method: 'GET' });
  }

  // Staff Account Management (Admin only)
  async listStaff(params?: { q?: string; role?: string; status?: string }): Promise<ApiResponse<AdminUser[]>> {
    const query = new URLSearchParams();
    if (params?.q) query.set('q', params.q);
    if (params?.role && params.role !== 'ALL') query.set('role', params.role);
    if (params?.status && params.status !== 'ALL') query.set('status', params.status);
    const qs = query.toString();
    return this.request<AdminUser[]>(`/auth/staff${qs ? `?${qs}` : ''}`, { method: 'GET' });
  }

  async createStaff(data: { name: string; email: string; password: string; role: UserRole; phone?: string; mustChangePassword?: boolean }): Promise<ApiResponse<AdminUser>> {
    return this.request<AdminUser>('/auth/staff', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateStaff(id: string, data: Partial<{ name: string; email: string; password: string; role: UserRole; phone: string; status: UserStatus; mustChangePassword: boolean }>): Promise<ApiResponse<AdminUser>> {
    return this.request<AdminUser>(`/auth/staff/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteStaff(id: string): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>(`/auth/staff/${id}`, { method: 'DELETE' });
  }

  async resetStaffPassword(id: string, newPassword?: string): Promise<ApiResponse<{ staff: AdminUser; temporaryPassword: string }>> {
    return this.request<{ staff: AdminUser; temporaryPassword: string }>(`/auth/staff/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    });
  }

  async changeOwnPassword(data: { currentPassword: string; newPassword: string }): Promise<ApiResponse<{ user: AdminUser; message: string }>> {
    return this.request<{ user: AdminUser; message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Generic REST
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async put<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient(API_BASE_URL);
