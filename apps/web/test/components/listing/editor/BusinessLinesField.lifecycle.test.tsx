/**
 * @file BusinessLinesField.lifecycle.test.tsx
 * @description Business-line lifecycle coverage (HOS-1787 leaf 5.7).
 *
 * AC:5:4 and AC:5:6 depend on three properties that are easy to lose:
 *  - a type change never silently drops a line: the field shows the catalog
 *    reason and offers the type's suggestions instead;
 *  - unchecking a line opens the removal notice with the sections that would go
 *    `absent` and their stored counts, resolved by the API map rather than by
 *    comparing business-line values here (G-FAC-03);
 *  - the notice never fabricates a count and never reads the QR (which mints).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    BusinessLinesField,
    resolveBusinessLinesFieldError
} from '@/components/listing/editor/BusinessLinesField.client';

const { getListingSectionStates, readAbsentSectionCounts, readRecentMenuQrScanCount } = vi.hoisted(
    () => ({
        getListingSectionStates: vi.fn(),
        readAbsentSectionCounts: vi.fn(),
        readRecentMenuQrScanCount: vi.fn()
    })
);

vi.mock('@/lib/api/endpoints-protected', () => ({
    listingAnalyticsApi: { getListingSectionStates }
}));

vi.mock('@/lib/listing/locked-section-counts', () => ({
    readAbsentSectionCounts,
    readRecentMenuQrScanCount
}));

vi.mock('@/components/listing/editor/BusinessLinesField.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('@/components/listing/editor/BusinessLineRemovalNotice.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

function renderField(
    overrides: Partial<React.ComponentProps<typeof BusinessLinesField>> = {}
): ReturnType<typeof render> {
    return render(
        <BusinessLinesField
            locale="es"
            vertical="venue"
            type="BAR"
            selected={['food', 'nightlife']}
            onChange={() => undefined}
            errors={{}}
            listingId="33333333-3333-4333-8333-333333333333"
            {...overrides}
        />
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    getListingSectionStates.mockImplementation(
        async ({ businessLines }: { businessLines?: readonly string[] }) =>
            businessLines
                ? {
                      ok: true,
                      data: {
                          sections: {
                              menu: { state: 'available' },
                              nightInfo: { state: 'absent' }
                          }
                      }
                  }
                : {
                      ok: true,
                      data: {
                          sections: {
                              menu: { state: 'available' },
                              nightInfo: { state: 'available' }
                          }
                      }
                  }
    );
    readAbsentSectionCounts.mockResolvedValue({ nightInfo: 3 });
    readRecentMenuQrScanCount.mockResolvedValue(null);
});

describe('BusinessLinesField — TEST:5.7:2 type changes (AC:5:4)', () => {
    it('shows the reason and blocks the selection instead of dropping a line', () => {
        renderField({ type: 'BOLICHE', selected: ['food', 'nightlife'] });

        expect(screen.getByRole('alert')).toHaveTextContent(
            'Este tipo de comercio no admite ese rubro'
        );
        // `food` is not an option for a BOLICHE; nothing was removed silently.
        expect(screen.queryByRole('checkbox', { name: /Gastronomía/ })).toBeNull();
        expect(screen.getByRole('checkbox', { name: /Noche/ })).toBeChecked();
    });

    it('applies the type suggestions on request', () => {
        const onChange = vi.fn();
        renderField({ type: 'BOLICHE', selected: ['food', 'nightlife'], onChange });

        fireEvent.click(
            screen.getByRole('button', { name: 'Usar los rubros sugeridos para este tipo' })
        );

        expect(onChange).toHaveBeenCalledWith(['nightlife']);
    });

    it('returns the canonical reason for an invalid selection', () => {
        const t = (key: string, fallback?: string) => fallback ?? key;

        expect(
            resolveBusinessLinesFieldError({
                vertical: 'venue',
                type: 'HELADERIA',
                selected: ['nightlife'],
                t
            })
        ).toContain('NOT_ALLOWED_FOR_TYPE');
    });
});

describe('BusinessLinesField — TEST:5.7:2 removal notice (AC:5:4)', () => {
    it('names nightInfo with its stored count when nightlife is removed', async () => {
        renderField({ type: 'BAR', selected: ['food', 'nightlife'] });

        fireEvent.click(screen.getByRole('checkbox', { name: /Noche/ }));

        const notice = await screen.findByTestId('business-line-removal-notice');
        expect(notice).toHaveTextContent('se ocultan');
        expect(notice).toHaveTextContent('Info para salir');
        expect(notice).toHaveTextContent('3');
        expect(notice).toHaveTextContent('No se borra nada');
        // The hypothetical map is what decides, never a business-line compare.
        expect(getListingSectionStates).toHaveBeenCalledWith(
            expect.objectContaining({ businessLines: ['food'] })
        );
        // Reading the QR would mint it; the notice only asks for scans.
        expect(readRecentMenuQrScanCount).not.toHaveBeenCalled();
    });

    it('renders nothing when no section changes state', async () => {
        getListingSectionStates.mockResolvedValue({
            ok: true,
            data: { sections: { menu: { state: 'available' } } }
        });
        renderField({ type: 'BAR', selected: ['food', 'nightlife'] });

        fireEvent.click(screen.getByRole('checkbox', { name: /Noche/ }));

        await Promise.resolve();
        expect(screen.queryByTestId('business-line-removal-notice')).toBeNull();
    });
});
