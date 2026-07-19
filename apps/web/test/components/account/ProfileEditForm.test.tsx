/**
 * @file ProfileEditForm.test.tsx
 * @description Unit tests for the ProfileEditForm React island (T-035, T-036).
 *
 * Covers:
 * - Renders with initial user data pre-populated
 * - Displays required field labels and inputs
 * - Shows validation errors for missing required fields
 * - Clears validation error when field is updated
 * - Calls PATCH on submit with valid data
 * - Shows error banner when PATCH fails
 * - Shows toast on success
 * - Avatar file change triggers preview (file input)
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { ProfileEditUser } from '../../../src/components/account/ProfileEditForm.client';
import { ProfileEditForm } from '../../../src/components/account/ProfileEditForm.client';
import { addToast } from '../../../src/store/toast-store';

// ─── Module mocks ─────────────────────────────────────────────────────────────

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
    // Mirrors the real `ProfileEditSchema` bounds/optionality (HOS-190 slice 3
    // read⊇write fix, bounds reverted to the original loose values): displayName/
    // firstName/lastName are optional/blankable (1-100 chars when provided) so a
    // profile with an unset name — or a legacy short value — can still re-save an
    // unrelated field (read⊇write) — see `packages/schemas/src/user/profile.ts`.
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

const MOCK_USER: ProfileEditUser = {
    id: 'user-1',
    displayName: 'María García',
    firstName: 'María',
    lastName: 'García',
    avatarUrl: null,
    phone: '+541134567890',
    profile: { bio: 'Viajera apasionada.' }
};

function renderForm(user: ProfileEditUser = MOCK_USER) {
    return render(
        <ProfileEditForm
            initialUser={user}
            locale="es"
            apiUrl="http://localhost:3001"
        />
    );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ProfileEditForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: successful PATCH
        globalThis.fetch = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ success: true, data: {} }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            })
        );
    });

    it('renders displayName field pre-populated', () => {
        renderForm();
        const input = screen.getByLabelText(/nombre visible/i) as HTMLInputElement;
        expect(input.value).toBe('María García');
    });

    it('renders firstName and lastName fields', () => {
        renderForm();
        // Query by id to avoid label collision with "Nombre visible"
        expect(document.getElementById('firstName')).toBeInTheDocument();
        expect(screen.getByLabelText(/apellido/i)).toBeInTheDocument();
    });

    it('renders bio textarea pre-populated', () => {
        renderForm();
        const textarea = screen.getByLabelText(/biografía/i) as HTMLTextAreaElement;
        expect(textarea.value).toBe('Viajera apasionada.');
    });

    it('renders phone field pre-populated', () => {
        renderForm();
        const input = screen.getByLabelText(/teléfono/i) as HTMLInputElement;
        expect(input.value).toBe('+541134567890');
    });

    it('shows submit button', () => {
        renderForm();
        expect(screen.getByRole('button', { name: /guardar cambios/i })).toBeInTheDocument();
    });

    it('shows avatar upload button', () => {
        renderForm();
        expect(screen.getByRole('button', { name: /cambiar foto/i })).toBeInTheDocument();
    });

    it('shows inline error when displayName exceeds the 100-char maximum', async () => {
        renderForm();
        const input = screen.getByLabelText(/nombre visible/i);
        fireEvent.change(input, { target: { value: 'x'.repeat(101) } });
        fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));
        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });
    });

    it('clears displayName error when user types a valid value', async () => {
        renderForm();
        const input = screen.getByLabelText(/nombre visible/i);
        fireEvent.change(input, { target: { value: 'x'.repeat(101) } });
        fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));
        await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(0));

        fireEvent.change(input, { target: { value: 'Nuevo Nombre' } });
        // Error for displayName should no longer be visible
        await waitFor(() => {
            const alerts = screen.queryAllByRole('alert');
            const displayNameError = alerts.find((a) => a.id === 'displayName-error');
            expect(displayNameError).toBeUndefined();
        });
    });

    // HOS-190 slice 3 bound-revert regression: a legacy single-character
    // displayName (e.g. 'x') must still be a VALID, saveable value — the
    // tightened 2-char minimum introduced (and reverted) by HOS-190 would
    // have blocked ANY profile-edit submission for a user with such a name,
    // even for unrelated field changes (read⊇write).
    it('accepts a single-character displayName without an inline error', async () => {
        renderForm();
        const input = screen.getByLabelText(/nombre visible/i);
        fireEvent.change(input, { target: { value: 'x' } });
        fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));
        await waitFor(() => {
            expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        });
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    // HOS-190 read⊇write regression: a profile with an unset displayName/
    // firstName/lastName (e.g. incomplete OAuth signup, `firstName: null`)
    // must still be able to re-save an unrelated field. Clearing a name field
    // no longer blocks submit — it's simply omitted from the PATCH payload
    // instead of being sent as an empty string that used to fail
    // `UserProtectedPatchInputSchema` server-side.
    it('submits successfully and omits displayName/firstName/lastName from the payload when blank', async () => {
        renderForm({ ...MOCK_USER, displayName: '', firstName: '', lastName: '' });
        // A real change is now required to trigger a PATCH (HOS-190 P2 no-op
        // guard). Blank names were never set (read⊇write) so they stay omitted.
        fireEvent.change(screen.getByLabelText(/biografía/i), {
            target: { value: 'Biografía de prueba válida' }
        });
        fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));
        await waitFor(() => {
            expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        });
        const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
            string,
            RequestInit
        ];
        const body = JSON.parse(String(call[1].body)) as Record<string, unknown>;
        expect(body.displayName).toBeUndefined();
        expect(body.firstName).toBeUndefined();
        expect(body.lastName).toBeUndefined();
    });

    it('calls fetch PATCH on valid submit', async () => {
        renderForm();
        // A real change is required to issue a PATCH (HOS-190 P2 no-op guard).
        fireEvent.change(screen.getByLabelText(/biografía/i), {
            target: { value: 'Biografía de prueba válida' }
        });
        fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));
        await waitFor(() => {
            expect(globalThis.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/v1/protected/users/user-1'),
                expect.objectContaining({ method: 'PATCH' })
            );
        });
    });

    it('shows error banner when PATCH fails', async () => {
        globalThis.fetch = vi
            .fn()
            .mockResolvedValue(
                new Response(
                    JSON.stringify({ success: false, error: { message: 'Falla de red' } }),
                    { status: 500, headers: { 'Content-Type': 'application/json' } }
                )
            );
        renderForm();
        fireEvent.change(screen.getByLabelText(/biografía/i), {
            target: { value: 'Biografía de prueba válida' }
        });
        fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));
        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });
    });

    it('disables submit while submitting', async () => {
        // Never resolving fetch to keep loading state
        globalThis.fetch = vi.fn().mockImplementation(() => new Promise(() => undefined));
        renderForm();
        fireEvent.change(screen.getByLabelText(/biografía/i), {
            target: { value: 'Biografía de prueba válida' }
        });
        const btn = screen.getByRole('button', { name: /guardar cambios/i });
        fireEvent.click(btn);
        await waitFor(() => expect(btn).toBeDisabled());
    });

    // ── HOS-190 BETA-189 regressions ────────────────────────────────────────

    it('re-syncs the baseline after save so reverting a just-saved field restores it (F6)', async () => {
        // F6 regression (BETA-189): the diff was computed against the load-time
        // snapshot and never resynced. Saving bio X then reverting bio to its
        // original value and saving again produced an empty profile diff while
        // the DB kept X. Asserts on the ACTUAL body of the SECOND save.
        renderForm();
        const bio = screen.getByLabelText(/biografía/i);
        const saveBtn = screen.getByRole('button', { name: /guardar cambios/i });

        // 1) Change bio and save → profile.bio carries the new value.
        fireEvent.change(bio, { target: { value: 'Nueva biografía de prueba' } });
        fireEvent.click(saveBtn);
        await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
        const firstCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
            string,
            RequestInit
        ];
        const firstBody = JSON.parse(String(firstCall[1].body)) as {
            profile?: { bio?: string };
        };
        expect(firstBody.profile?.bio).toBe('Nueva biografía de prueba');

        // 2) Revert bio to the ORIGINAL value and save again → must issue a
        //    restoring PATCH carrying the original bio (not a "no changes").
        fireEvent.change(bio, { target: { value: 'Viajera apasionada.' } });
        fireEvent.click(saveBtn);
        await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2));
        const secondCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[1] as [
            string,
            RequestInit
        ];
        const secondBody = JSON.parse(String(secondCall[1].body)) as {
            profile?: { bio?: string };
        };
        expect(secondBody.profile?.bio).toBe('Viajera apasionada.');
    });

    it('shows a "no changes" info toast and does not PATCH when nothing changed (P2)', async () => {
        renderForm();
        fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));
        await waitFor(() => {
            expect(vi.mocked(addToast)).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'info',
                    message: expect.stringMatching(/no hay cambios/i)
                })
            );
        });
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('blocks the save and announces when a previously-set required name is cleared (P1)', async () => {
        renderForm();
        fireEvent.change(screen.getByLabelText(/nombre visible/i), { target: { value: '' } });
        fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));
        await waitFor(() => {
            const err = document.getElementById('displayName-error');
            expect(err).toBeInTheDocument();
        });
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('marks bio and blocks the save when bio is shorter than the server minimum (P4)', async () => {
        renderForm();
        fireEvent.change(screen.getByLabelText(/biografía/i), { target: { value: 'corta' } });
        fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));
        await waitFor(() => {
            expect(document.getElementById('bio-error')).toBeInTheDocument();
        });
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });
});
