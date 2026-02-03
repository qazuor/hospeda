/**
 * BillingEmptyState Component Tests
 *
 * @module test/components/billing/BillingEmptyState.test
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BillingEmptyState } from '../../../src/components/billing/BillingEmptyState';

describe('BillingEmptyState', () => {
    const defaultProps = {
        title: 'No hay facturas',
        description: 'Tus facturas aparecerán aquí cuando realices un pago'
    };

    describe('Required props', () => {
        it('should render title', () => {
            render(<BillingEmptyState {...defaultProps} />);

            expect(screen.getByRole('heading', { name: 'No hay facturas' })).toBeInTheDocument();
        });

        it('should render description', () => {
            render(<BillingEmptyState {...defaultProps} />);

            expect(
                screen.getByText('Tus facturas aparecerán aquí cuando realices un pago')
            ).toBeInTheDocument();
        });

        it('should render default inbox icon when no custom icon provided', () => {
            const { container } = render(<BillingEmptyState {...defaultProps} />);

            const icon = container.querySelector('svg');

            expect(icon).toBeInTheDocument();
            expect(icon).toHaveAttribute('aria-hidden', 'true');
            expect(icon?.querySelector('title')).toHaveTextContent('Inbox');
        });
    });

    describe('Optional props', () => {
        it('should render custom icon when provided', () => {
            const customIcon = (
                <svg
                    data-testid="custom-icon"
                    aria-label="Custom icon"
                >
                    <title>Custom</title>
                </svg>
            );

            render(
                <BillingEmptyState
                    {...defaultProps}
                    icon={customIcon}
                />
            );

            expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
        });

        it('should render action button when action prop provided', () => {
            render(
                <BillingEmptyState
                    {...defaultProps}
                    action={{
                        label: 'Ver planes',
                        href: '/precios/propietarios'
                    }}
                />
            );

            const actionLink = screen.getByRole('link', { name: 'Ver planes' });

            expect(actionLink).toBeInTheDocument();
            expect(actionLink).toHaveAttribute('href', '/precios/propietarios');
        });

        it('should not render action button when action prop not provided', () => {
            render(<BillingEmptyState {...defaultProps} />);

            const links = screen.queryAllByRole('link');

            expect(links).toHaveLength(0);
        });

        it('should render action button with correct label and href', () => {
            render(
                <BillingEmptyState
                    {...defaultProps}
                    action={{
                        label: 'Ir a configuración',
                        href: '/configuracion'
                    }}
                />
            );

            const actionLink = screen.getByRole('link', {
                name: 'Ir a configuración'
            });

            expect(actionLink).toBeInTheDocument();
            expect(actionLink).toHaveAttribute('href', '/configuracion');
        });

        it('should render arrow icon in action button', () => {
            const { container } = render(
                <BillingEmptyState
                    {...defaultProps}
                    action={{
                        label: 'Ver planes',
                        href: '/precios'
                    }}
                />
            );

            const svgs = container.querySelectorAll('svg');

            // Should have 2 SVGs: default icon + arrow in button
            expect(svgs).toHaveLength(2);
            expect(svgs[1]).toHaveAttribute('aria-hidden', 'true');
        });
    });

    describe('Accessibility', () => {
        it('should use semantic output element', () => {
            const { container } = render(<BillingEmptyState {...defaultProps} />);

            const outputElement = container.querySelector('output');

            expect(outputElement).toBeInTheDocument();
        });

        it('should have aria-label matching title', () => {
            const { container } = render(<BillingEmptyState {...defaultProps} />);

            const outputElement = container.querySelector('output');

            expect(outputElement).toHaveAttribute('aria-label', 'No hay facturas');
        });

        it('should render heading with proper level', () => {
            render(<BillingEmptyState {...defaultProps} />);

            const heading = screen.getByRole('heading', { level: 3 });

            expect(heading).toBeInTheDocument();
            expect(heading).toHaveTextContent('No hay facturas');
        });

        it('should have accessible action button', () => {
            render(
                <BillingEmptyState
                    {...defaultProps}
                    action={{
                        label: 'Ver planes',
                        href: '/precios'
                    }}
                />
            );

            const actionLink = screen.getByRole('link', { name: 'Ver planes' });

            expect(actionLink).toHaveAttribute('aria-label', 'Ver planes');
        });
    });

    describe('Styling', () => {
        it('should apply correct CSS classes to container', () => {
            const { container } = render(<BillingEmptyState {...defaultProps} />);

            const outputElement = container.querySelector('output');

            expect(outputElement).toHaveClass('flex');
            expect(outputElement).toHaveClass('flex-col');
            expect(outputElement).toHaveClass('items-center');
            expect(outputElement).toHaveClass('justify-center');
            expect(outputElement).toHaveClass('py-12');
            expect(outputElement).toHaveClass('px-6');
            expect(outputElement).toHaveClass('text-center');
        });

        it('should apply correct CSS classes to title', () => {
            render(<BillingEmptyState {...defaultProps} />);

            const title = screen.getByRole('heading', { name: 'No hay facturas' });

            expect(title).toHaveClass('text-xl');
            expect(title).toHaveClass('font-semibold');
            expect(title).toHaveClass('text-gray-900');
            expect(title).toHaveClass('mb-2');
        });

        it('should apply correct CSS classes to description', () => {
            const { container } = render(<BillingEmptyState {...defaultProps} />);

            const description = container.querySelector('p');

            expect(description).toHaveClass('text-gray-600');
            expect(description).toHaveClass('max-w-md');
            expect(description).toHaveClass('mb-6');
        });

        it('should apply correct CSS classes to action button', () => {
            render(
                <BillingEmptyState
                    {...defaultProps}
                    action={{
                        label: 'Ver planes',
                        href: '/precios'
                    }}
                />
            );

            const actionLink = screen.getByRole('link', { name: 'Ver planes' });

            expect(actionLink).toHaveClass('inline-flex');
            expect(actionLink).toHaveClass('items-center');
            expect(actionLink).toHaveClass('gap-2');
            expect(actionLink).toHaveClass('bg-blue-600');
            expect(actionLink).toHaveClass('text-white');
            expect(actionLink).toHaveClass('font-medium');
            expect(actionLink).toHaveClass('px-6');
            expect(actionLink).toHaveClass('py-3');
            expect(actionLink).toHaveClass('rounded-lg');
        });
    });

    describe('Different content scenarios', () => {
        it('should render with different title and description', () => {
            render(
                <BillingEmptyState
                    title="Sin transacciones"
                    description="No has realizado ninguna transacción todavía"
                />
            );

            expect(screen.getByRole('heading', { name: 'Sin transacciones' })).toBeInTheDocument();
            expect(
                screen.getByText('No has realizado ninguna transacción todavía')
            ).toBeInTheDocument();
        });

        it('should render with long description text', () => {
            const longDescription =
                'Esta es una descripción muy larga que debería envolverse correctamente en el contenedor con un ancho máximo para mantener la legibilidad del texto';

            render(
                <BillingEmptyState
                    title="Sin datos"
                    description={longDescription}
                />
            );

            expect(screen.getByText(longDescription)).toBeInTheDocument();
        });

        it('should render with both custom icon and action', () => {
            const customIcon = (
                <svg data-testid="custom-icon">
                    <title>Custom</title>
                </svg>
            );

            render(
                <BillingEmptyState
                    {...defaultProps}
                    icon={customIcon}
                    action={{
                        label: 'Acción personalizada',
                        href: '/custom-path'
                    }}
                />
            );

            expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
            expect(screen.getByRole('link', { name: 'Acción personalizada' })).toBeInTheDocument();
        });
    });

    describe('Snapshot tests', () => {
        it('should match snapshot with default props', () => {
            const { container } = render(<BillingEmptyState {...defaultProps} />);

            expect(container.firstChild).toMatchSnapshot();
        });

        it('should match snapshot with custom icon', () => {
            const customIcon = (
                <svg data-testid="custom-icon">
                    <title>Custom</title>
                </svg>
            );

            const { container } = render(
                <BillingEmptyState
                    {...defaultProps}
                    icon={customIcon}
                />
            );

            expect(container.firstChild).toMatchSnapshot();
        });

        it('should match snapshot with action button', () => {
            const { container } = render(
                <BillingEmptyState
                    {...defaultProps}
                    action={{
                        label: 'Ver planes',
                        href: '/precios'
                    }}
                />
            );

            expect(container.firstChild).toMatchSnapshot();
        });

        it('should match snapshot with all props', () => {
            const customIcon = (
                <svg data-testid="custom-icon">
                    <title>Custom</title>
                </svg>
            );

            const { container } = render(
                <BillingEmptyState
                    title="Título completo"
                    description="Descripción completa"
                    icon={customIcon}
                    action={{
                        label: 'Acción completa',
                        href: '/path-completo'
                    }}
                />
            );

            expect(container.firstChild).toMatchSnapshot();
        });
    });
});
