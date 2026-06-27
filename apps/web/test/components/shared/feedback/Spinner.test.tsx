import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Spinner } from '../../../../src/components/shared/feedback/Spinner';

vi.mock('../../../../src/components/shared/feedback/Spinner.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

describe('Spinner', () => {
    it('renders a status live region whose accessible name is the label', () => {
        // Arrange / Act
        render(<Spinner label="Cargando…" />);

        // Assert — the label is exposed as live-region text content so AT
        // announces it on mount (role=status announces content changes).
        const status = screen.getByRole('status');
        expect(status).toBeInTheDocument();
        expect(status).toHaveTextContent('Cargando…');
    });

    it('is decorative (no status role) when no label is provided', () => {
        // Arrange / Act
        const { container } = render(<Spinner />);

        // Assert
        expect(screen.queryByRole('status')).toBeNull();
        expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
    });

    it('applies the requested size class', () => {
        // Arrange / Act
        render(
            <Spinner
                size="lg"
                label="loading"
            />
        );

        // Assert — CSS module proxy returns the key as the class name
        expect(screen.getByRole('status').className).toContain('lg');
    });

    it('defaults to the md size class', () => {
        // Arrange / Act
        render(<Spinner label="loading" />);

        // Assert
        expect(screen.getByRole('status').className).toContain('md');
    });

    it('merges an extra className onto the root', () => {
        // Arrange / Act
        render(
            <Spinner
                label="loading"
                className="extra"
            />
        );

        // Assert
        expect(screen.getByRole('status').className).toContain('extra');
    });
});
