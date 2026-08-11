/**
 * Gastronomy Subtypes — specialized schemas for gastronomy-specific sub-entities.
 */

// FAQ schemas
export * from './gastronomy.faq.schema.js';

// Media schemas (HOS-372 relational gallery, mirrors accommodation.media.schema.ts)
export * from './gastronomy.media.schema.js';

// Review schemas (uses CommerceRatingSchema for the rating breakdown)
export * from './gastronomy.review.schema.js';
