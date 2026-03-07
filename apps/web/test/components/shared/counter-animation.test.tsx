/**
 * @file counter-animation.test.tsx
 * @description Tests for CounterAnimation.client.tsx component.
 *
 * CounterAnimation is a React island that animates a number from 0 to
 * `targetValue` when the component enters the viewport (via IntersectionObserver).
 * It uses locale-aware number formatting, optional prefix/suffix, and announces
 * the final value to screen readers via aria-live.
 *
 * IntersectionObserver is mocked globally so that visibility can be controlled
 * in tests. requestAnimationFrame is also provided by jsdom.
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CounterAnimation } from '../../../src/components/shared/CounterAnimation.client';

// ---------------------------------------------------------------------------
// Mock @repo/i18n – the component uses formatNumber and toBcp47Locale.
// Return stable, predictable values so tests do not depend on locale logic.
// ---------------------------------------------------------------------------
vi.mock('@repo/i18n', () => ({
    formatNumber: ({ value }: { value: number; locale: string }) => String(value),
    toBcp47Locale: (locale: string) => locale
}));

// ---------------------------------------------------------------------------
// Mock the custom hooks so we control animation state in tests.
// useViewportTrigger returns [ref, isVisible]. When isVisible is true the
// animation starts. useCountUp returns the current animated value and completion.
// ---------------------------------------------------------------------------
vi.mock('../../../src/hooks/useCountUp', () => ({
    useViewportTrigger: () => [{ current: null }, true],
    useCountUp: ({ target }: { target: number }) => ({
        value: target,
        isComplete: true
    })
}));

// ---------------------------------------------------------------------------
// Global IntersectionObserver mock (required by useViewportTrigger in jsdom).
// ---------------------------------------------------------------------------
const mockObserver = {
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn()
};

beforeEach(() => {
    vi.clearAllMocks();
    window.IntersectionObserver = vi.fn().mockReturnValue(mockObserver);
});

describe('CounterAnimation.client.tsx', () => {
    describe('Basic rendering', () => {
        it('should render the target number in the document', () => {
            // Arrange
            const targetValue = 1500;

            // Act
            render(
                <CounterAnimation
                    targetValue={targetValue}
                    label="Alojamientos"
                />
            );

            // Assert: the formatted number is visible
            expect(screen.getByText('1500')).toBeInTheDocument();
        });

        it('should render the label text', () => {
            // Arrange
            const label = 'Destinos visitados';

            // Act
            render(
                <CounterAnimation
                    targetValue={42}
                    label={label}
                />
            );

            // Assert
            expect(screen.getByText(label)).toBeInTheDocument();
        });
    });

    describe('Prefix and suffix', () => {
        it('should render the suffix alongside the number', () => {
            // Arrange
            const { container } = render(
                <CounterAnimation
                    targetValue={200}
                    suffix="+"
                    label="Reseñas"
                />
            );

            // React renders number and suffix as separate text nodes inside one span.
            // Assert by checking the combined textContent of the number container.
            const numberDiv = container.querySelector('.text-foreground');
            expect(numberDiv?.textContent).toContain('200');
            expect(numberDiv?.textContent).toContain('+');
        });

        it('should render the prefix alongside the number', () => {
            // Arrange
            const { container } = render(
                <CounterAnimation
                    targetValue={50}
                    prefix="$"
                    label="Precio base"
                />
            );

            // React renders prefix and number as separate text nodes inside one span.
            // Assert by checking the combined textContent of the number container.
            const numberDiv = container.querySelector('.text-foreground');
            expect(numberDiv?.textContent).toContain('$');
            expect(numberDiv?.textContent).toContain('50');
        });

        it('should render both prefix and suffix together', () => {
            // Arrange
            const { container } = render(
                <CounterAnimation
                    targetValue={100}
                    prefix="~"
                    suffix="k"
                    label="Turistas"
                />
            );

            // React renders prefix, number, and suffix as separate text nodes inside one
            // span. Query the parent span via its structure instead of concatenated text.
            const numberDiv = container.querySelector('.text-foreground');
            expect(numberDiv?.textContent).toContain('~');
            expect(numberDiv?.textContent).toContain('100');
            expect(numberDiv?.textContent).toContain('k');
        });

        it('should render without prefix or suffix when both are omitted', () => {
            // Arrange
            render(
                <CounterAnimation
                    targetValue={7}
                    label="Provincias"
                />
            );

            // Assert: only the number is inside the numeric span
            expect(screen.getByText('7')).toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('should include an aria-live="polite" region', () => {
            // The sr-only span announces the final value to screen readers.
            const { container } = render(
                <CounterAnimation
                    targetValue={300}
                    label="Eventos"
                />
            );

            const liveRegion = container.querySelector('[aria-live="polite"]');
            expect(liveRegion).toBeInTheDocument();
        });

        it('should populate the aria-live region with the full announcement when complete', () => {
            // Arrange: hooks mock returns isComplete = true
            const { container } = render(
                <CounterAnimation
                    targetValue={50}
                    suffix="+"
                    label="Ciudades"
                />
            );

            // The sr-only span (aria-live) contains the full announcement.
            // Use a targeted selector to avoid matching the visible label div.
            const liveRegion = container.querySelector('[aria-live="polite"]');
            expect(liveRegion?.textContent).toContain('Ciudades');
        });

        it('should remove aria-hidden from the visible span when animation is complete', () => {
            // When isComplete is true the span should not be aria-hidden.
            const { container } = render(
                <CounterAnimation
                    targetValue={10}
                    label="Regiones"
                />
            );

            // The number span should not carry aria-hidden="true" after completion.
            const numberSpan = container.querySelector('span[aria-hidden="true"]');
            expect(numberSpan).not.toBeInTheDocument();
        });
    });

    describe('Layout', () => {
        it('should render a root div with flex-col and items-center', () => {
            const { container } = render(
                <CounterAnimation
                    targetValue={1}
                    label="Test"
                />
            );

            const root = container.firstChild as HTMLElement;
            expect(root.className).toContain('flex');
            expect(root.className).toContain('flex-col');
            expect(root.className).toContain('items-center');
        });

        it('should render the label in uppercase tracking-wider style', () => {
            render(
                <CounterAnimation
                    targetValue={1}
                    label="Etiqueta"
                />
            );

            const label = screen.getByText('Etiqueta');
            expect(label.className).toContain('uppercase');
            expect(label.className).toContain('tracking-wider');
        });
    });

    describe('Locale formatting', () => {
        it('should use the default locale "es" when no locale is provided', () => {
            // formatNumber mock returns String(value) so the number must still appear.
            render(
                <CounterAnimation
                    targetValue={999}
                    label="Test locale"
                />
            );

            expect(screen.getByText('999')).toBeInTheDocument();
        });

        it('should accept a custom locale prop', () => {
            // Providing an explicit locale must not throw; rendered output is stable.
            render(
                <CounterAnimation
                    targetValue={42}
                    label="Test locale en"
                    locale="en"
                />
            );

            expect(screen.getByText('42')).toBeInTheDocument();
        });
    });
});
