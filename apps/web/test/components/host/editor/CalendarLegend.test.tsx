/**
 * @file CalendarLegend.test.tsx
 * @description Tests for the occupancy calendar legend's mobile disclosure
 * (HOS-316).
 *
 * Which of the two presentations is shown is a CSS media-query decision, and
 * jsdom applies no media queries — so what is pinned here is the contract the
 * CSS depends on: a real toggle button with honest `aria-expanded`, a
 * `data-expanded` hook on the container, and the flat title still rendered so
 * wider screens have something to show without JavaScript state.
 */

import { OccupancySourceEnum } from '@repo/schemas';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CalendarLegend } from '../../../../src/components/host/editor/CalendarLegend.client';

vi.mock('../../../../src/components/host/editor/CalendarSection.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

/** Passthrough translator: returns the fallback the component supplies. */
const t = ((_key: string, fallback?: string) => fallback ?? _key) as never;

function renderLegend(sources: OccupancySourceEnum[] = []) {
    return render(
        <CalendarLegend
            t={t}
            presentSources={new Set(sources)}
        />
    );
}

describe('CalendarLegend', () => {
    it('starts collapsed', () => {
        const { container } = renderLegend();

        expect(container.querySelector('[data-expanded]')).toHaveAttribute(
            'data-expanded',
            'false'
        );
        expect(screen.getByRole('button', { name: /Referencias/ })).toHaveAttribute(
            'aria-expanded',
            'false'
        );
    });

    it('expands and collapses on the toggle', async () => {
        const user = userEvent.setup();
        const { container } = renderLegend();
        const toggle = screen.getByRole('button', { name: /Referencias/ });

        await user.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(container.querySelector('[data-expanded]')).toHaveAttribute('data-expanded', 'true');

        await user.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
    });

    it('keeps the flat title rendered for wider screens', () => {
        renderLegend();

        // The media query hides one presentation or the other. Both have to be
        // in the DOM, or desktop would depend on the collapsed React state.
        const titles = screen.getAllByText('Referencias');
        expect(titles.length).toBeGreaterThanOrEqual(2);
    });

    it('still renders every present source inside the collapsible region', () => {
        renderLegend([OccupancySourceEnum.MANUAL, OccupancySourceEnum.AIRBNB]);

        expect(screen.getByText('Libre')).toBeInTheDocument();
        expect(screen.getByText('Bloqueado manualmente')).toBeInTheDocument();
        expect(screen.getByText('Sincronizado — Airbnb')).toBeInTheDocument();
        // Data-driven (HOS-175): absent sources stay absent.
        expect(screen.queryByText(/Booking/)).not.toBeInTheDocument();
    });
});
