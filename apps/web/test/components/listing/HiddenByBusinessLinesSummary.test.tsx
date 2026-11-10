/**
 * @file HiddenByBusinessLinesSummary.test.tsx
 * @description Hub block for sections hidden by the current business lines
 * (HOS-1787 leaf 5.7, DEC-FAC-063 / DEC-FAC-075).
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HiddenByBusinessLinesSummary } from '@/components/listing/HiddenByBusinessLinesSummary.client';

vi.mock('@/components/listing/HiddenByBusinessLinesSummary.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

const NIGHT_INFO = {
    id: 'nightInfo',
    labelKey: 'listing.owner.editor.sectionNav.nightInfo',
    count: 3
};

describe('HiddenByBusinessLinesSummary — TEST:5.7:2 (AC:5:6)', () => {
    it('shows the section, its count and "Vaciar" for the owner', () => {
        render(
            <HiddenByBusinessLinesSummary
                locale="es"
                listingId="33333333-3333-4333-8333-333333333333"
                sections={[NIGHT_INFO]}
                canEmpty
            />
        );

        expect(screen.getByTestId('hidden-by-business-lines')).toHaveTextContent(
            'Guardado y oculto por tus rubros'
        );
        expect(screen.getByText('Info para salir')).toBeInTheDocument();
        expect(screen.getByText(/3 cargados/)).toBeInTheDocument();
        expect(screen.getByTestId('hidden-section-vaciar-nightInfo')).toBeInTheDocument();
    });

    it('renders nothing when no hidden section has data', () => {
        const { container } = render(
            <HiddenByBusinessLinesSummary
                locale="es"
                listingId="33333333-3333-4333-8333-333333333333"
                sections={[]}
                canEmpty
            />
        );

        expect(container).toBeEmptyDOMElement();
    });

    it('shows the summary WITHOUT the destructive action for staff', () => {
        render(
            <HiddenByBusinessLinesSummary
                locale="es"
                listingId="33333333-3333-4333-8333-333333333333"
                sections={[NIGHT_INFO]}
                canEmpty={false}
            />
        );

        expect(screen.getByText('Info para salir')).toBeInTheDocument();
        expect(screen.queryByTestId('hidden-section-vaciar-nightInfo')).toBeNull();
    });
});
