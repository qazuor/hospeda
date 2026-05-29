import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    type CreateModeActions,
    type EditModeActions,
    EntityPageHeader,
    type EntityPageHeaderMedia,
    type ViewModeActions
} from '../EntityPageHeader';

// ---------------------------------------------------------------------------
// IntersectionObserver mock
// jsdom does not implement IntersectionObserver, so we provide a minimal stub
// that never fires the callback (sentinel always "intersecting" = not reduced).
// ---------------------------------------------------------------------------

class MockIntersectionObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
}

beforeEach(() => {
    Object.defineProperty(window, 'IntersectionObserver', {
        writable: true,
        configurable: true,
        value: MockIntersectionObserver
    });
});

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

const defaultViewActions: ViewModeActions = {
    onBack: vi.fn(),
    onEdit: vi.fn()
};

const defaultEditActions: EditModeActions = {
    onCancel: vi.fn(),
    onSave: vi.fn(),
    isDirty: false,
    isSaving: false
};

const defaultCreateActions: CreateModeActions = {
    onCancel: vi.fn(),
    onCreate: vi.fn(),
    isCreating: false
};

const thumbnailMedia: EntityPageHeaderMedia = {
    type: 'thumbnail',
    src: 'https://example.com/hotel.jpg',
    alt: 'Hotel Plaza'
};

const avatarMedia: EntityPageHeaderMedia = {
    type: 'avatar',
    src: 'https://example.com/avatar.jpg',
    alt: 'John Doe'
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EntityPageHeader', () => {
    // ---- Basic rendering ----

    it('renders the header landmark', () => {
        render(
            <EntityPageHeader
                mode="view"
                title="Hotel Plaza"
                viewActions={defaultViewActions}
            />
        );
        expect(screen.getByRole('banner')).toBeInTheDocument();
        expect(screen.getByTestId('entity-page-header')).toBeInTheDocument();
    });

    it('renders the entity title', () => {
        render(
            <EntityPageHeader
                mode="view"
                title="Hotel Plaza"
                viewActions={defaultViewActions}
            />
        );
        expect(screen.getByText('Hotel Plaza')).toBeInTheDocument();
    });

    it('renders subtitle when provided', () => {
        render(
            <EntityPageHeader
                mode="view"
                title="Hotel Plaza"
                subtitle="Hotel · Gualeguaychú"
                viewActions={defaultViewActions}
            />
        );
        expect(screen.getByText('Hotel · Gualeguaychú')).toBeInTheDocument();
    });

    it('renders the sentinel element for scroll detection', () => {
        render(
            <EntityPageHeader
                mode="view"
                title="Hotel Plaza"
                viewActions={defaultViewActions}
            />
        );
        expect(screen.getByTestId('scroll-sentinel')).toBeInTheDocument();
    });

    // ---- Badges ----

    it('renders badges when provided', () => {
        render(
            <EntityPageHeader
                mode="view"
                title="Hotel Plaza"
                badges={
                    <>
                        <span data-testid="badge-published">Publicado</span>
                        <span data-testid="badge-active">Activo</span>
                    </>
                }
                viewActions={defaultViewActions}
            />
        );
        expect(screen.getByTestId('header-badges')).toBeInTheDocument();
        expect(screen.getByTestId('badge-published')).toBeInTheDocument();
        expect(screen.getByTestId('badge-active')).toBeInTheDocument();
    });

    // ---- Quality score slot ----

    it('renders the quality score slot when provided', () => {
        render(
            <EntityPageHeader
                mode="view"
                title="Hotel Plaza"
                qualityScore={<div data-testid="quality-score">80 / 100</div>}
                viewActions={defaultViewActions}
            />
        );
        expect(screen.getByTestId('quality-score-slot')).toBeInTheDocument();
        expect(screen.getByTestId('quality-score')).toBeInTheDocument();
    });

    it('does NOT render the quality score slot when prop is absent', () => {
        render(
            <EntityPageHeader
                mode="view"
                title="Hotel Plaza"
                viewActions={defaultViewActions}
            />
        );
        expect(screen.queryByTestId('quality-score-slot')).not.toBeInTheDocument();
    });

    // ---- MODE: view ----

    it('renders "Volver" and "Editar" buttons in view mode', () => {
        render(
            <EntityPageHeader
                mode="view"
                title="Hotel Plaza"
                viewActions={defaultViewActions}
            />
        );
        expect(screen.getByRole('button', { name: /volver/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /editar/i })).toBeInTheDocument();
    });

    it('does NOT render Cancelar or Guardar in view mode', () => {
        render(
            <EntityPageHeader
                mode="view"
                title="Hotel Plaza"
                viewActions={defaultViewActions}
            />
        );
        expect(screen.queryByRole('button', { name: /cancelar/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /guardar/i })).not.toBeInTheDocument();
    });

    it('calls onBack when "Volver" is clicked', async () => {
        const onBack = vi.fn();
        const user = userEvent.setup();
        render(
            <EntityPageHeader
                mode="view"
                title="Hotel Plaza"
                viewActions={{ onBack, onEdit: vi.fn() }}
            />
        );
        await user.click(screen.getByRole('button', { name: /volver/i }));
        expect(onBack).toHaveBeenCalledOnce();
    });

    it('calls onEdit when "Editar" is clicked', async () => {
        const onEdit = vi.fn();
        const user = userEvent.setup();
        render(
            <EntityPageHeader
                mode="view"
                title="Hotel Plaza"
                viewActions={{ onBack: vi.fn(), onEdit }}
            />
        );
        await user.click(screen.getByRole('button', { name: /editar/i }));
        expect(onEdit).toHaveBeenCalledOnce();
    });

    // ---- MODE: edit ----

    it('renders "Cancelar" and "Guardar" buttons in edit mode', () => {
        render(
            <EntityPageHeader
                mode="edit"
                title="Hotel Plaza"
                editActions={defaultEditActions}
            />
        );
        expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /guardar/i })).toBeInTheDocument();
    });

    it('does NOT render "Volver" or "Editar" in edit mode', () => {
        render(
            <EntityPageHeader
                mode="edit"
                title="Hotel Plaza"
                editActions={defaultEditActions}
            />
        );
        expect(screen.queryByRole('button', { name: /volver/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument();
    });

    it('shows the dirty indicator when isDirty=true', () => {
        render(
            <EntityPageHeader
                mode="edit"
                title="Hotel Plaza"
                editActions={{ ...defaultEditActions, isDirty: true }}
            />
        );
        expect(screen.getByTestId('dirty-indicator')).toBeInTheDocument();
        expect(screen.getByTestId('dirty-indicator')).toHaveTextContent('sin guardar');
    });

    it('does NOT show the dirty indicator when isDirty=false', () => {
        render(
            <EntityPageHeader
                mode="edit"
                title="Hotel Plaza"
                editActions={{ ...defaultEditActions, isDirty: false }}
            />
        );
        expect(screen.queryByTestId('dirty-indicator')).not.toBeInTheDocument();
    });

    it('shows "Guardando…" text and spinner when isSaving=true', () => {
        render(
            <EntityPageHeader
                mode="edit"
                title="Hotel Plaza"
                editActions={{ ...defaultEditActions, isSaving: true }}
            />
        );
        expect(screen.getByRole('button', { name: /guardar/i })).toHaveTextContent('Guardando…');
        // The button should be disabled while saving
        expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled();
    });

    it('calls onCancel when "Cancelar" is clicked in edit mode', async () => {
        const onCancel = vi.fn();
        const user = userEvent.setup();
        render(
            <EntityPageHeader
                mode="edit"
                title="Hotel Plaza"
                editActions={{ ...defaultEditActions, onCancel }}
            />
        );
        await user.click(screen.getByRole('button', { name: /cancelar/i }));
        expect(onCancel).toHaveBeenCalledOnce();
    });

    it('calls onSave when "Guardar" is clicked in edit mode', async () => {
        const onSave = vi.fn();
        const user = userEvent.setup();
        render(
            <EntityPageHeader
                mode="edit"
                title="Hotel Plaza"
                editActions={{ ...defaultEditActions, onSave }}
            />
        );
        await user.click(screen.getByRole('button', { name: /guardar/i }));
        expect(onSave).toHaveBeenCalledOnce();
    });

    // ---- MODE: create ----

    it('renders "Cancelar" and "Crear" buttons in create mode', () => {
        render(
            <EntityPageHeader
                mode="create"
                title="Nuevo alojamiento"
                createActions={defaultCreateActions}
            />
        );
        expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /crear/i })).toBeInTheDocument();
    });

    it('does NOT render "Volver", "Editar" or "Guardar" in create mode', () => {
        render(
            <EntityPageHeader
                mode="create"
                title="Nuevo alojamiento"
                createActions={defaultCreateActions}
            />
        );
        expect(screen.queryByRole('button', { name: /volver/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /guardar/i })).not.toBeInTheDocument();
    });

    it('shows "Creando…" and spinner when isCreating=true', () => {
        render(
            <EntityPageHeader
                mode="create"
                title="Nuevo alojamiento"
                createActions={{ ...defaultCreateActions, isCreating: true }}
            />
        );
        expect(screen.getByRole('button', { name: /crear/i })).toHaveTextContent('Creando…');
        expect(screen.getByRole('button', { name: /crear/i })).toBeDisabled();
    });

    it('calls onCancel when "Cancelar" is clicked in create mode', async () => {
        const onCancel = vi.fn();
        const user = userEvent.setup();
        render(
            <EntityPageHeader
                mode="create"
                title="Nuevo alojamiento"
                createActions={{ ...defaultCreateActions, onCancel }}
            />
        );
        await user.click(screen.getByRole('button', { name: /cancelar/i }));
        expect(onCancel).toHaveBeenCalledOnce();
    });

    it('calls onCreate when "Crear" is clicked', async () => {
        const onCreate = vi.fn();
        const user = userEvent.setup();
        render(
            <EntityPageHeader
                mode="create"
                title="Nuevo alojamiento"
                createActions={{ ...defaultCreateActions, onCreate }}
            />
        );
        await user.click(screen.getByRole('button', { name: /crear/i }));
        expect(onCreate).toHaveBeenCalledOnce();
    });

    // ---- Media variants ----

    it('renders a thumbnail img when media.type="thumbnail" and src is provided', () => {
        render(
            <EntityPageHeader
                mode="view"
                title="Hotel Plaza"
                media={thumbnailMedia}
                viewActions={defaultViewActions}
            />
        );
        const img = screen.getByRole('img', { name: 'Hotel Plaza' });
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute('src', 'https://example.com/hotel.jpg');
        // Thumbnail = rounded-lg (not rounded-full)
        expect(img.className).not.toContain('rounded-full');
    });

    it('renders an avatar img with rounded-full when media.type="avatar"', () => {
        render(
            <EntityPageHeader
                mode="view"
                title="John Doe"
                media={avatarMedia}
                viewActions={defaultViewActions}
            />
        );
        const img = screen.getByRole('img', { name: 'John Doe' });
        expect(img).toBeInTheDocument();
        expect(img.className).toContain('rounded-full');
    });

    it('renders the fallback when media.src is absent', () => {
        render(
            <EntityPageHeader
                mode="view"
                title="Hotel Plaza"
                media={{
                    type: 'thumbnail',
                    fallback: <span data-testid="thumb-fallback">HP</span>
                }}
                viewActions={defaultViewActions}
            />
        );
        expect(screen.getByTestId('thumb-fallback')).toBeInTheDocument();
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('does NOT render any media element when media prop is absent', () => {
        render(
            <EntityPageHeader
                mode="create"
                title="Nuevo alojamiento"
                createActions={defaultCreateActions}
            />
        );
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    // ---- Actions container ----

    it('renders the actions container', () => {
        render(
            <EntityPageHeader
                mode="view"
                title="Hotel Plaza"
                viewActions={defaultViewActions}
            />
        );
        expect(screen.getByTestId('header-actions')).toBeInTheDocument();
    });

    // ---- Accessibility ----

    it('has role=banner on the header element', () => {
        render(
            <EntityPageHeader
                mode="view"
                title="Hotel Plaza"
                viewActions={defaultViewActions}
            />
        );
        expect(screen.getByRole('banner')).toBeInTheDocument();
    });

    it('dirty indicator is an accessible status with aria-live=polite', () => {
        render(
            <EntityPageHeader
                mode="edit"
                title="Hotel Plaza"
                editActions={{ ...defaultEditActions, isDirty: true }}
            />
        );
        const indicator = screen.getByTestId('dirty-indicator');
        // <output> exposes an implicit ARIA role of "status"
        expect(screen.getByRole('status')).toBe(indicator);
        expect(indicator).toHaveAttribute('aria-live', 'polite');
    });

    // ---- IntersectionObserver wiring ----

    it('attaches IntersectionObserver to the sentinel on mount', () => {
        const observeSpy = vi.fn();
        Object.defineProperty(window, 'IntersectionObserver', {
            writable: true,
            configurable: true,
            value: class {
                observe = observeSpy;
                unobserve = vi.fn();
                disconnect = vi.fn();
            }
        });

        render(
            <EntityPageHeader
                mode="view"
                title="Hotel Plaza"
                viewActions={defaultViewActions}
            />
        );

        expect(observeSpy).toHaveBeenCalledOnce();
    });

    it('disconnects the observer on unmount', () => {
        const disconnectSpy = vi.fn();
        Object.defineProperty(window, 'IntersectionObserver', {
            writable: true,
            configurable: true,
            value: class {
                observe = vi.fn();
                unobserve = vi.fn();
                disconnect = disconnectSpy;
            }
        });

        const { unmount } = render(
            <EntityPageHeader
                mode="view"
                title="Hotel Plaza"
                viewActions={defaultViewActions}
            />
        );

        unmount();
        expect(disconnectSpy).toHaveBeenCalledOnce();
    });
});
