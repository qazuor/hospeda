/**
 * @file ComposeForm.test.tsx
 * HOS-2685: compose submit payload, suppressed blocking, test send and the
 * per-recipient results shown after a send.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComposeForm } from '@/routes/_authed/direct-emails/-components/ComposeForm';

const BODY = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hola' }] }]
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const mocks = vi.hoisted(() => ({
    send: vi.fn(),
    testSend: vi.fn(),
    check: vi.fn(),
    navigate: vi.fn(),
    toast: vi.fn(),
    canSend: { value: true }
}));

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string, params?: Record<string, unknown>) =>
            params ? `${key}|${JSON.stringify(params)}` : key,
        tPlural: (key: string, count: number) => `${key}#${count}`,
        locale: 'es'
    })
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ addToast: mocks.toast }) }));
vi.mock('@/hooks/use-auth-context', () => ({
    useAuthContext: () => ({ user: { email: 'admin@hospeda.com.ar' } })
}));
vi.mock('@/hooks/use-user-permissions', () => ({ useHasPermission: () => mocks.canSend.value }));
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/hooks/direct-email', () => ({
    getDirectEmailErrorKey: () => 'admin-direct-email.errors.generic',
    getDirectEmailSendErrorKey: () => 'admin-direct-email.errors.sendFailedCheckHistory',
    getDirectEmailProviderMessage: () => undefined,
    useDirectEmailTemplates: () => ({
        data: {
            items: [
                {
                    id: 'tpl-1',
                    name: 'Alianza',
                    subject: 'Propuesta de alianza',
                    bodyJson: {
                        type: 'doc',
                        content: [
                            { type: 'paragraph', content: [{ type: 'text', text: 'Plantilla' }] }
                        ]
                    }
                }
            ]
        },
        isLoading: false,
        isError: false
    }),
    useSendDirectEmail: () => ({ mutateAsync: mocks.send, isPending: false }),
    useTestSendDirectEmail: () => ({ mutateAsync: mocks.testSend, isPending: false }),
    useCheckDirectEmailRecipients: () => ({ mutateAsync: mocks.check }),
    usePreviewDirectEmail: () => ({
        mutateAsync: vi.fn().mockResolvedValue({ subject: '', html: '<p>x</p>' })
    })
}));
// The real editor needs ProseMirror layout APIs; a stub that emits a document is enough here.
vi.mock('@/components/newsletter/RichTextEditor', () => ({
    RichTextEditor: ({
        onChange,
        enableDynamicBlocks
    }: {
        onChange: (doc: unknown) => void;
        enableDynamicBlocks?: boolean;
    }) => (
        <button
            type="button"
            data-testid="editor"
            data-dynamic={String(enableDynamicBlocks)}
            onClick={() => onChange(BODY)}
        >
            editor
        </button>
    )
}));

function addRecipient(email: string) {
    const input = screen.getByLabelText('admin-direct-email.compose.recipientsLabel');
    fireEvent.change(input, { target: { value: email } });
    fireEvent.keyDown(input, { key: 'Enter' });
}

function fillValidForm() {
    fireEvent.change(screen.getByLabelText('admin-direct-email.compose.subjectLabel'), {
        target: { value: 'Propuesta' }
    });
    addRecipient('a@x.com');
    addRecipient('b@x.com');
    fireEvent.click(screen.getByTestId('editor'));
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.canSend.value = true;
    mocks.check.mockResolvedValue({ suppressed: [] });
});

describe('ComposeForm', () => {
    it('renders the editor without dynamic blocks', () => {
        render(<ComposeForm />);

        expect(screen.getByTestId('editor').getAttribute('data-dynamic')).toBe('false');
    });

    it('checks each new recipient against the suppression list', async () => {
        render(<ComposeForm />);

        addRecipient('a@x.com');

        await waitFor(() => expect(mocks.check).toHaveBeenCalledWith({ emails: ['a@x.com'] }));
    });

    it('blocks the send and marks the chip when a recipient is suppressed', async () => {
        mocks.check.mockResolvedValue({ suppressed: ['b@x.com'] });
        render(<ComposeForm />);

        fillValidForm();

        await waitFor(() => expect(screen.getByTestId('suppressed-warning')).toBeInTheDocument());
        expect(screen.getByText('admin-direct-email.compose.send')).toBeDisabled();
    });

    it('shows field errors and does not open the confirmation when invalid', () => {
        render(<ComposeForm />);

        fireEvent.click(screen.getByText('admin-direct-email.compose.send'));

        expect(screen.getByText('zodError.entity.directEmail.subject.min')).toBeInTheDocument();
        expect(screen.getByText('zodError.entity.directEmail.body.empty')).toBeInTheDocument();
        expect(screen.getByText('zodError.entity.directEmail.recipients.min')).toBeInTheDocument();
        expect(screen.queryByTestId('send-confirm-recipients')).not.toBeInTheDocument();
        expect(mocks.send).not.toHaveBeenCalled();
    });

    it('sends the validated payload after confirming and then shows each result', async () => {
        mocks.send.mockResolvedValue({
            messageId: 'msg-1',
            results: [
                { email: 'a@x.com', status: 'sent', providerMessageId: 'p1', error: null },
                {
                    email: 'b@x.com',
                    status: 'failed',
                    providerMessageId: null,
                    error: 'Brevo rejected it'
                }
            ]
        });
        render(<ComposeForm />);
        fillValidForm();

        fireEvent.click(screen.getByText('admin-direct-email.compose.send'));
        const list = await screen.findByTestId('send-confirm-recipients');
        expect(
            within(list)
                .getAllByRole('listitem')
                .map((item) => item.textContent)
        ).toEqual(['a@x.com', 'b@x.com']);
        fireEvent.click(screen.getByText('admin-direct-email.sendConfirm.confirm'));

        await waitFor(() =>
            expect(mocks.send).toHaveBeenCalledWith({
                subject: 'Propuesta',
                bodyJson: BODY,
                recipients: ['a@x.com', 'b@x.com'],
                idempotencyKey: expect.stringMatching(UUID)
            })
        );
        expect(await screen.findByText('Brevo rejected it')).toBeInTheDocument();
        expect(screen.getByTestId('send-results-summary').textContent).toContain(
            '"sent":1,"failed":1,"suppressed":0'
        );

        fireEvent.click(screen.getByText('admin-direct-email.results.viewMessage'));
        expect(mocks.navigate).toHaveBeenCalledWith({
            to: '/direct-emails/$messageId',
            params: { messageId: 'msg-1' }
        });
    });

    it('reuses the idempotency key on a retry after a failed send and renews it after a success', async () => {
        // Arrange
        mocks.send
            .mockRejectedValueOnce(new Error('timeout'))
            .mockResolvedValue({ messageId: 'msg-1', results: [] });
        render(<ComposeForm />);
        fillValidForm();
        const confirmSend = async () => {
            fireEvent.click(screen.getByText('admin-direct-email.compose.send'));
            fireEvent.click(await screen.findByText('admin-direct-email.sendConfirm.confirm'));
        };

        // Act: first attempt fails, the admin retries, then it succeeds
        await confirmSend();
        await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(1));
        await waitFor(() =>
            expect(mocks.toast).toHaveBeenCalledWith({
                message: 'admin-direct-email.errors.sendFailedCheckHistory',
                variant: 'error'
            })
        );
        await confirmSend();
        await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(2));

        // Assert
        const [first, second] = mocks.send.mock.calls.map(
            (call) => (call[0] as { idempotencyKey: string }).idempotencyKey
        );
        expect(first).toMatch(UUID);
        expect(second).toBe(first);
    });

    it('generates a new idempotency key for the next compose after a successful send', async () => {
        mocks.send.mockResolvedValue({ messageId: 'msg-1', results: [] });
        render(<ComposeForm />);
        fillValidForm();

        fireEvent.click(screen.getByText('admin-direct-email.compose.send'));
        fireEvent.click(await screen.findByText('admin-direct-email.sendConfirm.confirm'));
        await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(1));
        // The results dialog is open; "continue" navigates away, so send again from the form.
        fireEvent.click(await screen.findByText('admin-direct-email.compose.send'));
        fireEvent.click(await screen.findByText('admin-direct-email.sendConfirm.confirm'));
        await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(2));

        const [first, second] = mocks.send.mock.calls.map(
            (call) => (call[0] as { idempotencyKey: string }).idempotencyKey
        );
        expect(second).not.toBe(first);
    });

    it('shows the provider text when the test send is refused by the provider', async () => {
        mocks.testSend.mockResolvedValue({
            sentTo: 'admin@hospeda.com.ar',
            delivered: false,
            providerError: 'sender not verified'
        });
        render(<ComposeForm />);
        fireEvent.change(screen.getByLabelText('admin-direct-email.compose.subjectLabel'), {
            target: { value: 'Propuesta' }
        });
        fireEvent.click(screen.getByTestId('editor'));

        fireEvent.click(screen.getByText('admin-direct-email.compose.testSend'));
        fireEvent.click(await screen.findByText('admin-direct-email.testSend.submit'));

        await waitFor(() =>
            expect(mocks.toast).toHaveBeenCalledWith({
                message: 'admin-direct-email.testSend.failedToast|{"error":"sender not verified"}',
                variant: 'error'
            })
        );
    });

    it('applies a template by copying its subject', () => {
        render(<ComposeForm />);

        fireEvent.change(screen.getByLabelText('admin-direct-email.compose.templateLabel'), {
            target: { value: 'tpl-1' }
        });

        expect(
            (screen.getByLabelText('admin-direct-email.compose.subjectLabel') as HTMLInputElement)
                .value
        ).toBe('Propuesta de alianza');
    });

    it('test send omits toEmail for the admin own address', async () => {
        mocks.testSend.mockResolvedValue({
            sentTo: 'admin@hospeda.com.ar',
            delivered: true,
            providerError: null
        });
        render(<ComposeForm />);
        fireEvent.change(screen.getByLabelText('admin-direct-email.compose.subjectLabel'), {
            target: { value: 'Propuesta' }
        });
        fireEvent.click(screen.getByTestId('editor'));

        fireEvent.click(screen.getByText('admin-direct-email.compose.testSend'));
        fireEvent.click(await screen.findByText('admin-direct-email.testSend.submit'));

        await waitFor(() =>
            expect(mocks.testSend).toHaveBeenCalledWith({ subject: 'Propuesta', bodyJson: BODY })
        );
    });

    it('disables send and test send without DIRECT_EMAIL_SEND', () => {
        mocks.canSend.value = false;
        render(<ComposeForm />);

        expect(screen.getByText('admin-direct-email.compose.send')).toBeDisabled();
        expect(screen.getByText('admin-direct-email.compose.testSend')).toBeDisabled();
    });
});
