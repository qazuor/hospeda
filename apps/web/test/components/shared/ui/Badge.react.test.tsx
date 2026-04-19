/**
 * @file Badge.react.test.tsx
 * @description React Testing Library tests for the Badge.tsx React component.
 * Renders the component under jsdom and asserts on rendered DOM output.
 */

import { Badge } from '@/components/shared/ui/Badge';
import type { BadgeColorScheme } from '@/components/shared/ui/badge.types';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/shared/ui/Badge.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

const scheme: BadgeColorScheme = {
    bg: 'rgba(0, 0, 0, 0.05)',
    text: 'var(--brand-accent)',
    border: 'rgba(0, 0, 0, 0.1)'
};

describe('Badge (React)', () => {
    describe('rendering', () => {
        it('renders the provided label', () => {
            render(
                <Badge
                    label="Hotel"
                    colorScheme={scheme}
                />
            );
            expect(screen.getByText('Hotel')).toBeInTheDocument();
        });

        it('renders as <a> when href is provided', () => {
            render(
                <Badge
                    label="Hotel"
                    href="/hoteles"
                    colorScheme={scheme}
                />
            );
            const anchor = screen.getByRole('link');
            expect(anchor).toBeInTheDocument();
            expect(anchor).toHaveAttribute('href', '/hoteles');
        });

        it('renders as <span> when href is absent', () => {
            const { container } = render(
                <Badge
                    label="Hotel"
                    colorScheme={scheme}
                />
            );
            expect(container.querySelector('a')).toBeNull();
            expect(container.querySelector('span')).not.toBeNull();
        });
    });

    describe('icon support', () => {
        it('renders an SVG icon when a valid icon name is provided', () => {
            const { container } = render(
                <Badge
                    label="Wifi"
                    colorScheme={scheme}
                    icon="WifiIcon"
                />
            );
            // resolveIcon returns the Phosphor-wrapped icon which renders an <svg>
            expect(container.querySelector('svg')).not.toBeNull();
        });

        it('silently omits the icon when resolveIcon returns undefined', () => {
            const { container } = render(
                <Badge
                    label="X"
                    colorScheme={scheme}
                    icon="ThisDoesNotExistIcon"
                />
            );
            // Label still renders
            expect(screen.getByText('X')).toBeInTheDocument();
            // No svg should be present (icon could not be resolved)
            expect(container.querySelector('svg')).toBeNull();
        });
    });

    describe('dot variant', () => {
        it('renders a leading dot element for variant="dot"', () => {
            const { container } = render(
                <Badge
                    label="New"
                    colorScheme={scheme}
                    variant="dot"
                />
            );
            expect(container.querySelector('.badgeDot')).not.toBeNull();
        });

        it('does not render a dot for variant="default"', () => {
            const { container } = render(
                <Badge
                    label="Normal"
                    colorScheme={scheme}
                    variant="default"
                />
            );
            expect(container.querySelector('.badgeDot')).toBeNull();
        });
    });

    describe('accessibility', () => {
        it('applies ariaLabel when provided', () => {
            render(
                <Badge
                    label="H"
                    colorScheme={scheme}
                    ariaLabel="Hotel"
                />
            );
            expect(screen.getByLabelText('Hotel')).toBeInTheDocument();
        });
    });

    describe('variants', () => {
        const variants = ['default', 'filled-dark', 'outline', 'dot'] as const;

        for (const variant of variants) {
            it(`applies expected class and style for variant="${variant}"`, () => {
                const { container } = render(
                    <Badge
                        label={variant}
                        colorScheme={scheme}
                        variant={variant}
                    />
                );
                const el = container.firstElementChild as HTMLElement | null;
                expect(el).not.toBeNull();

                const expectedKey = (() => {
                    switch (variant) {
                        case 'default':
                            return 'badgeVariantDefault';
                        case 'filled-dark':
                            return 'badgeVariantFilledDark';
                        case 'outline':
                            return 'badgeVariantOutline';
                        case 'dot':
                            return 'badgeVariantDot';
                    }
                })();
                expect(el?.className).toContain(expectedKey);
            });
        }
    });

    describe('sizes', () => {
        const sizes = ['xs', 'sm', 'md'] as const;

        for (const size of sizes) {
            it(`applies expected class and inline padding for size="${size}"`, () => {
                const { container } = render(
                    <Badge
                        label={size}
                        colorScheme={scheme}
                        size={size}
                    />
                );
                const el = container.firstElementChild as HTMLElement | null;
                expect(el).not.toBeNull();

                const expectedSizeClass = (() => {
                    switch (size) {
                        case 'xs':
                            return 'badgeSizeXs';
                        case 'sm':
                            return 'badgeSizeSm';
                        case 'md':
                            return 'badgeSizeMd';
                    }
                })();
                expect(el?.className).toContain(expectedSizeClass);
            });
        }
    });

    describe('interactive affordance', () => {
        it('applies badgeInteractive class when href is provided', () => {
            const { container } = render(
                <Badge
                    label="Click"
                    colorScheme={scheme}
                    href="/go"
                />
            );
            const el = container.firstElementChild as HTMLElement | null;
            expect(el?.className).toContain('badgeInteractive');
        });

        it('does not apply badgeInteractive class when href is absent', () => {
            const { container } = render(
                <Badge
                    label="Static"
                    colorScheme={scheme}
                />
            );
            const el = container.firstElementChild as HTMLElement | null;
            expect(el?.className).not.toContain('badgeInteractive');
        });
    });
});
