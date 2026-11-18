/** HOS-2227: approving without touching the type select must send the type it shows. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PartnerApplicationApproveSchema } from '@repo/schemas';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PartnerApplicationActionDialog } from '@/features/partner-applications/components/PartnerApplicationActionDialog';

const BUSINESS_TYPE_ID = 'a2336000-0000-4000-8000-000000000001';

// HOS-2336: the select lists the admin catalog, lowest weight first.
vi.mock('@/hooks/use-partner-types', () => ({
    usePartnerTypeOptions: () => ({
        options: [
            { value: BUSINESS_TYPE_ID, slug: 'business', label: 'Comercio', inactive: false },
            {
                value: 'a2336000-0000-4000-8000-000000000004',
                slug: 'media',
                label: 'Medio',
                inactive: false
            }
        ],
        isLoading: false,
        isError: false
    })
}));

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: (key: string) => key, locale: 'es' })
}));

const item = { id: 'application-1', email: 'owner@example.com' } as never;

function build(approve: ReturnType<typeof vi.fn>) {
    return {
        approve: { mutateAsync: approve, isPending: false },
        reject: { mutateAsync: vi.fn(), isPending: false },
        cancelWait: { mutateAsync: vi.fn(), isPending: false }
    } as never;
}

describe('PartnerApplicationActionDialog approve', () => {
    it('submits a type the API accepts when the select is left untouched', async () => {
        const approve = vi.fn().mockResolvedValue({});
        const user = userEvent.setup();
        render(
            <PartnerApplicationActionDialog
                item={item}
                action="approve"
                onClose={vi.fn()}
                actions={build(approve)}
            />
        );

        await user.type(screen.getByLabelText(/partnerName/), 'Acme');
        await user.type(screen.getByLabelText(/dialogs.reason/), 'Looks good');
        fireEvent.click(screen.getByRole('button', { name: /approve.confirm/ }));

        await waitFor(() => expect(approve).toHaveBeenCalledOnce(), { timeout: 4000 });
        const sent = approve.mock.calls[0]?.[0] as { typeId: string };
        const select = screen.getByLabelText(/partnerType/) as HTMLSelectElement;
        expect(select.value).toBe(BUSINESS_TYPE_ID);
        expect(sent.typeId).toBe(select.value);
        expect(PartnerApplicationApproveSchema.safeParse({ ...sent, id: undefined }).success).toBe(
            true
        );
    });

    it('words the generic failure without blaming the reason, in every locale', () => {
        for (const locale of ['es', 'en', 'pt']) {
            const messages = JSON.parse(
                readFileSync(
                    join(
                        __dirname,
                        `../../../../../packages/i18n/src/locales/${locale}/admin-entities.json`
                    ),
                    'utf8'
                )
            ) as { partnerApplicationPanel: { errors: { action: string } } };
            expect(messages.partnerApplicationPanel.errors.action).not.toMatch(
                /motivo|reason|motivo/i
            );
        }
    });
});
