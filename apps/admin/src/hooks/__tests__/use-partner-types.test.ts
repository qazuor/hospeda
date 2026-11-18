/**
 * Unit tests for the pure helpers of `use-partner-types` (HOS-2336): the
 * in-use error reader (AC-3.4) and the picker options (AC-4.1).
 */

import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/errors';
import { readPartnerTypeInUse, toPartnerTypeOptions } from '../use-partner-types';

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));
vi.mock('@/utils/logger', () => ({ adminLogger: { error: vi.fn() } }));

const ACTIVE = {
    id: '11111111-1111-4111-8111-111111111111',
    slug: 'media',
    nameI18n: { es: 'Medio' },
    lifecycleState: 'ACTIVE',
    deletedAt: null
};
const INACTIVE = {
    id: '22222222-2222-4222-8222-222222222222',
    slug: 'legacy',
    nameI18n: { es: '' },
    lifecycleState: 'INACTIVE',
    deletedAt: null
};
const rows = [ACTIVE, INACTIVE] as unknown as Parameters<typeof toPartnerTypeOptions>[0]['rows'];

describe('readPartnerTypeInUse', () => {
    it('reads the count of a 409 PARTNER_TYPE_IN_USE', () => {
        const error = new ApiError('conflict', {
            status: 409,
            code: 'PARTNER_TYPE_IN_USE' as never,
            details: { count: 4 }
        });
        expect(readPartnerTypeInUse({ error })).toEqual({ inUse: true, count: 4 });
    });

    it('does not treat another 409 or a plain error as in use', () => {
        const conflict = new ApiError('dup', { status: 409, code: 'ALREADY_EXISTS' as never });
        expect(readPartnerTypeInUse({ error: conflict })).toEqual({ inUse: false, count: null });
        expect(readPartnerTypeInUse({ error: new Error('x') })).toEqual({
            inUse: false,
            count: null
        });
    });
});

describe('toPartnerTypeOptions', () => {
    it('offers ACTIVE types only when the current type is active', () => {
        expect(toPartnerTypeOptions({ rows, currentTypeId: ACTIVE.id })).toEqual([
            { value: ACTIVE.id, slug: 'media', label: 'Medio', inactive: false }
        ]);
    });

    it('keeps the current inactive type, flagged, labelled by slug when unnamed', () => {
        expect(toPartnerTypeOptions({ rows, currentTypeId: INACTIVE.id })).toEqual([
            { value: ACTIVE.id, slug: 'media', label: 'Medio', inactive: false },
            { value: INACTIVE.id, slug: 'legacy', label: 'legacy', inactive: true }
        ]);
    });
});
