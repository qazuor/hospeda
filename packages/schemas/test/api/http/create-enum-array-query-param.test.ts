/**
 * Tests for `createEnumArrayQueryParam` and the filters that use it (HOS-1974).
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createEnumArrayQueryParam } from '../../../src/api/http/base-http.schema.js';
import { AmenitySearchHttpSchema } from '../../../src/entities/amenity/amenity.http.schema.js';
import { EventLocationSearchHttpSchema } from '../../../src/entities/eventLocation/eventLocation.http.schema.js';
import { PermissionSearchHttpSchema } from '../../../src/entities/permission/permission.http.schema.js';
import { PostSponsorSearchHttpSchema } from '../../../src/entities/postSponsor/postSponsor.http.schema.js';
import { UserSearchHttpSchema } from '../../../src/entities/user/user.http.schema.js';
import {
    AmenitiesTypeEnumSchema,
    ClientTypeEnum,
    LifecycleStatusEnum,
    PermissionEnum,
    RoleEnum,
    VenueTypeEnum
} from '../../../src/enums/index.js';

describe('createEnumArrayQueryParam', () => {
    const schema = z.object({ types: createEnumArrayQueryParam('d', AmenitiesTypeEnumSchema) });

    it('upper-cases and trims every item by default', () => {
        const result = schema.safeParse({ types: ' kitchen , Safety' });

        expect(result.success).toBe(true);
        expect(result.data?.types).toEqual(['KITCHEN', 'SAFETY']);
    });

    it('rejects an item outside the enum, even if the others are valid', () => {
        const result = schema.safeParse({ types: 'KITCHEN,nope' });

        expect(result.success).toBe(false);
    });

    it('treats a missing or empty value as no filter', () => {
        expect(schema.safeParse({}).data?.types).toBeUndefined();
        expect(schema.safeParse({ types: '' }).data?.types).toBeUndefined();
    });

    it('does not change case with normalize: none', () => {
        const strict = z.object({
            p: createEnumArrayQueryParam('d', z.enum(['a.b', 'A.B']), { normalize: 'none' })
        });

        expect(strict.safeParse({ p: 'a.b' }).data?.p).toEqual(['a.b']);
        expect(strict.safeParse({ p: 'c.d' }).success).toBe(false);
    });
});

describe('enum-backed array filters reject values outside their enum', () => {
    const cases: ReadonlyArray<{
        name: string;
        schema: z.ZodType;
        key: string;
        valid: string;
        expected: string;
    }> = [
        {
            name: 'amenity types',
            schema: AmenitySearchHttpSchema,
            key: 'types',
            valid: 'kitchen',
            expected: 'KITCHEN'
        },
        {
            name: 'eventLocation venueTypes',
            schema: EventLocationSearchHttpSchema,
            key: 'venueTypes',
            valid: VenueTypeEnum.BAR.toLowerCase(),
            expected: VenueTypeEnum.BAR
        },
        {
            name: 'postSponsor types',
            schema: PostSponsorSearchHttpSchema,
            key: 'types',
            valid: ClientTypeEnum.HOST.toLowerCase(),
            expected: ClientTypeEnum.HOST
        },
        {
            name: 'user roles',
            schema: UserSearchHttpSchema,
            key: 'roles',
            valid: RoleEnum.HOST.toLowerCase(),
            expected: RoleEnum.HOST
        },
        {
            name: 'user statuses',
            schema: UserSearchHttpSchema,
            key: 'statuses',
            valid: LifecycleStatusEnum.ACTIVE.toLowerCase(),
            expected: LifecycleStatusEnum.ACTIVE
        },
        {
            name: 'permission roles',
            schema: PermissionSearchHttpSchema,
            key: 'roles',
            valid: RoleEnum.ADMIN.toLowerCase(),
            expected: RoleEnum.ADMIN
        }
    ];

    for (const { name, schema, key, valid, expected } of cases) {
        it(`${name}: invalid value fails, lower-case valid value is upper-cased`, () => {
            const bad = schema.safeParse({ [key]: 'definitely_not_valid' });
            const good = schema.safeParse({ [key]: valid });

            expect(bad.success).toBe(false);
            expect(good.success).toBe(true);
            expect((good.data as Record<string, unknown>)[key]).toEqual([expected]);
        });
    }

    it('permission permissions: case-sensitive enum, invalid fails, exact value passes', () => {
        const exact = PermissionEnum.ACCOMMODATION_CREATE;

        expect(PermissionSearchHttpSchema.safeParse({ permissions: 'nope.nope' }).success).toBe(
            false
        );
        expect(
            PermissionSearchHttpSchema.safeParse({ permissions: exact }).data?.permissions
        ).toEqual([exact]);
    });
});
