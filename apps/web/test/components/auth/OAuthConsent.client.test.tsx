/**
 * @file OAuthConsent.client.test.tsx
 * @description Behavior tests for the OAuth consent island (HOS-2184 T-027).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OAuthConsent } from '../../../src/components/auth/OAuthConsent.client';

vi.mock('../../../src/components/auth/OAuthConsent.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../src/lib/i18n', () => {
    const t = (key: string, fallback?: string, params?: Record<string, unknown>): string => {
        const base = fallback ?? key;
        return base.replace(/\{\{(\w+)\}\}/g, (_m, name: string) => String(params?.[name] ?? ''));
    };
    return { createTranslations: () => ({ t }) };
});

const fetchMock = vi.fn();
const getSessionMock = vi.fn();
const signOutMock = vi.fn();
vi.mock('../../../src/lib/auth-client', () => ({
    authClient: {
        $fetch: (...args: unknown[]) => fetchMock(...args),
        getSession: (...args: unknown[]) => getSessionMock(...args),
        signOut: (...args: unknown[]) => signOutMock(...args)
    }
}));
vi.mock('../../../src/lib/auth-cache', () => ({ clearCachedAuthMe: vi.fn() }));
// HOS-2562: whether the session is a real client (default: yes).
const canUseMock = vi.fn();
vi.mock('../../../src/lib/ai-assistants-access', () => ({
    fetchCanUseAiAssistants: (...args: unknown[]) => canUseMock(...args)
}));

const SEARCH =
    '?client_id=abc&scope=openid+email+calendar.write&redirect_uri=https%3A%2F%2Fclaude.ai%2Fcb' +
    '&state=xyz&exp=1900000000&ba_param=client_id&ba_param=scope&ba_param=redirect_uri' +
    '&ba_param=state&ba_param=exp&ba_param=ba_param&sig=SIG';

const replaceMock = vi.fn();
const assignMock = vi.fn();

function setLocation(search: string): void {
    Object.defineProperty(window, 'location', {
        configurable: true,
        value: { search, replace: replaceMock, assign: assignMock, reload: vi.fn() }
    });
}

function clientResponse(data: Record<string, unknown>) {
    return { data, error: null };
}

describe('OAuthConsent', () => {
    beforeEach(() => {
        fetchMock.mockReset();
        getSessionMock.mockReset();
        getSessionMock.mockResolvedValue({
            data: { user: { name: 'Leandro Gomez', email: 'leandro@gmail.com' } },
            error: null
        });
        signOutMock.mockReset();
        signOutMock.mockResolvedValue({});
        canUseMock.mockReset();
        canUseMock.mockResolvedValue(true);
        replaceMock.mockReset();
        assignMock.mockReset();
        setLocation(SEARCH);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('shows the client name and a summary of the requested scopes', async () => {
        // Arrange
        fetchMock.mockResolvedValue(clientResponse({ client_name: 'Claude' }));

        // Act
        render(<OAuthConsent locale="es" />);

        // Assert
        expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
            'Claude quiere conectarse a tu cuenta de Hospeda'
        );
        expect(screen.getByText('Confirmar tu identidad en Hospeda')).toBeInTheDocument();
        expect(screen.getByText('Tu correo electrónico')).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledWith('/oauth2/public-client', {
            method: 'GET',
            query: { client_id: 'abc' }
        });
    });

    it('lists an unknown scope generically instead of dropping it', async () => {
        // Arrange
        fetchMock.mockResolvedValue(clientResponse({ client_name: 'Claude' }));

        // Act
        render(<OAuthConsent locale="es" />);

        // Assert
        expect(
            await screen.findByText('Un permiso adicional (calendar.write)')
        ).toBeInTheDocument();
    });

    it('renders an untrusted client name as text, never as HTML', async () => {
        // Arrange
        const hostile = '<img src=x onerror="window.__pwned=1"><b>Evil</b>';
        fetchMock.mockResolvedValue(clientResponse({ client_name: hostile }));

        // Act
        const { container } = render(<OAuthConsent locale="es" />);

        // Assert
        const heading = await screen.findByRole('heading', { level: 1 });
        expect(heading.textContent).toContain(hostile);
        expect(container.querySelector('b')).toBeNull();
        expect(container.querySelector('img[onerror]')).toBeNull();
    });

    it('uses the logo and website only when they are https URLs', async () => {
        // Arrange
        fetchMock.mockResolvedValue(
            clientResponse({
                client_name: 'Claude',
                logo_uri: 'https://claude.ai/logo.png',
                client_uri: 'javascript:alert(1)'
            })
        );

        // Act
        const { container } = render(<OAuthConsent locale="es" />);
        await screen.findByRole('heading', { level: 1 });

        // Assert
        expect(container.querySelector('img')?.getAttribute('src')).toBe(
            'https://claude.ai/logo.png'
        );
        expect(container.querySelector('a[target="_blank"]')).toBeNull();
    });

    it('drops an http logo', async () => {
        // Arrange
        fetchMock.mockResolvedValue(
            clientResponse({ client_name: 'Claude', logo_uri: 'http://claude.ai/logo.png' })
        );

        // Act
        const { container } = render(<OAuthConsent locale="es" />);
        await screen.findByRole('heading', { level: 1 });

        // Assert
        expect(container.querySelector('img')).toBeNull();
    });

    it('allow posts accept=true with the signed query and follows the returned URL', async () => {
        // Arrange
        fetchMock
            .mockResolvedValueOnce(clientResponse({ client_name: 'Claude' }))
            .mockResolvedValueOnce(
                clientResponse({ redirect: true, url: 'https://claude.ai/cb?code=1' })
            );
        render(<OAuthConsent locale="es" />);

        // Act
        fireEvent.click(await screen.findByRole('button', { name: 'Permitir' }));

        // Assert
        await waitFor(() => expect(assignMock).toHaveBeenCalledWith('https://claude.ai/cb?code=1'));
        const [path, options] = fetchMock.mock.calls[1] as [
            string,
            { body: Record<string, unknown> }
        ];
        expect(path).toBe('/oauth2/consent');
        expect(options.body.accept).toBe(true);
        const sent = new URLSearchParams(String(options.body.oauth_query));
        expect(sent.get('sig')).toBe('SIG');
        expect(sent.get('client_id')).toBe('abc');
    });

    it('cancel posts accept=false and follows the returned URL', async () => {
        // Arrange
        fetchMock
            .mockResolvedValueOnce(clientResponse({ client_name: 'Claude' }))
            .mockResolvedValueOnce(
                clientResponse({ redirect: true, url: 'https://claude.ai/cb?error=access_denied' })
            );
        render(<OAuthConsent locale="es" />);

        // Act
        fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));

        // Assert
        await waitFor(() =>
            expect(assignMock).toHaveBeenCalledWith('https://claude.ai/cb?error=access_denied')
        );
        const [, options] = fetchMock.mock.calls[1] as [string, { body: Record<string, unknown> }];
        expect(options.body.accept).toBe(false);
    });

    it('never navigates to a non-http redirect and shows an error instead', async () => {
        // Arrange
        fetchMock
            .mockResolvedValueOnce(clientResponse({ client_name: 'Claude' }))
            .mockResolvedValueOnce(clientResponse({ redirect: true, url: 'javascript:alert(1)' }));
        render(<OAuthConsent locale="es" />);

        // Act
        fireEvent.click(await screen.findByRole('button', { name: 'Permitir' }));

        // Assert
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'No pudimos completar la autorización'
        );
        expect(assignMock).not.toHaveBeenCalled();
    });

    it('shows an error and lets the user retry when the decision call fails', async () => {
        // Arrange
        fetchMock
            .mockResolvedValueOnce(clientResponse({ client_name: 'Claude' }))
            .mockResolvedValueOnce({ data: null, error: { status: 500 } });
        render(<OAuthConsent locale="es" />);

        // Act
        fireEvent.click(await screen.findByRole('button', { name: 'Permitir' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));

        // Assert
        expect(await screen.findByRole('button', { name: 'Permitir' })).toBeEnabled();
    });

    it('shows a pure tourist the refusal: no Allow button, no link to AI assistants (HOS-2562)', async () => {
        // Arrange
        fetchMock.mockResolvedValue(clientResponse({ client_name: 'Claude' }));
        canUseMock.mockResolvedValue(false);

        // Act
        render(<OAuthConsent locale="es" />);

        // Assert
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Los asistentes de IA son solo para cuentas que administran un negocio'
        );
        expect(screen.queryByRole('button', { name: 'Permitir' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
        expect(screen.queryByRole('link', { name: 'Asistentes de IA' })).toBeNull();
    });

    it('shows the refusal when the server answers 403 to the consent (HOS-2562)', async () => {
        // Arrange: the browser could not tell (no /auth/me session), the server can
        fetchMock
            .mockResolvedValueOnce(clientResponse({ client_name: 'Claude' }))
            .mockResolvedValueOnce({ data: null, error: { status: 403 } });
        canUseMock.mockResolvedValue(null);
        render(<OAuthConsent locale="es" />);

        // Act
        fireEvent.click(await screen.findByRole('button', { name: 'Permitir' }));

        // Assert
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Los asistentes de IA son solo para cuentas que administran un negocio'
        );
        expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
        expect(assignMock).not.toHaveBeenCalled();
    });

    it('sends a signed-out visitor to sign-in with the request preserved', async () => {
        // Arrange
        fetchMock.mockResolvedValue({ data: null, error: { status: 401 } });

        // Act
        render(<OAuthConsent locale="es" />);

        // Assert
        await waitFor(() => expect(replaceMock).toHaveBeenCalledTimes(1));
        const target = String(replaceMock.mock.calls[0]?.[0]);
        expect(target.startsWith('/es/auth/signin/?returnUrl=')).toBe(true);
        const returnUrl = new URL(target, 'https://hospeda.test').searchParams.get('returnUrl');
        expect(returnUrl).toBe(`/es/auth/consent/${SEARCH}`);
    });

    it('explains an unknown client', async () => {
        // Arrange
        fetchMock.mockResolvedValue({ data: null, error: { status: 404 } });

        // Act
        render(<OAuthConsent locale="es" />);

        // Assert
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'No encontramos la aplicación que pide acceso'
        );
    });

    it('rejects a page opened without a signed request, without calling the API', async () => {
        // Arrange
        setLocation('');

        // Act
        render(<OAuthConsent locale="es" />);

        // Assert
        expect(await screen.findByRole('alert')).toHaveTextContent('no es válido o venció');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('lists the eight capabilities', async () => {
        // Arrange
        fetchMock.mockResolvedValue(clientResponse({ client_name: 'Claude' }));

        // Act
        render(<OAuthConsent locale="es" />);

        // Assert
        await screen.findByRole('heading', { level: 1 });
        for (const text of [
            'Ver tus publicaciones y sus estadísticas',
            'Editar datos básicos (descripción, contacto, horarios, servicios)',
            'Pausar o reanudar tus publicaciones',
            'Responder consultas de tus alojamientos',
            'Ver todas las reseñas de tus publicaciones, también las pendientes y las rechazadas',
            'Crear borradores de publicaciones nuevas',
            'Buscar en el directorio de proveedores para anfitriones',
            'Ver tus usos de beneficios y confirmarlos o rechazarlos'
        ]) {
            expect(screen.getByText(text)).toBeInTheDocument();
        }
    });

    it('words the two directory capabilities naturally in every locale', () => {
        // The component test mocks i18n to the Spanish fallbacks, so the locale
        // files are read directly.
        const capabilities = (locale: string) =>
            JSON.parse(
                readFileSync(
                    join(process.cwd(), `../../packages/i18n/src/locales/${locale}/auth.json`),
                    'utf8'
                )
            ).consent.capabilities as Record<string, string>;

        expect(capabilities('en')).toMatchObject({
            providers: "Search the hosts' provider directory",
            benefitUsages: 'See your benefit usages and confirm or reject them'
        });
        expect(capabilities('es')).toMatchObject({
            providers: 'Buscar en el directorio de proveedores para anfitriones',
            benefitUsages: 'Ver tus usos de beneficios y confirmarlos o rechazarlos'
        });
        expect(capabilities('pt').providers).toBe(
            'Buscar no diretório de fornecedores para anfitriões'
        );
    });

    it('links the disconnect notice to the AI assistants panel', async () => {
        // Arrange
        fetchMock.mockResolvedValue(clientResponse({ client_name: 'Claude' }));

        // Act
        render(<OAuthConsent locale="es" />);

        // Assert
        const link = await screen.findByRole('link', { name: 'Asistentes de IA' });
        expect(link).toHaveAttribute('href', '/es/mi-cuenta/asistentes-ia/');
    });

    it('shows the signed-in name and a masked email', async () => {
        // Arrange
        fetchMock.mockResolvedValue(clientResponse({ client_name: 'Claude' }));

        // Act
        render(<OAuthConsent locale="es" />);

        // Assert
        expect(
            await screen.findByText('Sesión iniciada como Leandro Gomez (lea***@gmail.com)')
        ).toBeInTheDocument();
        expect(screen.queryByText(/leandro@gmail\.com/)).toBeNull();
    });

    it('signs out and goes to sign-in with the request preserved on "Cambiar de cuenta"', async () => {
        // Arrange
        fetchMock.mockResolvedValue(clientResponse({ client_name: 'Claude' }));
        render(<OAuthConsent locale="es" />);

        // Act
        fireEvent.click(await screen.findByRole('button', { name: 'Cambiar de cuenta' }));

        // Assert
        await waitFor(() => expect(assignMock).toHaveBeenCalledTimes(1));
        expect(signOutMock).toHaveBeenCalledTimes(1);
        const target = String(assignMock.mock.calls[0]?.[0]);
        expect(target.startsWith('/es/auth/signin/?returnUrl=')).toBe(true);
        const returnUrl = new URL(target, 'https://hospeda.test').searchParams.get('returnUrl');
        expect(returnUrl).toBe(`/es/auth/consent/${SEARCH}`);
    });

    it('still goes to sign-in when sign-out throws', async () => {
        // Arrange
        fetchMock.mockResolvedValue(clientResponse({ client_name: 'Claude' }));
        signOutMock.mockRejectedValue(new Error('network'));
        render(<OAuthConsent locale="es" />);

        // Act
        fireEvent.click(await screen.findByRole('button', { name: 'Cambiar de cuenta' }));

        // Assert
        await waitFor(() => expect(assignMock).toHaveBeenCalledTimes(1));
    });

    it('hides the account line but keeps the screen usable when the session cannot be read', async () => {
        // Arrange
        fetchMock.mockResolvedValue(clientResponse({ client_name: 'Claude' }));
        getSessionMock.mockRejectedValue(new Error('boom'));

        // Act
        render(<OAuthConsent locale="es" />);

        // Assert
        expect(await screen.findByRole('button', { name: 'Permitir' })).toBeEnabled();
        expect(screen.queryByRole('button', { name: 'Cambiar de cuenta' })).toBeNull();
    });
});
