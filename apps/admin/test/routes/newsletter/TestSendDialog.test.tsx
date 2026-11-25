/**
 * @file TestSendDialog.test.tsx
 * Tests for the campaign test-send recipient dialog (HOS-2585).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    resolveTestSendRecipient,
    TestSendDialog
} from '@/routes/_authed/newsletter/campaigns/-components/TestSendDialog';

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: (key: string) => key, locale: 'es' })
}));

const ACTOR = 'admin@hospeda.com.ar';

function renderDialog(onSubmit = vi.fn()) {
    render(
        <TestSendDialog
            open
            onOpenChange={vi.fn()}
            defaultEmail={ACTOR}
            isPending={false}
            onSubmit={onSubmit}
        />
    );
    return {
        onSubmit,
        input: screen.getByLabelText('admin-newsletter.campaigns.testSendEmailLabel')
    };
}

describe('TestSendDialog', () => {
    it('prefills the logged-in user email', () => {
        const { input } = renderDialog();
        expect((input as HTMLInputElement).value).toBe(ACTOR);
    });

    it('submits a different valid address', async () => {
        const { onSubmit, input } = renderDialog();
        fireEvent.change(input, { target: { value: ' other@example.com ' } });
        fireEvent.click(screen.getByText('admin-newsletter.campaigns.testSendSubmit'));
        await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ email: 'other@example.com' }));
    });

    it('submits the default address when unchanged', async () => {
        const { onSubmit } = renderDialog();
        fireEvent.click(screen.getByText('admin-newsletter.campaigns.testSendSubmit'));
        await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ email: ACTOR }));
    });

    it('rejects an invalid address before calling onSubmit', async () => {
        const { onSubmit, input } = renderDialog();
        fireEvent.change(input, { target: { value: 'not-an-email' } });
        fireEvent.click(screen.getByText('admin-newsletter.campaigns.testSendSubmit'));
        expect(
            await screen.findByText('admin-newsletter.campaigns.testSendEmailInvalid')
        ).toBeInTheDocument();
        expect(onSubmit).not.toHaveBeenCalled();
    });
});

describe('resolveTestSendRecipient', () => {
    it('returns undefined when the address is the actor email (case-insensitive)', () => {
        expect(
            resolveTestSendRecipient({ email: 'ADMIN@hospeda.com.ar', actorEmail: ACTOR })
        ).toBeUndefined();
    });

    it('returns the typed address when it differs', () => {
        expect(resolveTestSendRecipient({ email: 'x@y.com', actorEmail: ACTOR })).toBe('x@y.com');
    });
});
