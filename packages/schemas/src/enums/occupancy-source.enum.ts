/**
 * Occupancy source enum — origin of an `accommodation_occupancy` row.
 *
 * HOS-43 Phase 1 only writes `MANUAL` rows (host toggles the calendar UI).
 * `GOOGLE_CALENDAR`, `AIRBNB`, `BOOKING`, and `OTHER` are reserved for Phase 2/3
 * sync jobs, which own their rows via `externalEventId` and never overwrite
 * `MANUAL` rows.
 *
 * - MANUAL: Host-toggled via the occupancy calendar UI (Phase 1).
 * - GOOGLE_CALENDAR: Imported from a connected Google Calendar (Phase 2).
 * - AIRBNB: Imported from an Airbnb iCal feed (Phase 3).
 * - BOOKING: Imported from a Booking.com iCal feed (Phase 3).
 * - OTHER: Imported from a generic iCal feed (VRBO, Expedia, PMS, etc.) — named
 *   `OTHER` rather than `ICAL` because Airbnb/Booking are iCal too; `OTHER` means
 *   "another platform via iCal" (Phase 3, HOS-162).
 */
export enum OccupancySourceEnum {
    MANUAL = 'MANUAL',
    GOOGLE_CALENDAR = 'GOOGLE_CALENDAR',
    AIRBNB = 'AIRBNB',
    BOOKING = 'BOOKING',
    OTHER = 'OTHER'
}
