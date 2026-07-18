/**
 * @file ContactForm.error-messages.test.tsx
 * @description Regression suite for HOS-190 BETA-190 — the ContactForm firstName
 * field used to render the RAW i18n key (`zodError.contact.firstName.min`) or a
 * spanglish string instead of a human Spanish message.
 *
 * Unlike ContactForm.test.tsx, this suite does NOT mock `@/lib/i18n`: it renders
 * with the REAL translations (seeded by test/setup.ts) so the assertion is on the
 * ACTUAL string the user sees, resolved through the real
 * `zodIssuesToFieldErrors` → `resolveValidationMessage` → `validation.json`
 * pipeline. A green test that only checks a handler ran is not enough here.
 */

import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContactForm } from '../../src/components/ContactForm.client';

/** Any leftover i18n key (either the schema key or the resolved-but-missing key). */
const RAW_KEY_RE = /^(zodError|validation)\./;

function setValue(name: string, value: string): void {
    const el = document.querySelector(`[name="${name}"]`) as
        | HTMLInputElement
        | HTMLTextAreaElement
        | null;
    if (!el) throw new Error(`field [name="${name}"] not found`);
    fireEvent.change(el, { target: { value } });
}

describe('ContactForm — human validation messages (HOS-190 BETA-190)', () => {
    beforeEach(() => {
        global.fetch = vi.fn();
    });

    it('renders the firstName error as human Spanish, not a raw zodError.* key', async () => {
        render(<ContactForm locale="es" />);

        // Fill every field except firstName so ONLY firstName fails validation.
        setValue('lastName', 'López');
        setValue('email', 'ana@example.com');
        setValue('message', 'Consulta con longitud suficiente para pasar la validación.');

        const submit = document.querySelector('button[type="submit"]') as HTMLButtonElement;
        fireEvent.click(submit);

        await waitFor(() => {
            const err = document.getElementById('cf-firstName-error');
            expect(err).not.toBeNull();
            expect(err?.textContent ?? '').toBe('El nombre es obligatorio');
        });

        const err = document.getElementById('cf-firstName-error');
        expect(err?.textContent ?? '').not.toMatch(/^zodError\./);
        expect(err?.textContent ?? '').not.toMatch(RAW_KEY_RE);
        // No spanglish leak: the old value was "El first name ...".
        expect(err?.textContent ?? '').not.toContain('first name');
    });

    it('does not call fetch while the form is invalid', () => {
        render(<ContactForm locale="es" />);
        const submit = document.querySelector('button[type="submit"]') as HTMLButtonElement;
        fireEvent.click(submit);
        expect(global.fetch).not.toHaveBeenCalled();
    });
});
