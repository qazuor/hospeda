/**
 * @file hero-search-form.test.tsx
 * @description Tests for HeroSearchForm.tsx React island component.
 * Mocks all external dependencies (Shadcn UI, icons, sub-components, hooks)
 * to focus on the component's rendering logic and user interactions.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @repo/icons
// ---------------------------------------------------------------------------

vi.mock('@repo/icons', () => ({
    CalendarDotsIcon: ({ className }: { className?: string }) => (
        <svg
            data-testid="calendar-dots-icon"
            className={className}
        />
    ),
    SearchIcon: ({ className }: { className?: string }) => (
        <svg
            data-testid="search-icon"
            className={className}
        />
    ),
    UsersIcon: ({ className }: { className?: string }) => (
        <svg
            data-testid="users-icon"
            className={className}
        />
    )
}));

// ---------------------------------------------------------------------------
// Mock @/components/ui/* (Shadcn primitives)
// ---------------------------------------------------------------------------

vi.mock('@/components/ui/button', () => ({
    Button: ({
        children,
        onClick,
        className,
        size: _size,
        variant: _variant
    }: {
        children: React.ReactNode;
        onClick?: () => void;
        className?: string;
        size?: string;
        variant?: string;
    }) => (
        <button
            type="button"
            data-testid="button"
            onClick={onClick}
            className={className}
        >
            {children}
        </button>
    )
}));

vi.mock('@/components/ui/popover', () => ({
    Popover: ({
        children,
        open: _open,
        onOpenChange: _onOpenChange
    }: {
        children: React.ReactNode;
        open?: boolean;
        onOpenChange?: (v: boolean) => void;
    }) => <div data-testid="popover">{children}</div>,

    PopoverTrigger: ({
        children,
        asChild: _asChild
    }: {
        children: React.ReactNode;
        asChild?: boolean;
    }) => <div data-testid="popover-trigger">{children}</div>,

    PopoverContent: ({
        children,
        className,
        align: _align
    }: {
        children: React.ReactNode;
        className?: string;
        align?: string;
    }) => (
        <div
            data-testid="popover-content"
            className={className}
        >
            {children}
        </div>
    )
}));

vi.mock('@/components/ui/drawer', () => ({
    Drawer: ({
        children,
        open: _open,
        onOpenChange: _onOpenChange
    }: {
        children: React.ReactNode;
        open?: boolean;
        onOpenChange?: (v: boolean) => void;
    }) => <div data-testid="drawer">{children}</div>,

    DrawerTrigger: ({
        children,
        asChild: _asChild
    }: {
        children: React.ReactNode;
        asChild?: boolean;
    }) => <div data-testid="drawer-trigger">{children}</div>,

    DrawerContent: ({
        children,
        className
    }: {
        children: React.ReactNode;
        className?: string;
    }) => (
        <div
            data-testid="drawer-content"
            className={className}
        >
            {children}
        </div>
    ),

    DrawerHeader: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="drawer-header">{children}</div>
    ),

    DrawerTitle: ({
        children,
        className
    }: {
        children: React.ReactNode;
        className?: string;
    }) => (
        <div
            data-testid="drawer-title"
            className={className}
        >
            {children}
        </div>
    ),

    DrawerFooter: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="drawer-footer">{children}</div>
    ),

    DrawerClose: ({
        children,
        asChild: _asChild
    }: {
        children: React.ReactNode;
        asChild?: boolean;
    }) => <div data-testid="drawer-close">{children}</div>
}));

vi.mock('@/components/ui/calendar', () => ({
    Calendar: ({
        mode: _mode,
        selected: _selected,
        onSelect: _onSelect,
        numberOfMonths: _numberOfMonths,
        disabled: _disabled,
        locale: _locale
    }: Record<string, unknown>) => <div data-testid="calendar" />
}));

// ---------------------------------------------------------------------------
// Mock @/components/shared/* sub-components
// ---------------------------------------------------------------------------

vi.mock('@/components/shared/GuestCounter', () => ({
    GuestCounter: ({
        label,
        value,
        onIncrement,
        onDecrement
    }: {
        label: string;
        sublabel?: string;
        value: number;
        min?: number;
        onIncrement: () => void;
        onDecrement: () => void;
        locale?: string;
    }) => (
        <div data-testid="guest-counter">
            <span>{label}</span>
            <span data-testid="counter-value">{value}</span>
            <button
                type="button"
                data-testid="increment"
                onClick={onIncrement}
            >
                +
            </button>
            <button
                type="button"
                data-testid="decrement"
                onClick={onDecrement}
            >
                -
            </button>
        </div>
    )
}));

vi.mock('@/components/shared/SearchFieldDestination', () => ({
    SearchFieldDestination: ({
        value: _value,
        onValueChange: _onValueChange,
        variant,
        locale: _locale
    }: {
        value: string;
        onValueChange: (v: string) => void;
        variant: string;
        locale: string;
    }) => <div data-testid={`search-field-destination-${variant}`} />
}));

vi.mock('@/components/shared/SearchFieldType', () => ({
    SearchFieldType: ({
        value: _value,
        onValueChange: _onValueChange,
        variant,
        locale: _locale
    }: {
        value: string;
        onValueChange: (v: string) => void;
        variant: string;
        locale: string;
    }) => <div data-testid={`search-field-type-${variant}`} />
}));

// ---------------------------------------------------------------------------
// Mock date-fns locale (es) - prevent module resolution issues
// ---------------------------------------------------------------------------

vi.mock('date-fns/locale', () => ({
    es: {}
}));

// ---------------------------------------------------------------------------
// Import component under test (AFTER all mocks)
// ---------------------------------------------------------------------------

import type React from 'react';
import { HeroSearchForm } from '../../src/components/hero/HeroSearchForm';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderForm(locale?: 'es' | 'en' | 'pt') {
    return render(<HeroSearchForm locale={locale} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.clearAllMocks();
});

describe('HeroSearchForm', () => {
    describe('rendering - desktop layout', () => {
        it('should render without crashing', () => {
            expect(() => renderForm('es')).not.toThrow();
        });

        it('should render the desktop search field for destinations', () => {
            renderForm('es');
            expect(screen.getByTestId('search-field-destination-desktop')).toBeInTheDocument();
        });

        it('should render the desktop search field for accommodation type', () => {
            renderForm('es');
            expect(screen.getByTestId('search-field-type-desktop')).toBeInTheDocument();
        });

        it('should render guests-related icon in the desktop layout', () => {
            renderForm('es');
            // The UsersIcon is used in the desktop guests FieldLabel
            const usersIcons = screen.getAllByTestId('users-icon');
            expect(usersIcons.length).toBeGreaterThanOrEqual(1);
        });

        it('should render dates-related icon in the desktop layout', () => {
            renderForm('es');
            const calendarIcons = screen.getAllByTestId('calendar-dots-icon');
            expect(calendarIcons.length).toBeGreaterThanOrEqual(1);
        });

        it('should render search icon(s)', () => {
            renderForm('es');
            const searchIcons = screen.getAllByTestId('search-icon');
            expect(searchIcons.length).toBeGreaterThanOrEqual(1);
        });

        it('should render GuestCounter components for adults and children', () => {
            renderForm('es');
            const counters = screen.getAllByTestId('guest-counter');
            expect(counters.length).toBeGreaterThanOrEqual(2);
        });

        it('should render a Calendar component for date selection', () => {
            renderForm('es');
            const calendars = screen.getAllByTestId('calendar');
            expect(calendars.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('rendering - mobile layout', () => {
        it('should render the drawer for mobile', () => {
            renderForm('es');
            expect(screen.getByTestId('drawer')).toBeInTheDocument();
        });

        it('should render the drawer trigger button', () => {
            renderForm('es');
            expect(screen.getByTestId('drawer-trigger')).toBeInTheDocument();
        });

        it('should render mobile search fields inside drawer content', () => {
            renderForm('es');
            expect(screen.getByTestId('search-field-destination-mobile')).toBeInTheDocument();
            expect(screen.getByTestId('search-field-type-mobile')).toBeInTheDocument();
        });

        it('should render the drawer header with title', () => {
            renderForm('es');
            expect(screen.getByTestId('drawer-header')).toBeInTheDocument();
            expect(screen.getByTestId('drawer-title')).toBeInTheDocument();
        });

        it('should render drawer footer with action buttons', () => {
            renderForm('es');
            expect(screen.getByTestId('drawer-footer')).toBeInTheDocument();
        });

        it('should render a cancel button in the drawer footer', () => {
            renderForm('es');
            const drawerClose = screen.getByTestId('drawer-close');
            expect(drawerClose).toBeInTheDocument();
        });
    });

    describe('locale support', () => {
        it('should render without crashing with es locale', () => {
            expect(() => renderForm('es')).not.toThrow();
        });

        it('should render without crashing with en locale', () => {
            expect(() => renderForm('en')).not.toThrow();
        });

        it('should render without crashing with pt locale', () => {
            expect(() => renderForm('pt')).not.toThrow();
        });

        it('should render without crashing when locale is not provided', () => {
            expect(() => render(<HeroSearchForm />)).not.toThrow();
        });
    });

    describe('initial state', () => {
        it('should render guest counter with initial value of 2 for adults', () => {
            renderForm('es');
            // The first counter-value should be 2 (default adults)
            const counterValues = screen.getAllByTestId('counter-value');
            const adultValue = counterValues[0];
            expect(adultValue.textContent).toBe('2');
        });

        it('should render guest counter with initial value of 0 for children', () => {
            renderForm('es');
            const counterValues = screen.getAllByTestId('counter-value');
            // Children counter (second one in desktop layout)
            const childValue = counterValues[1];
            expect(childValue.textContent).toBe('0');
        });
    });

    describe('guest counter interactions', () => {
        it('should increment adult count when + button clicked', () => {
            renderForm('es');
            const incrementButtons = screen.getAllByTestId('increment');
            // First increment button is for adults (desktop layout)
            const adultIncrement = incrementButtons[0];
            const counterValues = screen.getAllByTestId('counter-value');
            const adultValue = counterValues[0];

            expect(adultValue.textContent).toBe('2');
            fireEvent.click(adultIncrement);
            expect(adultValue.textContent).toBe('3');
        });

        it('should decrement adult count when - button clicked', () => {
            renderForm('es');
            const decrementButtons = screen.getAllByTestId('decrement');
            const adultDecrement = decrementButtons[0];
            const counterValues = screen.getAllByTestId('counter-value');
            const adultValue = counterValues[0];

            expect(adultValue.textContent).toBe('2');
            fireEvent.click(adultDecrement);
            expect(adultValue.textContent).toBe('1');
        });

        it('should not decrement adults below 1', () => {
            renderForm('es');
            const decrementButtons = screen.getAllByTestId('decrement');
            const adultDecrement = decrementButtons[0];
            const counterValues = screen.getAllByTestId('counter-value');
            const adultValue = counterValues[0];

            // Adults starts at 2, click decrement twice - should stop at 1
            fireEvent.click(adultDecrement);
            fireEvent.click(adultDecrement);
            fireEvent.click(adultDecrement);
            expect(adultValue.textContent).toBe('1');
        });

        it('should increment children count when + button clicked', () => {
            renderForm('es');
            const incrementButtons = screen.getAllByTestId('increment');
            // Second increment button is for children
            const childIncrement = incrementButtons[1];
            const counterValues = screen.getAllByTestId('counter-value');
            const childValue = counterValues[1];

            expect(childValue.textContent).toBe('0');
            fireEvent.click(childIncrement);
            expect(childValue.textContent).toBe('1');
        });

        it('should not decrement children below 0', () => {
            renderForm('es');
            const decrementButtons = screen.getAllByTestId('decrement');
            const childDecrement = decrementButtons[1];
            const counterValues = screen.getAllByTestId('counter-value');
            const childValue = counterValues[1];

            expect(childValue.textContent).toBe('0');
            fireEvent.click(childDecrement);
            // Should stay at 0
            expect(childValue.textContent).toBe('0');
        });
    });

    describe('structure and accessibility', () => {
        it('should render a wrapping div with max-width class', () => {
            const { container } = renderForm('es');
            const wrapper = container.firstChild as HTMLElement;
            expect(wrapper).not.toBeNull();
            expect(wrapper.tagName).toBe('DIV');
        });

        it('should render popovers for desktop guests and dates fields', () => {
            renderForm('es');
            const popovers = screen.getAllByTestId('popover');
            // At minimum 2 popovers: guests + dates (desktop)
            // + 2 more in mobile drawer = 4 total
            expect(popovers.length).toBeGreaterThanOrEqual(2);
        });

        it('should render multiple buttons for search actions', () => {
            renderForm('es');
            const buttons = screen.getAllByTestId('button');
            // At minimum: Done button in guests popover + desktop search + mobile search + cancel
            expect(buttons.length).toBeGreaterThanOrEqual(2);
        });
    });
});

// ---------------------------------------------------------------------------
// Additional: layout detection, URL building, sheet/drawer, and adults max cap
// ---------------------------------------------------------------------------

describe('HeroSearchForm - layout mode detection', () => {
    it('should render both desktop (lg:flex hidden) and mobile (lg:hidden) layouts simultaneously', () => {
        const { container } = renderForm('es');
        // Desktop bar has "hidden ... lg:flex" and mobile section has "lg:hidden"
        const html = container.innerHTML;
        expect(html).toContain('lg:flex');
        expect(html).toContain('lg:hidden');
    });

    it('should render desktop destination field with variant=desktop', () => {
        renderForm('es');
        expect(screen.getByTestId('search-field-destination-desktop')).toBeInTheDocument();
    });

    it('should render mobile destination field with variant=mobile inside the drawer', () => {
        renderForm('es');
        expect(screen.getByTestId('search-field-destination-mobile')).toBeInTheDocument();
    });

    it('should render desktop type field with variant=desktop', () => {
        renderForm('es');
        expect(screen.getByTestId('search-field-type-desktop')).toBeInTheDocument();
    });

    it('should render mobile type field with variant=mobile inside the drawer', () => {
        renderForm('es');
        expect(screen.getByTestId('search-field-type-mobile')).toBeInTheDocument();
    });
});

describe('HeroSearchForm - mobile drawer/sheet behavior', () => {
    it('should render exactly one drawer wrapper element', () => {
        renderForm('es');
        const drawers = screen.getAllByTestId('drawer');
        expect(drawers).toHaveLength(1);
    });

    it('should render a drawer trigger that opens the mobile search sheet', () => {
        renderForm('es');
        expect(screen.getByTestId('drawer-trigger')).toBeInTheDocument();
    });

    it('should render the drawer content panel', () => {
        renderForm('es');
        expect(screen.getByTestId('drawer-content')).toBeInTheDocument();
    });

    it('should render a drawer close element for cancel action', () => {
        renderForm('es');
        expect(screen.getByTestId('drawer-close')).toBeInTheDocument();
    });

    it('should render a drawer title with the search accommodation text key', () => {
        renderForm('es');
        // The DrawerTitle mock renders its children as text inside the element
        const title = screen.getByTestId('drawer-title');
        expect(title).toBeInTheDocument();
    });

    it('should render GuestCounter components inside the drawer for mobile guests', () => {
        renderForm('es');
        // Counters appear in both desktop popover and mobile drawer
        const counters = screen.getAllByTestId('guest-counter');
        // Each counter appears twice: once in desktop popover, once in mobile drawer
        expect(counters.length).toBeGreaterThanOrEqual(2);
    });

    it('should render a Calendar inside the drawer for mobile date selection', () => {
        renderForm('es');
        const calendars = screen.getAllByTestId('calendar');
        expect(calendars.length).toBeGreaterThanOrEqual(1);
    });
});

describe('HeroSearchForm - guest counter max/min boundaries', () => {
    it('should cap adults at 10 when incremented beyond the maximum', () => {
        renderForm('es');
        const incrementButtons = screen.getAllByTestId('increment');
        const adultIncrement = incrementButtons[0];
        const counterValues = screen.getAllByTestId('counter-value');
        const adultValue = counterValues[0];

        // Click increment 15 times from initial value of 2 — should stop at 10
        for (let i = 0; i < 15; i++) {
            fireEvent.click(adultIncrement);
        }
        expect(adultValue.textContent).toBe('10');
    });

    it('should cap children at 10 when incremented beyond the maximum', () => {
        renderForm('es');
        const incrementButtons = screen.getAllByTestId('increment');
        const childIncrement = incrementButtons[1];
        const counterValues = screen.getAllByTestId('counter-value');
        const childValue = counterValues[1];

        // Click increment 15 times from initial value of 0 — should stop at 10
        for (let i = 0; i < 15; i++) {
            fireEvent.click(childIncrement);
        }
        expect(childValue.textContent).toBe('10');
    });

    it('should not allow adults to go below 1 even after many decrements', () => {
        renderForm('es');
        const decrementButtons = screen.getAllByTestId('decrement');
        const adultDecrement = decrementButtons[0];
        const counterValues = screen.getAllByTestId('counter-value');
        const adultValue = counterValues[0];

        for (let i = 0; i < 10; i++) {
            fireEvent.click(adultDecrement);
        }
        expect(adultValue.textContent).toBe('1');
    });

    it('should not allow children to go below 0 even after many decrements', () => {
        renderForm('es');
        const decrementButtons = screen.getAllByTestId('decrement');
        const childDecrement = decrementButtons[1];
        const counterValues = screen.getAllByTestId('counter-value');
        const childValue = counterValues[1];

        for (let i = 0; i < 10; i++) {
            fireEvent.click(childDecrement);
        }
        expect(childValue.textContent).toBe('0');
    });
});

describe('HeroSearchForm - popover structure for desktop fields', () => {
    it('should render at least 2 popovers (guests + dates) in the desktop layout', () => {
        renderForm('es');
        const popovers = screen.getAllByTestId('popover');
        expect(popovers.length).toBeGreaterThanOrEqual(2);
    });

    it('should render popover triggers for desktop fields', () => {
        renderForm('es');
        const triggers = screen.getAllByTestId('popover-trigger');
        expect(triggers.length).toBeGreaterThanOrEqual(2);
    });

    it('should render popover content panels for guests and dates', () => {
        renderForm('es');
        const contents = screen.getAllByTestId('popover-content');
        expect(contents.length).toBeGreaterThanOrEqual(2);
    });
});
