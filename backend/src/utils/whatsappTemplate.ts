/**
 * WhatsApp Template and Click-to-Chat URL Generation Utility
 *
 * Implements standard, non-API WhatsApp Click-to-Chat deep links:
 * https://wa.me/<PHONE_NUMBER>?text=<ENCODED_MESSAGE>
 *
 * CRITICAL COMPLIANCE RULES:
 * 1. MANDATORY DISCLAIMER: "TENTATIVE ACCOMMODATION ALLOCATION – NOT CONFIRMED"
 * 2. ZERO AADHAAR DISCLOSURE: Strictly no Aadhaar numbers (full or partial) or sensitive KYC tokens.
 * 3. URL-SAFE ENCODING: Standard encodeURIComponent for clean cross-device rendering.
 */

export interface AllocatedRoomDetail {
  roomNumber: string;
  building?: string | null;
  floor?: number | null;
  units: Array<{
    unitNumber: string;
    type: string; // 'BED' | 'MAT'
  }>;
}

export interface AllocationMessagePayload {
  organizationName?: string;
  registrationId: string;
  primaryName: string;
  totalMembers: number;
  allocationNumber: string;
  rooms: AllocatedRoomDetail[];
  entryDate: Date | string;
  exitDate: Date | string;
  helpdeskContact?: string;
  customNotes?: string;
}

/**
 * Normalizes phone numbers to standard international format without '+' or spaces.
 * Assumes Indian mobile numbers (10 digits prepend 91).
 */
export function formatPhoneNumberForWhatsApp(rawMobile: string): string {
  if (!rawMobile || typeof rawMobile !== 'string') {
    throw new Error('A valid mobile phone number is required');
  }

  // Strip all non-digit characters
  let digits = rawMobile.replace(/\D/g, '');

  if (!digits) {
    throw new Error('Mobile number contains no valid digits');
  }

  // Remove leading zeros
  digits = digits.replace(/^0+/, '');

  // If 10 digits (standard Indian mobile), prepend 91
  if (digits.length === 10) {
    digits = '91' + digits;
  } else if (digits.length === 12 && digits.startsWith('91')) {
    // Already has 91 prefix
  } else if (digits.length < 10 || digits.length > 15) {
    throw new Error(`Invalid mobile number length (${digits.length} digits): ${rawMobile}`);
  }

  return digits;
}

/**
 * Formats a Date object or ISO string into a human-readable Indian Standard Time string.
 */
export function formatReadableDateTime(dateInput: Date | string): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) {
    return String(dateInput);
  }

  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Generates the standardized WhatsApp accommodation tentative allocation message.
 */
export function generateAllocationMessage(payload: AllocationMessagePayload): string {
  const org = payload.organizationName?.trim() || 'Accommodation Management Desk';
  const entryFormatted = formatReadableDateTime(payload.entryDate);
  const exitFormatted = formatReadableDateTime(payload.exitDate);

  // Group unit descriptions by room
  const roomLines = payload.rooms.map((r) => {
    const loc = [r.building, r.floor !== null && r.floor !== undefined ? `Floor ${r.floor}` : null]
      .filter(Boolean)
      .join(', ');
    const locStr = loc ? ` (${loc})` : '';

    const unitList = r.units.map((u) => `${u.type === 'MAT' ? 'Mat' : 'Bed'} ${u.unitNumber}`).join(', ');
    return `• *Room ${r.roomNumber}*${locStr}: ${unitList || 'Assigned units'}`;
  });

  const lines: string[] = [
    `*${org.toUpperCase()}*`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `*⚠️ TENTATIVE ACCOMMODATION ALLOCATION – NOT CONFIRMED ⚠️*`,
    ``,
    `Dear *${payload.primaryName.trim()}*,`,
    `A tentative accommodation allocation has been prepared for your registration.`,
    ``,
    `*Registration Details:*`,
    `• *Registration ID:* ${payload.registrationId}`,
    `• *Allocation Number:* ${payload.allocationNumber}`,
    `• *Primary Registrant:* ${payload.primaryName}`,
    `• *Total Registered Members:* ${payload.totalMembers}`,
    ``,
    `*Stay Schedule:*`,
    `• *Check-in (Entry):* ${entryFormatted}`,
    `• *Check-out (Exit):* ${exitFormatted}`,
    ``,
    `*Allocated Units (Tentative):*`,
    roomLines.length > 0 ? roomLines.join('\n') : `• Units assigned per Allocation ${payload.allocationNumber}`,
    ``,
    `*IMPORTANT RECEPTION INSTRUCTIONS:*`,
    `1. *Final Confirmation:* This is a *tentative allocation* and does NOT guarantee confirmed stay. Confirmation occurs strictly at the Reception Desk upon arrival.`,
    `2. *Identity Verification:* All arriving members must carry government-issued identity documents (e.g. Aadhaar, Voter ID, Passport) for on-site registration.`,
    `3. *Actual Member Check-in:* Actual arriving members will be verified and mapped to beds/mats at reception.`,
    `4. *Presentation:* Please present Registration ID *${payload.registrationId}* at the reception counter upon arrival.`,
  ];

  if (payload.customNotes && payload.customNotes.trim()) {
    lines.push(``, `*Special Note:* ${payload.customNotes.trim()}`);
  }

  const contact = payload.helpdeskContact?.trim() || 'Reception Desk';
  lines.push(
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `For any queries or assistance, contact: *${contact}*`,
    `Have a safe journey and pleasant stay!`
  );

  const fullMessage = lines.join('\n');

  // Hard safety check: ensure no 12-digit Aadhaar pattern or raw Aadhaar data exists
  if (/\b\d{4}\s?\d{4}\s?\d{4}\b/.test(fullMessage)) {
    throw new Error('Security Violation: Aadhaar number pattern detected in generated WhatsApp message');
  }

  return fullMessage;
}

/**
 * Constructs the standard WhatsApp Click-to-Chat deep link.
 */
export function buildWhatsAppClickToChatUrl(phone: string, message: string): string {
  const normalizedPhone = formatPhoneNumberForWhatsApp(phone);
  const encodedText = encodeURIComponent(message);
  return `https://wa.me/${normalizedPhone}?text=${encodedText}`;
}
