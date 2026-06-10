import { LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { EntityCreateConfig } from '@/components/entity-pages';
import { EntityCreatePageBase } from '@/components/entity-pages/EntityCreatePageBase';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Heavy provider / hook mocks
//
// EntityCreatePageBase pulls in i18n, toast, user permissions, the entity
// form provider, and the entire field renderer. The contract we want to
// regression-guard here is purely the shell:
//   1. EntityPageHeader is rendered in `create` mode.
//   2. Cancel button calls `onNavigate(basePath)`.
//   3. Create button calls the mutation and triggers the success path.
//
// Everything else (validation, accordion behaviour, lazy loading) is
// covered by sibling component tests and the manual smoke.
// ---------------------------------------------------------------------------

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string) => key
    })
}));

vi.mock('@repo/i18n', () => ({
    useTranslations: () => ({
        t: (key: string) => key
    })
}));

vi.mock('@/components/ui/ToastProvider', () => ({
    useToast: () => ({
        addToast: vi.fn()
    })
}));

vi.mock('@/hooks/use-user-permissions', () => ({
    useUserPermissions: () => []
}));

// EntityFormProvider just renders children — we don't need its context here.
vi.mock('@/components/entity-form', async () => {
    const actual = await vi.importActual<Record<string, unknown>>('@/components/entity-form');
    return {
        ...actual,
        EntityFormProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
        EntityFormSection: ({ config }: { config: { id?: string; title?: string } }) => (
            <div data-testid={`section-${config.id ?? 'unknown'}`}>{config.title ?? ''}</div>
        )
    };
});

// IntersectionObserver mock for the sticky-header sentinel.
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
// Test config + helpers
// ---------------------------------------------------------------------------

const baseConfig: EntityCreateConfig = {
    entityType: 'accommodation',
    title: 'Crear alojamiento',
    description: 'Empezá con los datos mínimos',
    entityName: 'alojamiento',
    entityNamePlural: 'alojamientos',
    basePath: '/accommodations',
    submitLabel: 'Crear',
    savingLabel: 'Creando...',
    successToastTitle: 'OK',
    successToastMessage: 'created',
    errorToastTitle: 'Error',
    errorMessage: 'Failed',
    afterCreateRedirectMode: 'edit'
};

function makeConsolidatedConfig() {
    return {
        sections: [
            {
                id: 'basic-info',
                title: 'Datos básicos',
                layout: LayoutTypeEnum.GRID,
                modes: ['create' as const],
                fields: []
            }
        ],
        metadata: { entityName: 'alojamiento', entityNamePlural: 'alojamientos' }
    };
}

describe('EntityCreatePageBase', () => {
    it('renders the EntityPageHeader landmark in create mode with the config title', () => {
        render(
            <EntityCreatePageBase
                config={baseConfig}
                createConsolidatedConfig={makeConsolidatedConfig}
                createMutation={{
                    mutateAsync: vi.fn().mockResolvedValue({ id: 'new-id' }),
                    isPending: false
                }}
                onNavigate={vi.fn()}
            />
        );

        const header = screen.getByTestId('entity-page-header');
        expect(header).toBeInTheDocument();
        // Banner landmark stays consistent with view/edit shells.
        expect(screen.getByRole('banner')).toBe(header);
        // Title appears in the header (visible h1) AND in the sr-only h1
        // outside the header — assert both via `getAllByRole`.
        const headings = screen.getAllByRole('heading', { name: 'Crear alojamiento' });
        expect(headings.length).toBeGreaterThan(0);
    });

    it('shows the Cancel and Crear buttons in the header', () => {
        render(
            <EntityCreatePageBase
                config={baseConfig}
                createConsolidatedConfig={makeConsolidatedConfig}
                createMutation={{
                    mutateAsync: vi.fn().mockResolvedValue({ id: 'new-id' }),
                    isPending: false
                }}
                onNavigate={vi.fn()}
            />
        );

        expect(screen.getByRole('button', { name: 'Cancelar creación' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Crear entidad' })).toBeInTheDocument();
    });

    it('clicking Cancelar navigates to the basePath', async () => {
        const onNavigate = vi.fn();
        render(
            <EntityCreatePageBase
                config={baseConfig}
                createConsolidatedConfig={makeConsolidatedConfig}
                createMutation={{
                    mutateAsync: vi.fn(),
                    isPending: false
                }}
                onNavigate={onNavigate}
            />
        );

        await userEvent.click(screen.getByRole('button', { name: 'Cancelar creación' }));

        expect(onNavigate).toHaveBeenCalledWith('/accommodations');
    });

    it('clicking Crear calls the mutation and navigates with afterCreateRedirectMode=edit', async () => {
        const onNavigate = vi.fn();
        const mutateAsync = vi.fn().mockResolvedValue({ id: 'abc-123' });
        render(
            <EntityCreatePageBase
                config={baseConfig}
                createConsolidatedConfig={makeConsolidatedConfig}
                createMutation={{ mutateAsync, isPending: false }}
                onNavigate={onNavigate}
            />
        );

        await userEvent.click(screen.getByRole('button', { name: 'Crear entidad' }));

        expect(mutateAsync).toHaveBeenCalledOnce();
        // afterCreateRedirectMode: 'edit' lands on the edit subroute.
        expect(onNavigate).toHaveBeenCalledWith('/accommodations/abc-123/edit');
    });

    it('navigates to the view subroute when afterCreateRedirectMode defaults', async () => {
        const onNavigate = vi.fn();
        const mutateAsync = vi.fn().mockResolvedValue({ id: 'abc-123' });
        const configWithoutRedirect: EntityCreateConfig = {
            ...baseConfig,
            afterCreateRedirectMode: undefined
        };
        render(
            <EntityCreatePageBase
                config={configWithoutRedirect}
                createConsolidatedConfig={makeConsolidatedConfig}
                createMutation={{ mutateAsync, isPending: false }}
                onNavigate={onNavigate}
            />
        );

        await userEvent.click(screen.getByRole('button', { name: 'Crear entidad' }));

        expect(onNavigate).toHaveBeenCalledWith('/accommodations/abc-123');
    });
});
