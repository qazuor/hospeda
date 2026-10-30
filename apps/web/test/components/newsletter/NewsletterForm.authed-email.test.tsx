/**
 * @file NewsletterForm.authed-email.test.tsx
 * @description Pins the single-line account email of the newsletter footer
 * (HOS-1767 AC:1767:9, :10, :11): the value must ellipsize instead of
 * breaking mid-word, keep the full email accessible, and stay aligned with
 * the subscribe button and the "Configurar" link.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewsletterForm } from '../../../src/components/newsletter/NewsletterForm.client';
import { AUTH_ME_CACHE_KEY } from '../../../src/lib/auth-cache';

// ---------------------------------------------------------------------------
// Module mocks (same boundaries as NewsletterForm.test.tsx)
// ---------------------------------------------------------------------------

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}));

const showConfirmationDialogMock = vi.fn(async () => true);

vi.mock('@/lib/forms/show-confirmation-dialog', () => ({
    showConfirmationDialog: (...args: readonly unknown[]) => showConfirmationDialogMock(...args)
}));

vi.mock('../../../src/components/newsletter/NewsletterForm.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('../../../src/components/auth/AuthRequiredPopover.client', () => ({
    AuthRequiredPopover: ({
        onClose,
        message,
        dialogLabel
    }: {
        onClose: () => void;
        message: string;
        dialogLabel?: string;
    }) => (
        <dialog
            aria-label={dialogLabel ?? 'Autenticacion requerida'}
            data-testid="auth-required-popover"
            open
        >
            <p>{message}</p>
            <button
                type="button"
                onClick={onClose}
            >
                Cerrar
            </button>
        </dialog>
    )
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_URL = 'http://api.test';
const USER_EMAIL = 'test@example.com';

const css = readFileSync(
    resolve(__dirname, '../../../src/components/newsletter/NewsletterForm.module.css'),
    'utf8'
);

/** Returns the declarations inside a single CSS rule. */
function ruleBody(selector: string): string {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
    if (!match) throw new Error(`missing CSS rule: ${selector}`);
    return match[1] ?? '';
}

function seedAuthMeCache(input: { isAuthenticated: boolean; email?: string }) {
    sessionStorage.setItem(
        AUTH_ME_CACHE_KEY,
        JSON.stringify({
            isAuthenticated: input.isAuthenticated,
            user: input.isAuthenticated ? { id: 'user-1', email: input.email ?? '' } : null,
            permissions: [],
            cachedAt: Date.now()
        })
    );
}

function mockFetchOk(body: unknown): ReturnType<typeof vi.fn> {
    return vi.fn().mockResolvedValue({
        ok: true,
        json: async () => body
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NewsletterForm authed email CSS', () => {
    it('AC:1767:9 — ellipsizes the email on one line instead of breaking words', () => {
        const value = ruleBody('.authedEmailValue');

        expect(value).toMatch(/text-overflow:\s*ellipsis;/);
        expect(value).toMatch(/white-space:\s*nowrap;/);
        expect(value).toMatch(/overflow:\s*hidden;/);
        expect(value).toMatch(/min-width:\s*0;/);
        expect(value).not.toMatch(/word-break\s*:/);
    });

    it('AC:1767:11 — lets the email shrink and aligns "Configurar" with the button', () => {
        expect(ruleBody('.authedEmail')).toMatch(/min-width:\s*0;/);

        const configureLink = ruleBody('.configureLink');
        expect(configureLink).toMatch(/align-self:\s*flex-start;/);
        expect(configureLink).toMatch(/display:\s*inline-flex;/);
        expect(configureLink).toMatch(/align-items:\s*center;/);
        expect(configureLink).toMatch(/min-height:\s*2\.75rem;/);
    });

    it('HOS-1773 — the row wraps and the actions group is a single non-shrinking item', () => {
        expect(ruleBody('.inputRow')).toMatch(/flex-wrap:\s*wrap;/);
        const actions = ruleBody('.actions');
        expect(actions).toMatch(/display:\s*flex;/);
        expect(actions).toMatch(/flex:\s*0 0 auto;/);
    });
});

describe('NewsletterForm authed email', () => {
    beforeEach(() => {
        vi.stubGlobal(
            'fetch',
            mockFetchOk({
                subscribed: false,
                status: null,
                subscribedAt: null,
                verifiedAt: null
            })
        );
        sessionStorage.clear();
        showConfirmationDialogMock.mockResolvedValue(true);
    });

    it('AC:1767:10 — exposes the full email through the value title', async () => {
        seedAuthMeCache({ isAuthenticated: true, email: USER_EMAIL });

        render(
            <NewsletterForm
                isAuthenticated={true}
                userEmail={USER_EMAIL}
                apiUrl={API_URL}
                locale="es"
            />
        );

        await waitFor(() => {
            expect(screen.getByText(USER_EMAIL)).toBeInTheDocument();
        });
        expect(screen.getByText(USER_EMAIL)).toHaveAttribute('title', USER_EMAIL);
    });

    it('HOS-1773 — groups "Configurar" with the button, apart from the email block', async () => {
        seedAuthMeCache({ isAuthenticated: true, email: USER_EMAIL });

        render(
            <NewsletterForm
                isAuthenticated={true}
                userEmail={USER_EMAIL}
                apiUrl={API_URL}
                locale="es"
            />
        );

        const link = await screen.findByRole('link', { name: 'Configurar' });
        const button = screen.getByRole('button', { name: 'Suscribirme' });
        const group = link.parentElement;

        // Same dedicated wrapper (so they wrap together), which must not be the
        // whole input row that also holds the email block.
        expect(group).toBe(button.parentElement);
        expect(group?.children).toHaveLength(2);
        expect(group).not.toContainElement(screen.getByText(USER_EMAIL));
    });
});
