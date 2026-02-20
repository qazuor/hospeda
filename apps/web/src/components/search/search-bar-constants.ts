import { AccommodationTypeEnum } from '@repo/schemas';

// ---------------------------------------------------------------------------
// Accommodation Type Options
// ---------------------------------------------------------------------------

/**
 * Static list of accommodation type options for the type popover.
 * Each entry maps an enum value to an emoji icon (used as visual indicator
 * inside the popover). Translated labels come from props at runtime.
 */
export const ACCOMMODATION_TYPE_OPTIONS = [
    { value: AccommodationTypeEnum.HOTEL, emoji: '\u{1F3E8}' },
    { value: AccommodationTypeEnum.CABIN, emoji: '\u{1F3D5}' },
    { value: AccommodationTypeEnum.APARTMENT, emoji: '\u{1F3E2}' },
    { value: AccommodationTypeEnum.HOUSE, emoji: '\u{1F3E0}' },
    { value: AccommodationTypeEnum.COUNTRY_HOUSE, emoji: '\u{1F33E}' },
    { value: AccommodationTypeEnum.HOSTEL, emoji: '\u{1F6CC}' },
    { value: AccommodationTypeEnum.CAMPING, emoji: '\u{26FA}' },
    { value: AccommodationTypeEnum.ROOM, emoji: '\u{1F6CF}' },
    { value: AccommodationTypeEnum.MOTEL, emoji: '\u{1F3E9}' },
    { value: AccommodationTypeEnum.RESORT, emoji: '\u{1F3D6}' }
] as const;

// ---------------------------------------------------------------------------
// CSS Constants
// ---------------------------------------------------------------------------

/** Focus ring utility for keyboard navigation. */
export const FOCUS_RING =
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-1';

/** Base styles for popover panels. */
export const POPOVER_BASE = 'rounded-2xl border border-border bg-surface p-4 shadow-xl';

/** Base styles for field trigger buttons inside the search bar. */
export const FIELD_TRIGGER =
    'flex w-full min-w-0 items-center gap-2 px-4 py-3 text-left text-sm transition-colors hover:bg-primary-50/50';

// ---------------------------------------------------------------------------
// Guest limits
// ---------------------------------------------------------------------------

export const ADULTS_MIN = 1;
export const ADULTS_MAX = 10;
export const CHILDREN_MIN = 0;
export const CHILDREN_MAX = 6;
