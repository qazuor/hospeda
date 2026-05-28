// @vitest-environment jsdom
/**
 * Tests for DeferredWidget component (SPEC-155 T-022).
 *
 * Covers:
 * - Renders without error
 * - Shows the coming-soon copy (title + description defaults)
 * - Renders phaseSpec badge when provided
 * - Renders custom title and description when provided
 * - Renders fine when description is omitted (falls back to default)
 * - Never throws when only the required phaseSpec prop is given
 *
 * References: SPEC-155 T-022, AC-T-041
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeferredWidget } from '../DeferredWidget';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: (key: string) => key })
}));

vi.mock('@repo/icons', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/icons')>()),
    ClockIcon: ({ className }: { className?: string }) => (
        <svg
            data-testid="clock-icon"
            className={className}
            aria-hidden="true"
        />
    )
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DeferredWidget', () => {
    /**
     * Component must render without throwing regardless of props.
     */
    it('renders without error with only the required phaseSpec prop', () => {
        expect(() => {
            render(<DeferredWidget phaseSpec="SPEC-159" />);
        }).not.toThrow();
    });

    /**
     * When no title is provided the component must show the default coming-soon
     * copy (the i18n key returned as-is by the mock).
     */
    it('shows the default coming-soon title key when title prop is omitted', () => {
        render(<DeferredWidget phaseSpec="SPEC-159" />);

        // The mock t() returns the key as-is, so we assert the key is rendered.
        expect(screen.getByText('admin-common.comingSoon.title')).toBeInTheDocument();
    });

    /**
     * When no description is provided the component must show the default
     * description coming-soon copy.
     */
    it('shows the default coming-soon description key when description prop is omitted', () => {
        render(<DeferredWidget phaseSpec="SPEC-159" />);

        expect(screen.getByText('admin-common.comingSoon.description')).toBeInTheDocument();
    });

    /**
     * The phaseSpec value must be rendered in the spec badge element.
     */
    it('renders the phaseSpec value in the badge', () => {
        render(<DeferredWidget phaseSpec="SPEC-161" />);

        const badge = screen.getByTestId('deferred-widget-spec-badge');
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveTextContent('SPEC-161');
    });

    /**
     * Custom title overrides the default coming-soon copy.
     */
    it('renders the custom title when provided', () => {
        render(
            <DeferredWidget
                phaseSpec="SPEC-160"
                title="Open rate del newsletter"
            />
        );

        expect(screen.getByText('Open rate del newsletter')).toBeInTheDocument();
        // Default key must NOT appear
        expect(screen.queryByText('admin-common.comingSoon.title')).not.toBeInTheDocument();
    });

    /**
     * Custom description overrides the default coming-soon description.
     */
    it('renders the custom description when provided', () => {
        render(
            <DeferredWidget
                phaseSpec="SPEC-160"
                description="Disponible cuando se implemente SPEC-160."
            />
        );

        expect(screen.getByText('Disponible cuando se implemente SPEC-160.')).toBeInTheDocument();
        // Default key must NOT appear
        expect(screen.queryByText('admin-common.comingSoon.description')).not.toBeInTheDocument();
    });

    /**
     * Component renders fine when description is explicitly omitted — the
     * default description from i18n takes over without any crash.
     */
    it('renders fine when description is omitted and phaseSpec is present', () => {
        render(
            <DeferredWidget
                phaseSpec="SPEC-162"
                title="Audit Logs"
            />
        );

        // Title provided
        expect(screen.getByText('Audit Logs')).toBeInTheDocument();
        // phaseSpec badge rendered
        expect(screen.getByTestId('deferred-widget-spec-badge')).toHaveTextContent('SPEC-162');
        // Default description key falls back correctly
        expect(screen.getByText('admin-common.comingSoon.description')).toBeInTheDocument();
    });

    /**
     * The root element carries a data-testid so sibling slots can assert
     * that the deferred widget was rendered (used in T-041 assertion tests).
     */
    it('exposes data-testid="deferred-widget" on the root container', () => {
        render(<DeferredWidget phaseSpec="SPEC-163" />);

        expect(screen.getByTestId('deferred-widget')).toBeInTheDocument();
    });

    /**
     * An accessible aria-label combining title and phaseSpec is present on
     * the root so screen readers can identify the deferred slot.
     */
    it('has an accessible aria-label containing the phaseSpec', () => {
        render(
            <DeferredWidget
                phaseSpec="SPEC-165"
                title="Comentarios"
            />
        );

        const widget = screen.getByTestId('deferred-widget');
        expect(widget.getAttribute('aria-label')).toContain('SPEC-165');
        expect(widget.getAttribute('aria-label')).toContain('Comentarios');
    });
});
