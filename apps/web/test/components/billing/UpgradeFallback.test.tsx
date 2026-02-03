/**
 * UpgradeFallback Component Tests
 *
 * @module test/components/billing/UpgradeFallback.test
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UpgradeFallback } from '../../../src/components/billing/UpgradeFallback';

describe('UpgradeFallback', () => {
    const defaultProps = {
        featureName: 'Estadísticas avanzadas',
        requiredPlan: 'Profesional',
        upgradeLink: '/precios/propietarios'
    };

    it('should render feature name', () => {
        render(<UpgradeFallback {...defaultProps} />);

        expect(screen.getByRole('heading', { name: 'Estadísticas avanzadas' })).toBeInTheDocument();
    });

    it('should render required plan name in message', () => {
        render(<UpgradeFallback {...defaultProps} />);

        // Check that the main message text is present
        expect(
            screen.getByText('Esta función está disponible en el plan', { exact: false })
        ).toBeInTheDocument();

        // Check that the plan name is present as a separate element
        expect(screen.getByText('Profesional')).toBeInTheDocument();
    });

    it('should render CTA link with correct href', () => {
        render(<UpgradeFallback {...defaultProps} />);

        const ctaLink = screen.getByRole('link', { name: /Ver planes/i });

        expect(ctaLink).toBeInTheDocument();
        expect(ctaLink).toHaveAttribute('href', '/precios/propietarios');
    });

    it('should render description when provided', () => {
        const description = 'Accedé a métricas detalladas de tus alojamientos.';

        render(
            <UpgradeFallback
                {...defaultProps}
                description={description}
            />
        );

        expect(screen.getByText(description)).toBeInTheDocument();
    });

    it('should not render description when not provided', () => {
        render(<UpgradeFallback {...defaultProps} />);

        // Only two paragraphs should be present: the plan message and nothing else
        const paragraphs = screen.getAllByRole('paragraph');

        // Should only have the plan availability message paragraph
        expect(paragraphs).toHaveLength(1);
        expect(paragraphs[0]).toHaveTextContent('Esta función está disponible en el plan');
    });

    it('should have correct accessibility attributes', () => {
        render(<UpgradeFallback {...defaultProps} />);

        const container = screen.getByRole('status');

        expect(container).toBeInTheDocument();
        expect(container).toHaveAttribute(
            'aria-label',
            'Función no disponible: Estadísticas avanzadas'
        );
    });

    it('should render lock icon', () => {
        const { container } = render(<UpgradeFallback {...defaultProps} />);

        // Lock icon is the first SVG
        const lockIcon = container.querySelector('svg');

        expect(lockIcon).toBeInTheDocument();
        expect(lockIcon).toHaveAttribute('aria-hidden', 'true');
    });

    it('should render arrow icon in CTA button', () => {
        const { container } = render(<UpgradeFallback {...defaultProps} />);

        // Arrow icon is the second SVG (inside the link)
        const svgs = container.querySelectorAll('svg');

        expect(svgs).toHaveLength(2);
        expect(svgs[1]).toHaveAttribute('aria-hidden', 'true');
    });

    it('should apply correct CSS classes for styling', () => {
        const { container } = render(<UpgradeFallback {...defaultProps} />);

        const mainContainer = container.firstChild as HTMLElement;

        expect(mainContainer).toHaveClass('bg-white');
        expect(mainContainer).toHaveClass('rounded-xl');
        expect(mainContainer).toHaveClass('shadow-md');
        expect(mainContainer).toHaveClass('border-l-4');
        expect(mainContainer).toHaveClass('border-amber-400');
        expect(mainContainer).toHaveClass('p-6');
    });

    it('should have accessible CTA button aria-label', () => {
        render(<UpgradeFallback {...defaultProps} />);

        const ctaLink = screen.getByRole('link', { name: /Ver planes/i });

        expect(ctaLink).toHaveAttribute(
            'aria-label',
            'Ver planes para acceder a Estadísticas avanzadas'
        );
    });

    it('should render with different feature names', () => {
        render(
            <UpgradeFallback
                featureName="Múltiples propiedades"
                requiredPlan="Premium"
                upgradeLink="/precios"
            />
        );

        expect(screen.getByRole('heading', { name: 'Múltiples propiedades' })).toBeInTheDocument();
        expect(screen.getByText(/Premium/i)).toBeInTheDocument();
    });

    it('should render with different plan names', () => {
        render(
            <UpgradeFallback
                featureName="Test Feature"
                requiredPlan="Enterprise"
                upgradeLink="/pricing"
            />
        );

        expect(screen.getByText(/Enterprise/i)).toBeInTheDocument();
    });

    it('should render with different upgrade links', () => {
        render(
            <UpgradeFallback
                {...defaultProps}
                upgradeLink="/custom/upgrade/path"
            />
        );

        const ctaLink = screen.getByRole('link', { name: /Ver planes/i });

        expect(ctaLink).toHaveAttribute('href', '/custom/upgrade/path');
    });

    it('should match snapshot', () => {
        const { container } = render(
            <UpgradeFallback
                {...defaultProps}
                description="Accedé a métricas detalladas de tus alojamientos."
            />
        );

        expect(container.firstChild).toMatchSnapshot();
    });

    it('should match snapshot without description', () => {
        const { container } = render(<UpgradeFallback {...defaultProps} />);

        expect(container.firstChild).toMatchSnapshot();
    });
});
