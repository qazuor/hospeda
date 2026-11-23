/**
 * @file plan-gate-names.hos2554.test.tsx
 * @description HOS-2554: the comparison and WhatsApp upsells name the plans the SSR page read
 * from the catalog, never a hardcoded "Plus y VIP". Each surface gets a DIFFERENT plan name,
 * and an unreadable catalog (no names) must name no plan at all.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DetailCompareButton } from '../../../../src/components/accommodation/DetailCompareButton.client';
import { WhatsAppContact } from '../../../../src/components/accommodation/WhatsAppContact.client';
import { CompareButton } from '../../../../src/components/shared/compare/CompareButton.client';
import { CompareCardSelect } from '../../../../src/components/shared/compare/CompareCardSelect.client';
import { ComparisonMatrix } from '../../../../src/components/shared/compare/ComparisonMatrix.client';
import { setCompareMode } from '../../../../src/store/compare-store';

vi.mock('../../../../src/lib/i18n', () => {
    // Plural keys carry no fallback: echo key + params so plan names stay assertable.
    const t = (key: string, fallback?: string, params?: Record<string, unknown>): string =>
        fallback ?? `${key} ${JSON.stringify(params ?? {})}`;
    const tPlural = (key: string) => key;
    return {
        createT: () => t,
        createTranslations: () => ({ t, tPlural })
    };
});
vi.mock('../../../../src/lib/cn', () => ({
    cn: (...c: (string | undefined | false | null)[]) => c.filter(Boolean).join(' ')
}));
for (const css of [
    'shared/compare/CompareButton',
    'shared/compare/CompareCardSelect',
    'shared/compare/ComparisonMatrix',
    'accommodation/DetailCompareButton',
    'accommodation/WhatsAppContact'
]) {
    vi.doMock(`../../../../src/components/${css}.module.css`, () => ({
        default: new Proxy({} as Record<string, string>, { get: (_t, p) => String(p) })
    }));
}
vi.mock('@repo/icons', () => {
    const Icon = () => <svg aria-hidden="true" />;
    return {
        ColumnIcon: Icon,
        CheckIcon: Icon,
        CheckCircleIcon: Icon,
        StarIcon: Icon,
        WhatsappLogo: Icon
    };
});

const mockAddToast = vi.fn();
vi.mock('../../../../src/store/toast-store', () => ({
    addToast: (...args: unknown[]) => mockAddToast(...args)
}));
vi.mock('../../../../src/hooks/useCompareGuard', () => ({
    useCompareGuard: () => ({
        isInList: () => false,
        isLoading: false,
        maxItems: 2,
        toggle: () => ({ action: 'blocked', reason: 'upsell' })
    })
}));
// A stable reference: a fresh array per render would re-run the matrix fetch effect forever.
const STABLE_IDS = vi.hoisted(() => ['a', 'b']);
vi.mock('../../../../src/store/compare-store', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../../../src/store/compare-store')>()),
    useCompareStore: () => ({ ids: STABLE_IDS })
}));
vi.mock('../../../../src/lib/api/endpoints-protected', () => ({
    protectedAccommodationsApi: {
        compare: async () => ({ ok: false, error: { status: 403, code: 'ENTITLEMENT_REQUIRED' } })
    }
}));
vi.mock('../../../../src/hooks/use-account-permissions', () => ({
    useAccountPermissions: () => ({ user: null })
}));
vi.mock('../../../../src/lib/analytics/umami-client', () => ({ trackEvent: vi.fn() }));

const KEY_BASE = 'accommodations.comparison.upsell.message';
const WA_BASE = 'accommodations.detail.whatsapp.upsellText';

type Surface = {
    readonly label: string;
    readonly planName: string;
    readonly keyBase: string;
    readonly noPlans: RegExp;
    /** Renders the surface and returns the text of its gate message. */
    readonly run: (names: readonly string[]) => Promise<string>;
};

const toastMessage = (): string => String(mockAddToast.mock.calls.at(-1)?.[0]?.message ?? '');

const SURFACES: readonly Surface[] = [
    {
        label: 'CompareButton',
        planName: 'Explorador',
        keyBase: KEY_BASE,
        noPlans: /Comparar alojamientos no está incluido en tu plan actual/,
        run: async (names) => {
            render(
                <CompareButton
                    accommodationId="a"
                    accommodationName="Cabaña"
                    gatePlanNames={names}
                />
            );
            fireEvent.click(screen.getByRole('button'));
            return toastMessage();
        }
    },
    {
        label: 'DetailCompareButton',
        planName: 'Aventurero',
        keyBase: KEY_BASE,
        noPlans: /Comparar alojamientos no está incluido en tu plan actual/,
        run: async (names) => {
            render(
                <DetailCompareButton
                    accommodationId="a"
                    accommodationName="Cabaña"
                    gatePlanNames={names}
                />
            );
            fireEvent.click(screen.getByRole('button'));
            return toastMessage();
        }
    },
    {
        label: 'CompareCardSelect',
        planName: 'Viajero',
        keyBase: KEY_BASE,
        noPlans: /Comparar alojamientos no está incluido en tu plan actual/,
        run: async (names) => {
            setCompareMode(true);
            render(
                <CompareCardSelect
                    accommodationId="a"
                    accommodationName="Cabaña"
                    gatePlanNames={names}
                />
            );
            fireEvent.click(await screen.findByRole('checkbox'));
            return toastMessage();
        }
    },
    {
        label: 'ComparisonMatrix',
        planName: 'Descubridor',
        keyBase: KEY_BASE,
        noPlans: /Comparar alojamientos no está incluido en tu plan actual/,
        run: async (names) => {
            render(<ComparisonMatrix gatePlanNames={names} />);
            await waitFor(() =>
                expect(screen.getByText(/Comparar alojamientos|upsell/)).toBeTruthy()
            );
            return document.body.textContent ?? '';
        }
    },
    {
        label: 'WhatsAppContact',
        planName: 'Anfitrión Club',
        keyBase: WA_BASE,
        noPlans: /Tu plan actual no incluye ver el WhatsApp del anfitrión/,
        run: async (names) => {
            render(
                <WhatsAppContact
                    accommodationId="a"
                    accommodationName="Cabaña"
                    plansHref="/es/precios/"
                    locale="es"
                    gatePlanNames={names}
                />
            );
            return document.body.textContent ?? '';
        }
    }
];

describe('comparison and WhatsApp upsells name the catalog plans (HOS-2554)', () => {
    beforeEach(() => {
        mockAddToast.mockClear();
        setCompareMode(false);
    });

    for (const s of SURFACES) {
        describe(s.label, () => {
            it('names a single catalog plan with the singular key', async () => {
                const text = await s.run([s.planName]);
                expect(text).toContain(`${s.keyBase}_one`);
                expect(text).toContain(s.planName);
                expect(text).not.toMatch(/Plus|VIP/);
            });

            it('names several catalog plans as a list with the plural key', async () => {
                const text = await s.run([s.planName, 'Premium']);
                expect(text).toContain(`${s.keyBase}_other`);
                expect(text).toContain(`${s.planName} y Premium`);
            });

            it('names no plan when the catalog could not be read', async () => {
                const text = await s.run([]);
                expect(text).toMatch(s.noPlans);
                expect(text).not.toMatch(/Plus|VIP/);
            });
        });
    }
});
