/**
 * Gastronomy Subtypes — specialized schemas for gastronomy-specific sub-entities.
 */

// FAQ schemas
export * from './gastronomy.faq.schema.js';

// Review schemas (uses CommerceRatingSchema for the rating breakdown)
export * from './gastronomy.review.schema.js';
