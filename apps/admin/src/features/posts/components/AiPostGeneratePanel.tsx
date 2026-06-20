/**
 * @file AiPostGeneratePanel.tsx
 * @description AI post-generation panel for the post editor (SPEC-223 T-009).
 *
 * Renders a collapsible panel with inputs (topic, key points, optional
 * category/tone/locale) and a "Generar" button that calls
 * `POST /api/v1/admin/ai/post-generate`.
 *
 * The panel is designed to be embedded as a `customRender` section inside the
 * post entity form (via `useEntityFormContext`). On a successful response it
 * calls `setFieldValue` directly on the parent form's title, summary, and
 * content fields — no `onDraftReady` callback is threaded through route files.
 *
 * ## Response envelope
 *
 * The API wraps its response in the project's standard envelope:
 * - Success: `{ success: true, data: { title, summary, content } }`
 * - Error:   `{ success: false, error: { code: string } }`
 *
 * ## Error handling
 *
 * - 422 MODERATION_FAILED → `errorModeration` i18n key.
 * - 429 AI_CEILING_HIT   → `errorCeiling` i18n key.
 * - 503 (exhausted)      → `errorExhausted` i18n key.
 * - anything else        → `errorGeneric` i18n key.
 *
 * Errors NEVER mutate the parent form fields.
 *
 * ## Draft apply / discard (US-2)
 *
 * After a successful generation the panel shows "Aplicar borrador" and
 * "Descartar" buttons. "Aplicar" writes the draft into the form; "Descartar"
 * clears the local draft state without touching the form.
 */
import { EntityFormContext } from '@/components/entity-form/context/EntityFormContext';
import type { EntityFormContextValue } from '@/components/entity-form/context/EntityFormContext';
import { Button } from '@/components/ui-wrapped/Button';
import { useTranslations } from '@/hooks/use-translations';
import { SparkleIcon } from '@repo/icons';
import type { AiPostGenerateDraft, AiPostGenerateRequest } from '@repo/schemas';
import {
    AiPostGenerateRequestSchema,
    AiPostGenerateToneSchema,
    PostCategoryEnum
} from '@repo/schemas';
import { useCallback, useContext, useReducer, useRef } from 'react';
import { initialPanelState, panelReducer } from './ai-post-generate-panel.state';
import {
    AI_POST_GENERATE_ENDPOINT,
    POST_CATEGORY_LABELS,
    mapErrorKey
} from './ai-post-generate-panel.utils';

// ---------------------------------------------------------------------------
// Context helper
// ---------------------------------------------------------------------------

/**
 * Returns the EntityFormContextValue if the component is mounted inside an
 * EntityFormProvider, or `null` if it is not (e.g. standalone test usage).
 *
 * Using `useContext` directly (instead of the throwing `useEntityFormContext`
 * hook) avoids the try/catch conditional-hook pattern and removes the need for
 * an `any` annotation.
 */
function useEntityFormContextOptional(): EntityFormContextValue | null {
    return useContext(EntityFormContext);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Props for {@link AiPostGeneratePanel}.
 *
 * When used as a `customRender` section inside the consolidated config, the
 * panel accesses the form via `useEntityFormContext` — no extra props needed.
 * The optional `onDraftReady` callback is provided for standalone / test usage
 * where no form context is available.
 */
export interface AiPostGeneratePanelProps {
    /**
     * Optional callback invoked with the generated draft.
     * If omitted the panel uses `useEntityFormContext().setFieldValue` directly.
     */
    readonly onDraftReady?: (draft: AiPostGenerateDraft) => void;
}

/**
 * AI post-generation panel.
 *
 * Shows a form to supply a topic and key points (plus optional category/tone/locale),
 * calls the admin AI post-generate endpoint, and populates the parent post form
 * with the resulting title, summary, and content.
 */
export function AiPostGeneratePanel({ onDraftReady }: AiPostGeneratePanelProps) {
    const { t } = useTranslations();
    const formContext = useEntityFormContextOptional();

    const [state, dispatch] = useReducer(panelReducer, initialPanelState);
    const abortRef = useRef<AbortController | null>(null);

    // -----------------------------------------------------------------------
    // Handlers
    // -----------------------------------------------------------------------

    const handleTopicChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        dispatch({ type: 'set_topic', value: e.target.value });
    }, []);

    const handlePointChange = useCallback(
        (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
            dispatch({ type: 'update_point', index, value: e.target.value });
        },
        []
    );

    const handleAddPoint = useCallback(() => {
        dispatch({ type: 'add_point' });
    }, []);

    const handleRemovePoint = useCallback((index: number) => {
        dispatch({ type: 'remove_point', index });
    }, []);

    const handleCategoryChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        dispatch({ type: 'set_category', value: e.target.value });
    }, []);

    const handleToneChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        dispatch({ type: 'set_tone', value: e.target.value });
    }, []);

    const handleLocaleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        dispatch({ type: 'set_locale', value: e.target.value });
    }, []);

    const handleGenerate = useCallback(async () => {
        // Build the request object
        const filledPoints = state.points.filter((p) => p.trim().length > 0);
        const requestBody: AiPostGenerateRequest = {
            topic: state.topic,
            points: filledPoints,
            ...(state.category ? { category: state.category as PostCategoryEnum } : {}),
            ...(state.tone && state.tone !== 'neutral'
                ? { tone: state.tone as 'formal' | 'informal' | 'neutral' }
                : state.tone === 'neutral'
                  ? { tone: 'neutral' as const }
                  : {}),
            ...(state.locale && state.locale !== 'es'
                ? { locale: state.locale as 'es' | 'en' | 'pt' }
                : state.locale === 'es'
                  ? { locale: 'es' as const }
                  : {})
        };

        // Client-side Zod validation before sending
        const validation = AiPostGenerateRequestSchema.safeParse(requestBody);
        if (!validation.success) {
            const errors: Partial<Record<keyof AiPostGenerateRequest, string>> = {};
            for (const issue of validation.error.issues) {
                const path = issue.path[0] as keyof AiPostGenerateRequest;
                if (path) errors[path] = issue.message;
            }
            dispatch({ type: 'validation_errors', errors });
            return;
        }

        dispatch({ type: 'generating' });
        abortRef.current?.abort();
        abortRef.current = new AbortController();

        try {
            const res = await fetch(AI_POST_GENERATE_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(validation.data),
                signal: abortRef.current.signal
            });

            const json = await res.json();

            if (!res.ok) {
                // API wraps errors as: { success: false, error: { code } }
                const code = (json?.error?.code as string) ?? '';
                dispatch({ type: 'error', errorKey: mapErrorKey(res.status, code) });
                return;
            }

            // API wraps success as: { success: true, data: { title, summary, content } }
            const draft = (json?.data ?? json) as AiPostGenerateDraft;
            dispatch({ type: 'draft_ready', draft });
        } catch (err) {
            if ((err as Error).name === 'AbortError') return;
            dispatch({ type: 'error', errorKey: 'errorGeneric' });
        }
    }, [state.topic, state.points, state.category, state.tone, state.locale]);

    const handleApply = useCallback(() => {
        if (!state.draft) return;
        if (onDraftReady) {
            onDraftReady(state.draft);
        } else if (formContext) {
            formContext.setFieldValue('title', state.draft.title);
            formContext.setFieldValue('summary', state.draft.summary);
            formContext.setFieldValue('content', state.draft.content);
        }
        dispatch({ type: 'discard' });
    }, [state.draft, onDraftReady, formContext]);

    const handleDiscard = useCallback(() => {
        dispatch({ type: 'discard' });
    }, []);

    // -----------------------------------------------------------------------
    // Derived
    // -----------------------------------------------------------------------
    const isGenerating = state.status === 'generating';
    const tKey = (suffix: string) =>
        t(`admin-pages.posts.aiGenerate.${suffix}` as Parameters<typeof t>[0]);

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------
    return (
        <div
            className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4"
            data-testid="ai-post-generate-panel"
        >
            {/* Header */}
            <div className="flex items-center gap-2">
                <SparkleIcon className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-base text-card-foreground">
                    {tKey('panelTitle')}
                </h3>
            </div>
            <p className="text-muted-foreground text-sm">{tKey('description')}</p>

            {/* Topic field */}
            <div className="flex flex-col gap-1">
                <label
                    htmlFor="ai-post-topic"
                    className="font-medium text-foreground text-sm"
                >
                    {tKey('topicLabel')}
                </label>
                <input
                    id="ai-post-topic"
                    type="text"
                    value={state.topic}
                    onChange={handleTopicChange}
                    placeholder={tKey('topicPlaceholder')}
                    disabled={isGenerating}
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                    data-testid="ai-post-topic"
                />
                {state.validationErrors.topic && (
                    <p
                        role="alert"
                        className="text-destructive text-xs"
                    >
                        {state.validationErrors.topic}
                    </p>
                )}
            </div>

            {/* Key points */}
            <div className="flex flex-col gap-2">
                <span className="font-medium text-foreground text-sm">{tKey('pointsLabel')}</span>
                {state.points.map((point, index) => (
                    <div
                        key={`point-${
                            // biome-ignore lint/suspicious/noArrayIndexKey: dynamic list, no stable id
                            index
                        }`}
                        className="flex items-center gap-2"
                    >
                        <input
                            type="text"
                            value={point}
                            onChange={(e) => handlePointChange(index, e)}
                            placeholder={tKey('pointsPlaceholder')}
                            disabled={isGenerating}
                            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                            data-testid={`ai-post-point-${index}`}
                        />
                        {state.points.length > 1 && (
                            <button
                                type="button"
                                onClick={() => handleRemovePoint(index)}
                                disabled={isGenerating}
                                aria-label={tKey('pointsRemove')}
                                className="shrink-0 text-muted-foreground text-sm hover:text-destructive disabled:opacity-50"
                                data-testid={`ai-post-remove-point-${index}`}
                            >
                                {tKey('pointsRemove')}
                            </button>
                        )}
                    </div>
                ))}
                {state.points.length < 10 && (
                    <button
                        type="button"
                        onClick={handleAddPoint}
                        disabled={isGenerating}
                        className="self-start text-primary text-sm hover:underline disabled:opacity-50"
                        data-testid="ai-post-add-point"
                    >
                        {tKey('pointsAdd')}
                    </button>
                )}
                {state.validationErrors.points && (
                    <p
                        role="alert"
                        className="text-destructive text-xs"
                    >
                        {state.validationErrors.points}
                    </p>
                )}
            </div>

            {/* Optional fields row */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {/* Category */}
                <div className="flex flex-col gap-1">
                    <label
                        htmlFor="ai-post-category"
                        className="font-medium text-foreground text-sm"
                    >
                        {tKey('categoryLabel')}
                    </label>
                    <select
                        id="ai-post-category"
                        value={state.category}
                        onChange={handleCategoryChange}
                        disabled={isGenerating}
                        className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                        data-testid="ai-post-category"
                    >
                        <option value="">—</option>
                        {Object.values(PostCategoryEnum).map((value) => (
                            <option
                                key={value}
                                value={value}
                            >
                                {POST_CATEGORY_LABELS[value] ?? value}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Tone */}
                <div className="flex flex-col gap-1">
                    <label
                        htmlFor="ai-post-tone"
                        className="font-medium text-foreground text-sm"
                    >
                        {tKey('toneLabel')}
                    </label>
                    <select
                        id="ai-post-tone"
                        value={state.tone}
                        onChange={handleToneChange}
                        disabled={isGenerating}
                        className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                        data-testid="ai-post-tone"
                    >
                        {AiPostGenerateToneSchema.options.map((value) => (
                            <option
                                key={value}
                                value={value}
                            >
                                {tKey(`tone${value.charAt(0).toUpperCase()}${value.slice(1)}`)}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Locale */}
                <div className="flex flex-col gap-1">
                    <label
                        htmlFor="ai-post-locale"
                        className="font-medium text-foreground text-sm"
                    >
                        {tKey('localeLabel')}
                    </label>
                    <select
                        id="ai-post-locale"
                        value={state.locale}
                        onChange={handleLocaleChange}
                        disabled={isGenerating}
                        className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                        data-testid="ai-post-locale"
                    >
                        {(['es', 'en', 'pt'] as const).map((loc) => (
                            <option
                                key={loc}
                                value={loc}
                            >
                                {loc === 'es' ? 'Español' : loc === 'en' ? 'English' : 'Português'}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Generate button */}
            <Button
                type="button"
                onClick={handleGenerate}
                loading={isGenerating}
                disabled={isGenerating}
                leftIcon={<SparkleIcon className="h-4 w-4" />}
                data-testid="ai-post-generate-btn"
            >
                {isGenerating ? tKey('generating') : tKey('generate')}
            </Button>

            {/* Error banner */}
            {state.status === 'error' && state.errorKey && (
                <div
                    role="alert"
                    className="rounded-md bg-destructive/10 px-3 py-2 text-destructive text-sm"
                    data-testid="ai-post-error"
                >
                    {tKey(state.errorKey)}
                </div>
            )}

            {/* Draft ready — preview + apply/discard */}
            {state.status === 'draft-ready' && state.draft && (
                <div
                    className="flex flex-col gap-3 rounded-md border border-border bg-muted/30 p-3"
                    data-testid="ai-post-draft-preview"
                >
                    <p className="font-semibold text-sm">{state.draft.title}</p>
                    <p className="text-muted-foreground text-xs">{state.draft.summary}</p>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            size="sm"
                            onClick={handleApply}
                            data-testid="ai-post-apply"
                        >
                            {tKey('apply')}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleDiscard}
                            data-testid="ai-post-discard"
                        >
                            {tKey('discard')}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
