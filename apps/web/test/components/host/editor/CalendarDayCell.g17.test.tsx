import { OccupancySourceEnum } from '@repo/schemas';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CalendarDayCellProps } from '@/components/host/editor/CalendarDayCell.client';
import { CalendarDayCell } from '@/components/host/editor/CalendarDayCell.client';
import { createTranslations } from '@/lib/i18n';

const props: CalendarDayCellProps = {
    date: new Date(2026, 10, 25),
    dateKey: '2026-11-25',
    locale: 'en',
    t: createTranslations('en').t,
    row: undefined,
    isPast: false,
    isSelected: false,
    isPending: false,
    barMode: true,
    onSelect: vi.fn()
};

describe('G17 calendar classification', () => {
    it('classifies free and past days separately and prevents past selections', () => {
        const { rerender } = render(<CalendarDayCell {...props} />);
        expect(screen.getByRole('button')).toHaveAttribute('data-day-state', 'free');
        expect(screen.getByRole('button')).toBeEnabled();
        rerender(
            <CalendarDayCell
                {...props}
                isPast
            />
        );
        expect(screen.getByRole('button')).toHaveAttribute('data-day-state', 'past');
        expect(screen.getByRole('button')).toBeDisabled();
        fireEvent.click(screen.getByRole('button'));
        expect(props.onSelect).not.toHaveBeenCalled();
    });

    it('retains the blocked signal in bar mode, including past occupied days', () => {
        const row = {
            id: 'occupancy',
            accommodationId: 'listing',
            date: '2026-11-25',
            source: OccupancySourceEnum.MANUAL,
            isBlocked: true,
            externalEventId: null,
            note: null,
            createdById: 'owner',
            createdAt: new Date('2026-11-01'),
            updatedAt: new Date('2026-11-01')
        };
        render(
            <CalendarDayCell
                {...props}
                row={row}
                isPast
            />
        );
        const cell = screen.getByRole('button');
        expect(cell).toHaveAttribute('data-day-state', 'blocked');
        expect(cell.className).toContain('dayOccupied');
        expect(cell.className).not.toContain('dayPast');
        expect(cell).toBeDisabled();
    });
});
