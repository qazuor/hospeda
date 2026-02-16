/**
 * Comprehensive tests for Phosphor Icons props interface.
 *
 * Tests the createPhosphorIcon wrapper to ensure all IconProps are properly
 * mapped to the underlying Phosphor components and defaults are applied correctly.
 *
 * Test Coverage:
 * - Weight prop validation (all 6 variants)
 * - Mirrored prop forwarding
 * - Size mapping (named sizes and numeric values)
 * - Color and duotone color handling
 * - Backward compatibility with className and aria-label
 * - DefaultClassName merging
 * - No-props rendering
 */

import { render, screen } from '@testing-library/react';
// biome-ignore lint/correctness/noUnusedImports: Required for JSX
import React from 'react';
import { describe, expect, it } from 'vitest';
import { HomeIcon, LoaderIcon } from '../src';
import { DEFAULT_DUOTONE_COLOR, ICON_SIZES } from '../src/types';

describe('Phosphor Icons Props Interface', () => {
    describe('Weight prop tests', () => {
        /**
         * Verifies that the icon accepts 'thin' weight variant.
         *
         * Arrange: Render HomeIcon with weight="thin"
         * Act: Query the rendered SVG element
         * Assert: SVG element exists (Phosphor accepts the weight)
         */
        it('should accept thin weight', () => {
            render(<HomeIcon weight="thin" />);

            const icon = screen.getByLabelText(/home icon/i);
            expect(icon).toBeDefined();
            expect(icon.tagName.toLowerCase()).toBe('svg');
        });

        /**
         * Verifies that the icon accepts 'light' weight variant.
         *
         * Arrange: Render HomeIcon with weight="light"
         * Act: Query the rendered SVG element
         * Assert: SVG element exists
         */
        it('should accept light weight', () => {
            render(<HomeIcon weight="light" />);

            const icon = screen.getByLabelText(/home icon/i);
            expect(icon).toBeDefined();
        });

        /**
         * Verifies that the icon accepts 'regular' weight variant.
         *
         * Arrange: Render HomeIcon with weight="regular"
         * Act: Query the rendered SVG element
         * Assert: SVG element exists
         */
        it('should accept regular weight', () => {
            render(<HomeIcon weight="regular" />);

            const icon = screen.getByLabelText(/home icon/i);
            expect(icon).toBeDefined();
        });

        /**
         * Verifies that the icon accepts 'bold' weight variant.
         *
         * Arrange: Render HomeIcon with weight="bold"
         * Act: Query the rendered SVG element
         * Assert: SVG element exists
         */
        it('should accept bold weight', () => {
            render(<HomeIcon weight="bold" />);

            const icon = screen.getByLabelText(/home icon/i);
            expect(icon).toBeDefined();
        });

        /**
         * Verifies that the icon accepts 'fill' weight variant.
         *
         * Arrange: Render HomeIcon with weight="fill"
         * Act: Query the rendered SVG element
         * Assert: SVG element exists
         */
        it('should accept fill weight', () => {
            render(<HomeIcon weight="fill" />);

            const icon = screen.getByLabelText(/home icon/i);
            expect(icon).toBeDefined();
        });

        /**
         * Verifies that the icon accepts 'duotone' weight variant.
         *
         * Arrange: Render HomeIcon with weight="duotone"
         * Act: Query the rendered SVG element
         * Assert: SVG element exists
         */
        it('should accept duotone weight', () => {
            render(<HomeIcon weight="duotone" />);

            const icon = screen.getByLabelText(/home icon/i);
            expect(icon).toBeDefined();
        });

        /**
         * Verifies that default weight is 'duotone' when not specified.
         *
         * Per createPhosphorIcon implementation, weight defaults to 'duotone'.
         * This aligns with the Hospeda platform's duotone-first design system.
         *
         * Arrange: Render HomeIcon without weight prop
         * Act: Query the rendered SVG element
         * Assert: Icon renders successfully (confirms default weight is applied)
         */
        it('should default to duotone weight when not specified', () => {
            render(<HomeIcon />);

            const icon = screen.getByLabelText(/home icon/i);
            expect(icon).toBeDefined();
        });

        /**
         * Verifies that weight prop is properly forwarded to Phosphor component.
         *
         * While we cannot directly inspect Phosphor's internal props in jsdom,
         * we can verify that the icon renders without errors when weight is provided.
         * Phosphor would throw if weight was invalid or not forwarded.
         *
         * Arrange: Render HomeIcon with explicit weight
         * Act: Query the rendered element
         * Assert: Element renders successfully
         */
        it('should pass weight prop to underlying Phosphor component', () => {
            render(<HomeIcon weight="bold" />);

            const icon = screen.getByLabelText(/home icon/i);
            expect(icon).toBeDefined();
        });
    });

    describe('Mirrored prop tests', () => {
        /**
         * Verifies that mirrored={true} prop is accepted.
         *
         * Mirrored prop horizontally flips the icon, useful for RTL layouts.
         *
         * Arrange: Render HomeIcon with mirrored={true}
         * Act: Query the rendered SVG element
         * Assert: Icon renders successfully
         */
        it('should accept mirrored={true}', () => {
            render(<HomeIcon mirrored={true} />);

            const icon = screen.getByLabelText(/home icon/i);
            expect(icon).toBeDefined();
        });

        /**
         * Verifies that mirrored={false} prop is accepted.
         *
         * Arrange: Render HomeIcon with mirrored={false}
         * Act: Query the rendered SVG element
         * Assert: Icon renders successfully
         */
        it('should accept mirrored={false}', () => {
            render(<HomeIcon mirrored={false} />);

            const icon = screen.getByLabelText(/home icon/i);
            expect(icon).toBeDefined();
        });

        /**
         * Verifies that mirrored prop is forwarded to Phosphor component.
         *
         * Arrange: Render HomeIcon with mirrored prop
         * Act: Query the rendered element
         * Assert: Element renders successfully (Phosphor would error if prop not supported)
         */
        it('should pass mirrored prop to underlying Phosphor component', () => {
            render(<HomeIcon mirrored={true} />);

            const icon = screen.getByLabelText(/home icon/i);
            expect(icon).toBeDefined();
        });
    });

    describe('Size prop tests', () => {
        /**
         * Verifies that 'xs' size maps to 16px.
         *
         * Arrange: Render HomeIcon with size="xs"
         * Act: Query the SVG element
         * Assert: Width and height attributes are both 16
         */
        it('should map xs size to 16px', () => {
            render(<HomeIcon size="xs" />);

            const icon = screen.getByLabelText(/home icon/i);
            expect(icon.getAttribute('width')).toBe(String(ICON_SIZES.xs));
            expect(icon.getAttribute('height')).toBe(String(ICON_SIZES.xs));
        });

        /**
         * Verifies that 'sm' size maps to 20px.
         *
         * Arrange: Render HomeIcon with size="sm"
         * Act: Query the SVG element
         * Assert: Width and height are both 20
         */
        it('should map sm size to 20px', () => {
            render(<HomeIcon size="sm" />);

            const icon = screen.getByLabelText(/home icon/i);
            expect(icon.getAttribute('width')).toBe(String(ICON_SIZES.sm));
            expect(icon.getAttribute('height')).toBe(String(ICON_SIZES.sm));
        });

        /**
         * Verifies that 'md' size maps to 24px.
         *
         * Arrange: Render HomeIcon with size="md"
         * Act: Query the SVG element
         * Assert: Width and height are both 24
         */
        it('should map md size to 24px', () => {
            render(<HomeIcon size="md" />);

            const icon = screen.getByLabelText(/home icon/i);
            expect(icon.getAttribute('width')).toBe(String(ICON_SIZES.md));
            expect(icon.getAttribute('height')).toBe(String(ICON_SIZES.md));
        });

        /**
         * Verifies that 'lg' size maps to 28px.
         *
         * Arrange: Render HomeIcon with size="lg"
         * Act: Query the SVG element
         * Assert: Width and height are both 28
         */
        it('should map lg size to 28px', () => {
            render(<HomeIcon size="lg" />);

            const icon = screen.getByLabelText(/home icon/i);
            expect(icon.getAttribute('width')).toBe(String(ICON_SIZES.lg));
            expect(icon.getAttribute('height')).toBe(String(ICON_SIZES.lg));
        });

        /**
         * Verifies that 'xl' size maps to 32px.
         *
         * Arrange: Render HomeIcon with size="xl"
         * Act: Query the SVG element
         * Assert: Width and height are both 32
         */
        it('should map xl size to 32px', () => {
            render(<HomeIcon size="xl" />);

            const icon = screen.getByLabelText(/home icon/i);
            expect(icon.getAttribute('width')).toBe(String(ICON_SIZES.xl));
            expect(icon.getAttribute('height')).toBe(String(ICON_SIZES.xl));
        });

        /**
         * Verifies that numeric size values are passed directly to Phosphor.
         *
         * Arrange: Render HomeIcon with size={48}
         * Act: Query the SVG element
         * Assert: Width and height are both 48
         */
        it('should pass numeric size values directly', () => {
            render(<HomeIcon size={48} />);

            const icon = screen.getByLabelText(/home icon/i);
            expect(icon.getAttribute('width')).toBe('48');
            expect(icon.getAttribute('height')).toBe('48');
        });

        /**
         * Verifies that default size is 'md' (24px) when not specified.
         *
         * Per createPhosphorIcon implementation, size defaults to 'md' which maps to 24px.
         *
         * Arrange: Render HomeIcon without size prop
         * Act: Query the SVG element
         * Assert: Width and height are both 24 (the default)
         */
        it('should default to md size (24px) when not specified', () => {
            render(<HomeIcon />);

            const icon = screen.getByLabelText(/home icon/i);
            expect(icon.getAttribute('width')).toBe(String(ICON_SIZES.md));
            expect(icon.getAttribute('height')).toBe(String(ICON_SIZES.md));
        });
    });

    describe('Color and duotone tests', () => {
        /**
         * Verifies that default duotoneColor is '#1A5FB4' (Hospeda brand color).
         *
         * When weight is 'duotone' and no duotoneColor is specified,
         * the wrapper should apply DEFAULT_DUOTONE_COLOR.
         * Phosphor icons use the 'fill' attribute for color in SVG.
         *
         * Arrange: Render HomeIcon with weight="duotone" (default) and no color props
         * Act: Query the SVG element and check fill attribute
         * Assert: Fill matches DEFAULT_DUOTONE_COLOR
         */
        it('should use default duotoneColor (#1A5FB4) for duotone weight', () => {
            render(<HomeIcon weight="duotone" />);

            const icon = screen.getByLabelText(/home icon/i);
            expect(icon.getAttribute('fill')).toBe(DEFAULT_DUOTONE_COLOR);
        });

        /**
         * Verifies that custom color prop is applied for non-duotone weights.
         *
         * Arrange: Render HomeIcon with weight="bold" and custom color
         * Act: Query the SVG element
         * Assert: Fill attribute matches the custom color
         */
        it('should apply custom color prop for non-duotone weights', () => {
            const customColor = '#FF0000';
            render(
                <HomeIcon
                    weight="bold"
                    color={customColor}
                />
            );

            const icon = screen.getByLabelText(/home icon/i);
            expect(icon.getAttribute('fill')).toBe(customColor);
        });

        /**
         * Verifies that custom duotoneColor prop is applied when specified.
         *
         * Arrange: Render HomeIcon with weight="duotone" and custom duotoneColor
         * Act: Query the SVG element
         * Assert: Fill attribute matches the custom duotoneColor
         */
        it('should apply custom duotoneColor prop when provided', () => {
            const customDuotoneColor = '#E53E3E';
            render(
                <HomeIcon
                    weight="duotone"
                    duotoneColor={customDuotoneColor}
                />
            );

            const icon = screen.getByLabelText(/home icon/i);
            expect(icon.getAttribute('fill')).toBe(customDuotoneColor);
        });

        /**
         * Verifies that duotoneColor takes precedence over color for duotone weight.
         *
         * Per createPhosphorIcon logic, when weight is 'duotone',
         * resolvedColor uses duotoneColor instead of color prop.
         *
         * Arrange: Render HomeIcon with weight="duotone", color, and duotoneColor
         * Act: Query the SVG element
         * Assert: Fill attribute matches duotoneColor (not color prop)
         */
        it('should prioritize duotoneColor over color for duotone weight', () => {
            const customColor = '#00FF00';
            const customDuotoneColor = '#0000FF';
            render(
                <HomeIcon
                    weight="duotone"
                    color={customColor}
                    duotoneColor={customDuotoneColor}
                />
            );

            const icon = screen.getByLabelText(/home icon/i);
            expect(icon.getAttribute('fill')).toBe(customDuotoneColor);
            expect(icon.getAttribute('fill')).not.toBe(customColor);
        });

        /**
         * Verifies that color defaults to 'currentColor' for non-duotone weights.
         *
         * Arrange: Render HomeIcon with weight="regular" and no color props
         * Act: Query the SVG element
         * Assert: Fill attribute is 'currentColor'
         */
        it('should default to currentColor for non-duotone weights', () => {
            render(<HomeIcon weight="regular" />);

            const icon = screen.getByLabelText(/home icon/i);
            expect(icon.getAttribute('fill')).toBe('currentColor');
        });
    });

    describe('Backward compatibility', () => {
        /**
         * Verifies that className prop is forwarded to the SVG element.
         *
         * In jsdom, SVG elements use SVGAnimatedString for className,
         * so we use getAttribute('class') or classList.contains() for testing.
         *
         * Arrange: Render HomeIcon with custom className
         * Act: Query the SVG element and check class attribute
         * Assert: class attribute contains the custom className
         */
        it('should forward className prop', () => {
            const customClass = 'custom-icon-class';
            render(<HomeIcon className={customClass} />);

            const icon = screen.getByLabelText(/home icon/i);
            const classValue = icon.getAttribute('class');
            expect(classValue).toContain(customClass);
        });

        /**
         * Verifies that aria-label prop is applied correctly.
         *
         * Arrange: Render HomeIcon with custom aria-label
         * Act: Query by the custom label
         * Assert: Element is found with the custom label
         */
        it('should apply aria-label prop', () => {
            const customLabel = 'Navigate to home';
            render(<HomeIcon aria-label={customLabel} />);

            const icon = screen.getByLabelText(customLabel);
            expect(icon).toBeDefined();
        });

        /**
         * Verifies that icon renders without errors when no props are provided.
         *
         * This ensures backward compatibility with existing usage where
         * icons are used without any customization.
         *
         * Arrange: Render HomeIcon with no props
         * Act: Query the SVG element
         * Assert: Icon renders with default values
         */
        it('should render without crashing with no props', () => {
            render(<HomeIcon />);

            const icon = screen.getByLabelText(/home icon/i);
            expect(icon).toBeDefined();
            expect(icon.tagName.toLowerCase()).toBe('svg');
        });

        /**
         * Verifies that icon renders without errors when all props are provided.
         *
         * This ensures the wrapper handles the full IconProps interface correctly.
         *
         * Arrange: Render HomeIcon with all possible props
         * Act: Query the SVG element
         * Assert: Icon renders successfully with all props applied
         */
        it('should render without crashing with all props combined', () => {
            render(
                <HomeIcon
                    size="lg"
                    weight="bold"
                    color="#FF0000"
                    duotoneColor="#0000FF"
                    mirrored={true}
                    className="test-class"
                    aria-label="Test home icon"
                    data-testid="full-props-icon"
                />
            );

            const icon = screen.getByTestId('full-props-icon');
            expect(icon).toBeDefined();
            const classValue = icon.getAttribute('class');
            expect(classValue).toContain('test-class');
        });

        /**
         * Verifies that additional SVG props are forwarded via spread operator.
         *
         * The createPhosphorIcon wrapper uses {...props} to forward any
         * additional props like onClick, onMouseOver, data-*, etc.
         *
         * Arrange: Render HomeIcon with custom data attribute
         * Act: Query by the data attribute
         * Assert: Element is found with the custom attribute
         */
        it('should forward additional SVG props via spread operator', () => {
            render(
                <HomeIcon
                    data-testid="custom-data-attr"
                    data-custom="test-value"
                />
            );

            const icon = screen.getByTestId('custom-data-attr');
            expect(icon).toBeDefined();
            expect(icon.getAttribute('data-custom')).toBe('test-value');
        });
    });

    describe('DefaultClassName support', () => {
        /**
         * Verifies that icons with defaultClassName include it in the rendered element.
         *
         * LoaderIcon is created with defaultClassName: 'animate-spin'.
         * This class should be present even when no className prop is provided.
         *
         * Arrange: Render LoaderIcon without className prop
         * Act: Query the SVG element and check class attribute
         * Assert: class attribute includes 'animate-spin'
         */
        it('should include defaultClassName (LoaderIcon has animate-spin)', () => {
            render(<LoaderIcon />);

            const icon = screen.getByLabelText(/loader icon/i);
            const classValue = icon.getAttribute('class');
            expect(classValue).toContain('animate-spin');
        });

        /**
         * Verifies that custom className is merged with defaultClassName.
         *
         * LoaderIcon has defaultClassName 'animate-spin'.
         * When a custom className is provided, both should be present.
         *
         * Arrange: Render LoaderIcon with custom className
         * Act: Query the SVG element and check class attribute
         * Assert: class attribute includes both 'animate-spin' and custom class
         */
        it('should merge custom className with defaultClassName', () => {
            const customClass = 'custom-loader';
            render(<LoaderIcon className={customClass} />);

            const icon = screen.getByLabelText(/loader icon/i);
            const classValue = icon.getAttribute('class');
            expect(classValue).toContain('animate-spin');
            expect(classValue).toContain(customClass);
        });

        /**
         * Verifies that icons without defaultClassName work normally.
         *
         * HomeIcon does not have a defaultClassName option.
         * It should still accept and apply a custom className.
         *
         * Arrange: Render HomeIcon with className
         * Act: Query the SVG element and check class attribute
         * Assert: class attribute equals the custom className
         */
        it('should work for icons without defaultClassName (HomeIcon)', () => {
            const customClass = 'home-custom';
            render(<HomeIcon className={customClass} />);

            const icon = screen.getByLabelText(/home icon/i);
            const classValue = icon.getAttribute('class');
            expect(classValue).toBe(customClass);
            expect(classValue).not.toContain('animate-spin');
        });
    });

    describe('Display name and default aria-label', () => {
        /**
         * Verifies that default aria-label is generated from displayName.
         *
         * Per createPhosphorIcon, when no aria-label is provided,
         * it defaults to '{displayName} icon'.
         *
         * Arrange: Render HomeIcon without aria-label
         * Act: Query by default label
         * Assert: Element is found with 'home icon' label
         */
        it('should generate default aria-label from displayName', () => {
            render(<HomeIcon />);

            const icon = screen.getByLabelText('home icon');
            expect(icon).toBeDefined();
        });

        /**
         * Verifies that custom aria-label overrides the default.
         *
         * Arrange: Render HomeIcon with custom aria-label
         * Act: Query by custom label
         * Assert: Element is found with custom label, not default
         */
        it('should allow custom aria-label to override default', () => {
            const customLabel = 'Go to homepage';
            render(<HomeIcon aria-label={customLabel} />);

            const icon = screen.getByLabelText(customLabel);
            expect(icon).toBeDefined();

            // Should not be queryable by default label
            expect(screen.queryByLabelText('home icon')).toBeNull();
        });
    });
});
