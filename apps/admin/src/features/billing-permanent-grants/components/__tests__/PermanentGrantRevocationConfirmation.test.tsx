// @vitest-environment jsdom
import es from '@repo/i18n/locales/es/admin-billing.json';
import { type PermanentGrantRevocationPreviewResponse, VerticalEnum } from '@repo/schemas';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermanentGrantRevocationConfirmation } from '../PermanentGrantRevocationConfirmation';

function translate(key: string, params?: Record<string, unknown>) {
    let node: unknown = es;
    for (const part of key.replace('admin-billing.', '').split('.'))
        node =
            typeof node === 'object' && node ? (node as Record<string, unknown>)[part] : undefined;
    if (typeof node !== 'string') return key;
    return Object.entries(params ?? {}).reduce(
        (value, [name, replacement]) =>
            value
                .replaceAll(`{{${name}}}`, String(replacement))
                .replaceAll(`{${name}}`, String(replacement)),
        node
    );
}
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: translate, locale: 'es' })
}));
const mutateAsync = vi.fn();
vi.mock('../../hooks/usePermanentGrants', () => ({
    usePermanentGrantRevocation: () => ({ mutateAsync, isPending: false })
}));
const preview: PermanentGrantRevocationPreviewResponse = {
    permanentGrantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    verticalsLosingService: [VerticalEnum.ACCOMMODATION],
    addonsTurnedOff: [
        { addonInstanceId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', addonName: 'Extra A' }
    ],
    trialReturns: false,
    oldDebitResumes: false
};
const userId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const onCompleted = vi.fn();
beforeEach(() => {
    vi.clearAllMocks();
    mutateAsync.mockResolvedValue({ revokedAt: '2026-10-12T15:00:00.000Z' });
});

describe('AC:B13a:6 — revocation confirmation (support for TEST:B13a:5)', () => {
    it('blocks empty and whitespace reasons, then posts the trimmed reason', async () => {
        const user = userEvent.setup();
        render(
            <PermanentGrantRevocationConfirmation
                preview={preview}
                userId={userId}
                onBack={() => undefined}
                onCompleted={onCompleted}
            />
        );
        const submit = screen.getByTestId('permanent-grant-revocation-submit');
        const reason = screen.getByTestId('permanent-grant-revocation-reason');
        expect(submit).toBeDisabled();
        await user.type(reason, '   ');
        expect(submit).toBeDisabled();
        await user.type(reason, '  pedido del cliente  ');
        expect(submit).toBeEnabled();
        await user.click(submit);
        expect(mutateAsync).toHaveBeenCalledWith({
            permanentGrantId: preview.permanentGrantId,
            userId,
            reason: 'pedido del cliente'
        });
    });

    it('says service ends, add-ons do not return, trial does not return and the old debit does not resume', () => {
        const confirm = vi.spyOn(window, 'confirm');
        render(
            <PermanentGrantRevocationConfirmation
                preview={preview}
                userId={userId}
                onBack={() => undefined}
                onCompleted={onCompleted}
            />
        );
        expect(screen.getByTestId('permanent-grant-revocation-confirmation')).toHaveTextContent(
            'sin servicio'
        );
        expect(screen.getByTestId('permanent-grant-addons-turned-off')).toHaveTextContent(
            'no vuelve solo'
        );
        expect(document.body).toHaveTextContent('trial no vuelve');
        expect(document.body).toHaveTextContent('débito viejo no se reanuda');
        expect(document.body.textContent).not.toMatch(/¿estás seguro\?/i);
        expect(confirm).not.toHaveBeenCalled();
        confirm.mockRestore();
    });

    it('names an empty add-on list', () => {
        render(
            <PermanentGrantRevocationConfirmation
                preview={{ ...preview, addonsTurnedOff: [] }}
                userId={userId}
                onBack={() => undefined}
                onCompleted={onCompleted}
            />
        );
        expect(screen.getByTestId('permanent-grant-addons-turned-off')).toHaveTextContent(
            'Sin complementos que apagar'
        );
    });
});
