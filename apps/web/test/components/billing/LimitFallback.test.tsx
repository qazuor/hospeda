/**
 * LimitFallback Component Tests
 *
 * Test suite for the LimitFallback component
 *
 * @module test/components/billing/LimitFallback
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
    LimitFallback,
    type LimitFallbackProps
} from '../../../src/components/billing/LimitFallback';

describe('LimitFallback', () => {
    const defaultProps: LimitFallbackProps = {
        limitName: 'alojamientos',
        currentValue: 5,
        maxValue: 5,
        currentPlan: 'Básico',
        upgradeLink: '/precios/propietarios'
    };

    it('should render limit exceeded message with correct values', () => {
        render(<LimitFallback {...defaultProps} />);

        // Check title
        expect(screen.getByText('Límite alcanzado')).toBeInTheDocument();

        // Check message parts - text is split across multiple elements
        expect(
            screen.getByText('Has alcanzado el límite de', { exact: false })
        ).toBeInTheDocument();
        expect(screen.getByText(/5\s+alojamientos/i)).toBeInTheDocument();
        expect(screen.getByText('Básico')).toBeInTheDocument();
    });

    it('should show correct current/max values in counter', () => {
        render(<LimitFallback {...defaultProps} />);

        // Check counter display
        expect(screen.getByText('5/5')).toBeInTheDocument();
        expect(screen.getByText('Uso actual')).toBeInTheDocument();
    });

    it('should render progress bar with correct percentage width at 100%', () => {
        render(<LimitFallback {...defaultProps} />);

        // Find progress bar by role
        const progressBar = screen.getByRole('progressbar');
        expect(progressBar).toBeInTheDocument();

        // Check aria attributes
        expect(progressBar).toHaveAttribute('aria-valuenow', '5');
        expect(progressBar).toHaveAttribute('aria-valuemin', '0');
        expect(progressBar).toHaveAttribute('aria-valuemax', '5');
        expect(progressBar).toHaveAttribute('aria-label', '5 de 5 alojamientos utilizados');

        // Check width style (100%)
        expect(progressBar).toHaveStyle({ width: '100%' });
    });

    it('should render progress bar with correct percentage width at 75%', () => {
        const props: LimitFallbackProps = {
            ...defaultProps,
            currentValue: 3,
            maxValue: 4
        };

        render(<LimitFallback {...props} />);

        const progressBar = screen.getByRole('progressbar');

        // 3/4 = 75%
        expect(progressBar).toHaveStyle({ width: '75%' });
        expect(progressBar).toHaveAttribute('aria-valuenow', '3');
        expect(progressBar).toHaveAttribute('aria-valuemax', '4');
    });

    it('should render progress bar with correct percentage width at 50%', () => {
        const props: LimitFallbackProps = {
            ...defaultProps,
            currentValue: 5,
            maxValue: 10
        };

        render(<LimitFallback {...props} />);

        const progressBar = screen.getByRole('progressbar');

        // 5/10 = 50%
        expect(progressBar).toHaveStyle({ width: '50%' });
    });

    it('should have correct CTA link', () => {
        render(<LimitFallback {...defaultProps} />);

        const ctaLink = screen.getByRole('link', {
            name: /Mejorar plan para más alojamientos/i
        });

        expect(ctaLink).toBeInTheDocument();
        expect(ctaLink).toHaveAttribute('href', '/precios/propietarios');
    });

    it('should include limitName in CTA button text', () => {
        const props: LimitFallbackProps = {
            ...defaultProps,
            limitName: 'eventos'
        };

        render(<LimitFallback {...props} />);

        expect(
            screen.getByRole('link', { name: /Mejorar plan para más eventos/i })
        ).toBeInTheDocument();
    });

    it('should have aria-live="polite" attribute', () => {
        const { container } = render(<LimitFallback {...defaultProps} />);

        const alertDiv = container.querySelector('[aria-live="polite"]');
        expect(alertDiv).toBeInTheDocument();
    });

    it('should show red color class when at limit (100%)', () => {
        render(<LimitFallback {...defaultProps} />);

        const progressBar = screen.getByRole('progressbar');

        // At 100% should have red color
        expect(progressBar).toHaveClass('bg-red-500');
    });

    it('should show amber color class when near limit (>75%)', () => {
        const props: LimitFallbackProps = {
            ...defaultProps,
            currentValue: 4,
            maxValue: 5
        };

        render(<LimitFallback {...props} />);

        const progressBar = screen.getByRole('progressbar');

        // 4/5 = 80% should have amber color
        expect(progressBar).toHaveClass('bg-amber-500');
    });

    it('should show blue color class when below 75%', () => {
        const props: LimitFallbackProps = {
            ...defaultProps,
            currentValue: 3,
            maxValue: 5
        };

        render(<LimitFallback {...props} />);

        const progressBar = screen.getByRole('progressbar');

        // 3/5 = 60% should have blue color
        expect(progressBar).toHaveClass('bg-blue-500');
    });

    it('should cap percentage at 100% when currentValue exceeds maxValue', () => {
        const props: LimitFallbackProps = {
            ...defaultProps,
            currentValue: 7,
            maxValue: 5
        };

        render(<LimitFallback {...props} />);

        const progressBar = screen.getByRole('progressbar');

        // Should cap at 100% even though 7/5 = 140%
        expect(progressBar).toHaveStyle({ width: '100%' });
        expect(progressBar).toHaveClass('bg-red-500');
    });

    it('should render with different plan names', () => {
        const props: LimitFallbackProps = {
            ...defaultProps,
            currentPlan: 'Premium'
        };

        render(<LimitFallback {...props} />);

        // Check that "Premium" appears in the rendered output
        expect(screen.getByText('Premium')).toBeInTheDocument();
        // Also check that the message context is present
        expect(screen.getByText('de tu plan', { exact: false })).toBeInTheDocument();
    });

    it('should handle different upgrade link paths', () => {
        const props: LimitFallbackProps = {
            ...defaultProps,
            upgradeLink: '/planes/actualizar'
        };

        render(<LimitFallback {...props} />);

        const ctaLink = screen.getByRole('link');
        expect(ctaLink).toHaveAttribute('href', '/planes/actualizar');
    });
});
