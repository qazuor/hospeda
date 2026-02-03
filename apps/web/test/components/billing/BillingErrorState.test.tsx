/**
 * BillingErrorState Component Tests
 *
 * @module test/components/billing/BillingErrorState.test
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BillingErrorState } from '../../../src/components/billing/BillingErrorState';

describe('BillingErrorState', () => {
    const defaultProps = {
        message: 'No se pudo conectar con el servidor'
    };

    describe('Required props', () => {
        it('should render error message', () => {
            render(<BillingErrorState {...defaultProps} />);

            expect(screen.getByText('No se pudo conectar con el servidor')).toBeInTheDocument();
        });

        it('should render default title when not provided', () => {
            render(<BillingErrorState {...defaultProps} />);

            expect(
                screen.getByRole('heading', { name: 'Error al cargar los datos' })
            ).toBeInTheDocument();
        });

        it('should render alert icon', () => {
            const { container } = render(<BillingErrorState {...defaultProps} />);

            const icon = container.querySelector('svg');

            expect(icon).toBeInTheDocument();
            expect(icon).toHaveAttribute('aria-hidden', 'true');
            expect(icon?.querySelector('title')).toHaveTextContent('Alert');
        });
    });

    describe('Optional props', () => {
        it('should render custom title when provided', () => {
            render(
                <BillingErrorState
                    {...defaultProps}
                    title="Error personalizado"
                />
            );

            expect(
                screen.getByRole('heading', { name: 'Error personalizado' })
            ).toBeInTheDocument();
        });

        it('should render retry button when onRetry provided', () => {
            const onRetry = vi.fn();

            render(
                <BillingErrorState
                    {...defaultProps}
                    onRetry={onRetry}
                />
            );

            const retryButton = screen.getByRole('button', { name: 'Reintentar' });

            expect(retryButton).toBeInTheDocument();
        });

        it('should not render retry button when onRetry not provided', () => {
            render(<BillingErrorState {...defaultProps} />);

            const buttons = screen.queryAllByRole('button');

            expect(buttons).toHaveLength(0);
        });

        it('should call onRetry when retry button clicked', () => {
            const onRetry = vi.fn();

            render(
                <BillingErrorState
                    {...defaultProps}
                    onRetry={onRetry}
                />
            );

            const retryButton = screen.getByRole('button', { name: 'Reintentar' });

            fireEvent.click(retryButton);

            expect(onRetry).toHaveBeenCalledTimes(1);
        });

        it('should render custom retry label when provided', () => {
            const onRetry = vi.fn();

            render(
                <BillingErrorState
                    {...defaultProps}
                    onRetry={onRetry}
                    retryLabel="Volver a intentar"
                />
            );

            expect(screen.getByRole('button', { name: 'Volver a intentar' })).toBeInTheDocument();
        });

        it('should use default retry label when not provided', () => {
            const onRetry = vi.fn();

            render(
                <BillingErrorState
                    {...defaultProps}
                    onRetry={onRetry}
                />
            );

            expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
        });

        it('should render refresh icon in retry button', () => {
            const onRetry = vi.fn();
            const { container } = render(
                <BillingErrorState
                    {...defaultProps}
                    onRetry={onRetry}
                />
            );

            const svgs = container.querySelectorAll('svg');

            // Should have 2 SVGs: alert icon + refresh icon in button
            expect(svgs).toHaveLength(2);
            expect(svgs[1]).toHaveAttribute('aria-hidden', 'true');
        });
    });

    describe('Accessibility', () => {
        it('should have role="alert"', () => {
            render(<BillingErrorState {...defaultProps} />);

            const container = screen.getByRole('alert');

            expect(container).toBeInTheDocument();
        });

        it('should have aria-live="assertive"', () => {
            render(<BillingErrorState {...defaultProps} />);

            const container = screen.getByRole('alert');

            expect(container).toHaveAttribute('aria-live', 'assertive');
        });

        it('should render heading with proper level', () => {
            render(<BillingErrorState {...defaultProps} />);

            const heading = screen.getByRole('heading', { level: 3 });

            expect(heading).toBeInTheDocument();
        });

        it('should have accessible retry button', () => {
            const onRetry = vi.fn();

            render(
                <BillingErrorState
                    {...defaultProps}
                    onRetry={onRetry}
                    retryLabel="Reintentar carga"
                />
            );

            const retryButton = screen.getByRole('button', {
                name: 'Reintentar carga'
            });

            expect(retryButton).toHaveAttribute('aria-label', 'Reintentar carga');
        });

        it('should have accessible button type', () => {
            const onRetry = vi.fn();

            render(
                <BillingErrorState
                    {...defaultProps}
                    onRetry={onRetry}
                />
            );

            const retryButton = screen.getByRole('button', { name: 'Reintentar' });

            expect(retryButton).toHaveAttribute('type', 'button');
        });
    });

    describe('Styling', () => {
        it('should apply correct CSS classes to container', () => {
            const { container } = render(<BillingErrorState {...defaultProps} />);

            const mainContainer = container.firstChild as HTMLElement;

            expect(mainContainer).toHaveClass('bg-red-50');
            expect(mainContainer).toHaveClass('border');
            expect(mainContainer).toHaveClass('border-red-200');
            expect(mainContainer).toHaveClass('rounded-xl');
            expect(mainContainer).toHaveClass('shadow-sm');
            expect(mainContainer).toHaveClass('p-6');
            expect(mainContainer).toHaveClass('max-w-2xl');
            expect(mainContainer).toHaveClass('mx-auto');
        });

        it('should apply correct CSS classes to title', () => {
            render(<BillingErrorState {...defaultProps} />);

            const title = screen.getByRole('heading', {
                name: 'Error al cargar los datos'
            });

            expect(title).toHaveClass('text-xl');
            expect(title).toHaveClass('font-bold');
            expect(title).toHaveClass('text-red-900');
        });

        it('should apply correct CSS classes to message', () => {
            const { container } = render(<BillingErrorState {...defaultProps} />);

            const message = container.querySelector('p');

            expect(message).toHaveClass('text-red-800');
            expect(message).toHaveClass('mb-6');
            expect(message).toHaveClass('pl-16');
        });

        it('should apply correct CSS classes to retry button', () => {
            const onRetry = vi.fn();

            render(
                <BillingErrorState
                    {...defaultProps}
                    onRetry={onRetry}
                />
            );

            const retryButton = screen.getByRole('button', { name: 'Reintentar' });

            expect(retryButton).toHaveClass('inline-flex');
            expect(retryButton).toHaveClass('items-center');
            expect(retryButton).toHaveClass('gap-2');
            expect(retryButton).toHaveClass('bg-red-600');
            expect(retryButton).toHaveClass('text-white');
            expect(retryButton).toHaveClass('font-medium');
            expect(retryButton).toHaveClass('px-6');
            expect(retryButton).toHaveClass('py-3');
            expect(retryButton).toHaveClass('rounded-lg');
        });
    });

    describe('Different content scenarios', () => {
        it('should render with custom title and message', () => {
            render(
                <BillingErrorState
                    title="Error de conexión"
                    message="No se pudo establecer conexión con la base de datos"
                />
            );

            expect(screen.getByRole('heading', { name: 'Error de conexión' })).toBeInTheDocument();
            expect(
                screen.getByText('No se pudo establecer conexión con la base de datos')
            ).toBeInTheDocument();
        });

        it('should render with long error message', () => {
            const longMessage =
                'Este es un mensaje de error muy largo que describe en detalle lo que salió mal y proporciona información adicional para ayudar al usuario a entender el problema';

            render(
                <BillingErrorState
                    title="Error detallado"
                    message={longMessage}
                />
            );

            expect(screen.getByText(longMessage)).toBeInTheDocument();
        });

        it('should render with custom title, message, and retry', () => {
            const onRetry = vi.fn();

            render(
                <BillingErrorState
                    title="Error temporal"
                    message="Servicio no disponible"
                    onRetry={onRetry}
                    retryLabel="Reintentar ahora"
                />
            );

            expect(screen.getByRole('heading', { name: 'Error temporal' })).toBeInTheDocument();
            expect(screen.getByText('Servicio no disponible')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Reintentar ahora' })).toBeInTheDocument();
        });

        it('should handle multiple retry clicks', () => {
            const onRetry = vi.fn();

            render(
                <BillingErrorState
                    {...defaultProps}
                    onRetry={onRetry}
                />
            );

            const retryButton = screen.getByRole('button', { name: 'Reintentar' });

            fireEvent.click(retryButton);
            fireEvent.click(retryButton);
            fireEvent.click(retryButton);

            expect(onRetry).toHaveBeenCalledTimes(3);
        });
    });

    describe('Snapshot tests', () => {
        it('should match snapshot with default title', () => {
            const { container } = render(<BillingErrorState {...defaultProps} />);

            expect(container.firstChild).toMatchSnapshot();
        });

        it('should match snapshot with custom title', () => {
            const { container } = render(
                <BillingErrorState
                    title="Error personalizado"
                    message="Mensaje de error"
                />
            );

            expect(container.firstChild).toMatchSnapshot();
        });

        it('should match snapshot with retry button', () => {
            const onRetry = vi.fn();
            const { container } = render(
                <BillingErrorState
                    {...defaultProps}
                    onRetry={onRetry}
                />
            );

            expect(container.firstChild).toMatchSnapshot();
        });

        it('should match snapshot with custom retry label', () => {
            const onRetry = vi.fn();
            const { container } = render(
                <BillingErrorState
                    {...defaultProps}
                    onRetry={onRetry}
                    retryLabel="Volver a cargar"
                />
            );

            expect(container.firstChild).toMatchSnapshot();
        });

        it('should match snapshot with all props', () => {
            const onRetry = vi.fn();
            const { container } = render(
                <BillingErrorState
                    title="Título completo"
                    message="Mensaje completo de error"
                    onRetry={onRetry}
                    retryLabel="Etiqueta completa"
                />
            );

            expect(container.firstChild).toMatchSnapshot();
        });
    });
});
