import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SetPassword } from '../../../src/components/account/SetPassword.client';

vi.mock('../../../src/components/account/SetPassword.module.css', () => ({
    default: new Proxy({}, { get: (_target, key) => String(key) })
}));
vi.mock('../../../src/components/shared/ui/Dialog.module.css', () => ({
    default: new Proxy({}, { get: (_target, key) => String(key) })
}));
vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key })
}));
vi.mock('../../../src/components/shared/ui/Dialog.client', () => ({
    Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));
const fetchMock = vi.fn();
describe('TEST:1720:4 SetPassword shared schema', () => {
    beforeEach(() => {
        fetchMock.mockReset();
        fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
        vi.stubGlobal('fetch', fetchMock);
    });
    it('sends the smoke password to set-password API', async () => {
        render(
            <SetPassword
                locale="es"
                apiUrl="http://api.test"
                returnUrl="/account"
            />
        );
        fireEvent.change(document.getElementById('sp-password') as HTMLInputElement, {
            target: { value: 'Abcdef1234-ghijklm!xy' }
        });
        fireEvent.change(document.getElementById('sp-confirm-password') as HTMLInputElement, {
            target: { value: 'Abcdef1234-ghijklm!xy' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Establecer contraseña' }));
        await waitFor(() =>
            expect(fetchMock).toHaveBeenCalledWith(
                'http://api.test/api/v1/protected/profile/set-password',
                expect.objectContaining({
                    body: JSON.stringify({ password: 'Abcdef1234-ghijklm!xy' })
                })
            )
        );
    });
    it('rejects without an ASCII symbol before network', () => {
        render(
            <SetPassword
                locale="es"
                apiUrl="http://api.test"
                returnUrl="/account"
            />
        );
        fireEvent.change(document.getElementById('sp-password') as HTMLInputElement, {
            target: { value: 'Abcdef1234 ñ' }
        });
        fireEvent.change(document.getElementById('sp-confirm-password') as HTMLInputElement, {
            target: { value: 'Abcdef1234 ñ' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Establecer contraseña' }));
        expect(fetchMock).not.toHaveBeenCalled();
        expect(screen.getByRole('alert')).toHaveTextContent(
            'La contraseña debe tener mayúsculas, minúsculas, un número y un carácter especial (por ejemplo ! @ # $ - _).'
        );
    });
});
