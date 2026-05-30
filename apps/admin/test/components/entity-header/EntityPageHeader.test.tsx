import { EntityPageHeader } from '@/components/entity-header/EntityPageHeader';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// IntersectionObserver is used internally by the scroll-shrink hook.
class MockIntersectionObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
    takeRecords = vi.fn().mockReturnValue([]);
    root = null;
    rootMargin = '';
    thresholds: ReadonlyArray<number> = [];
}

beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
});

describe('EntityPageHeader — additive slots', () => {
    const baseProps = {
        mode: 'view' as const,
        title: 'Juan Pérez',
        viewActions: {
            onBack: vi.fn(),
            onEdit: vi.fn()
        }
    };

    it('does not render the tabs strip when tabs prop is omitted', () => {
        render(<EntityPageHeader {...baseProps} />);
        expect(screen.queryByTestId('header-tabs')).not.toBeInTheDocument();
    });

    it('renders the tabs strip inside the sticky banner when tabs prop is provided', () => {
        render(
            <EntityPageHeader
                {...baseProps}
                tabs={<nav data-testid="user-tabs">Perfil · Permisos · Actividad</nav>}
            />
        );

        const banner = screen.getByRole('banner');
        const tabsStrip = screen.getByTestId('header-tabs');

        expect(tabsStrip).toBeInTheDocument();
        expect(banner.contains(tabsStrip)).toBe(true);
        // The tabs payload is forwarded as-is.
        expect(screen.getByTestId('user-tabs')).toBeInTheDocument();
    });

    it('does not render the extra-actions slot when extraActions prop is omitted', () => {
        render(<EntityPageHeader {...baseProps} />);
        expect(screen.queryByTestId('header-extra-actions')).not.toBeInTheDocument();
    });

    it('renders extraActions next to the mode-specific action set', () => {
        render(
            <EntityPageHeader
                {...baseProps}
                extraActions={
                    <button
                        type="button"
                        data-testid="impersonate"
                    >
                        Suplantar
                    </button>
                }
            />
        );

        const extras = screen.getByTestId('header-extra-actions');
        const modeActions = screen.getByTestId('header-actions');

        expect(extras).toBeInTheDocument();
        expect(modeActions).toBeInTheDocument();
        // Mode action set (Volver / Editar) still renders alongside the extras.
        expect(screen.getByRole('button', { name: /editar entidad/i })).toBeInTheDocument();
        expect(screen.getByTestId('impersonate')).toBeInTheDocument();
    });

    it('still renders mode actions when neither extraActions nor tabs are provided (existing entities keep working)', () => {
        render(<EntityPageHeader {...baseProps} />);
        expect(screen.getByRole('button', { name: /volver al listado/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /editar entidad/i })).toBeInTheDocument();
    });
});
