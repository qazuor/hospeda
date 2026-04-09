/**
 * @fileoverview
 * Type-level tests for the `EntityFilters<TSchema>` utility type.
 *
 * These tests verify at compile time that:
 * - Base fields from AdminSearchBaseSchema are excluded from EntityFilters
 * - Entity-specific fields are preserved with their correct types
 * - All entity-specific fields are optional (| undefined)
 *
 * Uses Vitest's built-in `expectTypeOf` (Vitest 3.x).
 */
import { describe, expectTypeOf, it } from 'vitest';
import type { EntityFilters } from '../../src/common/admin-search.schema.js';
import type { AccommodationAdminSearchSchema } from '../../src/entities/accommodation/accommodation.admin-search.schema.js';
import type { EventAdminSearchSchema } from '../../src/entities/event/event.admin-search.schema.js';
import type { UserAdminSearchSchema } from '../../src/entities/user/user.admin-search.schema.js';
import type { AccommodationTypeSchema } from '../../src/enums/accommodation-type.schema.js';

// Derived types used across multiple tests
type AccommodationFilters = EntityFilters<typeof AccommodationAdminSearchSchema>;
type EventFilters = EntityFilters<typeof EventAdminSearchSchema>;
type UserFilters = EntityFilters<typeof UserAdminSearchSchema>;

describe('EntityFilters<TSchema>', () => {
    describe('AccommodationAdminSearchSchema — base fields excluded', () => {
        it('should NOT have "page" in AccommodationFilters', () => {
            expectTypeOf<AccommodationFilters>().not.toHaveProperty('page');
        });

        it('should NOT have "pageSize" in AccommodationFilters', () => {
            expectTypeOf<AccommodationFilters>().not.toHaveProperty('pageSize');
        });

        it('should NOT have "search" in AccommodationFilters', () => {
            expectTypeOf<AccommodationFilters>().not.toHaveProperty('search');
        });

        it('should NOT have "sort" in AccommodationFilters', () => {
            expectTypeOf<AccommodationFilters>().not.toHaveProperty('sort');
        });

        it('should NOT have "status" in AccommodationFilters', () => {
            expectTypeOf<AccommodationFilters>().not.toHaveProperty('status');
        });

        it('should NOT have "includeDeleted" in AccommodationFilters', () => {
            expectTypeOf<AccommodationFilters>().not.toHaveProperty('includeDeleted');
        });

        it('should NOT have "createdAfter" in AccommodationFilters', () => {
            expectTypeOf<AccommodationFilters>().not.toHaveProperty('createdAfter');
        });

        it('should NOT have "createdBefore" in AccommodationFilters', () => {
            expectTypeOf<AccommodationFilters>().not.toHaveProperty('createdBefore');
        });
    });

    describe('AccommodationAdminSearchSchema — entity-specific fields present', () => {
        it('should have "type" as AccommodationTypeSchema | undefined', () => {
            expectTypeOf<AccommodationFilters>().toHaveProperty('type');
            expectTypeOf<AccommodationFilters['type']>().toEqualTypeOf<
                AccommodationTypeSchema | undefined
            >();
        });

        it('should have "destinationId" as string | undefined', () => {
            expectTypeOf<AccommodationFilters>().toHaveProperty('destinationId');
            expectTypeOf<AccommodationFilters['destinationId']>().toEqualTypeOf<
                string | undefined
            >();
        });

        it('should have "ownerId" as string | undefined', () => {
            expectTypeOf<AccommodationFilters>().toHaveProperty('ownerId');
            expectTypeOf<AccommodationFilters['ownerId']>().toEqualTypeOf<string | undefined>();
        });

        it('should have "isFeatured" as boolean | undefined', () => {
            expectTypeOf<AccommodationFilters>().toHaveProperty('isFeatured');
            expectTypeOf<AccommodationFilters['isFeatured']>().toEqualTypeOf<boolean | undefined>();
        });

        it('should have "minPrice" as number | undefined', () => {
            expectTypeOf<AccommodationFilters>().toHaveProperty('minPrice');
            expectTypeOf<AccommodationFilters['minPrice']>().toEqualTypeOf<number | undefined>();
        });

        it('should have "maxPrice" as number | undefined', () => {
            expectTypeOf<AccommodationFilters>().toHaveProperty('maxPrice');
            expectTypeOf<AccommodationFilters['maxPrice']>().toEqualTypeOf<number | undefined>();
        });
    });

    describe('EventAdminSearchSchema — base fields excluded', () => {
        it('should NOT have "page" in EventFilters', () => {
            expectTypeOf<EventFilters>().not.toHaveProperty('page');
        });

        it('should NOT have "pageSize" in EventFilters', () => {
            expectTypeOf<EventFilters>().not.toHaveProperty('pageSize');
        });

        it('should NOT have "sort" in EventFilters', () => {
            expectTypeOf<EventFilters>().not.toHaveProperty('sort');
        });

        it('should NOT have "includeDeleted" in EventFilters', () => {
            expectTypeOf<EventFilters>().not.toHaveProperty('includeDeleted');
        });
    });

    describe('EventAdminSearchSchema — entity-specific date/event fields present', () => {
        it('should have "startDateAfter" as Date | undefined', () => {
            expectTypeOf<EventFilters>().toHaveProperty('startDateAfter');
            expectTypeOf<EventFilters['startDateAfter']>().toEqualTypeOf<Date | undefined>();
        });

        it('should have "startDateBefore" as Date | undefined', () => {
            expectTypeOf<EventFilters>().toHaveProperty('startDateBefore');
            expectTypeOf<EventFilters['startDateBefore']>().toEqualTypeOf<Date | undefined>();
        });

        it('should have "endDateAfter" as Date | undefined', () => {
            expectTypeOf<EventFilters>().toHaveProperty('endDateAfter');
            expectTypeOf<EventFilters['endDateAfter']>().toEqualTypeOf<Date | undefined>();
        });

        it('should have "endDateBefore" as Date | undefined', () => {
            expectTypeOf<EventFilters>().toHaveProperty('endDateBefore');
            expectTypeOf<EventFilters['endDateBefore']>().toEqualTypeOf<Date | undefined>();
        });

        it('should have "locationId" as string | undefined', () => {
            expectTypeOf<EventFilters>().toHaveProperty('locationId');
            expectTypeOf<EventFilters['locationId']>().toEqualTypeOf<string | undefined>();
        });

        it('should have "organizerId" as string | undefined', () => {
            expectTypeOf<EventFilters>().toHaveProperty('organizerId');
            expectTypeOf<EventFilters['organizerId']>().toEqualTypeOf<string | undefined>();
        });

        it('should have "isFeatured" as boolean | undefined', () => {
            expectTypeOf<EventFilters>().toHaveProperty('isFeatured');
            expectTypeOf<EventFilters['isFeatured']>().toEqualTypeOf<boolean | undefined>();
        });
    });

    describe('UserAdminSearchSchema — base fields excluded', () => {
        it('should NOT have "page" in UserFilters', () => {
            expectTypeOf<UserFilters>().not.toHaveProperty('page');
        });

        it('should NOT have "pageSize" in UserFilters', () => {
            expectTypeOf<UserFilters>().not.toHaveProperty('pageSize');
        });

        it('should NOT have "sort" in UserFilters', () => {
            expectTypeOf<UserFilters>().not.toHaveProperty('sort');
        });
    });

    describe('UserAdminSearchSchema — entity-specific fields present', () => {
        it('should have "email" as string | undefined', () => {
            expectTypeOf<UserFilters>().toHaveProperty('email');
            expectTypeOf<UserFilters['email']>().toEqualTypeOf<string | undefined>();
        });

        it('should have "authProvider" as string | undefined', () => {
            expectTypeOf<UserFilters>().toHaveProperty('authProvider');
            expectTypeOf<UserFilters['authProvider']>().toEqualTypeOf<string | undefined>();
        });
    });
});
