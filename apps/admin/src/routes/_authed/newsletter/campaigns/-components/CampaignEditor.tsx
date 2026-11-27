/**
 * @file CampaignEditor.tsx
 * @description Shared two-column campaign editor form used by both new and edit flows.
 *
 * - Left column (60%): title + subject inputs with char counters, locale dropdown, RichTextEditor.
 * - Right column (40%): live CampaignPreview (debounced 300ms).
 * - Sticky action bar: Save draft, Test send, Send campaign, Cancel send.
 * - Autosave (3s debounce) when mode='edit' and form is dirty/valid.
 * - Read-only mode for sent/cancelled/sending campaigns.
 * - Mobile: single-column with preview toggle.
 *
 * Uses `@tanstack/react-form` (project standard — react-hook-form is NOT installed).
 *
 * @module CampaignEditor
 */

import { LoaderIcon } from '@repo/icons';
import type { NewsletterCampaign, NewsletterCampaignLocaleFilterEnum } from '@repo/schemas';
import { renderTiptapContent } from '@repo/utils';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TiptapDocument } from '@/components/newsletter/RichTextEditor';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { Button } from '@/components/ui/button';
import {
    useCancelCampaign,
    useCreateCampaign,
    useTestSendCampaign,
    useUpdateCampaign
} from '@/hooks/newsletter';
import { useAuthContext } from '@/hooks/use-auth-context';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/hooks/use-translations';
import { AutosaveIndicator, CampaignEditorFields } from './CampaignEditorFields';
import { CampaignPreview } from './CampaignPreview';
import type { AutosaveStatus, CampaignFormValues } from './campaign-editor-form';
import {
    buildCampaignBody,
    buildCampaignDefaults,
    campaignSnapshot,
    useCampaignEditorForm
} from './campaign-editor-form';
import { SendConfirmDialog } from './SendConfirmDialog';
import { resolveTestSendRecipient, TestSendDialog } from './TestSendDialog';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Operating mode for the editor. */
export type CampaignEditorMode = 'create' | 'edit' | 'readonly';

/** Props for CampaignEditor. */
export interface CampaignEditorProps {
    /** 'create' for new campaigns, 'edit' for drafts, 'readonly' for sent/sending/cancelled. */
    readonly mode: CampaignEditorMode;
    /**
     * Existing campaign data. Required when mode='edit' or mode='readonly'.
     * Undefined when mode='create'.
     */
    readonly campaign?: NewsletterCampaign;
}

// ─── CampaignEditor ───────────────────────────────────────────────────────────

/**
 * Full-featured campaign editor form component.
 *
 * Shared between the new-campaign page and the edit (detail) page.
 * Handles save-as-draft, autosave, test-send, send confirmation, and cancel-send flows.
 *
 * @param props - CampaignEditorProps
 *
 * @example
 * ```tsx
 * // create mode
 * <CampaignEditor mode="create" />
 *
 * // edit mode (draft campaign)
 * <CampaignEditor mode="edit" campaign={campaign} />
 *
 * // read-only (sent/cancelled)
 * <CampaignEditor mode="readonly" campaign={campaign} />
 * ```
 */
export function CampaignEditor({ mode, campaign }: CampaignEditorProps) {
    const { t } = useTranslations();
    const { addToast } = useToast();
    const navigate = useNavigate();
    const { user } = useAuthContext();
    const actorEmail = user?.email ?? '';

    const isReadOnly = mode === 'readonly';
    const isCreate = mode === 'create';
    const isEdit = mode === 'edit';

    // ── Hooks ────────────────────────────────────────────────────────────────
    const createMutation = useCreateCampaign();
    const updateMutation = useUpdateCampaign(campaign?.id ?? '');
    const testSendMutation = useTestSendCampaign(campaign?.id ?? '');
    const cancelMutation = useCancelCampaign(campaign?.id ?? '');

    // ── Local state ──────────────────────────────────────────────────────────
    const [sendDialogOpen, setSendDialogOpen] = useState(false);
    const [testSendDialogOpen, setTestSendDialogOpen] = useState(false);
    const [cancelSendDialogOpen, setCancelSendDialogOpen] = useState(false);
    const [showPreviewMobile, setShowPreviewMobile] = useState(false);
    const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>('idle');
    // Debounced preview HTML (300ms)
    const [previewHtml, setPreviewHtml] = useState('');
    const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Autosave timer ref (3s debounce)
    const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Stores latest form values to avoid stale closure in autosave timer
    const latestFormValuesRef = useRef<CampaignFormValues>(buildCampaignDefaults({ campaign }));
    // Snapshot of the content last persisted (or loaded); autosave skips when unchanged
    const lastSavedSnapshotRef = useRef<string>(
        campaignSnapshot({ value: buildCampaignDefaults({ campaign }) })
    );
    // Track if first save has happened (for create mode showing Send button)
    const [savedOnce, setSavedOnce] = useState(!isCreate);

    // ── TanStack Form ────────────────────────────────────────────────────────
    const form = useCampaignEditorForm({ campaign, onSubmit: handleSaveDraft });

    // ── Preview debounce ─────────────────────────────────────────────────────
    const schedulePreviewUpdate = useCallback((bodyJson: unknown) => {
        if (previewDebounceRef.current) {
            clearTimeout(previewDebounceRef.current);
        }
        previewDebounceRef.current = setTimeout(() => {
            if (!bodyJson) {
                setPreviewHtml('');
                return;
            }
            try {
                const html = renderTiptapContent({ content: bodyJson as TiptapDocument });
                setPreviewHtml(html);
            } catch {
                setPreviewHtml('');
            }
        }, 300);
    }, []);

    // ── Autosave (edit mode only) ─────────────────────────────────────────────
    const scheduleAutosave = useCallback(
        (value: CampaignFormValues) => {
            if (!isEdit || !campaign?.id) return;

            latestFormValuesRef.current = value;

            if (autosaveTimerRef.current) {
                clearTimeout(autosaveTimerRef.current);
            }

            autosaveTimerRef.current = setTimeout(async () => {
                const v = latestFormValuesRef.current;
                const title = v.title as string;
                const subject = v.subject as string;

                const isValid =
                    title.trim().length > 0 &&
                    title.length <= 120 &&
                    subject.trim().length > 0 &&
                    subject.length <= 120;

                if (!isValid) return;

                const snapshot = campaignSnapshot({ value: v });
                if (snapshot === lastSavedSnapshotRef.current) return;

                setAutosaveStatus('saving');
                try {
                    await updateMutation.mutateAsync({
                        title,
                        subject,
                        localeFilter: v.localeFilter as NewsletterCampaignLocaleFilterEnum,
                        contentType: v.contentType,
                        bodyJson: buildCampaignBody({ raw: v.bodyJson })
                    });
                    lastSavedSnapshotRef.current = snapshot;
                    setAutosaveStatus('saved');
                    setTimeout(() => setAutosaveStatus('idle'), 3000);
                } catch {
                    setAutosaveStatus('error');
                }
            }, 3000);
        },
        [isEdit, campaign?.id, updateMutation]
    );

    // Cleanup timers on unmount
    useEffect(() => {
        return () => {
            if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
            if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
        };
    }, []);

    // Initialize preview on mount for edit/readonly
    useEffect(() => {
        if (campaign?.bodyJson) {
            try {
                const html = renderTiptapContent({ content: campaign.bodyJson as TiptapDocument });
                setPreviewHtml(html);
            } catch {
                setPreviewHtml('');
            }
        }
    }, [campaign?.bodyJson]);

    // ── Handlers ──────────────────────────────────────────────────────────────
    async function handleSaveDraft(value: CampaignFormValues) {
        const title = value.title as string;
        const subject = value.subject as string;
        const localeFilter = value.localeFilter as NewsletterCampaignLocaleFilterEnum;
        const contentType = value.contentType;
        const bodyJson = buildCampaignBody({ raw: value.bodyJson });

        if (isCreate) {
            const created = await createMutation.mutateAsync({
                title,
                subject,
                localeFilter,
                contentType,
                bodyJson
            });
            setSavedOnce(true);
            addToast({
                message: t('admin-newsletter.campaigns.savedDraftToast'),
                variant: 'success'
            });
            await navigate({
                to: '/newsletter/campaigns/$campaignId',
                params: { campaignId: created.id }
            });
        } else if (isEdit && campaign?.id) {
            await updateMutation.mutateAsync({
                title,
                subject,
                localeFilter,
                contentType,
                bodyJson
            });
            lastSavedSnapshotRef.current = campaignSnapshot({ value });
            setSavedOnce(true);
            addToast({
                message: t('admin-newsletter.campaigns.savedDraftToast'),
                variant: 'success'
            });
        }
    }

    /**
     * Sends the test email. When the address is unchanged from the logged-in
     * user's own email, `toEmail` is omitted so the API resolves the actor's
     * email itself (canonical source); otherwise the typed address is sent.
     */
    async function handleTestSend({ email }: { readonly email: string }) {
        if (!campaign?.id) return;
        try {
            const result = await testSendMutation.mutateAsync(
                resolveTestSendRecipient({ email, actorEmail })
            );
            setTestSendDialogOpen(false);
            addToast({
                message: t('admin-newsletter.campaigns.testSentToast').replace(
                    '{email}',
                    result.sentTo
                ),
                variant: 'success'
            });
        } catch (err) {
            addToast({
                message: err instanceof Error ? err.message : 'Error al enviar email de prueba.',
                variant: 'error'
            });
        }
    }

    function handleCancelSend() {
        if (!campaign?.id) return;
        setCancelSendDialogOpen(true);
    }

    async function confirmCancelSend() {
        setCancelSendDialogOpen(false);
        try {
            await cancelMutation.mutateAsync();
            addToast({ message: 'Envío cancelado.', variant: 'success' });
        } catch (err) {
            addToast({
                message: err instanceof Error ? err.message : 'Error al cancelar el envío.',
                variant: 'error'
            });
        }
    }

    const isSending =
        createMutation.isPending ||
        updateMutation.isPending ||
        testSendMutation.isPending ||
        cancelMutation.isPending;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col gap-6">
            {/* Title bar */}
            <div className="flex items-center gap-3">
                <h2 className="font-bold text-2xl">
                    {isCreate
                        ? 'Nueva campaña'
                        : isReadOnly
                          ? (campaign?.title ?? 'Campaña')
                          : (campaign?.title ?? 'Editar campaña')}
                </h2>
                {isEdit && <AutosaveIndicator status={autosaveStatus} />}
            </div>

            {/* Read-only banner for sent/cancelled */}
            {isReadOnly && campaign?.status !== 'sending' && (
                <output className="block rounded-md border border-border bg-muted/30 px-4 py-3 text-muted-foreground text-sm">
                    {t('admin-newsletter.campaigns.readOnlyBanner')}
                </output>
            )}

            {/* Sending banner */}
            {campaign?.status === 'sending' && (
                <output className="block rounded-md border border-info/30 bg-info/10 px-4 py-3 text-foreground text-sm">
                    Esta campaña se está enviando actualmente. Los campos no son editables.
                </output>
            )}

            {/* Mobile preview toggle */}
            <div className="flex justify-end lg:hidden">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPreviewMobile((prev) => !prev)}
                >
                    {showPreviewMobile ? 'Ocultar vista previa' : 'Vista previa'}
                </Button>
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                {/* ── Left column: editor (60% = 3/5) ── */}
                <div className="flex flex-col gap-5 lg:col-span-3">
                    <CampaignEditorFields
                        form={form}
                        isReadOnly={isReadOnly}
                        isSending={isSending}
                        scheduleAutosave={scheduleAutosave}
                        schedulePreviewUpdate={schedulePreviewUpdate}
                    />
                </div>

                {/* ── Right column: preview (40% = 2/5) ── */}
                <div className={`lg:col-span-2 ${showPreviewMobile ? 'block' : 'hidden'} lg:block`}>
                    <form.Subscribe selector={(state) => state.values}>
                        {(values) => (
                            <CampaignPreview
                                campaignId={campaign?.id}
                                bodyJson={values.bodyJson}
                                revision={campaign?.bodyJson}
                                html={previewHtml}
                                subject={values.subject}
                            />
                        )}
                    </form.Subscribe>
                </div>
            </div>

            {/* ── Sticky action bar ── */}
            <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-border border-t bg-background/95 px-4 py-3 backdrop-blur-sm">
                <div className="flex flex-wrap gap-2">
                    {/* Save draft — visible in create and edit modes */}
                    {!isReadOnly && (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => form.handleSubmit()}
                            disabled={isSending}
                            data-testid="save-draft-btn"
                        >
                            {(createMutation.isPending || updateMutation.isPending) && (
                                <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            {t('admin-newsletter.campaigns.saveDraft')}
                        </Button>
                    )}

                    {/* Test send — visible when we have a saved campaign */}
                    {savedOnce && campaign?.id && !isReadOnly && campaign?.status === 'draft' && (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setTestSendDialogOpen(true)}
                            disabled={isSending}
                            data-testid="test-send-btn"
                        >
                            {testSendMutation.isPending && (
                                <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            {t('admin-newsletter.campaigns.testSend')}
                        </Button>
                    )}

                    {/* Send campaign — visible when we have a saved draft */}
                    {savedOnce && campaign?.id && !isReadOnly && campaign?.status === 'draft' && (
                        <Button
                            type="button"
                            variant="default"
                            onClick={() => setSendDialogOpen(true)}
                            disabled={isSending}
                            data-testid="send-campaign-btn"
                        >
                            {t('admin-newsletter.campaigns.sendCampaign')}
                        </Button>
                    )}
                </div>

                {/* Cancel send — only when status='sending' */}
                {campaign?.status === 'sending' && (
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={handleCancelSend}
                        disabled={cancelMutation.isPending}
                        data-testid="cancel-send-btn"
                    >
                        {cancelMutation.isPending && (
                            <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        {t('admin-newsletter.campaigns.cancelSend')}
                    </Button>
                )}
            </div>

            {/* Test-send recipient dialog */}
            <TestSendDialog
                open={testSendDialogOpen}
                onOpenChange={setTestSendDialogOpen}
                defaultEmail={actorEmail}
                isPending={testSendMutation.isPending}
                onSubmit={handleTestSend}
            />

            {/* Send confirmation dialog */}
            {campaign && (
                <SendConfirmDialog
                    open={sendDialogOpen}
                    onOpenChange={setSendDialogOpen}
                    campaign={campaign}
                />
            )}

            {/* Cancel-send confirmation dialog */}
            <DeleteConfirmDialog
                open={cancelSendDialogOpen}
                onOpenChange={setCancelSendDialogOpen}
                title={t('admin-newsletter.campaigns.cancelSend')}
                description={t('admin-newsletter.campaigns.cancelSendConfirmDescription')}
                cancelLabel={t('admin-newsletter.campaigns.cancelSendDialogDismiss')}
                confirmLabel={t('admin-newsletter.campaigns.cancelSend')}
                onConfirm={confirmCancelSend}
            />
        </div>
    );
}
