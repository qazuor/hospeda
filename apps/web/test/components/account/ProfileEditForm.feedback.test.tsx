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

vi.mock('../../../src/lib/i18n', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/lib/i18n')>();
    const { tFromCatalog } = await import('../../helpers/i18n-catalog');
    const translations = { t: tFromCatalog } as const;
    return { ...actual, createTranslations: () => translations };
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
    fireEvent.change(document.getElementById(`profile-${id}`) as HTMLInputElement, {
        target: { value }
    });
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
            expect(document.getElementById('profile-website-error')).toBeInTheDocument();
            expect(document.getElementById('profile-facebookUrl-error')).toBeInTheDocument();
        });
        // `website` sits above the social networks in the document.
        expect(document.activeElement).toBe(document.getElementById('profile-website'));
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

    it('retires the saved confirmation as soon as the user edits again', async () => {
        renderForm();
        setValue('occupation', 'Guía de turismo');
        save();
        expect(await screen.findByText(/cambios guardados/i)).toBeInTheDocument();

        setValue('occupation', 'Guía de turismo y fotógrafa');

        await waitFor(() =>
            expect(screen.queryByText(/cambios guardados/i)).not.toBeInTheDocument()
        );
        expect(screen.getByText(/cambios sin guardar/i)).toBeInTheDocument();
    });

    it('confirms the save on the bar, next to the button', async () => {
        renderForm();
        setValue('occupation', 'Guía de turismo');
        save();

        const status = await screen.findByText(/cambios guardados/i);
        expect(status.closest('[role="status"]')).not.toBeNull();
        expect(status.closest('[aria-label]')?.getAttribute('data-status')).toBe('saved');
    });
});
