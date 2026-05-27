// @vitest-environment jsdom
/**
 * Tests for the shared widget-states module (SPEC-155 T-028).
 *
 * Verifies that each shared state component:
 * - Renders the correct `data-testid` derived from the `variant` prop.
 * - Renders the expected accessible attributes (role, aria-label, aria-busy).
 * - Renders the expected text content.
 * - WidgetError exposes a retry button that calls `onRetry` when clicked.
 * - WidgetEmpty renders the default text when `text` is not provided.
 * - WidgetEmpty renders custom `text` when provided.
 * - WidgetSkeleton renders the variant-specific inner shape.
 *
 * References: SPEC-155 T-028
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WidgetEmpty, WidgetError, WidgetSkeleton, WidgetUnavailable } from '../widget-states';
import type { WidgetVariant } from '../widget-states';

// Mock icons — tests don't depend on the Phosphor bundle.
vi.mock('@repo/icons', () => ({
    AlertTriangleIcon: ({ className }: { className?: string }) => (
        <svg
            data-testid="alert-triangle-icon"
            className={className}
            aria-hidden="true"
        />
    )
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALL_VARIANTS: WidgetVariant[] = ['kpi', 'list', 'chart', 'checklist', 'status'];

// ---------------------------------------------------------------------------
// WidgetSkeleton
// ---------------------------------------------------------------------------

describe('WidgetSkeleton', () => {
    it.each(ALL_VARIANTS)(
        'renders data-testid="%s-widget-skeleton" for variant "%s"',
        (variant) => {
            render(<WidgetSkeleton variant={variant} />);
            expect(screen.getByTestId(`${variant}-widget-skeleton`)).toBeInTheDocument();
        }
    );

    it('has aria-busy="true" and aria-label="Loading"', () => {
        render(<WidgetSkeleton variant="kpi" />);
        const el = screen.getByTestId('kpi-widget-skeleton');
        expect(el).toHaveAttribute('aria-busy', 'true');
        expect(el).toHaveAttribute('aria-label', 'Loading');
    });

    it('renders the kpi inner shape (label + value + delta lines)', () => {
        const { container } = render(<WidgetSkeleton variant="kpi" />);
        // kpi shape has 3 muted divs
        const mutesDivs = container.querySelectorAll('.bg-muted');
        expect(mutesDivs.length).toBeGreaterThanOrEqual(3);
    });

    it('renders the list inner shape (header + 4 rows with 3 muted items each)', () => {
        const { container } = render(<WidgetSkeleton variant="list" />);
        // list: 1 header + 4 rows × 3 items = 13 muted elements
        const mutesDivs = container.querySelectorAll('.bg-muted');
        expect(mutesDivs.length).toBeGreaterThanOrEqual(13);
    });

    it('renders the chart inner shape (header + bars + ticks)', () => {
        const { container } = render(<WidgetSkeleton variant="chart" />);
        // chart: 1 header + 7 bars + 7 ticks = 15 muted elements
        const mutesDivs = container.querySelectorAll('.bg-muted');
        expect(mutesDivs.length).toBeGreaterThanOrEqual(15);
    });

    it('renders the checklist inner shape (header + progress + 5 rows)', () => {
        const { container } = render(<WidgetSkeleton variant="checklist" />);
        // checklist: 1 header + 1 progress + 5 rows × 2 items = 12 muted elements
        const mutesDivs = container.querySelectorAll('.bg-muted');
        expect(mutesDivs.length).toBeGreaterThanOrEqual(12);
    });

    it('renders the status inner shape (label + badge + description)', () => {
        const { container } = render(<WidgetSkeleton variant="status" />);
        // status: 3 muted elements
        const mutesDivs = container.querySelectorAll('.bg-muted');
        expect(mutesDivs.length).toBeGreaterThanOrEqual(3);
    });
});

// ---------------------------------------------------------------------------
// WidgetError
// ---------------------------------------------------------------------------

describe('WidgetError', () => {
    it.each(ALL_VARIANTS)('renders data-testid="%s-widget-error" for variant "%s"', (variant) => {
        render(
            <WidgetError
                variant={variant}
                label="Test"
                onRetry={vi.fn()}
            />
        );
        expect(screen.getByTestId(`${variant}-widget-error`)).toBeInTheDocument();
    });

    it('has role="alert"', () => {
        render(
            <WidgetError
                variant="kpi"
                label="Test label"
                onRetry={vi.fn()}
            />
        );
        expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('includes the label in the aria-label', () => {
        render(
            <WidgetError
                variant="kpi"
                label="Total alojamientos"
                onRetry={vi.fn()}
            />
        );
        expect(screen.getByRole('alert')).toHaveAttribute(
            'aria-label',
            'Error loading Total alojamientos'
        );
    });

    it('renders the "Reintentar" button', () => {
        render(
            <WidgetError
                variant="kpi"
                label="Test"
                onRetry={vi.fn()}
            />
        );
        expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
    });

    it('calls onRetry when the retry button is clicked', () => {
        const onRetry = vi.fn();
        render(
            <WidgetError
                variant="kpi"
                label="Test"
                onRetry={onRetry}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
        expect(onRetry).toHaveBeenCalledOnce();
    });

    it('renders the AlertTriangleIcon', () => {
        render(
            <WidgetError
                variant="kpi"
                label="Test"
                onRetry={vi.fn()}
            />
        );
        expect(screen.getByTestId('alert-triangle-icon')).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// WidgetEmpty
// ---------------------------------------------------------------------------

describe('WidgetEmpty', () => {
    it.each(ALL_VARIANTS)('renders data-testid="%s-widget-empty" for variant "%s"', (variant) => {
        render(<WidgetEmpty variant={variant} />);
        expect(screen.getByTestId(`${variant}-widget-empty`)).toBeInTheDocument();
    });

    it('renders default text "—" when text is not provided', () => {
        render(<WidgetEmpty variant="kpi" />);
        expect(screen.getByTestId('kpi-widget-empty')).toHaveTextContent('—');
    });

    it('renders custom text when provided', () => {
        render(
            <WidgetEmpty
                variant="list"
                text="Sin datos"
            />
        );
        expect(screen.getByTestId('list-widget-empty')).toHaveTextContent('Sin datos');
    });

    it('renders "Sin datos disponibles" for checklist variant', () => {
        render(
            <WidgetEmpty
                variant="checklist"
                text="Sin datos disponibles"
            />
        );
        expect(screen.getByTestId('checklist-widget-empty')).toHaveTextContent(
            'Sin datos disponibles'
        );
    });
});

// ---------------------------------------------------------------------------
// WidgetUnavailable
// ---------------------------------------------------------------------------

describe('WidgetUnavailable', () => {
    it.each(ALL_VARIANTS)(
        'renders data-testid="%s-widget-unavailable" for variant "%s"',
        (variant) => {
            render(
                <WidgetUnavailable
                    variant={variant}
                    label="Test"
                />
            );
            expect(screen.getByTestId(`${variant}-widget-unavailable`)).toBeInTheDocument();
        }
    );

    it('includes the label in the aria-label', () => {
        render(
            <WidgetUnavailable
                variant="kpi"
                label="Total alojamientos"
            />
        );
        expect(screen.getByTestId('kpi-widget-unavailable')).toHaveAttribute(
            'aria-label',
            'Total alojamientos — data source unavailable'
        );
    });

    it('renders "Sin fuente de datos" text', () => {
        render(
            <WidgetUnavailable
                variant="kpi"
                label="Test"
            />
        );
        expect(screen.getByTestId('kpi-widget-unavailable')).toHaveTextContent(
            'Sin fuente de datos'
        );
    });
});
