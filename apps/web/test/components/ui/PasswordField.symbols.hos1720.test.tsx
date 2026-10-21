import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PasswordField } from '../../../src/components/ui/PasswordField.client';

const i18n = {
    showPassword: 'Mostrar contraseña',
    hidePassword: 'Ocultar contraseña',
    strength: { weak: 'Débil', medium: 'Media', strong: 'Fuerte' },
    rules: {
        length: 'Al menos 8 caracteres',
        upper: 'Una letra mayúscula (A-Z)',
        lower: 'Una letra minúscula (a-z)',
        digit: 'Un número (0-9)',
        special: 'Un carácter especial (por ejemplo ! @ # $ - _)'
    }
};
function renderValue(value: string) {
    return render(
        <PasswordField
            id="pw"
            label="Contraseña"
            value={value}
            onChange={() => undefined}
            showStrength
            showRuleChecklist
            i18n={i18n}
        />
    );
}
describe('TEST:1720:2 PasswordField symbols', () => {
    it('marks the smoke password special rule and strength strong', () => {
        renderValue('Abcdef1234-ghijklm!xy');
        expect(screen.getByText(/Un carácter especial/)).toHaveTextContent('✅');
        expect(screen.getByRole('status')).toHaveTextContent('Fuerte');
    });
    it('counts a hyphen as an ASCII special character on its own', () => {
        renderValue('Abcdef1234-ghijklm');
        expect(screen.getByText(/Un carácter especial/)).toHaveTextContent('✅');
        expect(screen.getByRole('status')).toHaveTextContent('Fuerte');
    });
    it('uses the shared ASCII symbol rule in non-strong strength scoring', () => {
        renderValue('abc12345-');
        expect(screen.getByRole('status')).toHaveTextContent('Media');
    });
    it.each([
        'Abcdef1234ghijklm',
        'Abcdef1234 ñ'
    ])('does not call a symbol-less password strong: %s', (value) => {
        renderValue(value);
        expect(screen.getByText(/Un carácter especial/)).toHaveTextContent('⬜');
        expect(screen.getByRole('status')).not.toHaveTextContent('Fuerte');
    });
});
