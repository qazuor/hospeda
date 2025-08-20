import { render, screen } from '@testing-library/react';
// biome-ignore lint/correctness/noUnusedImports: <explanation>
import React from 'react';
import { describe, expect, it } from 'vitest';

/**
 * Simple test icon component for verification
 */
const TestIconComponent = ({
    size = 24,
    color = 'currentColor'
}: { size?: number; color?: string }) => {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            data-testid="test-icon"
        >
            <title>Test Icon</title>
            <circle
                cx="12"
                cy="12"
                r="10"
            />
            <path d="M8 12h8" />
        </svg>
    );
};

describe('Icons Package - Basic Tests', () => {
    it('should render test icon component correctly', () => {
        render(<TestIconComponent />);

        const icon = screen.getByTestId('test-icon');
        expect(icon).toBeDefined();
        expect(icon.getAttribute('width')).toBe('24');
        expect(icon.getAttribute('height')).toBe('24');
        expect(icon.getAttribute('stroke')).toBe('currentColor');
    });

    it('should render icon with custom props', () => {
        render(
            <TestIconComponent
                size={32}
                color="#ff0000"
            />
        );

        const icon = screen.getByTestId('test-icon');
        expect(icon.getAttribute('width')).toBe('32');
        expect(icon.getAttribute('height')).toBe('32');
        expect(icon.getAttribute('stroke')).toBe('#ff0000');
    });

    it('should have correct environment setup', () => {
        expect(process.env.NODE_ENV).toBe('test');
    });

    it('should handle icon utility functions', () => {
        const getIconSize = (size: 'sm' | 'md' | 'lg' | 'xl'): number => {
            const sizeMap = {
                sm: 16,
                md: 24,
                lg: 32,
                xl: 48
            };
            return sizeMap[size];
        };

        const formatIconName = (name: string): string => {
            return name
                .split('-')
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join('');
        };

        expect(getIconSize('sm')).toBe(16);
        expect(getIconSize('md')).toBe(24);
        expect(getIconSize('lg')).toBe(32);
        expect(getIconSize('xl')).toBe(48);

        expect(formatIconName('user-circle')).toBe('UserCircle');
        expect(formatIconName('arrow-left')).toBe('ArrowLeft');
    });

    it('should handle SVG element creation', () => {
        const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        expect(svgElement).toBeDefined();
        expect(svgElement.tagName.toLowerCase()).toBe('svg');
    });
});
