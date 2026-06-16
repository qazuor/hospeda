/**
 * Tests for create-brand-icon.tsx.
 *
 * Exercises the branches uncovered in lines 59-90:
 * - numeric size pass-through vs string-key resolution
 * - defaultClassName merging vs plain className
 * - aria-label fallback to displayName
 * - custom viewBox option
 * - color defaulting to currentColor
 * - Phosphor-only props (weight, duotoneColor, mirrored) are dropped from DOM
 */

import { render, screen } from '@testing-library/react';
// biome-ignore lint/correctness/noUnusedImports: React import required for JSX transform in test environment
import React from 'react';
import { describe, expect, it } from 'vitest';
import { createBrandIcon } from '../src/create-brand-icon';
import { ICON_SIZES } from '../src/types';

// A minimal SVG path used as the brand mark content
const TestPath = (
    <path
        d="M0 0h24v24H0z"
        fill="none"
    />
);

describe('createBrandIcon', () => {
    describe('size resolution', () => {
        it('should resolve named xs size key to ICON_SIZES.xs pixels', () => {
            // Arrange
            const XsIcon = createBrandIcon(TestPath, 'TestBrand');
            render(<XsIcon size="xs" />);

            // Act
            const svg = screen.getByRole('img');

            // Assert
            expect(svg.getAttribute('width')).toBe(String(ICON_SIZES.xs));
            expect(svg.getAttribute('height')).toBe(String(ICON_SIZES.xs));
        });

        it('should resolve named sm size key to ICON_SIZES.sm pixels', () => {
            const SmIcon = createBrandIcon(TestPath, 'TestBrand');
            render(<SmIcon size="sm" />);
            const svg = screen.getByRole('img');
            expect(svg.getAttribute('width')).toBe(String(ICON_SIZES.sm));
        });

        it('should resolve named md size key (default) to ICON_SIZES.md pixels', () => {
            const MdIcon = createBrandIcon(TestPath, 'TestBrand');
            render(<MdIcon />);
            const svg = screen.getByRole('img');
            expect(svg.getAttribute('width')).toBe(String(ICON_SIZES.md));
        });

        it('should resolve named lg size key to ICON_SIZES.lg pixels', () => {
            const LgIcon = createBrandIcon(TestPath, 'TestBrand');
            render(<LgIcon size="lg" />);
            const svg = screen.getByRole('img');
            expect(svg.getAttribute('width')).toBe(String(ICON_SIZES.lg));
        });

        it('should resolve named xl size key to ICON_SIZES.xl pixels', () => {
            const XlIcon = createBrandIcon(TestPath, 'TestBrand');
            render(<XlIcon size="xl" />);
            const svg = screen.getByRole('img');
            expect(svg.getAttribute('width')).toBe(String(ICON_SIZES.xl));
        });

        it('should pass numeric size through directly without mapping', () => {
            // Arrange: numeric size — exercises the typeof size !== 'string' branch
            const NumericIcon = createBrandIcon(TestPath, 'TestBrand');
            render(<NumericIcon size={48} />);

            // Act / Assert
            const svg = screen.getByRole('img');
            expect(svg.getAttribute('width')).toBe('48');
            expect(svg.getAttribute('height')).toBe('48');
        });

        it('should pass numeric size 16 through directly', () => {
            const Icon = createBrandIcon(TestPath, 'TestBrand');
            render(<Icon size={16} />);
            const svg = screen.getByRole('img');
            expect(svg.getAttribute('width')).toBe('16');
        });
    });

    describe('className merging', () => {
        it('should use only className when no defaultClassName is set', () => {
            // Arrange: no defaultClassName option — exercises the else branch at line 71
            const Icon = createBrandIcon(TestPath, 'TestBrand');
            render(<Icon className="custom-class" />);

            // Act / Assert
            const svg = screen.getByRole('img');
            expect(svg.getAttribute('class')).toBe('custom-class');
        });

        it('should merge defaultClassName with className when both are provided', () => {
            // Arrange: defaultClassName set — exercises the if branch at line 70
            const Icon = createBrandIcon(TestPath, 'TestBrand', {
                defaultClassName: 'brand-base'
            });
            render(<Icon className="extra-class" />);

            // Act / Assert
            const svg = screen.getByRole('img');
            const classValue = svg.getAttribute('class');
            expect(classValue).toContain('brand-base');
            expect(classValue).toContain('extra-class');
        });

        it('should use only defaultClassName when className prop is empty string (default)', () => {
            const Icon = createBrandIcon(TestPath, 'TestBrand', {
                defaultClassName: 'only-default'
            });
            render(<Icon />);
            const svg = screen.getByRole('img');
            // `${defaultClassName} ${''}`.trim() == 'only-default'
            expect(svg.getAttribute('class')).toBe('only-default');
        });

        it('should result in empty class attribute when both defaultClassName and className are absent', () => {
            const Icon = createBrandIcon(TestPath, 'TestBrand');
            render(<Icon />);
            const svg = screen.getByRole('img');
            // className defaults to '' and no defaultClassName
            expect(svg.getAttribute('class')).toBe('');
        });
    });

    describe('aria-label', () => {
        it('should default aria-label to displayName + " icon" when not provided', () => {
            // Arrange
            const Icon = createBrandIcon(TestPath, 'MyBrand');

            // Act
            render(<Icon />);

            // Assert — exercises the `ariaLabel || \`${displayName} icon\`` branch
            const svg = screen.getByLabelText('MyBrand icon');
            expect(svg).toBeDefined();
        });

        it('should use the provided aria-label over the default', () => {
            const Icon = createBrandIcon(TestPath, 'MyBrand');
            render(<Icon aria-label="Custom label" />);
            const svg = screen.getByLabelText('Custom label');
            expect(svg).toBeDefined();
        });
    });

    describe('color prop', () => {
        it('should default fill to currentColor when color is not provided', () => {
            const Icon = createBrandIcon(TestPath, 'TestBrand');
            render(<Icon />);
            const svg = screen.getByRole('img');
            expect(svg.getAttribute('fill')).toBe('currentColor');
        });

        it('should apply custom color to fill attribute', () => {
            const Icon = createBrandIcon(TestPath, 'TestBrand');
            render(<Icon color="#ff0000" />);
            const svg = screen.getByRole('img');
            expect(svg.getAttribute('fill')).toBe('#ff0000');
        });
    });

    describe('viewBox option', () => {
        it('should default viewBox to "0 0 24 24" when not specified', () => {
            const Icon = createBrandIcon(TestPath, 'TestBrand');
            render(<Icon />);
            const svg = screen.getByRole('img');
            expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
        });

        it('should use custom viewBox when provided via options', () => {
            const Icon = createBrandIcon(TestPath, 'TestBrand', {
                viewBox: '0 0 32 32'
            });
            render(<Icon />);
            const svg = screen.getByRole('img');
            expect(svg.getAttribute('viewBox')).toBe('0 0 32 32');
        });
    });

    describe('Phosphor-only prop filtering', () => {
        it('should not leak weight prop onto the DOM element', () => {
            const Icon = createBrandIcon(TestPath, 'TestBrand');
            render(<Icon weight="bold" />);
            const svg = screen.getByRole('img');
            // weight is extracted and must not appear as an SVG attribute
            expect(svg.hasAttribute('weight')).toBe(false);
        });

        it('should not leak duotoneColor prop onto the DOM element', () => {
            const Icon = createBrandIcon(TestPath, 'TestBrand');
            render(<Icon duotoneColor="#123456" />);
            const svg = screen.getByRole('img');
            expect(svg.hasAttribute('duotoneColor')).toBe(false);
        });

        it('should not leak mirrored prop onto the DOM element', () => {
            const Icon = createBrandIcon(TestPath, 'TestBrand');
            render(<Icon mirrored={true} />);
            const svg = screen.getByRole('img');
            expect(svg.hasAttribute('mirrored')).toBe(false);
        });
    });

    describe('displayName', () => {
        it('should set displayName on the returned component', () => {
            const Icon = createBrandIcon(TestPath, 'PaymentBrand');
            expect(Icon.displayName).toBe('PaymentBrand');
        });
    });

    describe('title element', () => {
        it('should render a title element with the displayName inside the SVG', () => {
            const Icon = createBrandIcon(TestPath, 'VisaBrand');
            const { container } = render(<Icon />);
            const title = container.querySelector('title');
            expect(title).not.toBeNull();
            expect(title?.textContent).toBe('VisaBrand');
        });
    });

    describe('additional SVG props forwarding', () => {
        it('should forward arbitrary data- attributes to the SVG element', () => {
            const Icon = createBrandIcon(TestPath, 'TestBrand');
            render(
                <Icon
                    data-testid="brand-svg"
                    data-custom="hello"
                />
            );
            const svg = screen.getByTestId('brand-svg');
            expect(svg.getAttribute('data-custom')).toBe('hello');
        });
    });
});
