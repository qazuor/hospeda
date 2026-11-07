// @vitest-environment jsdom

import en from '@repo/i18n/locales/en/admin-billing.json';
import es from '@repo/i18n/locales/es/admin-billing.json';
import pt from '@repo/i18n/locales/pt/admin-billing.json';
import { type PermanentGrantPreviewResponse, VerticalEnum } from '@repo/schemas';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermanentGrantConfirmation } from '../PermanentGrantConfirmation';

let currentLocale: 'es' | 'en' | 'pt' = 'es';
function translate(key: string, params?: Record<string, unknown>) {
    let node: unknown = { es, en, pt }[currentLocale];
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
    useTranslations: () => ({ t: translate, locale: currentLocale })
}));
beforeEach(() => {
    currentLocale = 'es';
});

const empty: PermanentGrantPreviewResponse = {
    stoppedCharges: [],
    endingCourtesies: [],
    closedDeferredBalances: [],
    convertedAddons: []
};
const noop = () => undefined;
const renderPreview = (
    preview: PermanentGrantPreviewResponse,
    action: 'grant' | 'anchor' = 'grant'
) =>
    render(
        <PermanentGrantConfirmation
            preview={preview}
            action={action}
            pending={false}
            onConfirm={noop}
            onBack={noop}
        />
    );

describe('AC:B13a:6 — grant and anchor confirmations (support for TEST:B13a:5)', () => {
    it('shows the provider email only for stopped charges flagged for email', () => {
        const withEmail = '11111111-1111-4111-8111-111111111111';
        const withoutEmail = '22222222-2222-4222-8222-222222222222';
        renderPreview({
            ...empty,
            stoppedCharges: [
                {
                    subscriptionId: withEmail,
                    vertical: VerticalEnum.ACCOMMODATION,
                    status: 'ACTIVE',
                    providerEmail: true
                },
                {
                    subscriptionId: withoutEmail,
                    vertical: VerticalEnum.VENUE,
                    status: 'ACTIVE',
                    providerEmail: false
                }
            ]
        });

        const section = within(screen.getByTestId('permanent-grant-stopped-charges'));
        expect(section.getByText(new RegExp(withEmail))).toHaveTextContent(/correo del proveedor/);
        expect(section.getByText(new RegExp(withoutEmail))).not.toHaveTextContent(
            /correo del proveedor/
        );
    });

    it('says a current courtesy ends on its date and the provider emails only when flagged', () => {
        const row = {
            subscriptionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            vertical: VerticalEnum.ACCOMMODATION,
            endsAt: '2026-10-12T15:00:00.000Z',
            providerEmail: true
        };
        const { rerender } = renderPreview({ ...empty, endingCourtesies: [row] });
        const section = within(screen.getByTestId('permanent-grant-ending-courtesies'));
        expect(section.getByText(/termina el 12\/10\/2026/)).toBeInTheDocument();
        expect(section.getByText(/paused a cancelled/)).toBeInTheDocument();
        expect(section.getByText(/correo del proveedor/)).toBeInTheDocument();
        rerender(
            <PermanentGrantConfirmation
                preview={{ ...empty, endingCourtesies: [{ ...row, providerEmail: false }] }}
                action="grant"
                pending={false}
                onConfirm={noop}
                onBack={noop}
            />
        );
        expect(
            within(screen.getByTestId('permanent-grant-ending-courtesies')).queryByText(
                /correo del proveedor/
            )
        ).toBeNull();
    });

    it('says three deferred months and one provider email for each converted preapproval', () => {
        renderPreview(
            {
                ...empty,
                closedDeferredBalances: [
                    {
                        courtesyGrantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                        vertical: VerticalEnum.VENUE,
                        balanceMonths: 3
                    }
                ],
                convertedAddons: [
                    {
                        addonInstanceId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
                        addonName: 'Extra A',
                        complementSubscriptionId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
                        providerEmail: true
                    },
                    {
                        addonInstanceId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
                        addonName: 'Extra B',
                        complementSubscriptionId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
                        providerEmail: true
                    }
                ]
            },
            'anchor'
        );
        expect(
            within(screen.getByTestId('permanent-grant-closed-balances')).getByText(/3 meses/)
        ).toBeInTheDocument();
        expect(
            within(screen.getByTestId('permanent-grant-converted-addons')).getAllByText(
                /correo del proveedor/
            )
        ).toHaveLength(2);
    });

    it('keeps the empty add-on section visible and never asks whether the operator is sure', () => {
        const confirm = vi.spyOn(window, 'confirm');
        renderPreview(empty);
        expect(screen.getByTestId('permanent-grant-converted-addons')).toHaveTextContent(
            'Sin complementos para convertir'
        );
        expect(document.body.textContent).not.toMatch(/¿estás seguro\?/i);
        expect(confirm).not.toHaveBeenCalled();
        confirm.mockRestore();
    });

    it('all three locales render without a sure question', () => {
        for (const locale of ['es', 'en', 'pt'] as const) {
            currentLocale = locale;
            const { unmount } = renderPreview(empty);
            expect(document.body.textContent).not.toMatch(
                /¿estás seguro\?|are you sure\?|tem certeza\?/i
            );
            unmount();
        }
    });
});
