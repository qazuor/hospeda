import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LoadingButton } from '../../../../src/components/shared/feedback/LoadingButton';

vi.mock('../../../../src/components/shared/feedback/LoadingButton.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));
vi.mock('../../../../src/components/shared/feedback/Spinner.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

describe('LoadingButton', () => {
    it('shows idle children and is enabled when not loading', () => {
        // Arrange / Act
        render(
            <LoadingButton
                loading={false}
                loadingLabel="Enviando…"
            >
                Enviar
            </LoadingButton>
        );

        // Assert
        const button = screen.getByRole('button', { name: 'Enviar' });
        expect(button).toBeEnabled();
        expect(button).toHaveAttribute('aria-busy', 'false');
    });

    it('is disabled, busy, and shows loadingLabel + spinner when loading', () => {
        // Arrange / Act
        render(
            <LoadingButton
                loading={true}
                loadingLabel="Enviando…"
            >
                Enviar
            </LoadingButton>
        );

        // Assert
        const button = screen.getByRole('button');
        expect(button).toBeDisabled();
        expect(button).toHaveAttribute('aria-busy', 'true');
        expect(button).toHaveTextContent('Enviando…');
    });

    it('does not fire onClick while loading (double-submit guard)', () => {
        // Arrange
        const onClick = vi.fn();

        // Act
        render(
            <LoadingButton
                loading={true}
                onClick={onClick}
            >
                Enviar
            </LoadingButton>
        );
        fireEvent.click(screen.getByRole('button'));

        // Assert
        expect(onClick).not.toHaveBeenCalled();
    });

    it('fires onClick when idle', () => {
        // Arrange
        const onClick = vi.fn();

        // Act
        render(
            <LoadingButton
                loading={false}
                onClick={onClick}
            >
                Enviar
            </LoadingButton>
        );
        fireEvent.click(screen.getByRole('button'));

        // Assert
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('keeps idle children visible when no loadingLabel is given', () => {
        // Arrange / Act
        render(<LoadingButton loading={true}>Enviar</LoadingButton>);

        // Assert
        expect(screen.getByRole('button')).toHaveTextContent('Enviar');
    });
});
