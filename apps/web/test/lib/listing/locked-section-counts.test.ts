/**
 * @file locked-section-counts.test.ts
 * @description Unit coverage for the server-side "how much is stored" readers
 * of a locked section (HOS-1854).
 *
 * The hub and the section notice show a real number, so this module has three
 * properties worth pinning on its own: it only pays for the sections the caller
 * passed as `locked`, the carta's count is all three things it owns (dishes,
 * file and link — DEC-FAC-062), and a failed read is `null` rather than `0`.
 * Rendering "0 cargados" would claim an empty section the code cannot prove.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/lib/api/client';
import type { ListingSectionStates } from '@/lib/editor/listing-editor-registry';
import {
    readAbsentSectionCounts,
    readLockedSectionCounts,
    readRecentMenuQrScanCount
} from '@/lib/listing/locked-section-counts';

vi.mock('@/lib/api/client', () => ({
    apiClient: {
        getProtected: vi.fn()
    }
}));

const mockGetProtected = vi.mocked(apiClient.getProtected);
const LISTING_ID = '33333333-3333-4333-8333-333333333333';

const ALL_LOCKED: ListingSectionStates = {
    menu: { state: 'locked' },
    dailySpecials: { state: 'locked' },
    venueEvents: { state: 'locked' }
};

const MENU_ENVELOPE = {
    ok: true as const,
    data: {
        sections: [
            { items: [{ name: 'Empanadas' }, { name: 'Provoleta' }] },
            { items: [{ name: 'Milanesa' }] }
        ],
        file: { url: 'https://cdn.test/carta.pdf', kind: 'pdf' },
        externalUrl: 'https://menu.example/carta'
    }
};

const SPECIALS_ENVELOPE = {
    ok: true as const,
    data: { specials: [{ title: 'Milanesa del día' }, { title: 'Guiso' }] }
};

const EVENTS_ENVELOPE = {
    ok: true as const,
    data: { events: [{ title: 'Música en vivo' }] }
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe('readLockedSectionCounts (HOS-1854)', () => {
    it('reads only the sections the caller passed as locked', async () => {
        mockGetProtected.mockResolvedValue(MENU_ENVELOPE as never);

        await readLockedSectionCounts({
            vertical: 'venue',
            listingId: LISTING_ID,
            sectionStates: {
                menu: { state: 'locked' },
                dailySpecials: { state: 'available' },
                venueEvents: { state: 'absent' },
                // A locked section with no reader in this leaf must not cost a
                // request either.
                contact: { state: 'locked' }
            }
        });

        expect(mockGetProtected).toHaveBeenCalledTimes(1);
        expect(mockGetProtected).toHaveBeenCalledWith({
            path: `/api/v1/protected/venues/${LISTING_ID}/menu`,
            cookieHeader: undefined
        });
    });

    it('counts dishes, file and link for the carta, and one item per special and event', async () => {
        mockGetProtected.mockImplementation(async ({ path }) => {
            if (path.endsWith('/menu')) return MENU_ENVELOPE as never;
            if (path.endsWith('/daily-specials')) return SPECIALS_ENVELOPE as never;
            return EVENTS_ENVELOPE as never;
        });

        const counts = await readLockedSectionCounts({
            vertical: 'venue',
            listingId: LISTING_ID,
            sectionStates: ALL_LOCKED
        });

        // 3 dishes + 1 file + 1 external link.
        expect(counts.menu).toBe(5);
        expect(counts.dailySpecials).toBe(2);
        expect(counts.venueEvents).toBe(1);
    });

    it('returns null for a reader that fails and for a locked section with no reader', async () => {
        mockGetProtected.mockImplementation(async ({ path }) => {
            if (path.endsWith('/menu')) {
                return { ok: false, error: { status: 500, message: 'boom' } } as never;
            }
            if (path.endsWith('/daily-specials')) {
                throw new Error('network down');
            }
            return EVENTS_ENVELOPE as never;
        });

        const counts = await readLockedSectionCounts({
            vertical: 'venue',
            listingId: LISTING_ID,
            sectionStates: {
                ...ALL_LOCKED,
                contact: { state: 'locked' }
            }
        });

        expect(counts).toEqual({
            menu: null,
            dailySpecials: null,
            venueEvents: 1,
            contact: null
        });
    });
});

describe('readAbsentSectionCounts (HOS-1787 leaf 5.7)', () => {
    it('reads only absent sections and extends the counts to nightInfo', async () => {
        mockGetProtected.mockImplementation(async ({ path }) => {
            if (path.endsWith('/menu')) return MENU_ENVELOPE as never;
            // nightInfo lives on the venue row itself.
            return {
                ok: true,
                data: {
                    entryKind: 'paid',
                    entryNoteI18n: { es: 'Hasta las 2', en: '', pt: '' },
                    entryPriceFrom: 500000,
                    // HOS-2060: the night house rules live in `policies`.
                    policies: { minAge: 18 }
                }
            } as never;
        });

        const counts = await readAbsentSectionCounts({
            vertical: 'venue',
            listingId: LISTING_ID,
            sectionStates: {
                menu: { state: 'absent' },
                nightInfo: { state: 'absent' },
                dailySpecials: { state: 'available' }
            }
        });

        expect(counts.menu).toBe(5);
        // entryKind + note + price + minAge.
        expect(counts.nightInfo).toBe(4);
        expect(mockGetProtected).not.toHaveBeenCalledWith(
            expect.objectContaining({ path: expect.stringContaining('daily-specials') })
        );
    });
});

describe('readRecentMenuQrScanCount (HOS-1787 leaf 5.7)', () => {
    it('reads the 90-day aggregate', async () => {
        mockGetProtected.mockResolvedValue({
            ok: true,
            data: { total: 42 }
        } as never);

        await expect(readRecentMenuQrScanCount({ venueId: LISTING_ID })).resolves.toBe(42);
        expect(mockGetProtected).toHaveBeenCalledWith(
            expect.objectContaining({
                path: `/api/v1/protected/venues/${LISTING_ID}/menu-qr/scans`,
                params: { window: '90d' }
            })
        );
    });

    it('omits the line (null) when the metric is not readable', async () => {
        mockGetProtected.mockResolvedValue({
            ok: false,
            error: { status: 403, message: 'forbidden' }
        } as never);

        await expect(readRecentMenuQrScanCount({ venueId: LISTING_ID })).resolves.toBeNull();
    });
});
