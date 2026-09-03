/**
 * @file CommerceDailySpecialsManager.test.tsx
 * @description The gastronomy menú del día panel (HOS-1041).
 *
 * Four things are asserted, and each is a decision that would otherwise stay
 * invisible until an owner complained:
 *
 * 1. **The panel loads its own specials.** It is not fed by the SSR listing
 *    payload, so a broken `GET` shows an empty editor and the owner's next save
 *    silently deletes what they had — the write is whole-document.
 * 2. **The save sends the window, and sends prices in CENTAVOS.** The owner
 *    types pesos and the column stores centavos (HOS-809, the bug this repeats
 *    the fix for), and a payload that dropped the dates would store a special
 *    that can never be published. The assertion is on the BODY, not on "some
 *    call happened".
 * 3. **A new row defaults to TODAY ONLY.** That default is what makes the safe
 *    choice the zero-effort one: an owner who ignores the dates publishes for
 *    today and nothing is left behind tomorrow. A default of "today onwards
 *    forever" would reintroduce the rotting field the feature exists to remove.
 * 4. **A 403 is an upsell, not an error.** The menú del día is a
 *    `gastronomy-pro` capability and this page carries no entitlement
 *    information, so the API is what decides.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommerceDailySpecialsManager } from '../../../src/components/commerce/CommerceDailySpecialsManager.client';

vi.mock('../../../src/components/commerce/CommerceDailySpecialsManager.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: () => ({ t: (key: string, fallback?: string) => fallback ?? key })
}));

vi.mock('../../../src/lib/api/client', () => ({
    apiClient: {
        get: vi.fn(),
        put: vi.fn()
    }
}));

import { apiClient } from '../../../src/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPut = vi.mocked(apiClient.put);

const LISTING_ID = '22222222-2222-4222-8222-222222222222';

/** One special priced at ARS 18.500 (1 850 000 centavos), valid for one day. */
const LOADED = {
    ok: true as const,
    data: {
        specials: [
            {
                title: 'Milanesa a la napolitana',
                description: 'Con puré',
                priceCents: 1_850_000,
                validFrom: '2026-09-03',
                validUntil: '2026-09-03'
            }
        ]
    }
};

/** Today, in the same shape the component derives it. */
function todayIso(): string {
    const now = new Date();
    return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}-${`${now.getDate()}`.padStart(2, '0')}`;
}

beforeEach(() => {
    vi.clearAllMocks();
    // Defaults set per test rather than here: a default declared in the wrong
    // place still turns a suite green through mock leakage.
});

describe('CommerceDailySpecialsManager', () => {
    it('loads its own specials rather than waiting to be handed them', async () => {
        // Arrange
        mockGet.mockResolvedValue(LOADED);

        // Act
        render(
            <CommerceDailySpecialsManager
                listingId={LISTING_ID}
                locale="es"
            />
        );

        // Assert
        await waitFor(() => {
            expect(mockGet).toHaveBeenCalledWith({
                path: `/api/v1/protected/gastronomies/${LISTING_ID}/daily-specials`
            });
        });
        expect(await screen.findByDisplayValue('Milanesa a la napolitana')).toBeTruthy();
        // The window round-trips into the form, not just the title.
        expect(screen.getAllByDisplayValue('2026-09-03')).toHaveLength(2);
        // Pesos in the input, centavos in the column.
        expect(screen.getByDisplayValue('18500')).toBeTruthy();
    });

    it('saves the window and sends the price in centavos, not pesos', async () => {
        // Arrange
        mockGet.mockResolvedValue(LOADED);
        mockPut.mockResolvedValue(LOADED);
        render(
            <CommerceDailySpecialsManager
                listingId={LISTING_ID}
                locale="es"
            />
        );
        await screen.findByDisplayValue('Milanesa a la napolitana');

        // Act
        fireEvent.click(screen.getByText('Guardar menú del día'));

        // Assert — on the BODY. "A PUT happened" would pass with an empty
        // payload, which is exactly the shape that deletes the owner's specials.
        await waitFor(() => expect(mockPut).toHaveBeenCalled());
        const body = mockPut.mock.calls[0]?.[0]?.body as {
            specials: Array<Record<string, unknown>>;
        };
        expect(body.specials).toHaveLength(1);
        expect(body.specials[0]).toMatchObject({
            title: 'Milanesa a la napolitana',
            description: 'Con puré',
            priceCents: 1_850_000,
            validFrom: '2026-09-03',
            validUntil: '2026-09-03'
        });
    });

    it('defaults a NEW special to today only, both bounds on the same day', async () => {
        // The default is the feature's safety net: a special nobody dated still
        // expires. "From today, forever" would be the rotting field again.
        // Arrange
        mockGet.mockResolvedValue({ ok: true as const, data: { specials: [] } });
        mockPut.mockResolvedValue({ ok: true as const, data: { specials: [] } });
        render(
            <CommerceDailySpecialsManager
                listingId={LISTING_ID}
                locale="es"
            />
        );
        await waitFor(() => expect(mockGet).toHaveBeenCalled());

        // Act
        fireEvent.click(screen.getByText('Agregar plato del día'));

        // Assert
        const today = todayIso();
        const dateInputs = screen.getAllByDisplayValue(today);
        expect(dateInputs).toHaveLength(2);
    });

    it('drops an untitled row instead of failing the whole save', async () => {
        // An empty row is what an owner leaves after clicking "add" and changing
        // their mind. Rejecting the save over it would lose the rows they did
        // fill in.
        // Arrange
        mockGet.mockResolvedValue(LOADED);
        mockPut.mockResolvedValue(LOADED);
        render(
            <CommerceDailySpecialsManager
                listingId={LISTING_ID}
                locale="es"
            />
        );
        await screen.findByDisplayValue('Milanesa a la napolitana');

        // Act
        fireEvent.click(screen.getByText('Agregar plato del día'));
        fireEvent.click(screen.getByText('Guardar menú del día'));

        // Assert
        await waitFor(() => expect(mockPut).toHaveBeenCalled());
        const body = mockPut.mock.calls[0]?.[0]?.body as { specials: unknown[] };
        expect(body.specials).toHaveLength(1);
    });

    it('shows a 403 as the plan upsell it is, not as a generic failure', async () => {
        // Arrange
        mockGet.mockResolvedValue(LOADED);
        mockPut.mockResolvedValue({
            ok: false as const,
            error: { status: 403, message: 'forbidden' }
        });
        render(
            <CommerceDailySpecialsManager
                listingId={LISTING_ID}
                locale="es"
            />
        );
        await screen.findByDisplayValue('Milanesa a la napolitana');

        // Act
        fireEvent.click(screen.getByText('Guardar menú del día'));

        // Assert
        expect(
            await screen.findByText('El menú del día está disponible desde el plan Profesional.')
        ).toBeTruthy();
        // And NOT the generic error, which is the whole distinction.
        expect(screen.queryByText('No se pudo guardar el menú del día.')).toBeNull();
    });

    it('shows the generic error for a non-403 failure', async () => {
        // The other side of the branch above. Without it, a component that
        // showed the upsell for EVERY failure would pass the 403 test.
        // Arrange
        mockGet.mockResolvedValue(LOADED);
        mockPut.mockResolvedValue({
            ok: false as const,
            error: { status: 500, message: 'boom' }
        });
        render(
            <CommerceDailySpecialsManager
                listingId={LISTING_ID}
                locale="es"
            />
        );
        await screen.findByDisplayValue('Milanesa a la napolitana');

        // Act
        fireEvent.click(screen.getByText('Guardar menú del día'));

        // Assert
        expect(await screen.findByText('No se pudo guardar el menú del día.')).toBeTruthy();
    });
});
