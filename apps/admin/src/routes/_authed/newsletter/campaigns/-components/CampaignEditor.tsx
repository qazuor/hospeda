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

import { RichTextEditor } from '@/components/newsletter/RichTextEditor';
import type { TiptapDocument } from '@/components/newsletter/RichTextEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import {
    useCancelCampaign,
    useCreateCampaign,
    useTestSendCampaign,
    useUpdateCampaign
} from '@/hooks/newsletter';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/hooks/use-translations';
import { LoaderIcon } from '@repo/icons';
import type { NewsletterCampaign } from '@repo/schemas';
import { NewsletterCampaignLocaleFilterEnum, NewsletterContentTypeEnum } from '@repo/schemas';
import { renderTiptapContent } from '@repo/utils';
import { useForm } from '@tanstack/react-form';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CampaignPreview } from './CampaignPreview';
import { SendConfirmDialog } from './SendConfirmDialog';

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

// ─── Form state types ─────────────────────────────────────────────────────────

/**
 * Sentinel for the "no segmentation" option in the contentType <Select>.
 * Radix Select does not accept empty-string values, so we use a literal
 * `'all'` token that maps back to `null` when persisting.
 */
const CONTENT_TYPE_ALL = 'all' as const;
type ContentTypeOption = NewsletterContentTypeEnum | typeof CONTENT_TYPE_ALL;

/** Internal form value shape (matches TanStack Form defaultValues). */
interface CampaignFormValues {
    title: string;
    subject: string;
    localeFilter: NewsletterCampaignLocaleFilterEnum;
    /**
     * Audience content-type segmentation.
     * - `null`/`undefined` → no segmentation (legacy behavior).
     * - One of NewsletterContentTypeEnum → only subscribers opted-in for that type.
     */
    contentType: NewsletterContentTypeEnum | null;
    // Using unknown for bodyJson avoids deep TiptapDocument inference issues with @tanstack/react-form.
    // The field is typed as TiptapDocument | null in usage but stored as unknown here
    // to prevent "Type instantiation is excessively deep" TS errors.
    bodyJson: unknown;
}

function buildDefaults(campaign?: NewsletterCampaign): CampaignFormValues {
    return {
        title: campaign?.title ?? '',
        subject: campaign?.subject ?? '',
        localeFilter:
            (campaign?.localeFilter as NewsletterCampaignLocaleFilterEnum) ??
            NewsletterCampaignLocaleFilterEnum.ALL,
        contentType: (campaign?.contentType as NewsletterContentTypeEnum | null) ?? null,
        bodyJson: campaign?.bodyJson ?? null
    };
}

/**
 * Builds the bodyJson payload for API calls, ensuring a valid TipTap doc structure.
 * Cast to satisfy the Zod-inferred schema type.
 */
function buildBodyJson(raw: unknown): { type: 'doc'; content?: unknown[] } {
    if (raw && typeof raw === 'object' && (raw as Record<string, unknown>).type === 'doc') {
        return raw as { type: 'doc'; content?: unknown[] };
    }
    return { type: 'doc', content: [] };
}

// ─── Character counter ────────────────────────────────────────────────────────

interface CharCounterProps {
    readonly value: string;
    readonly max: number;
}

function CharCounter({ value, max }: CharCounterProps) {
    const len = value.length;
    const isOverLimit = len > max;
    return (
        <span
            className={isOverLimit ? 'text-destructive text-xs' : 'text-muted-foreground text-xs'}
            aria-live="polite"
        >
            {len}/{max}
        </span>
    );
}

// ─── Autosave indicator ───────────────────────────────────────────────────────

type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface AutosaveIndicatorProps {
    readonly status: AutosaveStatus;
}

function AutosaveIndicator({ status }: AutosaveIndicatorProps) {
    if (status === 'idle') return null;

    const label =
        status === 'saving' ? 'Guardando...' : status === 'saved' ? 'Guardado' : 'Error al guardar';

    return (
        <span
            aria-live="polite"
            className={`text-xs ${status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}
        >
            {label}
        </span>
    );
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
    const [showPreviewMobile, setShowPreviewMobile] = useState(false);
    const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>('idle');
    // Debounced preview HTML (300ms)
    const [previewHtml, setPreviewHtml] = useState('');
    const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Autosave timer ref (3s debounce)
    const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Stores latest form values to avoid stale closure in autosave timer
    const latestFormValuesRef = useRef<CampaignFormValues>(buildDefaults(campaign));
    // Track if first save has happened (for create mode showing Send button)
    const [savedOnce, setSavedOnce] = useState(!isCreate);

    // ── TanStack Form ────────────────────────────────────────────────────────
    const form = useForm({
        defaultValues: buildDefaults(campaign),
        onSubmit: async ({ value }) => {
            await handleSaveDraft(value);
        }
    });

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

                setAutosaveStatus('saving');
                try {
                    await updateMutation.mutateAsync({
                        title,
                        subject,
                        localeFilter: v.localeFilter as NewsletterCampaignLocaleFilterEnum,
                        contentType: v.contentType,
                        // biome-ignore lint/suspicious/noExplicitAny: required for Zod schema compatibility
                        bodyJson: buildBodyJson(v.bodyJson) as any
                    });
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
        // biome-ignore lint/suspicious/noExplicitAny: required for Zod schema compatibility
        const bodyJson = buildBodyJson(value.bodyJson) as any;

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
            setSavedOnce(true);
            addToast({
                message: t('admin-newsletter.campaigns.savedDraftToast'),
                variant: 'success'
            });
        }
    }

    async function handleTestSend() {
        if (!campaign?.id) return;
        try {
            // Pass undefined explicitly — toEmail is optional in the API
            const result = await testSendMutation.mutateAsync(undefined);
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

    async function handleCancelSend() {
        if (!campaign?.id) return;
        if (
            !window.confirm(
                '¿Cancelar el envío de esta campaña? Los emails en vuelo pueden completarse.'
            )
        )
            return;
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

    // ── Current form values for the preview ──────────────────────────────────
    const currentSubject = form.state.values.subject as string;

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
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            form.handleSubmit();
                        }}
                        className="flex flex-col gap-5"
                        noValidate
                    >
                        {/* Title field */}
                        <form.Field name="title">
                            {(field) => (
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="campaign-title">
                                            {t('admin-newsletter.campaigns.titleField')}
                                            <span className="ml-1 text-destructive">*</span>
                                        </Label>
                                        <CharCounter
                                            value={field.state.value as string}
                                            max={120}
                                        />
                                    </div>
                                    <Input
                                        id="campaign-title"
                                        data-testid="campaign-title-input"
                                        value={field.state.value as string}
                                        onChange={(e) => {
                                            const next = e.target.value;
                                            field.handleChange(next);
                                            scheduleAutosave({
                                                title: next,
                                                subject: form.state.values.subject as string,
                                                localeFilter: form.state.values
                                                    .localeFilter as NewsletterCampaignLocaleFilterEnum,
                                                contentType: form.state.values.contentType,
                                                bodyJson: form.state.values.bodyJson
                                            });
                                        }}
                                        onBlur={field.handleBlur}
                                        disabled={isReadOnly || isSending}
                                        maxLength={120}
                                        placeholder="Nombre interno de la campaña"
                                        aria-required="true"
                                    />
                                    {field.state.meta.errors.length > 0 && (
                                        <p className="text-destructive text-xs">
                                            {String(field.state.meta.errors[0])}
                                        </p>
                                    )}
                                </div>
                            )}
                        </form.Field>

                        {/* Subject field */}
                        <form.Field name="subject">
                            {(field) => (
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="campaign-subject">
                                            {t('admin-newsletter.campaigns.subjectField')}
                                            <span className="ml-1 text-destructive">*</span>
                                        </Label>
                                        <CharCounter
                                            value={field.state.value as string}
                                            max={120}
                                        />
                                    </div>
                                    <Input
                                        id="campaign-subject"
                                        data-testid="campaign-subject-input"
                                        value={field.state.value as string}
                                        onChange={(e) => {
                                            const next = e.target.value;
                                            field.handleChange(next);
                                            scheduleAutosave({
                                                title: form.state.values.title as string,
                                                subject: next,
                                                localeFilter: form.state.values
                                                    .localeFilter as NewsletterCampaignLocaleFilterEnum,
                                                contentType: form.state.values.contentType,
                                                bodyJson: form.state.values.bodyJson
                                            });
                                        }}
                                        onBlur={field.handleBlur}
                                        disabled={isReadOnly || isSending}
                                        maxLength={120}
                                        placeholder="Asunto que verá el destinatario en su bandeja"
                                        aria-required="true"
                                    />
                                    {field.state.meta.errors.length > 0 && (
                                        <p className="text-destructive text-xs">
                                            {String(field.state.meta.errors[0])}
                                        </p>
                                    )}
                                </div>
                            )}
                        </form.Field>

                        {/* Locale filter */}
                        <form.Field name="localeFilter">
                            {(field) => (
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="campaign-locale">
                                        {t('admin-newsletter.campaigns.localeFilterField')}
                                    </Label>
                                    <Select
                                        value={field.state.value as string}
                                        onValueChange={(value) => {
                                            const next =
                                                value as NewsletterCampaignLocaleFilterEnum;
                                            field.handleChange(next);
                                            scheduleAutosave({
                                                title: form.state.values.title as string,
                                                subject: form.state.values.subject as string,
                                                localeFilter: next,
                                                contentType: form.state.values.contentType,
                                                bodyJson: form.state.values.bodyJson
                                            });
                                        }}
                                        disabled={isReadOnly || isSending}
                                    >
                                        <SelectTrigger id="campaign-locale">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem
                                                value={NewsletterCampaignLocaleFilterEnum.ALL}
                                            >
                                                Todos los idiomas
                                            </SelectItem>
                                            <SelectItem
                                                value={NewsletterCampaignLocaleFilterEnum.ES}
                                            >
                                                Español
                                            </SelectItem>
                                            <SelectItem
                                                value={NewsletterCampaignLocaleFilterEnum.EN}
                                            >
                                                English
                                            </SelectItem>
                                            <SelectItem
                                                value={NewsletterCampaignLocaleFilterEnum.PT}
                                            >
                                                Português
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </form.Field>

                        {/* Content-type segmentation */}
                        <form.Field name="contentType">
                            {(field) => {
                                // Map between the form's `NewsletterContentTypeEnum | null`
                                // and the Radix Select's required non-empty string value.
                                const selectValue: ContentTypeOption =
                                    field.state.value ?? CONTENT_TYPE_ALL;

                                return (
                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="campaign-content-type">
                                            Segmentación por tipo de contenido
                                        </Label>
                                        <Select
                                            value={selectValue}
                                            onValueChange={(value) => {
                                                const next: NewsletterContentTypeEnum | null =
                                                    value === CONTENT_TYPE_ALL
                                                        ? null
                                                        : (value as NewsletterContentTypeEnum);
                                                field.handleChange(next);
                                                scheduleAutosave({
                                                    title: form.state.values.title as string,
                                                    subject: form.state.values.subject as string,
                                                    localeFilter: form.state.values
                                                        .localeFilter as NewsletterCampaignLocaleFilterEnum,
                                                    contentType: next,
                                                    bodyJson: form.state.values.bodyJson
                                                });
                                            }}
                                            disabled={isReadOnly || isSending}
                                        >
                                            <SelectTrigger
                                                id="campaign-content-type"
                                                data-testid="campaign-content-type-select"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={CONTENT_TYPE_ALL}>
                                                    Todos los suscriptores (sin segmentar)
                                                </SelectItem>
                                                <SelectItem
                                                    value={NewsletterContentTypeEnum.OFFERS}
                                                >
                                                    Ofertas
                                                </SelectItem>
                                                <SelectItem
                                                    value={NewsletterContentTypeEnum.EVENTS}
                                                >
                                                    Eventos
                                                </SelectItem>
                                                <SelectItem
                                                    value={NewsletterContentTypeEnum.GUIDES}
                                                >
                                                    Guías
                                                </SelectItem>
                                                <SelectItem
                                                    value={NewsletterContentTypeEnum.PRODUCT_NEWS}
                                                >
                                                    Novedades del producto
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p className="text-muted-foreground text-xs">
                                            Solo los suscriptores con esta preferencia activa
                                            recibirán la campaña. Dejar en &quot;sin segmentar&quot;
                                            envía a toda la audiencia que cumpla el filtro de
                                            idioma.
                                        </p>
                                    </div>
                                );
                            }}
                        </form.Field>

                        {/* Rich text body */}
                        <form.Field name="bodyJson">
                            {(field) => (
                                <div className="flex flex-col gap-1.5">
                                    <Label>
                                        {t('admin-newsletter.campaigns.bodyField')}
                                        <span className="ml-1 text-destructive">*</span>
                                    </Label>
                                    <RichTextEditor
                                        value={field.state.value as TiptapDocument | null}
                                        onChange={(next) => {
                                            field.handleChange(next);
                                            schedulePreviewUpdate(next);
                                            scheduleAutosave({
                                                title: form.state.values.title as string,
                                                subject: form.state.values.subject as string,
                                                localeFilter: form.state.values
                                                    .localeFilter as NewsletterCampaignLocaleFilterEnum,
                                                contentType: form.state.values.contentType,
                                                bodyJson: next
                                            });
                                        }}
                                        disabled={isReadOnly || isSending}
                                        ariaLabel="Contenido del email"
                                        className="min-h-[300px]"
                                    />
                                </div>
                            )}
                        </form.Field>

                        {/* Hidden submit trigger — visually hidden, not focusable.
                            aria-label keeps axe happy; sr-only + tabIndex=-1 keep it
                            invisible/unreachable to mouse + keyboard users. */}
                        <button
                            type="submit"
                            className="sr-only"
                            tabIndex={-1}
                            aria-label="Enviar formulario"
                        />
                    </form>
                </div>

                {/* ── Right column: preview (40% = 2/5) ── */}
                <div className={`lg:col-span-2 ${showPreviewMobile ? 'block' : 'hidden'} lg:block`}>
                    <CampaignPreview
                        html={previewHtml}
                        subject={currentSubject}
                    />
                </div>
            </div>

            {/* ── Sticky action bar ── */}
            <div className="-mx-4 sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-border border-t bg-background/95 px-4 py-3 backdrop-blur-sm">
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
                            onClick={handleTestSend}
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

            {/* Send confirmation dialog */}
            {campaign && (
                <SendConfirmDialog
                    open={sendDialogOpen}
                    onOpenChange={setSendDialogOpen}
                    campaign={campaign}
                />
            )}
        </div>
    );
}
