/**
 * Entity Column Preset Options
 *
 * Reusable badge option constants for common entity types
 * (accommodations, events, etc.) and standard lifecycle/moderation states.
 */
import { BadgeColor } from '@/components/table/DataTable';
import { STATUS_BADGE_OPTIONS } from './createBaseColumns';

// ============================================================================
// Preset Options
// ============================================================================

/**
 * Common badge options for reuse
 */
export const BADGE_OPTIONS = {
    lifecycle: STATUS_BADGE_OPTIONS.lifecycle,
    moderation: STATUS_BADGE_OPTIONS.moderation,
    visibility: STATUS_BADGE_OPTIONS.visibility,
    publishStatus: STATUS_BADGE_OPTIONS.publishStatus
} as const;

/**
 * Common accommodation type options
 */
export const ACCOMMODATION_TYPE_OPTIONS = [
    { value: 'HOTEL', label: 'Hotel', color: BadgeColor.BLUE },
    { value: 'HOSTEL', label: 'Hostel', color: BadgeColor.CYAN },
    { value: 'APARTMENT', label: 'Apartment', color: BadgeColor.PURPLE },
    { value: 'HOUSE', label: 'House', color: BadgeColor.GREEN },
    { value: 'COUNTRY_HOUSE', label: 'Country House', color: BadgeColor.TEAL },
    { value: 'CABIN', label: 'Cabin', color: BadgeColor.ORANGE },
    { value: 'CAMPING', label: 'Camping', color: BadgeColor.YELLOW },
    { value: 'ROOM', label: 'Room', color: BadgeColor.PINK },
    { value: 'MOTEL', label: 'Motel', color: BadgeColor.INDIGO },
    { value: 'RESORT', label: 'Resort', color: BadgeColor.RED }
] as const;

/**
 * Common event type options
 */
export const EVENT_TYPE_OPTIONS = [
    { value: 'CONCERT', label: 'Concert', color: BadgeColor.PURPLE },
    { value: 'FESTIVAL', label: 'Festival', color: BadgeColor.ORANGE },
    { value: 'EXHIBITION', label: 'Exhibition', color: BadgeColor.BLUE },
    { value: 'CONFERENCE', label: 'Conference', color: BadgeColor.CYAN },
    { value: 'WORKSHOP', label: 'Workshop', color: BadgeColor.GREEN },
    { value: 'SPORTS', label: 'Sports', color: BadgeColor.RED },
    { value: 'THEATER', label: 'Theater', color: BadgeColor.PINK },
    { value: 'OTHER', label: 'Other', color: BadgeColor.GRAY }
] as const;
