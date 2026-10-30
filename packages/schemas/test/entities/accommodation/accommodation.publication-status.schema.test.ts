/**
 * HOS-1641 (AC:V6:32) — the accommodation contract carries `publicationStatus`
 * instead of the six old state columns.
 *
 * Lives in its own file because `accommodation.schema.test.ts` is already past
 * the 500-line limit.
 */
import { describe, expect, it } from 'vitest';
import { BaseLifecycleFields } from '../../../src/common/lifecycle.schema.js';
import { BaseModerationFields } from '../../../src/common/moderation.schema.js';
import { BaseVisibilityFields } from '../../../src/common/visibility.schema.js';
import {
    AccommodationAdminSchema,
    AccommodationProtectedSchema,
    AccommodationPublicSchema
} from '../../../src/entities/accommodation/accommodation.access.schema.js';
import { AccommodationAdminSearchSchema } from '../../../src/entities/accommodation/accommodation.admin-search.schema.js';
import {
    AccommodationCreateInputSchema,
    AccommodationUpdateInputSchema
} from '../../../src/entities/accommodation/accommodation.crud.schema.js';
import { AccommodationCreateDraftHttpSchema } from '../../../src/entities/accommodation/accommodation.http.schema.js';
import { AccommodationSchema } from '../../../src/entities/accommodation/accommodation.schema.js';
import { PublicationStatusEnum } from '../../../src/enums/publication-status.enum.js';
import { createValidAccommodation } from '../../fixtures/accommodation.fixtures.js';

/**
 * The six old columns this contract no longer carries: the shared lifecycle,
 * visibility and moderation trio (read from the base field groups, so the
 * names follow those groups) plus the three accommodation-only flags.
 */
const OLD_STATE_FIELDS: readonly string[] = [
    ...Object.keys(BaseLifecycleFields),
    ...Object.keys(BaseVisibilityFields),
    ...Object.keys(BaseModerationFields),
    'ownerSuspended',
    'planRestricted',
    'billingUnpublishedAt'
];

/** The visibility column name, read from its base field group. */
const VISIBILITY_FIELDS = Object.keys(BaseVisibilityFields);

const ALL_STATES = Object.values(PublicationStatusEnum);

describe('AccommodationSchema.publicationStatus (HOS-1641)', () => {
    it.each(ALL_STATES)('accepts the %s state', (state) => {
        // Arrange
        const data = { ...createValidAccommodation(), publicationStatus: state };

        // Act
        const result = AccommodationSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.publicationStatus).toBe(state);
        }
    });

    it('rejects a value outside the six states (the old ACTIVE)', () => {
        const result = AccommodationSchema.safeParse({
            ...createValidAccommodation(),
            publicationStatus: 'ACTIVE'
        });
        expect(result.success).toBe(false);
    });

    it('no longer declares any of the six old columns', () => {
        const keys = Object.keys(AccommodationSchema.shape);
        expect(OLD_STATE_FIELDS).toHaveLength(6);
        for (const field of OLD_STATE_FIELDS) {
            expect(keys).not.toContain(field);
        }
    });
});

describe('accommodation write inputs never take publicationStatus (R3)', () => {
    const INPUTS = [
        { name: 'AccommodationCreateInputSchema', schema: AccommodationCreateInputSchema },
        { name: 'AccommodationUpdateInputSchema', schema: AccommodationUpdateInputSchema },
        { name: 'AccommodationCreateDraftHttpSchema', schema: AccommodationCreateDraftHttpSchema }
    ] as const;

    for (const { name, schema } of INPUTS) {
        it(`${name} does not declare publicationStatus`, () => {
            expect(Object.keys(schema.shape)).not.toContain('publicationStatus');
        });
    }

    it('the update input strips a publicationStatus sent in the body', () => {
        const result = AccommodationUpdateInputSchema.safeParse({
            name: 'A Valid Accommodation Name',
            publicationStatus: PublicationStatusEnum.PUBLISHED
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).not.toHaveProperty('publicationStatus');
        }
    });
});

describe('accommodation read tiers (H3)', () => {
    it('the PUBLIC tier exposes neither visibility nor publicationStatus', () => {
        const keys = Object.keys(AccommodationPublicSchema.shape);
        expect(VISIBILITY_FIELDS.length).toBeGreaterThan(0);
        for (const field of VISIBILITY_FIELDS) {
            expect(keys).not.toContain(field);
        }
        expect(keys).not.toContain('publicationStatus');
    });

    it.each([
        ['AccommodationProtectedSchema', AccommodationProtectedSchema],
        ['AccommodationAdminSchema', AccommodationAdminSchema]
    ] as const)('%s exposes publicationStatus and none of the old columns', (_name, schema) => {
        const keys = Object.keys(schema.shape);
        expect(keys).toContain('publicationStatus');
        for (const field of OLD_STATE_FIELDS) {
            expect(keys).not.toContain(field);
        }
    });
});

describe('AccommodationAdminSearchSchema.status filters by publicationStatus (H7)', () => {
    it.each(ALL_STATES)('accepts %s', (state) => {
        const result = AccommodationAdminSearchSchema.safeParse({ status: state });
        expect(result.success).toBe(true);
    });

    it('accepts all and defaults to it', () => {
        expect(AccommodationAdminSearchSchema.parse({ status: 'all' }).status).toBe('all');
        expect(AccommodationAdminSearchSchema.parse({}).status).toBe('all');
    });

    it('rejects the old lifecycle value ACTIVE', () => {
        const result = AccommodationAdminSearchSchema.safeParse({ status: 'ACTIVE' });
        expect(result.success).toBe(false);
    });
});
