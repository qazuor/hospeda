/**
 * Experience Subtypes — specialized schemas for experience-specific sub-entities.
 */

// Certificate schemas (HOS-1057 — what a provider issues to whoever did the
// experience)
export * from './experience.certificate.schema.js';

// FAQ schemas
export * from './experience.faq.schema.js';

// Media schemas (HOS-372 relational gallery, mirrors accommodation.media.schema.ts)
export * from './experience.media.schema.js';

// Review schemas (uses CommerceRatingSchema for the rating breakdown)
export * from './experience.review.schema.js';
