/**
 * HOS-2519 US-7: the admin email previewer page (`/platform/emails`).
 *
 * AC-7.1 list + count and the guard's no-access state, AC-7.2 accent/case-
 * insensitive search and the domain filter, AC-7.3 the scenario selector,
 * AC-7.4 the width toggle without refetch, AC-7.5 the sandboxed `srcDoc`
 * iframe, AC-7.6 subject prefix + plain text, AC-7.7 the "not wired" badge,
 * plus the preview error with retry.
 */

import type { EmailPreviewEntrySummary, EmailPreviewRenderResponse } from '@repo/schemas';
import { PermissionEnum } from '@repo/schemas';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../helpers/render-with-providers';

const mocks = vi.hoisted(() => ({
    fetchApi: vi.fn(),
    navigate: vi.fn(),
    permissions: [] as string[]
}));

vi.mock('@/lib/api/client', () => ({ fetchApi: mocks.fetchApi }));

// This file exercises the real guard (the global setup replaces it).
vi.mock('@/components/auth/RoutePermissionGuard', async () =>
    vi.importActual('@/components/auth/RoutePermissionGuard')
);
// Same shape as the global router mock, with an observable `navigate`.
vi.mock('@tanstack/react-router', () => ({
    useNavigate: () => mocks.navigate,
    useRouter: () => ({ navigate: mocks.navigate }),
    useLocation: () => ({ pathname: '/platform/emails', search: '', hash: '' }),
    Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
    Outlet: () => null,
    createFileRoute: () => (options: Record<string, unknown>) => ({ options })
}));
vi.mock('@/hooks/use-user-permissions', () => ({
    useUserPermissions: () => mocks.permissions
}));
vi.mock('@/components/layout/SidebarPageLayout', () => ({
    SidebarPageLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string, params?: Record<string, unknown>) =>
            params ? `${key} ${JSON.stringify(params)}` : key,
        tPlural: (key: string) => key,
        locale: 'es'
    })
}));

import { Route } from '../../../../src/routes/_authed/platform/emails/index';

const ENTRIES: EmailPreviewEntrySummary[] = [
    {
        key: 'outbox.billing.renewal-upcoming',
        id: 'billing.renewal-upcoming',
        sendPath: 'outbox',
        name: 'Aviso de renovación',
        domain: 'billing',
        audience: 'user',
        wired: true,
        scenarios: [
            { id: 'monthly', label: 'Mensual', locale: 'es', subject: 'Tu plan se renueva pronto' },
            { id: 'annual', label: 'Anual', locale: 'es', subject: 'Tu plan se renueva pronto' }
        ]
    },
    {
        key: 'auth.reset-password',
        id: 'reset-password',
        sendPath: 'auth',
        name: 'Restablecer contraseña',
        domain: 'auth',
        audience: 'user',
        wired: true,
        scenarios: [
            {
                id: 'with-name',
                label: 'Con nombre',
                locale: 'es',
                subject: 'Restablecé tu contraseña de Hospeda'
            }
        ]
    },
    {
        key: 'newsletter.verify',
        id: 'verify',
        sendPath: 'newsletter',
        name: 'Confirmación de suscripción',
        domain: 'newsletter',
        audience: 'staff',
        wired: false,
        scenarios: [{ id: 'default', label: 'Por defecto', locale: 'es', subject: null }]
    }
];

const LIST_PATH = '/api/v1/admin/email-previews';

function rendered(input: { key: string; scenarioId: string }): EmailPreviewRenderResponse {
    return {
        key: input.key,
        scenarioId: input.scenarioId,
        subject: `Asunto ${input.scenarioId}`,
        subjectPrefix: '[STAGING] ',
        html: `<html lang="es"><body><p>Cuerpo ${input.scenarioId}</p></body></html>`,
        text: `Texto ${input.scenarioId}`,
        warnings: []
    };
}

function renderCalls(): string[] {
    return mocks.fetchApi.mock.calls
        .map(([arg]) => (arg as { path: string }).path)
        .filter((path) => path.startsWith(`${LIST_PATH}/render`));
}

function catalogList() {
    return within(screen.getByRole('navigation', { name: 'admin-pages.emailPreviews.title' }));
}

function renderPage() {
    const Page = Route.options.component as React.ComponentType;
    return renderWithProviders(<Page />);
}

describe('/platform/emails (HOS-2519)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.permissions = [PermissionEnum.NOTIFICATION_TEMPLATE_PREVIEW];
        mocks.fetchApi.mockImplementation(async ({ path }: { path: string }) => {
            if (path === LIST_PATH) {
                return { data: { success: true, data: { entries: ENTRIES, total: 3 } } };
            }
            const params = new URL(path, 'http://admin.test').searchParams;
            return {
                data: {
                    success: true,
                    data: rendered({
                        key: params.get('key') ?? '',
                        scenarioId: params.get('scenarioId') ?? ''
                    })
                }
            };
        });
    });

    it('AC-7.1: lists every entry with the count and selects the first one', async () => {
        renderPage();

        expect(
            await screen.findByRole('button', { name: /Aviso de renovación/ })
        ).toBeInTheDocument();
        expect(catalogList().getByText('Restablecer contraseña')).toBeInTheDocument();
        expect(screen.getByTestId('email-catalog-count').textContent).toContain(
            '{"shown":3,"total":3}'
        );
        expect(await screen.findByTestId('email-preview-subject')).toHaveTextContent(
            '[STAGING] Asunto monthly'
        );
    });

    it('AC-7.1: without the permission, shows the guard state and never calls the API', () => {
        mocks.permissions = [PermissionEnum.SETTINGS_MANAGE];

        renderPage();

        // The guard's no-access state: its sr-only placeholder heading and a redirect.
        expect(
            screen.getByRole('heading', { level: 1, name: 'admin-common.states.loading' })
        ).toBeInTheDocument();
        expect(mocks.navigate).toHaveBeenCalledWith({ to: '/dashboard' });
        expect(screen.queryByText('Aviso de renovación')).not.toBeInTheDocument();
        expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
        expect(mocks.fetchApi).not.toHaveBeenCalled();
    });

    it('AC-7.1: with the permission, the guard does not redirect', async () => {
        renderPage();

        expect(await screen.findByRole('searchbox')).toBeInTheDocument();
        expect(mocks.navigate).not.toHaveBeenCalled();
    });

    it('shows the loading state, not the error, while a failed catalog load is retried', async () => {
        // Arrange: the first list load fails, the retry hangs until released
        let release: (() => void) | undefined;
        const base = mocks.fetchApi.getMockImplementation();
        let listCalls = 0;
        mocks.fetchApi.mockImplementation(async (input: { path: string }) => {
            if (input.path === LIST_PATH) {
                listCalls += 1;
                if (listCalls === 1) {
                    throw new Error('list failed');
                }
                await new Promise<void>((resolve) => {
                    release = resolve;
                });
            }
            return base?.(input);
        });
        renderPage();
        const retry = await screen.findByRole('button', {
            name: 'admin-pages.emailPreviews.retry'
        });
        expect(screen.getByText('admin-pages.emailPreviews.loadError')).toBeInTheDocument();

        // Act
        fireEvent.click(retry);

        // Assert: busy feedback replaces the error and its button while fetching
        const loading = await screen.findByText('admin-pages.emailPreviews.loading');
        expect(loading).toHaveAttribute('aria-busy', 'true');
        expect(screen.queryByText('admin-pages.emailPreviews.loadError')).not.toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: 'admin-pages.emailPreviews.retry' })
        ).not.toBeInTheDocument();
        release?.();
        expect(await screen.findByRole('searchbox')).toBeInTheDocument();
        expect(listCalls).toBe(2);
    });

    it('AC-7.2: searches name, key and id ignoring case and accents', async () => {
        renderPage();
        const search = await screen.findByRole('searchbox');

        fireEvent.change(search, { target: { value: 'RENOVACION' } });
        expect(catalogList().getByText('Aviso de renovación')).toBeInTheDocument();
        expect(catalogList().queryByText('Restablecer contraseña')).not.toBeInTheDocument();
        expect(screen.getByTestId('email-catalog-count').textContent).toContain(
            '{"shown":1,"total":3}'
        );

        fireEvent.change(search, { target: { value: 'renov' } });
        expect(catalogList().getByText('Aviso de renovación')).toBeInTheDocument();

        fireEvent.change(search, { target: { value: 'reset-password' } });
        expect(catalogList().getByText('Restablecer contraseña')).toBeInTheDocument();
        expect(catalogList().queryByText('Aviso de renovación')).not.toBeInTheDocument();
    });

    it('AC-7.2: the domain filter is a multi-select', async () => {
        renderPage();
        await screen.findByRole('button', { name: /Aviso de renovación/ });
        const filter = screen.getByRole('group', {
            name: 'admin-pages.emailPreviews.domainFilterLabel'
        });

        fireEvent.click(
            within(filter).getByRole('button', { name: 'admin-pages.emailPreviews.domains.auth' })
        );
        expect(catalogList().queryByText('Aviso de renovación')).not.toBeInTheDocument();
        expect(catalogList().getByText('Restablecer contraseña')).toBeInTheDocument();

        fireEvent.click(
            within(filter).getByRole('button', {
                name: 'admin-pages.emailPreviews.domains.newsletter'
            })
        );
        expect(catalogList().getByText('Confirmación de suscripción')).toBeInTheDocument();
        expect(catalogList().getByText('Restablecer contraseña')).toBeInTheDocument();
        expect(screen.getByTestId('email-catalog-count').textContent).toContain(
            '{"shown":2,"total":3}'
        );
    });

    it('AC-1.4: the audience control filters users and staff, with the count and the badge', async () => {
        renderPage();
        await screen.findByRole('button', { name: /Aviso de renovación/ });
        const control = screen.getByRole('group', {
            name: 'admin-pages.emailPreviews.audienceFilterLabel'
        });
        const count = () => screen.getByTestId('email-catalog-count').textContent;

        expect(
            within(
                catalogList().getByRole('button', { name: /Confirmación de suscripción/ })
            ).getByText('admin-pages.emailPreviews.staffBadge')
        ).toBeInTheDocument();

        fireEvent.click(
            within(control).getByRole('button', {
                name: 'admin-pages.emailPreviews.audiences.staff'
            })
        );
        expect(catalogList().getByText('Confirmación de suscripción')).toBeInTheDocument();
        expect(catalogList().queryByText('Aviso de renovación')).not.toBeInTheDocument();
        expect(count()).toContain('{"shown":1,"total":3}');

        fireEvent.click(
            within(control).getByRole('button', {
                name: 'admin-pages.emailPreviews.audiences.user'
            })
        );
        expect(catalogList().queryByText('Confirmación de suscripción')).not.toBeInTheDocument();
        expect(count()).toContain('{"shown":2,"total":3}');

        fireEvent.click(
            within(control).getByRole('button', { name: 'admin-pages.emailPreviews.audiences.all' })
        );
        expect(count()).toContain('{"shown":3,"total":3}');
    });

    it('AC-1.5: "Limpiar filtros" resets the audience, the search and the domains', async () => {
        renderPage();
        const search = await screen.findByRole('searchbox');
        const control = screen.getByRole('group', {
            name: 'admin-pages.emailPreviews.audienceFilterLabel'
        });

        fireEvent.click(
            within(control).getByRole('button', {
                name: 'admin-pages.emailPreviews.audiences.staff'
            })
        );
        fireEvent.change(search, { target: { value: 'zzz' } });
        fireEvent.click(
            screen.getByRole('button', { name: 'admin-pages.emailPreviews.clearFilters' })
        );

        expect(search).toHaveValue('');
        expect(
            within(control).getByRole('button', { name: 'admin-pages.emailPreviews.audiences.all' })
        ).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByTestId('email-catalog-count').textContent).toContain(
            '{"shown":3,"total":3}'
        );
    });

    it('AC-7.3: shows the scenario selector for 2+ scenarios and re-renders on change', async () => {
        renderPage();
        const trigger = await screen.findByRole('combobox', {
            name: 'admin-pages.emailPreviews.scenarioLabel'
        });
        expect(trigger).toHaveTextContent('Mensual');

        fireEvent.keyDown(trigger, { key: 'ArrowDown' });
        fireEvent.click(await screen.findByRole('option', { name: 'Anual' }));

        await waitFor(() =>
            expect(screen.getByTestId('email-preview-subject')).toHaveTextContent(
                '[STAGING] Asunto annual'
            )
        );
        expect(renderCalls()).toEqual([
            `${LIST_PATH}/render?key=outbox.billing.renewal-upcoming&scenarioId=monthly`,
            `${LIST_PATH}/render?key=outbox.billing.renewal-upcoming&scenarioId=annual`
        ]);
    });

    it('AC-7.3: hides the scenario selector for a single scenario', async () => {
        renderPage();
        fireEvent.click(await screen.findByRole('button', { name: /Restablecer contraseña/ }));

        await waitFor(() =>
            expect(screen.getByTestId('email-preview-subject')).toHaveTextContent(
                'Asunto with-name'
            )
        );
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('AC-7.4 + AC-7.5: toggles 600/375 px without refetching, in a fully sandboxed srcDoc iframe', async () => {
        renderPage();
        await screen.findByTestId('email-preview-subject');
        const iframe = screen.getByTitle(/admin-pages\.emailPreviews\.iframeTitle/);

        expect(iframe.getAttribute('sandbox')).toBe('');
        expect(iframe.getAttribute('srcdoc')).toContain('Cuerpo monthly');
        expect(iframe.getAttribute('src')).toBeNull();
        expect(iframe.getAttribute('width')).toBe('600');
        expect(iframe.getAttribute('height')).toBe('900');

        fireEvent.click(screen.getByRole('button', { name: 'admin-pages.emailPreviews.mobile' }));
        expect(
            screen.getByTitle(/admin-pages\.emailPreviews\.iframeTitle/).getAttribute('width')
        ).toBe('375');
        fireEvent.click(screen.getByRole('button', { name: 'admin-pages.emailPreviews.desktop' }));
        expect(
            screen.getByTitle(/admin-pages\.emailPreviews\.iframeTitle/).getAttribute('width')
        ).toBe('600');
        expect(renderCalls()).toHaveLength(1);
    });

    it('AC-7.6: shows the plain-text part', async () => {
        renderPage();
        await screen.findByTestId('email-preview-subject');

        expect(screen.getByTestId('email-plain-text')).toHaveTextContent('Texto monthly');
        expect(screen.getByText('admin-pages.emailPreviews.plainText')).toBeInTheDocument();
    });

    it('AC-7.7: badges only the entries with wired: false', async () => {
        renderPage();
        await screen.findByRole('button', { name: /Confirmación de suscripción/ });

        const badges = screen.getAllByText('admin-pages.emailPreviews.notWired');
        expect(badges).toHaveLength(1);
        expect(
            badges[0]?.closest('button')?.textContent?.includes('Confirmación de suscripción')
        ).toBe(true);
    });

    it('shows the preview error with a retry that renders again', async () => {
        let failures = 1;
        const base = mocks.fetchApi.getMockImplementation();
        mocks.fetchApi.mockImplementation(async (input: { path: string }) => {
            if (input.path.startsWith(`${LIST_PATH}/render`) && failures > 0) {
                failures -= 1;
                throw new Error('render failed');
            }
            return base?.(input);
        });
        renderPage();

        expect(
            await screen.findByText('admin-pages.emailPreviews.previewError')
        ).toBeInTheDocument();
        expect(catalogList().getByText('Aviso de renovación')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'admin-pages.emailPreviews.retry' }));

        expect(await screen.findByTestId('email-preview-subject')).toHaveTextContent(
            'Asunto monthly'
        );
    });
});
