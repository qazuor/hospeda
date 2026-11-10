import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OpeningHoursGridRow } from '../../../src/components/venue/OpeningHoursGrid.client';
import { OpeningHoursGrid } from '../../../src/components/venue/OpeningHoursGrid.client';

const rows: readonly OpeningHoursGridRow[] = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday'
].map((dayKey) => ({ dayKey, label: dayKey, hoursText: '09:00 – 18:00', isClosed: false }));
const dayIndexByKey = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6
};
const props = { rows, todayLabel: 'Hoy', dayIndexByKey };

afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

describe('OpeningHoursGrid', () => {
    it('keeps the server markup unmarked and includes all seven days', () => {
        const html = renderToString(<OpeningHoursGrid {...props} />);
        expect(html).not.toContain('data-today');
        expect(html).not.toContain('Hoy');
        for (const row of rows) expect(html).toContain(row.label);
    });

    it('marks only the Buenos Aires weekday after the effect', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-11-09T02:30:00Z'));
        render(<OpeningHoursGrid {...props} />);
        await waitFor(() =>
            expect(document.querySelectorAll('[data-today="true"]')).toHaveLength(1)
        );
        const today = document.querySelector('[data-today="true"]');
        expect(today).toHaveAttribute('data-day', 'sunday');
        expect(today).toHaveTextContent('Hoy');
        expect(screen.getByText('Hoy')).toBeInTheDocument();
    });

    it('hydrates server markup without console errors', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-11-09T02:30:00Z'));
        const html = renderToString(<OpeningHoursGrid {...props} />);
        const host = document.createElement('div');
        host.innerHTML = html;
        document.body.append(host);
        vi.setSystemTime(new Date('2026-11-09T03:30:00Z'));
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        let root: ReturnType<typeof hydrateRoot> | undefined;
        await act(async () => {
            root = hydrateRoot(host, <OpeningHoursGrid {...props} />);
        });
        expect(error).not.toHaveBeenCalled();
        await act(async () => root?.unmount());
        error.mockRestore();
        host.remove();
    });
});
