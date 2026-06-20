import { useEntityFormContext } from '@/components/entity-form/context/EntityFormContext';
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
import { Button } from '@/components/ui-wrapped/Button';
import { useTranslations } from '@/hooks/use-translations';
import { SparkleIcon } from '@repo/icons';
import type { AiPostGenerateDraft, AiPostGenerateRequest } from '@repo/schemas';
import {
    AiPostGenerateRequestSchema,
    AiPostGenerateToneSchema,
    PostCategoryEnum
} from '@repo/schemas';
import { useCallback, useReducer, useRef } from 'react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Spanish labels for PostCategoryEnum — mirrors basic-info.consolidated.ts */
const POST_CATEGORY_LABELS: Record<string, string> = {
    EVENTS: 'Eventos',
    CULTURE: 'Cultura',
    GASTRONOMY: 'Gastronomía',
    NATURE: 'Naturaleza',
    TOURISM: 'Turismo',
    GENERAL: 'General',
    SPORT: 'Deporte',
    CARNIVAL: 'Carnaval',
    NIGHTLIFE: 'Vida Nocturna',
    HISTORY: 'Historia',
    TRADITIONS: 'Tradiciones',
    WELLNESS: 'Bienestar',
    FAMILY: 'Familia',
    TIPS: 'Consejos',
    ART: 'Arte',
    BEACH: 'Playa',
    RURAL: 'Rural',
    FESTIVALS: 'Festivales'
};

const ENDPOINT = '/api/v1/admin/ai/post-generate';

// ---------------------------------------------------------------------------
// Panel state machine
// ---------------------------------------------------------------------------

type PanelStatus = 'idle' | 'generating' | 'draft-ready' | 'error';

interface PanelState {
    /** Current UI phase. */
    status: PanelStatus;
    /** Draft from a successful generation — only present in 'draft-ready'. */
    draft: AiPostGenerateDraft | null;
    /** Mapped error key (i18n suffix after `posts.aiGenerate.`). */
    errorKey: string | null;
    /** Inline validation errors for the panel form fields. */
    validationErrors: Partial<Record<keyof AiPostGenerateRequest, string>>;
    /** Currently entered topic text. */
    topic: string;
    /** Currently entered points list. */
    points: string[];
    /** Selected category (optional). */
    category: string;
    /** Selected tone. */
    tone: string;
    /** Selected locale. */
    locale: string;
}

type PanelAction =
    | { type: 'set_topic'; value: string }
    | { type: 'add_point' }
    | { type: 'update_point'; index: number; value: string }
    | { type: 'remove_point'; index: number }
    | { type: 'set_category'; value: string }
    | { type: 'set_tone'; value: string }
    | { type: 'set_locale'; value: string }
    | { type: 'validation_errors'; errors: Partial<Record<keyof AiPostGenerateRequest, string>> }
    | { type: 'generating' }
    | { type: 'draft_ready'; draft: AiPostGenerateDraft }
    | { type: 'error'; errorKey: string }
    | { type: 'discard' };

const initialState: PanelState = {
    status: 'idle',
    draft: null,
    errorKey: null,
    validationErrors: {},
    topic: '',
    points: [''],
    category: '',
    tone: 'neutral',
    locale: 'es'
};

function panelReducer(state: PanelState, action: PanelAction): PanelState {
    switch (action.type) {
        case 'set_topic':
            return { ...state, topic: action.value };
        case 'add_point':
            if (state.points.length >= 10) return state;
            return { ...state, points: [...state.points, ''] };
        case 'update_point': {
            const updated = [...state.points];
            updated[action.index] = action.value;
            return { ...state, points: updated };
        }
        case 'remove_point': {
            if (state.points.length <= 1) return state;
            const filtered = state.points.filter((_, i) => i !== action.index);
            return { ...state, points: filtered };
        }
        case 'set_category':
            return { ...state, category: action.value };
        case 'set_tone':
            return { ...state, tone: action.value };
        case 'set_locale':
            return { ...state, locale: action.value };
        case 'validation_errors':
            return { ...state, validationErrors: action.errors, status: 'idle' };
        case 'generating':
            return {
                ...state,
                status: 'generating',
                errorKey: null,
                validationErrors: {},
                draft: null
            };
        case 'draft_ready':
            return { ...state, status: 'draft-ready', draft: action.draft, errorKey: null };
        case 'error':
            return { ...state, status: 'error', errorKey: action.errorKey, draft: null };
        case 'discard':
            return { ...state, status: 'idle', draft: null, errorKey: null };
        default:
            return state;
    }
}

// ---------------------------------------------------------------------------
// Error code → i18n key suffix mapper
// ---------------------------------------------------------------------------

function mapErrorKey(status: number, code: string): string {
    if (status === 422 || code === 'MODERATION_FAILED') return 'errorModeration';
    if (status === 429 || code === 'AI_CEILING_HIT') return 'errorCeiling';
    if (status === 503 || code === 'exhausted') return 'errorExhausted';
    return 'errorGeneric';
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
    // biome-ignore lint/suspicious/noExplicitAny: context may be unavailable in test
    let formContext: any = null;
    try {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        formContext = useEntityFormContext();
    } catch {
        // Not inside EntityFormProvider (e.g. standalone test) — use onDraftReady
    }

    const [state, dispatch] = useReducer(panelReducer, initialState);
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
            const res = await fetch(ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(validation.data),
                signal: abortRef.current.signal
            });

            const json = await res.json();

            if (!res.ok) {
                const code = (json?.code as string) ?? '';
                dispatch({ type: 'error', errorKey: mapErrorKey(res.status, code) });
                return;
            }

            dispatch({ type: 'draft_ready', draft: json as AiPostGenerateDraft });
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
    const tKey = (suffix: string) => t(`posts.aiGenerate.${suffix}` as Parameters<typeof t>[0]);

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
