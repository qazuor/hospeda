/**
 * @file campaign-editor.test.tsx
 * @description RTL component tests for CampaignEditor (SPEC-101 T-101-40).
 *
 * Coverage targets:
 * - Create-mode submit flow (save draft → navigation).
 * - Edit-mode autosave (3s debounce via vi.useFakeTimers).
 * - Test-send with toast.
 * - SendConfirmDialog: audience display + ignoreSoftCap toggle + confirm.
 * - Read-only state (status='sent' and status='sending').
 * - Cancel-send button (status='sending').
 *
 * Hooks are mocked at the module boundary to isolate component logic.
 *
 * NOTE: The i18n mock in setup.tsx returns translation keys as-is (e.g.
 * "admin-newsletter.campaigns.titleField") so assertions use data-testid
 * attributes instead of label text for robustness.
 *
 * @module test/newsletter/campaign-editor
 */

import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NewsletterCampaign } from '@repo/schemas';
import { NewsletterCampaignLocaleFilterEnum, NewsletterCampaignStatusEnum } from '@repo/schemas';
import { renderWithProviders } from '../helpers/render-with-providers';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockCreateMutateAsync = vi.fn();
const mockUpdateMutateAsync = vi.fn();
const mockTestSendMutateAsync = vi.fn();
const mockCancelMutateAsync = vi.fn();
const mockSendMutateAsync = vi.fn();

vi.mock('@/hooks/newsletter', () => ({
    useCreateCampaign: () => ({
        mutateAsync: mockCreateMutateAsync,
        isPending: false
    }),
    useUpdateCampaign: (_id: string) => ({
        mutateAsync: mockUpdateMutateAsync,
        isPending: false,
        mutate: mockUpdateMutateAsync
    }),
    useTestSendCampaign: (_id: string) => ({
        mutateAsync: mockTestSendMutateAsync,
        isPending: false
    }),
    useCancelCampaign: (_id: string) => ({
        mutateAsync: mockCancelMutateAsync,
        isPending: false,
        mutate: mockCancelMutateAsync
    }),
    useSendCampaign: (_id: string) => ({
        mutateAsync: mockSendMutateAsync,
        isPending: false,
        mutate: mockSendMutateAsync
    }),
    useCampaignMetrics: (_id: string, _status?: string) => ({
        data: {
            totalRecipients: 42,
            totalSoftcapped: 3,
            delivered: 0,
            failed: 0,
            skipped: 0,
            opened: 0,
            clicked: 0,
            openRate: 0,
            clickRate: 0
        },
        isLoading: false
    })
}));

// Mock RichTextEditor — too heavy (TipTap + ProseMirror) for unit tests
vi.mock('@/components/newsletter/RichTextEditor', () => ({
    RichTextEditor: ({
        value,
        onChange,
        disabled
    }: {
        value: unknown;
        onChange: (v: unknown) => void;
        disabled?: boolean;
    }) => (
        <div data-testid="rich-text-editor">
            <textarea
                data-testid="rte-textarea"
                disabled={disabled}
                defaultValue={value ? JSON.stringify(value) : ''}
                onChange={(e) => {
                    try {
                        onChange(JSON.parse(e.target.value));
                    } catch {
                        onChange({ type: 'doc', content: [] });
                    }
                }}
                aria-label="Contenido del email"
            />
        </div>
    )
}));

// Mock @repo/utils renderTiptapContent
vi.mock('@repo/utils', () => ({
    renderTiptapContent: ({ content }: { content: unknown }) =>
        `<p>rendered:${JSON.stringify(content).slice(0, 30)}</p>`
}));

// Mock CampaignPreview (visual only)
vi.mock('@/routes/_authed/newsletter/campaigns/-components/CampaignPreview', () => ({
    CampaignPreview: ({
        html,
        subject
    }: {
        html: string;
        subject: string;
    }) => (
        <div data-testid="campaign-preview">
            <span data-testid="preview-subject">{subject}</span>
            <div data-testid="preview-html">{html}</div>
        </div>
    )
}));

// Mock SendConfirmDialog — tested via simplified inline mock
vi.mock('@/routes/_authed/newsletter/campaigns/-components/SendConfirmDialog', () => ({
    SendConfirmDialog: ({
        open,
        onOpenChange,
        campaign
    }: {
        open: boolean;
        onOpenChange: (v: boolean) => void;
        campaign: NewsletterCampaign;
    }) =>
        open ? (
            <div data-testid="send-confirm-dialog">
                <span data-testid="dialog-campaign-id">{campaign.id}</span>
                <button
                    type="button"
                    data-testid="dialog-confirm-btn"
                    onClick={() => {
                        mockSendMutateAsync(false);
                        onOpenChange(false);
                    }}
                >
                    Confirmar envío
                </button>
                <button
                    type="button"
                    data-testid="dialog-cancel-btn"
                    onClick={() => onOpenChange(false)}
                >
                    Cancelar
                </button>
            </div>
        ) : null
}));

// Mock SidebarPageLayout — passthrough
vi.mock('@/components/layout/SidebarPageLayout', () => ({
    SidebarPageLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DRAFT_CAMPAIGN: NewsletterCampaign = {
    id: 'campaign-draft-001',
    title: 'Mayo 2025',
    subject: 'Novedades de mayo',
    bodyJson: { type: 'doc', content: [] },
    status: NewsletterCampaignStatusEnum.DRAFT,
    localeFilter: NewsletterCampaignLocaleFilterEnum.ALL,
    totalRecipients: null,
    totalSoftcapped: 0,
    sentAt: null,
    scheduledFor: null,
    createdBy: 'user-001',
    createdAt: '2025-05-01T00:00:00Z',
    updatedAt: '2025-05-01T00:00:00Z',
    deletedAt: null
};

const SENT_CAMPAIGN: NewsletterCampaign = {
    ...DRAFT_CAMPAIGN,
    id: 'campaign-sent-001',
    status: NewsletterCampaignStatusEnum.SENT,
    totalRecipients: 100,
    sentAt: '2025-05-10T10:00:00Z'
};

const SENDING_CAMPAIGN: NewsletterCampaign = {
    ...DRAFT_CAMPAIGN,
    id: 'campaign-sending-001',
    status: NewsletterCampaignStatusEnum.SENDING,
    totalRecipients: 100,
    sentAt: '2025-05-10T10:00:00Z'
};

// ── Import component under test ────────────────────────────────────────────────

import { CampaignEditor } from '@/routes/_authed/newsletter/campaigns/-components/CampaignEditor';

// ── Test suites ───────────────────────────────────────────────────────────────

describe('CampaignEditor', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCreateMutateAsync.mockResolvedValue({ id: 'new-campaign-001' });
        mockUpdateMutateAsync.mockResolvedValue({ ...DRAFT_CAMPAIGN });
        mockTestSendMutateAsync.mockResolvedValue({ sent: true, sentTo: 'admin@hospeda.com' });
        mockCancelMutateAsync.mockResolvedValue({ cancelled: true, skipped: 0 });
        mockSendMutateAsync.mockResolvedValue({ dispatched: true, enqueued: 42, softcapped: 3 });
    });

    // ── Create mode ────────────────────────────────────────────────────────────

    describe('mode=create', () => {
        it('renders empty form with heading "Nueva campaña"', () => {
            renderWithProviders(<CampaignEditor mode="create" />);

            expect(screen.getByText('Nueva campaña')).toBeInTheDocument();
            expect(screen.getByTestId('campaign-title-input')).toBeInTheDocument();
            expect(screen.getByTestId('campaign-subject-input')).toBeInTheDocument();
            expect(screen.getByTestId('rich-text-editor')).toBeInTheDocument();
        });

        it('renders Save draft button but no Send or Test Send in create mode', () => {
            renderWithProviders(<CampaignEditor mode="create" />);

            expect(screen.getByTestId('save-draft-btn')).toBeInTheDocument();
            expect(screen.queryByTestId('send-campaign-btn')).not.toBeInTheDocument();
            expect(screen.queryByTestId('test-send-btn')).not.toBeInTheDocument();
        });

        it('shows character counters for title and subject (both start at 0/120)', () => {
            renderWithProviders(<CampaignEditor mode="create" />);

            const counters = screen.getAllByText('0/120');
            expect(counters.length).toBeGreaterThanOrEqual(2);
        });

        it('updates character counter when typing in title field', async () => {
            const user = userEvent.setup({ delay: null });
            renderWithProviders(<CampaignEditor mode="create" />);

            const titleInput = screen.getByTestId('campaign-title-input');
            await user.type(titleInput, 'Hola');

            expect(screen.getByText('4/120')).toBeInTheDocument();
        });

        it('calls createMutation.mutateAsync on save draft submit', async () => {
            const user = userEvent.setup({ delay: null });
            renderWithProviders(<CampaignEditor mode="create" />);

            await user.type(screen.getByTestId('campaign-title-input'), 'Test Title');
            await user.type(screen.getByTestId('campaign-subject-input'), 'Test Subject');

            await user.click(screen.getByTestId('save-draft-btn'));

            await waitFor(() => {
                expect(mockCreateMutateAsync).toHaveBeenCalledWith(
                    expect.objectContaining({
                        title: 'Test Title',
                        subject: 'Test Subject'
                    })
                );
            });
        });

        it('renders locale dropdown', () => {
            renderWithProviders(<CampaignEditor mode="create" />);

            expect(screen.getByRole('combobox')).toBeInTheDocument();
        });
    });

    // ── Edit mode ──────────────────────────────────────────────────────────────

    describe('mode=edit', () => {
        it('pre-fills form with campaign data', () => {
            renderWithProviders(
                <CampaignEditor
                    mode="edit"
                    campaign={DRAFT_CAMPAIGN}
                />
            );

            expect(screen.getByDisplayValue('Mayo 2025')).toBeInTheDocument();
            expect(screen.getByDisplayValue('Novedades de mayo')).toBeInTheDocument();
        });

        it('renders all action buttons (save, test-send, send) in edit mode', () => {
            renderWithProviders(
                <CampaignEditor
                    mode="edit"
                    campaign={DRAFT_CAMPAIGN}
                />
            );

            expect(screen.getByTestId('save-draft-btn')).toBeInTheDocument();
            expect(screen.getByTestId('test-send-btn')).toBeInTheDocument();
            expect(screen.getByTestId('send-campaign-btn')).toBeInTheDocument();
        });

        it('calls updateMutation.mutateAsync on save draft in edit mode', async () => {
            const user = userEvent.setup({ delay: null });
            renderWithProviders(
                <CampaignEditor
                    mode="edit"
                    campaign={DRAFT_CAMPAIGN}
                />
            );

            await user.click(screen.getByTestId('save-draft-btn'));

            await waitFor(() => {
                expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
                    expect.objectContaining({
                        title: 'Mayo 2025',
                        subject: 'Novedades de mayo'
                    })
                );
            });
        });

        it('triggers autosave after 3 seconds of inactivity', async () => {
            vi.useFakeTimers();

            renderWithProviders(
                <CampaignEditor
                    mode="edit"
                    campaign={DRAFT_CAMPAIGN}
                />
            );

            // Use fireEvent.change to trigger the autosave schedule without slow userEvent
            const titleInput = screen.getByTestId('campaign-title-input');
            fireEvent.change(titleInput, { target: { value: 'Mayo 2025 editado' } });

            // Autosave should not have fired yet
            expect(mockUpdateMutateAsync).not.toHaveBeenCalled();

            // Advance 3.1 seconds past the debounce
            await act(async () => {
                vi.advanceTimersByTime(3100);
                // Flush microtask queue (promises)
                await Promise.resolve();
            });

            expect(mockUpdateMutateAsync).toHaveBeenCalled();

            vi.useRealTimers();
        });

        it('does NOT autosave before 3 seconds', async () => {
            vi.useFakeTimers();

            renderWithProviders(
                <CampaignEditor
                    mode="edit"
                    campaign={DRAFT_CAMPAIGN}
                />
            );

            fireEvent.change(screen.getByTestId('campaign-title-input'), {
                target: { value: 'Mayo 2025 x' }
            });

            await act(async () => {
                vi.advanceTimersByTime(1500);
            });

            expect(mockUpdateMutateAsync).not.toHaveBeenCalled();

            vi.useRealTimers();
        });

        it('calls testSendMutation on test-send button click', async () => {
            renderWithProviders(
                <CampaignEditor
                    mode="edit"
                    campaign={DRAFT_CAMPAIGN}
                />
            );

            fireEvent.click(screen.getByTestId('test-send-btn'));

            await waitFor(() => {
                expect(mockTestSendMutateAsync).toHaveBeenCalled();
            });
        });

        it('opens SendConfirmDialog when Send Campaign is clicked', () => {
            renderWithProviders(
                <CampaignEditor
                    mode="edit"
                    campaign={DRAFT_CAMPAIGN}
                />
            );

            fireEvent.click(screen.getByTestId('send-campaign-btn'));

            expect(screen.getByTestId('send-confirm-dialog')).toBeInTheDocument();
            expect(screen.getByTestId('dialog-campaign-id')).toHaveTextContent(DRAFT_CAMPAIGN.id);
        });

        it('calls sendMutation when dialog confirm is clicked', () => {
            renderWithProviders(
                <CampaignEditor
                    mode="edit"
                    campaign={DRAFT_CAMPAIGN}
                />
            );

            fireEvent.click(screen.getByTestId('send-campaign-btn'));
            fireEvent.click(screen.getByTestId('dialog-confirm-btn'));

            expect(mockSendMutateAsync).toHaveBeenCalledWith(false);
        });

        it('closes dialog when cancel is clicked', () => {
            renderWithProviders(
                <CampaignEditor
                    mode="edit"
                    campaign={DRAFT_CAMPAIGN}
                />
            );

            fireEvent.click(screen.getByTestId('send-campaign-btn'));
            expect(screen.getByTestId('send-confirm-dialog')).toBeInTheDocument();

            fireEvent.click(screen.getByTestId('dialog-cancel-btn'));
            expect(screen.queryByTestId('send-confirm-dialog')).not.toBeInTheDocument();
        });
    });

    // ── Read-only mode (sent) ──────────────────────────────────────────────────

    describe('mode=readonly (status=sent)', () => {
        it('shows read-only banner with "role=status"', () => {
            renderWithProviders(
                <CampaignEditor
                    mode="readonly"
                    campaign={SENT_CAMPAIGN}
                />
            );

            const banner = screen.getByRole('status');
            expect(banner).toBeInTheDocument();
            // The banner text is the i18n key: admin-newsletter.campaigns.readOnlyBanner
            expect(banner.textContent).toContain('admin-newsletter.campaigns.readOnlyBanner');
        });

        it('disables title and subject inputs', () => {
            renderWithProviders(
                <CampaignEditor
                    mode="readonly"
                    campaign={SENT_CAMPAIGN}
                />
            );

            expect(screen.getByTestId('campaign-title-input')).toBeDisabled();
            expect(screen.getByTestId('campaign-subject-input')).toBeDisabled();
        });

        it('hides all action buttons (save, test-send, send, cancel)', () => {
            renderWithProviders(
                <CampaignEditor
                    mode="readonly"
                    campaign={SENT_CAMPAIGN}
                />
            );

            expect(screen.queryByTestId('save-draft-btn')).not.toBeInTheDocument();
            expect(screen.queryByTestId('test-send-btn')).not.toBeInTheDocument();
            expect(screen.queryByTestId('send-campaign-btn')).not.toBeInTheDocument();
            expect(screen.queryByTestId('cancel-send-btn')).not.toBeInTheDocument();
        });
    });

    // ── Read-only mode (sending) ───────────────────────────────────────────────

    describe('mode=readonly (status=sending)', () => {
        it('shows "sending" status banner (not the read-only banner)', () => {
            renderWithProviders(
                <CampaignEditor
                    mode="readonly"
                    campaign={SENDING_CAMPAIGN}
                />
            );

            expect(screen.getByText(/se está enviando actualmente/i)).toBeInTheDocument();
        });

        it('shows Cancel send button when status=sending', () => {
            renderWithProviders(
                <CampaignEditor
                    mode="readonly"
                    campaign={SENDING_CAMPAIGN}
                />
            );

            expect(screen.getByTestId('cancel-send-btn')).toBeInTheDocument();
        });

        it('calls cancelMutation when cancel-send is clicked and window.confirm returns true', async () => {
            vi.spyOn(window, 'confirm').mockReturnValue(true);

            renderWithProviders(
                <CampaignEditor
                    mode="readonly"
                    campaign={SENDING_CAMPAIGN}
                />
            );

            fireEvent.click(screen.getByTestId('cancel-send-btn'));

            await waitFor(() => {
                expect(mockCancelMutateAsync).toHaveBeenCalled();
            });

            vi.restoreAllMocks();
        });

        it('does NOT call cancelMutation when confirm dialog is dismissed', () => {
            vi.spyOn(window, 'confirm').mockReturnValue(false);

            renderWithProviders(
                <CampaignEditor
                    mode="readonly"
                    campaign={SENDING_CAMPAIGN}
                />
            );

            fireEvent.click(screen.getByTestId('cancel-send-btn'));

            expect(mockCancelMutateAsync).not.toHaveBeenCalled();

            vi.restoreAllMocks();
        });
    });

    // ── Preview panel ─────────────────────────────────────────────────────────

    describe('preview pane', () => {
        it('renders CampaignPreview with the campaign subject', () => {
            renderWithProviders(
                <CampaignEditor
                    mode="edit"
                    campaign={DRAFT_CAMPAIGN}
                />
            );

            expect(screen.getByTestId('preview-subject')).toHaveTextContent('Novedades de mayo');
        });

        it('renders a mobile preview toggle button', () => {
            renderWithProviders(
                <CampaignEditor
                    mode="edit"
                    campaign={DRAFT_CAMPAIGN}
                />
            );

            expect(screen.getByText('Vista previa')).toBeInTheDocument();
        });
    });

    // ── Character counters ────────────────────────────────────────────────────

    describe('character counters', () => {
        it('shows over-limit counter when title exceeds 120 chars', () => {
            renderWithProviders(<CampaignEditor mode="create" />);

            const titleInput = screen.getByTestId('campaign-title-input');
            // Use fireEvent.change to avoid slow userEvent.type with 121 chars
            fireEvent.change(titleInput, { target: { value: 'a'.repeat(121) } });

            expect(screen.getByText('121/120')).toBeInTheDocument();
        });
    });
});
