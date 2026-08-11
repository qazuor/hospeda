/**
 * @file ProfileEditForm.socialOptIn.test.tsx
 * @description HOS-375 §6.7 (G-5) — the social-networks opt-in toggle and its
 * consent copy.
 *
 * The setting key shipped in T-008 with no UI, which makes it a preference
 * nobody can ever turn on. The toggle alone would be worse: it would publish a
 * user's social links to a page they were never told exists. So the copy is
 * part of the feature, not decoration, and is asserted here alongside the
 * behaviour.
 *
 * Three properties, matching the task: the toggle round-trips into the PATCH
 * body under `settings` (never rejected as an unknown key), it defaults to OFF
 * for a user with no stored value, and the consent copy is actually rendered.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { ProfileEditUser } from '../../../src/components/account/ProfileEditForm.client';
import { ProfileEditForm } from '../../../src/components/account/ProfileEditForm.client';

// ─── Module mocks (mirrors ProfileEditForm.test.tsx) ─────────────────────────

vi.mock('../../../src/components/account/ProfileEditForm.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('../../../src/lib/i18n', () => {
    const t = (key: string, fallback?: string): string => fallback ?? key;
    const translations = { t } as const;
    return { createTranslations: () => translations };
});

vi.mock('../../../src/lib/avatar-utils', () => ({
    getInitials: ({ name }: { name?: string | null }) =>
        name ? (name[0]?.toUpperCase() ?? '?') : '?'
}));

vi.mock('../../../src/store/toast-store', () => ({
    addToast: vi.fn()
}));

vi.mock('@repo/schemas', async () => {
    // Deliberately STRICT, mirroring the real `ProfileEditSchema`. That is the
    // point: the toggle must never reach the flat validation map, because a
    // strict schema rejects a key it does not declare.
    const nameField = z.union([z.literal(''), z.string().min(1).max(100)]).optional();
    const ProfileEditSchema = z.strictObject({
        displayName: nameField,
        firstName: nameField,
        lastName: nameField,
        bio: z.string().max(1000).optional(),
        avatarUrl: z.union([z.literal(''), z.string().url()]).optional(),
        phone: z.union([z.literal(''), z.string().regex(/^\+\d{1,3}\d{4,14}$/)]).optional()
    });
    return { ProfileEditSchema };
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_USER: ProfileEditUser = {
    id: 'user-1',
    displayName: 'María García',
    firstName: 'María',
    lastName: 'García',
    avatarUrl: null,
    profile: { bio: 'Viajera apasionada.' },
    instagramUrl: 'https://instagram.com/maria'
};

function renderForm(user: ProfileEditUser = BASE_USER) {
    return render(
        <ProfileEditForm
            initialUser={user}
            locale="es"
            apiUrl="http://localhost:3001"
        />
    );
}

const toggle = () => document.getElementById('publicProfileShowSocialNetworks') as HTMLInputElement;

/** Body of the single PATCH the mocked fetch received. */
function patchBody(): Record<string, unknown> {
    const call = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    return JSON.parse((call[1] as RequestInit).body as string) as Record<string, unknown>;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ProfileEditForm — social opt-in (HOS-375 G-5)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        globalThis.fetch = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ success: true, data: {} }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            })
        );
    });

    it('renders the toggle', () => {
        renderForm();
        expect(toggle()).toBeInTheDocument();
        expect(toggle().type).toBe('checkbox');
    });

    it('defaults to OFF for a user who has never stored a value', () => {
        // The whole point of an opt-in. A user who never answered must not be
        // treated as having said yes.
        renderForm();
        expect(toggle().checked).toBe(false);
    });

    it('defaults to OFF when the stored value is explicitly null', () => {
        // Drizzle returns `null` for an empty `settings` JSONB, so this is the
        // shape a real never-configured account arrives in.
        renderForm({ ...BASE_USER, publicProfileShowSocialNetworks: null });
        expect(toggle().checked).toBe(false);
    });

    it('reflects a stored opt-in as ON', () => {
        // Non-vacuity for the two defaults above: if the prop were ignored
        // entirely they would pass and this would not.
        renderForm({ ...BASE_USER, publicProfileShowSocialNetworks: true });
        expect(toggle().checked).toBe(true);
    });

    it('renders consent copy naming the page, its visibility, and what appears on it', () => {
        // The three facts a user needs in order to consent. Asserted as
        // separate substrings rather than the whole sentence so a copy rewrite
        // does not fail the test unless it drops one of them.
        renderForm();
        const help = document.getElementById('publicProfileShowSocialNetworks-help');

        expect(help).toBeInTheDocument();
        expect(help?.textContent).toContain('página de autor');
        expect(help?.textContent).toContain('visible para cualquiera');
        expect(help?.textContent).toContain('los enlaces de arriba se muestran ahí');
    });

    it('describes the toggle with the consent copy for screen readers', () => {
        renderForm();
        expect(toggle().getAttribute('aria-describedby')).toBe(
            'publicProfileShowSocialNetworks-help'
        );
    });

    it('sends the opt-in under settings when turned on', async () => {
        renderForm();
        fireEvent.click(toggle());
        fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

        await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

        expect(patchBody().settings).toEqual({ publicProfileShowSocialNetworks: true });
    });

    it('sends the opt-OUT too, so consent can actually be withdrawn', async () => {
        // A patch builder that only emitted the `true` case would leave the
        // user unable to take the links down again.
        renderForm({ ...BASE_USER, publicProfileShowSocialNetworks: true });
        fireEvent.click(toggle());
        fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

        await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

        expect(patchBody().settings).toEqual({ publicProfileShowSocialNetworks: false });
    });

    it('does not leak the toggle into the profile fields it is not part of', async () => {
        // It is a SETTING, not a social link. Sending it inside
        // `socialNetworks` (or flat at the top level) would be rejected by the
        // strict web-scoped settings allowlist on the API.
        renderForm();
        fireEvent.click(toggle());
        fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

        await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

        const body = patchBody();
        expect(body).not.toHaveProperty('publicProfileShowSocialNetworks');
        expect(body.socialNetworks ?? {}).not.toHaveProperty('publicProfileShowSocialNetworks');
    });

    it('treats flipping the toggle alone as a real change worth saving', async () => {
        // The form short-circuits an empty diff with a "no changes" toast and
        // never calls the API. If the toggle did not reach the payload, turning
        // it on and saving would silently do nothing.
        renderForm();
        fireEvent.click(toggle());
        fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

        await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
    });

    it('omits settings entirely when the toggle was not touched', async () => {
        // An untouched preference must not be rewritten on every unrelated
        // save — that would overwrite a value changed elsewhere.
        renderForm();
        fireEvent.change(screen.getByLabelText(/nombre visible/i), {
            target: { value: 'María G.' }
        });
        fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

        await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

        expect(patchBody()).not.toHaveProperty('settings');
    });
});
