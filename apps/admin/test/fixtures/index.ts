/**
 * Test Fixtures Barrel Export
 *
 * Re-exports all fixture files for convenient access in tests.
 * Import from '@test/fixtures' instead of individual fixture files.
 */

// Core entities
export * from './accommodation.fixture';
export * from './destination.fixture';
export * from './event.fixture';
export * from './user.fixture';
export * from './tag.fixture';
export * from './post.fixture';
export * from './sponsor.fixture';

// Billing entities
export * from './billing-plan.fixture';
export * from './billing-addon.fixture';
export * from './billing-subscription.fixture';
export * from './billing-invoice.fixture';
export * from './promo-code.fixture';
export * from './owner-promotion.fixture';
export * from './sponsorship.fixture';

// System entities
export * from './webhook-event.fixture';
export * from './notification-log.fixture';
export * from './role.fixture';
