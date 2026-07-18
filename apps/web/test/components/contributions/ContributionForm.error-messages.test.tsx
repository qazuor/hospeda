/**
 * @file ContributionForm.error-messages.test.tsx
 * @description Regression suite for HOS-190 BETA-190 — the ContributionForm
 * (ContactForm's clone) name field must render a human Spanish message, not a
 * raw i18n key or spanglish.
 *
 * Renders with the REAL translations (no `@/lib/i18n` mock) so the assertion is
 * on the actual string the user sees.
 */

import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContributionForm } from '../../../src/components/contributions/ContributionForm.client';

// PostHog is only hit on success; mock it so the module has no side effects.
vi.mock('../../../src/lib/analytics/posthog-client', () => ({
    trackEvent: vi.fn()
}));

function setValue(name: string, value: string): void {
    const el = document.querySelector(`[name="${name}"]`) as
        | HTMLInputElement
        | HTMLTextAreaElement
        | null;
    if (!el) throw new Error(`field [name="${name}"] not found`);
    fireEvent.change(el, { target: { value } });
}

describe('ContributionForm — human validation messages (HOS-190 BETA-190)', () => {
    beforeEach(() => {
        global.fetch = vi.fn();
    });

    it('renders the firstName error as human Spanish, not a raw zodError.* key', async () => {
        render(
            <ContributionForm
                presetType="photo_submission"
                locale="es"
            />
        );

        setValue('lastName', 'López');
        setValue('email', 'ana@example.com');
        setValue('message', 'Aporte con longitud suficiente para pasar la validación.');

        const submit = document.querySelector('button[type="submit"]') as HTMLButtonElement;
        fireEvent.click(submit);

        await waitFor(() => {
            const err = document.getElementById('contrib-firstName-error');
            expect(err).not.toBeNull();
            expect(err?.textContent ?? '').toBe('El nombre es obligatorio');
        });

        const err = document.getElementById('contrib-firstName-error');
        expect(err?.textContent ?? '').not.toMatch(/^zodError\./);
        expect(err?.textContent ?? '').not.toContain('first name');
    });
});
