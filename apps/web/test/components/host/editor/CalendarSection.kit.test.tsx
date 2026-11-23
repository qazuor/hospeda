/**
 * @file CalendarSection.kit.test.tsx
 * @description The occupancy calendar on the kit (HOS-2503): two flat kit
 * Sections anchored to the calendar help article, the kit Skeleton while the
 * month loads and the kit ErrorState with a working retry.
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CalendarSection } from '@/components/host/editor/CalendarSection.client';

const { mockList } = vi.hoisted(() => ({ mockList: vi.fn() }));

vi.mock('@/lib/logger', () => ({
    webLogger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}));

vi.mock('@/lib/api/endpoints-protected', () => ({
    accommodationOccupancyApi: { list: mockList, batchToggle: vi.fn(), updateEvent: vi.fn() }
}));

const defaultProps = { locale: 'es', accommodationId: 'acc-uuid-123' } as const;

function makeListOk(occupancy: unknown[] = []) {
    return Promise.resolve({ ok: true as const, data: { occupancy } });
}

describe('CalendarSection on the kit', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(2026, 6, 15));
        mockList.mockReturnValue(makeListOk([]));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders the calendar and the external sync as two flat kit sections with the calendar help anchor', async () => {
        // Arrange
        mockList.mockReturnValue(makeListOk([]));

        // Act
        const { container } = render(<CalendarSection {...defaultProps} />);
        await waitFor(() => expect(mockList).toHaveBeenCalled());

        // Assert
        const sections = container.querySelectorAll('[data-kit-section]');
        expect(sections).toHaveLength(2);
        for (const section of sections) {
            expect(section.getAttribute('data-help')).toBe('section:accommodation.calendario');
        }
        expect(
            screen.getByRole('heading', { name: 'Sincronización de calendarios externos' })
        ).toBeInTheDocument();
        expect(within(sections[1] as HTMLElement).getByRole('button')).toHaveTextContent(
            'Conectar calendarios externos'
        );
    });

    it('shows a busy skeleton while the month loads', () => {
        // Arrange — a list call that never settles keeps the loading state.
        mockList.mockReturnValue(new Promise(() => {}));

        // Act
        const { container } = render(<CalendarSection {...defaultProps} />);

        // Assert
        expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
        expect(screen.queryByRole('button', { name: /Libre/ })).not.toBeInTheDocument();
    });

    it('shows the kit error state on a failed load and re-fetches on retry', async () => {
        // Arrange
        mockList.mockReturnValueOnce(Promise.resolve({ ok: false, error: { status: 500 } }));
        const user = userEvent.setup();

        // Act
        render(<CalendarSection {...defaultProps} />);
        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('No pudimos cargar el calendario. Intentá de nuevo.');
        await user.click(within(alert).getByRole('button'));

        // Assert
        await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2));
    });
});
