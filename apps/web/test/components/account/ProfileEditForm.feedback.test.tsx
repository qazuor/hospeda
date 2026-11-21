/**
 * @file ProfileEditForm.feedback.test.tsx
 * @description Regression for HOS-2444. With invalid URLs the form only raised a
 * generic toast: no field received focus, the previous toast stayed stacked
 * under the new one, and a successful save showed nothing near the button.
 *
 * Uses the REAL `ProfileEditSchema` and the REAL toast store.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    ProfileEditForm,
    type ProfileEditUser
} from '../../../src/components/account/ProfileEditForm.client';
import { addToast, clearToasts, getToasts } from '../../../src/store/toast-store';

vi.mock('../../../src/components/account/ProfileEditForm.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('../../../src/lib/i18n', async () => {
    const { tFromCatalog } = await import('../../helpers/i18n-catalog');
    const translations = { t: tFromCatalog } as const;
    return { createTranslations: () => translations };
});

vi.mock('../../../src/lib/avatar-utils', () => ({
    getInitials: () => 'J'
}));

const USER: ProfileEditUser = {
    id: 'user-1',
    displayName: 'Juan Pérez',
    firstName: 'Juan',
    lastName: 'Pérez',
    avatarUrl: null,
    phone: null,
    profile: { bio: 'Hola mundo desde Hospeda' }
};

function renderForm() {
    return render(
        <ProfileEditForm
            initialUser={USER}
            locale="es"
            apiUrl="http://localhost:3001"
        />
    );
}

function setValue(id: string, value: string): void {
    fireEvent.change(document.getElementById(id) as HTMLInputElement, { target: { value } });
}

function save(): void {
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));
}

describe('ProfileEditForm feedback (HOS-2444)', () => {
    beforeEach(() => {
        clearToasts();
        globalThis.fetch = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ success: true, data: {} }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            })
        );
    });

    it('marks each invalid URL field and focuses the first one on the page', async () => {
        renderForm();
        setValue('facebookUrl', 'no-es-una-url');
        setValue('website', 'tampoco');
        save();

        await waitFor(() => {
            expect(document.getElementById('website-error')).toBeInTheDocument();
            expect(document.getElementById('facebookUrl-error')).toBeInTheDocument();
        });
        // `website` sits above the social networks in the document.
        expect(document.activeElement).toBe(document.getElementById('website'));
    });

    it('replaces the previous toast instead of stacking a new one on top', async () => {
        renderForm();
        setValue('website', 'tampoco');
        save();
        await waitFor(() => expect(getToasts().map((x) => x.type)).toEqual(['error']));

        setValue('website', 'https://hospeda.com.ar');
        save();

        await waitFor(() => expect(getToasts().map((x) => x.type)).toEqual(['success']));
    });

    it('dismisses only its own toasts, so other islands keep theirs', async () => {
        addToast({ type: 'info', message: 'toast de otra isla', duration: 0 });
        renderForm();
        setValue('website', 'tampoco');
        save();
        await waitFor(() => expect(getToasts().map((x) => x.type)).toContain('error'));

        setValue('website', 'https://hospeda.com.ar');
        save();

        await waitFor(() => expect(getToasts().map((x) => x.type)).toContain('success'));
        const types = getToasts().map((x) => x.type);
        expect(types).toContain('info');
        expect(types).not.toContain('error');
    });

    it('focuses the field inside the form even when another element shares the id', async () => {
        const decoy = document.createElement('input');
        decoy.id = 'website';
        document.body.prepend(decoy);
        const { container } = renderForm();
        // `setValue` resolves by document id, which would now hit the decoy.
        fireEvent.change(container.querySelector('form #website') as HTMLInputElement, {
            target: { value: 'tampoco' }
        });
        save();

        await waitFor(() => expect(document.getElementById('website-error')).toBeInTheDocument());
        expect(document.activeElement).not.toBe(decoy);
        expect(document.activeElement?.closest('form')).not.toBeNull();
        decoy.remove();
    });

    it('retires the inline success as soon as the user edits again', async () => {
        renderForm();
        setValue('occupation', 'Guía de turismo');
        save();
        await screen.findByRole('status');

        setValue('occupation', 'Guía de turismo y fotógrafa');

        await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    });

    it('shows the success next to the save button, in context', async () => {
        renderForm();
        setValue('occupation', 'Guía de turismo');
        save();

        const status = await screen.findByRole('status');
        expect(status).toHaveTextContent(/perfil actualizado/i);
    });
});
