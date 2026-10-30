/**
 * venue Subtypes — specialized schemas for venue-specific sub-entities.
 */

// Daily-special schemas (HOS-1041 — the menú del día, with its own validity window)
export * from './venue.daily-special.schema.js';
// Venue events schemas (HOS-1042 — the venue's own agenda, with recurrence)
export * from './venue.event.schema.js';

// FAQ schemas
export * from './venue.faq.schema.js';

// Media schemas (HOS-372 relational gallery, mirrors accommodation.media.schema.ts)
export * from './venue.media.schema.js';

// Menu schemas (HOS-895 — structured carta, uploaded photo/PDF, external link)
export * from './venue.menu.schema.js';

// Review schemas (uses venueRatingSchema for the rating breakdown)
export * from './venue.review.schema.js';
