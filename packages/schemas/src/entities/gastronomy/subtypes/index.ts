/**
 * Gastronomy Subtypes — specialized schemas for gastronomy-specific sub-entities.
 */

// Daily-special schemas (HOS-1041 — the menú del día, with its own validity window)
export * from './gastronomy.daily-special.schema.js';
// Venue events schemas (HOS-1042 — the venue's own agenda, with recurrence)
export * from './gastronomy.event.schema.js';

// FAQ schemas
export * from './gastronomy.faq.schema.js';

// Media schemas (HOS-372 relational gallery, mirrors accommodation.media.schema.ts)
export * from './gastronomy.media.schema.js';

// Menu schemas (HOS-895 — structured carta, uploaded photo/PDF, external link)
export * from './gastronomy.menu.schema.js';

// Review schemas (uses CommerceRatingSchema for the rating breakdown)
export * from './gastronomy.review.schema.js';
