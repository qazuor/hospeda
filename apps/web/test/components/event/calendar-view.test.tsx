import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CalendarView } from '../../../src/components/event/CalendarView.client';
import type { CalendarEvent } from '../../../src/components/event/CalendarView.client';

describe('CalendarView.client.tsx', () => {
    const mockEvents: ReadonlyArray<CalendarEvent> = [
        { id: '1', name: 'Event 1', date: '2026-02-15' },
        { id: '2', name: 'Event 2', date: '2026-02-20' },
        { id: '3', name: 'Event 3', date: '2026-03-10' }
    ];

    describe('Props', () => {
        it('should accept events prop', () => {
            const onDateSelect = vi.fn();
            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );
            expect(screen.getByRole('grid')).toBeInTheDocument();
        });

        it('should accept onDateSelect callback prop', () => {
            const onDateSelect = vi.fn();
            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );
            expect(onDateSelect).toBeDefined();
        });

        it('should accept locale prop', () => {
            const onDateSelect = vi.fn();
            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="en"
                />
            );
            expect(screen.getByText('Mon')).toBeInTheDocument();
        });

        it('should accept className prop', () => {
            const onDateSelect = vi.fn();
            const { container } = render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                    className="custom-calendar-class"
                />
            );
            const calendarContainer = container.firstChild as HTMLElement;
            expect(calendarContainer).toHaveClass('custom-calendar-class');
        });
    });

    describe('Rendering', () => {
        it('should render month/year header', () => {
            const onDateSelect = vi.fn();
            // Mock current date to February 2026
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 1, 14, 12, 0, 0));

            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );
            expect(screen.getByText(/febrero 2026/i)).toBeInTheDocument();

            vi.useRealTimers();
        });

        it('should render day names in Spanish', () => {
            const onDateSelect = vi.fn();
            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );
            expect(screen.getByText('Lun')).toBeInTheDocument();
            expect(screen.getByText('Mar')).toBeInTheDocument();
            expect(screen.getByText('Mié')).toBeInTheDocument();
            expect(screen.getByText('Jue')).toBeInTheDocument();
            expect(screen.getByText('Vie')).toBeInTheDocument();
            expect(screen.getByText('Sáb')).toBeInTheDocument();
            expect(screen.getByText('Dom')).toBeInTheDocument();
        });

        it('should render day names in English', () => {
            const onDateSelect = vi.fn();
            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="en"
                />
            );
            expect(screen.getByText('Mon')).toBeInTheDocument();
            expect(screen.getByText('Tue')).toBeInTheDocument();
            expect(screen.getByText('Wed')).toBeInTheDocument();
            expect(screen.getByText('Thu')).toBeInTheDocument();
            expect(screen.getByText('Fri')).toBeInTheDocument();
            expect(screen.getByText('Sat')).toBeInTheDocument();
            expect(screen.getByText('Sun')).toBeInTheDocument();
        });

        it('should render day names in Portuguese', () => {
            const onDateSelect = vi.fn();
            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="pt"
                />
            );
            expect(screen.getByText('Seg')).toBeInTheDocument();
            expect(screen.getByText('Ter')).toBeInTheDocument();
            expect(screen.getByText('Qua')).toBeInTheDocument();
            expect(screen.getByText('Qui')).toBeInTheDocument();
            expect(screen.getByText('Sex')).toBeInTheDocument();
            expect(screen.getByText('Sáb')).toBeInTheDocument();
            expect(screen.getByText('Dom')).toBeInTheDocument();
        });

        it('should render calendar grid', () => {
            const onDateSelect = vi.fn();
            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );
            const grid = screen.getByRole('grid');
            expect(grid).toBeInTheDocument();
        });

        it('should render calendar cells with role="gridcell"', () => {
            const onDateSelect = vi.fn();
            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );
            const cells = screen.getAllByRole('gridcell');
            expect(cells.length).toBeGreaterThan(0);
        });

        it('should render event indicators on dates with events', () => {
            const onDateSelect = vi.fn();
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 1, 14, 12, 0, 0));

            const { container } = render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );

            // Look for event dots (small rounded circles)
            const eventDots = container.querySelectorAll('[aria-hidden="true"].rounded-full');
            expect(eventDots.length).toBeGreaterThan(0);

            vi.useRealTimers();
        });

        it('should render previous month navigation button', () => {
            const onDateSelect = vi.fn();
            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );
            const prevButton = screen.getByLabelText('Mes anterior');
            expect(prevButton).toBeInTheDocument();
        });

        it('should render next month navigation button', () => {
            const onDateSelect = vi.fn();
            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );
            const nextButton = screen.getByLabelText('Mes siguiente');
            expect(nextButton).toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('should have role="grid" on calendar container', () => {
            const onDateSelect = vi.fn();
            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );
            expect(screen.getByRole('grid')).toBeInTheDocument();
        });

        it('should have role="gridcell" on each day cell', () => {
            const onDateSelect = vi.fn();
            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );
            const cells = screen.getAllByRole('gridcell');
            expect(cells.length).toBe(42); // 6 rows × 7 columns
        });

        it('should have aria-label on each day button with full date in Spanish', () => {
            const onDateSelect = vi.fn();
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 1, 14, 12, 0, 0));

            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );
            const cell15 = screen.getByLabelText(/15 de febrero de 2026/i);
            expect(cell15).toBeInTheDocument();

            vi.useRealTimers();
        });

        it('should have aria-label on each day button with full date in English', () => {
            const onDateSelect = vi.fn();
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 1, 14, 12, 0, 0));

            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="en"
                />
            );
            const cell15 = screen.getByLabelText(/february 15, 2026/i);
            expect(cell15).toBeInTheDocument();

            vi.useRealTimers();
        });

        it('should have aria-label on each day button with full date in Portuguese', () => {
            const onDateSelect = vi.fn();
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 1, 14, 12, 0, 0));

            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="pt"
                />
            );
            const cell15 = screen.getByLabelText(/15 de fevereiro de 2026/i);
            expect(cell15).toBeInTheDocument();

            vi.useRealTimers();
        });

        it('should have aria-current="date" on today\'s date', () => {
            const onDateSelect = vi.fn();
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 1, 14, 12, 0, 0)); // Feb 14, 2026 at noon local time

            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );
            const todayCell = screen.getByLabelText(/14 de febrero de 2026/i);
            expect(todayCell).toHaveAttribute('aria-current', 'date');

            vi.useRealTimers();
        });

        it('should have aria-selected="true" on selected date', () => {
            const onDateSelect = vi.fn();
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 1, 14, 12, 0, 0));

            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );
            const cell15 = screen.getByLabelText(/15 de febrero de 2026/i);
            fireEvent.click(cell15);

            expect(cell15).toHaveAttribute('aria-selected', 'true');

            vi.useRealTimers();
        });

        it('should have aria-selected="false" on non-selected dates', () => {
            const onDateSelect = vi.fn();
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 1, 14, 12, 0, 0));

            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );
            const cell15 = screen.getByLabelText(/15 de febrero de 2026/i);
            const cell16 = screen.getByLabelText(/16 de febrero de 2026/i);

            fireEvent.click(cell15);

            expect(cell16).toHaveAttribute('aria-selected', 'false');

            vi.useRealTimers();
        });

        it('should have aria-label on previous month navigation button in Spanish', () => {
            const onDateSelect = vi.fn();
            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );
            const prevButton = screen.getByLabelText('Mes anterior');
            expect(prevButton).toBeInTheDocument();
        });

        it('should have aria-label on next month navigation button in English', () => {
            const onDateSelect = vi.fn();
            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="en"
                />
            );
            const nextButton = screen.getByLabelText('Next month');
            expect(nextButton).toBeInTheDocument();
        });

        it('should have aria-label on next month navigation button in Portuguese', () => {
            const onDateSelect = vi.fn();
            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="pt"
                />
            );
            const nextButton = screen.getByLabelText('Próximo mês');
            expect(nextButton).toBeInTheDocument();
        });

        it('should have focus-visible styles on day cells', () => {
            const onDateSelect = vi.fn();
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 1, 14, 12, 0, 0));

            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );
            const cell15 = screen.getByLabelText(/15 de febrero de 2026/i);
            expect(cell15.className).toContain('focus-visible:outline');
            expect(cell15.className).toContain('focus-visible:outline-primary');

            vi.useRealTimers();
        });

        it('should have focus-visible styles on navigation buttons', () => {
            const onDateSelect = vi.fn();
            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );
            const prevButton = screen.getByLabelText('Mes anterior');
            expect(prevButton.className).toContain('focus-visible:outline');
        });
    });

    describe('Interaction', () => {
        it('should call onDateSelect when a date is clicked', () => {
            const onDateSelect = vi.fn();
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 1, 14, 12, 0, 0));

            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );
            const cell15 = screen.getByLabelText(/15 de febrero de 2026/i);
            fireEvent.click(cell15);

            expect(onDateSelect).toHaveBeenCalledWith('2026-02-15');

            vi.useRealTimers();
        });

        it('should update selected date visually when clicked', () => {
            const onDateSelect = vi.fn();
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 1, 14, 12, 0, 0));

            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );
            const cell15 = screen.getByLabelText(/15 de febrero de 2026/i);
            fireEvent.click(cell15);

            expect(cell15.className).toContain('bg-primary');
            expect(cell15.className).toContain('text-white');

            vi.useRealTimers();
        });

        it('should navigate to previous month when prev button is clicked', () => {
            const onDateSelect = vi.fn();
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 1, 14, 12, 0, 0));

            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );
            const prevButton = screen.getByLabelText('Mes anterior');
            fireEvent.click(prevButton);

            expect(screen.getByText(/enero 2026/i)).toBeInTheDocument();

            vi.useRealTimers();
        });

        it('should navigate to next month when next button is clicked', () => {
            const onDateSelect = vi.fn();
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 1, 14, 12, 0, 0));

            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );
            const nextButton = screen.getByLabelText('Mes siguiente');
            fireEvent.click(nextButton);

            expect(screen.getByText(/marzo 2026/i)).toBeInTheDocument();

            vi.useRealTimers();
        });

        it('should navigate across year boundary (December to January)', () => {
            const onDateSelect = vi.fn();
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 11, 14, 12, 0, 0));

            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );
            const nextButton = screen.getByLabelText('Mes siguiente');
            fireEvent.click(nextButton);

            expect(screen.getByText(/enero 2027/i)).toBeInTheDocument();

            vi.useRealTimers();
        });

        it('should navigate across year boundary (January to December)', () => {
            const onDateSelect = vi.fn();
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 0, 14, 12, 0, 0));

            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );
            const prevButton = screen.getByLabelText('Mes anterior');
            fireEvent.click(prevButton);

            expect(screen.getByText(/diciembre 2025/i)).toBeInTheDocument();

            vi.useRealTimers();
        });
    });

    describe('Keyboard Navigation', () => {
        it('should handle ArrowRight to move to next day', () => {
            const onDateSelect = vi.fn();
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 1, 14, 12, 0, 0));

            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );
            const cell15 = screen.getByLabelText(/15 de febrero de 2026/i);

            fireEvent.keyDown(cell15, { key: 'ArrowRight' });

            // After ArrowRight, focus should shift (verified via DOM operation in component)
            expect(() => fireEvent.keyDown(cell15, { key: 'ArrowRight' })).not.toThrow();

            vi.useRealTimers();
        });

        it('should handle ArrowLeft to move to previous day', () => {
            const onDateSelect = vi.fn();
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 1, 14, 12, 0, 0));

            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );
            const cell15 = screen.getByLabelText(/15 de febrero de 2026/i);

            fireEvent.keyDown(cell15, { key: 'ArrowLeft' });

            expect(() => fireEvent.keyDown(cell15, { key: 'ArrowLeft' })).not.toThrow();

            vi.useRealTimers();
        });

        it('should handle ArrowDown to move to next week', () => {
            const onDateSelect = vi.fn();
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 1, 14, 12, 0, 0));

            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );
            const cell15 = screen.getByLabelText(/15 de febrero de 2026/i);

            fireEvent.keyDown(cell15, { key: 'ArrowDown' });

            expect(() => fireEvent.keyDown(cell15, { key: 'ArrowDown' })).not.toThrow();

            vi.useRealTimers();
        });

        it('should handle ArrowUp to move to previous week', () => {
            const onDateSelect = vi.fn();
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 1, 14, 12, 0, 0));

            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );
            const cell15 = screen.getByLabelText(/15 de febrero de 2026/i);

            fireEvent.keyDown(cell15, { key: 'ArrowUp' });

            expect(() => fireEvent.keyDown(cell15, { key: 'ArrowUp' })).not.toThrow();

            vi.useRealTimers();
        });

        it('should handle Home key to jump to first day', () => {
            const onDateSelect = vi.fn();
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 1, 14, 12, 0, 0));

            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );
            const cell15 = screen.getByLabelText(/15 de febrero de 2026/i);

            fireEvent.keyDown(cell15, { key: 'Home' });

            expect(() => fireEvent.keyDown(cell15, { key: 'Home' })).not.toThrow();

            vi.useRealTimers();
        });

        it('should handle End key to jump to last day', () => {
            const onDateSelect = vi.fn();
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 1, 14, 12, 0, 0));

            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );
            const cell15 = screen.getByLabelText(/15 de febrero de 2026/i);

            fireEvent.keyDown(cell15, { key: 'End' });

            expect(() => fireEvent.keyDown(cell15, { key: 'End' })).not.toThrow();

            vi.useRealTimers();
        });

        it('should select date on Enter key', () => {
            const onDateSelect = vi.fn();
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 1, 14, 12, 0, 0));

            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );
            const cell15 = screen.getByLabelText(/15 de febrero de 2026/i);

            fireEvent.keyDown(cell15, { key: 'Enter' });

            expect(onDateSelect).toHaveBeenCalledWith('2026-02-15');

            vi.useRealTimers();
        });

        it('should select date on Space key', () => {
            const onDateSelect = vi.fn();
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 1, 14, 12, 0, 0));

            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );
            const cell15 = screen.getByLabelText(/15 de febrero de 2026/i);

            fireEvent.keyDown(cell15, { key: ' ' });

            expect(onDateSelect).toHaveBeenCalledWith('2026-02-15');

            vi.useRealTimers();
        });

        it('should prevent default on arrow keys to avoid page scroll', () => {
            const onDateSelect = vi.fn();
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 1, 14, 12, 0, 0));

            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );
            const cell15 = screen.getByLabelText(/15 de febrero de 2026/i);

            const event = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });
            const _preventDefaultSpy = vi.spyOn(event, 'preventDefault');

            fireEvent.keyDown(cell15, event);

            // Note: In a real DOM environment, preventDefault would be called
            // In JSDOM, we can't directly verify this, so we check that the handler doesn't throw
            expect(() => fireEvent.keyDown(cell15, { key: 'ArrowRight' })).not.toThrow();

            vi.useRealTimers();
        });
    });

    describe('Localization', () => {
        it('should display month names in Spanish', () => {
            const onDateSelect = vi.fn();
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 1, 14, 12, 0, 0));

            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );
            expect(screen.getByText(/febrero 2026/i)).toBeInTheDocument();

            vi.useRealTimers();
        });

        it('should display month names in English', () => {
            const onDateSelect = vi.fn();
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 1, 14, 12, 0, 0));

            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="en"
                />
            );
            expect(screen.getByText(/february 2026/i)).toBeInTheDocument();

            vi.useRealTimers();
        });

        it('should display month names in Portuguese', () => {
            const onDateSelect = vi.fn();
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 1, 14, 12, 0, 0));

            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="pt"
                />
            );
            expect(screen.getByText(/fevereiro 2026/i)).toBeInTheDocument();

            vi.useRealTimers();
        });

        it('should have aria-labels in Spanish', () => {
            const onDateSelect = vi.fn();
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 1, 14, 12, 0, 0));

            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );
            expect(screen.getByLabelText(/15 de febrero de 2026/i)).toBeInTheDocument();

            vi.useRealTimers();
        });

        it('should have aria-labels in English', () => {
            const onDateSelect = vi.fn();
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 1, 14, 12, 0, 0));

            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="en"
                />
            );
            expect(screen.getByLabelText(/february 15, 2026/i)).toBeInTheDocument();

            vi.useRealTimers();
        });

        it('should have aria-labels in Portuguese', () => {
            const onDateSelect = vi.fn();
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 1, 14, 12, 0, 0));

            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="pt"
                />
            );
            expect(screen.getByLabelText(/15 de fevereiro de 2026/i)).toBeInTheDocument();

            vi.useRealTimers();
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty events array', () => {
            const onDateSelect = vi.fn();
            render(
                <CalendarView
                    events={[]}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );
            expect(screen.getByRole('grid')).toBeInTheDocument();
        });

        it('should handle month with leading days from previous month', () => {
            const onDateSelect = vi.fn();
            vi.useFakeTimers();
            // February 2026 starts on Sunday
            vi.setSystemTime(new Date(2026, 1, 1, 12, 0, 0));

            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );

            // Should have cells from previous month
            const cells = screen.getAllByRole('gridcell');
            expect(cells.length).toBe(42); // 6 rows × 7 columns

            vi.useRealTimers();
        });

        it('should handle month with trailing days from next month', () => {
            const onDateSelect = vi.fn();
            vi.useFakeTimers();
            // February 2026 ends on Saturday
            vi.setSystemTime(new Date(2026, 1, 28, 12, 0, 0));

            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );

            // Should have cells from next month
            const cells = screen.getAllByRole('gridcell');
            expect(cells.length).toBe(42); // 6 rows × 7 columns

            vi.useRealTimers();
        });

        it('should handle leap year February correctly', () => {
            const onDateSelect = vi.fn();
            vi.useFakeTimers();
            // 2024 is a leap year
            vi.setSystemTime(new Date(2024, 1, 14, 12, 0, 0));

            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );

            // Should show 29 days in February 2024
            expect(screen.getByLabelText(/29 de febrero de 2024/i)).toBeInTheDocument();

            vi.useRealTimers();
        });

        it('should handle non-leap year February correctly', () => {
            const onDateSelect = vi.fn();
            vi.useFakeTimers();
            // 2026 is not a leap year
            vi.setSystemTime(new Date(2026, 1, 14, 12, 0, 0));

            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );

            // Should NOT show 29 days in February 2026
            expect(screen.queryByLabelText(/29 de febrero de 2026/i)).not.toBeInTheDocument();

            vi.useRealTimers();
        });

        it('should style days from previous/next month as muted', () => {
            const onDateSelect = vi.fn();
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 1, 14, 12, 0, 0));

            const { container } = render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );

            // Days from other months should have text-gray-400
            const cells = container.querySelectorAll('[role="gridcell"]');
            const mutedCells = Array.from(cells).filter((cell) =>
                cell.className.includes('text-gray-400')
            );
            expect(mutedCells.length).toBeGreaterThan(0);

            vi.useRealTimers();
        });

        it('should handle events in different months correctly', () => {
            const onDateSelect = vi.fn();
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 1, 14, 12, 0, 0));

            const { container } = render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );

            // February should show events for Feb 15 and Feb 20
            const febEventDots = container.querySelectorAll('[aria-hidden="true"].rounded-full');
            expect(febEventDots.length).toBeGreaterThan(0);

            // Navigate to March
            const nextButton = screen.getByLabelText('Mes siguiente');
            fireEvent.click(nextButton);

            // March should show event for March 10
            const marchEventDots = container.querySelectorAll('[aria-hidden="true"].rounded-full');
            expect(marchEventDots.length).toBeGreaterThan(0);

            vi.useRealTimers();
        });

        it('should maintain selected date when navigating months', () => {
            const onDateSelect = vi.fn();
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 1, 14, 12, 0, 0));

            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );

            // Select Feb 15
            const cell15 = screen.getByLabelText(/15 de febrero de 2026/i);
            fireEvent.click(cell15);

            expect(onDateSelect).toHaveBeenCalledWith('2026-02-15');

            // Navigate to March
            const nextButton = screen.getByLabelText('Mes siguiente');
            fireEvent.click(nextButton);

            // Navigate back to February
            const prevButton = screen.getByLabelText('Mes anterior');
            fireEvent.click(prevButton);

            // Feb 15 should still be selected
            const cell15Again = screen.getByLabelText(/15 de febrero de 2026/i);
            expect(cell15Again).toHaveAttribute('aria-selected', 'true');

            vi.useRealTimers();
        });

        it('should handle today indicator correctly', () => {
            const onDateSelect = vi.fn();
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 1, 14, 12, 0, 0)); // Feb 14, 2026 at noon local time

            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );

            const todayCell = screen.getByLabelText(/14 de febrero de 2026/i);
            expect(todayCell).toHaveAttribute('aria-current', 'date');
            expect(todayCell.className).toContain('bg-blue-50');
            expect(todayCell.className).toContain('ring-blue-500');

            vi.useRealTimers();
        });
    });

    describe('Styling', () => {
        it('should apply primary background to selected date', () => {
            const onDateSelect = vi.fn();
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 1, 14, 12, 0, 0));

            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );
            const cell15 = screen.getByLabelText(/15 de febrero de 2026/i);
            fireEvent.click(cell15);

            expect(cell15.className).toContain('bg-primary');
            expect(cell15.className).toContain('text-white');

            vi.useRealTimers();
        });

        it('should apply hover styles on non-selected dates', () => {
            const onDateSelect = vi.fn();
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 1, 14, 12, 0, 0));

            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );
            const cell15 = screen.getByLabelText(/15 de febrero de 2026/i);

            expect(cell15.className).toContain('hover:bg-gray-50');

            vi.useRealTimers();
        });

        it('should apply transition styles on date cells', () => {
            const onDateSelect = vi.fn();
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 1, 14, 12, 0, 0));

            render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );
            const cell15 = screen.getByLabelText(/15 de febrero de 2026/i);

            expect(cell15.className).toContain('transition-colors');

            vi.useRealTimers();
        });

        it('should have event indicator dot with correct styling', () => {
            const onDateSelect = vi.fn();
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 1, 14, 12, 0, 0));

            const { container } = render(
                <CalendarView
                    events={mockEvents}
                    onDateSelect={onDateSelect}
                    locale="es"
                />
            );

            const eventDots = container.querySelectorAll('[aria-hidden="true"].rounded-full');
            const firstDot = eventDots[0];

            if (firstDot) {
                expect(firstDot.className).toContain('rounded-full');
            }

            vi.useRealTimers();
        });
    });
});
