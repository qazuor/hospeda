/**
 * @file CalendarSyncMessage.test.tsx
 * @description Tests for the calendar-sync status message (HOS-320).
 *
 * The reported symptom was that these messages read as unstyled text. The
 * measured cause was contrast: success used a surface tint as its TEXT colour
 * (~1.1:1), and error/info sat at 3.81:1 and 3.19:1, both under the WCAG AA
 * floor of 4.5. Colour ratios cannot be asserted in jsdom — it does not resolve
 * custom properties or compute `oklch` — so what is pinned here is the
 * structure that makes the fix possible and correct: a kind marker to style
 * against, an icon so colour is not the only differentiator, and roles that
 * match each kind's urgency.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CalendarSyncMessage } from '../../../../src/components/host/editor/CalendarSyncMessage.client';

vi.mock('../../../../src/components/host/editor/CalendarSyncMessage.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

describe('CalendarSyncMessage', () => {
    it('marks the kind so each variant can be styled distinctly', () => {
        const { rerender } = render(
            <CalendarSyncMessage kind="success">Sincronizado</CalendarSyncMessage>
        );
        expect(screen.getByText('Sincronizado').closest('[data-kind]')).toHaveAttribute(
            'data-kind',
            'success'
        );

        rerender(<CalendarSyncMessage kind="error">Falló</CalendarSyncMessage>);
        expect(screen.getByText('Falló').closest('[data-kind]')).toHaveAttribute(
            'data-kind',
            'error'
        );
    });

    it('interrupts for error and warning, and does not for success and info', () => {
        const { rerender } = render(<CalendarSyncMessage kind="error">Falló</CalendarSyncMessage>);
        expect(screen.getByRole('alert')).toBeInTheDocument();

        rerender(<CalendarSyncMessage kind="warning">Ojo</CalendarSyncMessage>);
        expect(screen.getByRole('alert')).toBeInTheDocument();

        rerender(<CalendarSyncMessage kind="success">Listo</CalendarSyncMessage>);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.getByRole('status')).toBeInTheDocument();

        rerender(<CalendarSyncMessage kind="info">Dato</CalendarSyncMessage>);
        expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('carries an icon so colour is not the only differentiator', () => {
        const { container } = render(
            <CalendarSyncMessage kind="success">Sincronizado</CalendarSyncMessage>
        );

        const icon = container.querySelector('svg');
        expect(icon).toBeInTheDocument();
        // The role already conveys urgency; the icon must not be announced too.
        expect(icon).toHaveAttribute('aria-hidden', 'true');
    });

    it('renders a different icon per kind', () => {
        const { container: success } = render(
            <CalendarSyncMessage kind="success">ok</CalendarSyncMessage>
        );
        const { container: error } = render(
            <CalendarSyncMessage kind="error">no</CalendarSyncMessage>
        );

        expect(success.querySelector('svg')?.innerHTML).not.toBe(
            error.querySelector('svg')?.innerHTML
        );
    });

    it('offers a compact variant for the per-provider rows', () => {
        const { container } = render(
            <CalendarSyncMessage
                kind="info"
                compact
            >
                Row message
            </CalendarSyncMessage>
        );

        expect(container.querySelector('[data-kind]')?.className).toContain('compact');
    });
});
