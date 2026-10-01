/**
 * HOS-992: `useTranslations()` follows an ambient LocaleProvider, an explicit
 * argument still wins, and with no provider nothing changes.
 */

import { LocaleProvider, useTranslations } from '@repo/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

function Probe({ explicit }: { readonly explicit?: string }) {
    const { locale } = useTranslations(explicit);
    return <p data-testid="locale">{locale}</p>;
}

describe('LocaleProvider', () => {
    it('is followed by an argument-less useTranslations()', () => {
        render(
            <LocaleProvider locale="pt">
                <Probe />
            </LocaleProvider>
        );
        expect(screen.getByTestId('locale').textContent).toBe('pt');
    });

    it('is overridden by an explicit locale argument', () => {
        render(
            <LocaleProvider locale="pt">
                <Probe explicit="en" />
            </LocaleProvider>
        );
        expect(screen.getByTestId('locale').textContent).toBe('en');
    });

    it('leaves the default locale in place when no provider is mounted', () => {
        render(<Probe />);
        expect(screen.getByTestId('locale').textContent).toBe('es');
    });
});
