/**
 * @file ProfileEditForm.kit.test.tsx
 * @description HOS-2478: the edit-profile form on the account kit. Pins the
 * explicit-save bar (D8), the leave warning through the shared guard, the
 * per-field error for an invalid URL (HOS-2444 behaviour) with the bar's
 * «Ir al primer error», and the security link for both kinds of account.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileEditForm } from '../../../src/components/account/ProfileEditForm.client';

vi.mock('../../../src/components/account/ProfileEditForm.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_target, prop) => String(prop) })
}));

vi.mock('../../../src/lib/i18n', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/lib/i18n')>();
    const { tFromCatalog } = await import('../../helpers/i18n-catalog');
    return { ...actual, createTranslations: () => ({ t: tFromCatalog }) };
});

vi.mock('../../../src/lib/avatar-utils', () => ({ getInitials: () => 'U' }));

const USER = { id: 'user-1', displayName: 'Ana', firstName: 'Ana', lastName: 'Gómez' } as const;

function renderForm({ hasPassword }: { readonly hasPassword?: boolean } = {}) {
    return render(
        <ProfileEditForm
            initialUser={USER}
            locale="es"
            apiUrl="http://localhost:3001"
            hasPassword={hasPassword}
        />
    );
}

function edit(name: string, value: string): void {
    fireEvent.change(document.getElementById(`profile-${name}`) as HTMLInputElement, {
        target: { value }
    });
}

describe('ProfileEditForm on the account kit (HOS-2478)', () => {
    beforeEach(() => {
        globalThis.fetch = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ success: true, data: {} }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            })
        );
    });

    it('saves from the bar and confirms on it', async () => {
        renderForm();
        edit('occupation', 'Guía');
        fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

        await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
        expect(await screen.findByText(/cambios guardados/i)).toBeInTheDocument();
    });

    it('saves with Ctrl+S while there are edits', async () => {
        renderForm();
        edit('occupation', 'Guía');
        fireEvent.keyDown(document, { key: 's', ctrlKey: true });

        await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
    });

    it('warns before leaving only while there are unsaved edits', () => {
        renderForm();
        const pristine = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(pristine);
        expect(pristine.defaultPrevented).toBe(false);

        edit('occupation', 'Guía');
        const dirty = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(dirty);
        expect(dirty.defaultPrevented).toBe(true);
    });

    it('puts the error of an invalid URL on its own field and never PATCHes', async () => {
        renderForm();
        edit('facebookUrl', 'no-es-una-url');
        fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

        await waitFor(() =>
            expect(document.getElementById('profile-facebookUrl-error')).toBeInTheDocument()
        );
        const input = document.getElementById('profile-facebookUrl') as HTMLInputElement;
        expect(input.getAttribute('aria-invalid')).toBe('true');
        expect(input.getAttribute('aria-describedby')).toContain('profile-facebookUrl-error');
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('«Ir al primer error» focuses the first invalid field', async () => {
        renderForm();
        edit('facebookUrl', 'no-es-una-url');
        fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));
        await screen.findByRole('button', { name: /ir al primer error/i });
        (document.getElementById('profile-occupation') as HTMLInputElement).focus();

        fireEvent.click(screen.getByRole('button', { name: /ir al primer error/i }));

        expect(document.activeElement).toBe(document.getElementById('profile-facebookUrl'));
    });

    it('links the security section to change-password for an account with a password', () => {
        renderForm({ hasPassword: true });
        const link = screen.getByRole('link', { name: /cambiar contraseña/i });
        expect(link.getAttribute('href')).toMatch(
            /^\/es\/mi-cuenta\/cambiar-contrasena\/\?returnUrl=/
        );
    });

    it('links to add-password for an account without one', () => {
        renderForm({ hasPassword: false });
        const link = screen.getByRole('link', { name: /agregar contraseña/i });
        expect(link.getAttribute('href')).toMatch(
            /^\/es\/mi-cuenta\/agregar-contrasena\/\?returnUrl=/
        );
    });

    it('mixes no auto-save into the page (D8): no chip, saving is explicit', () => {
        renderForm();
        edit('occupation', 'Guía');
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });
});
