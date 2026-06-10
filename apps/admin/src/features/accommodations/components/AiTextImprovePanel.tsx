/**
 * @file AiTextImprovePanel.tsx
 * @description AI text-improvement panel for accommodation description and
 * summary fields (SPEC-198 T-009, spec §5.3.7).
 *
 * Renders a trigger button (always visible) and a conditional panel that
 * displays the streaming suggestion, loading skeleton, done state with
 * Accept/Discard, or error state with Dismiss.
 *
 * ## Accessibility
 *
 * - Panel container: `role="region"` with `aria-label` from i18n.
 * - Loading state: `aria-busy="true"` on the skeleton container.
 * - Streaming state: `aria-live="polite"` on the suggestion text area.
 * - Error state: `role="alert"` on the error message container.
 * - Trigger button: `title` attribute with tooltip (upgrade or trigger).
 * - Focus management: when the panel opens (status transitions from idle),
 *   focus moves to the panel region element.
 *
 * ## Safety invariant (mid-stream moderation)
 *
 * When the hook transitions to `error` after streaming tokens, the hook
 * itself discards the accumulated suggestion (sets `suggestion = ''`).
 * This component trusts the hook's state — it never displays partial
 * tokens when `status === 'error'`. The CRITICAL test case in the test
 * file proves this at the UI level.
 */
import { Button } from '@/components/ui-wrapped/Button';
import { useTranslations } from '@/hooks/use-translations';
import { cn } from '@/lib/utils';
import type { TranslationKey } from '@repo/i18n';
import { SparkleIcon } from '@repo/icons';
import type { AiTextImproveFieldType } from '@repo/schemas';
import { useCallback, useEffect, useRef } from 'react';
import { AI_TEXT_IMPROVE_ERROR_CODES, useAiTextImprove } from '../hooks/useAiTextImprove';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** Props for {@link AiTextImprovePanel}. See spec §5.3.7. */
export interface AiTextImprovePanelProps {
    /** Which field the panel is attached to. */
    readonly fieldType: AiTextImproveFieldType;
    /** Current form value at trigger time (sent to the API). */
    readonly fieldValue: string;
    /** Locale for the AI suggestion ('es' | 'en' | 'pt'). Defaults to 'es'. */
    readonly locale?: string;
    /** Called when the HOST accepts a suggestion. Receives the full text. */
    readonly onAccept: (suggestion: string) => void;
    /** Whether the current user's plan includes the AI text-improve entitlement. */
    readonly canUse: boolean;
    /** Optional className forwarded to the outermost wrapper. */
    readonly className?: string;
}

// ---------------------------------------------------------------------------
// Error-code → i18n key resolver
// ---------------------------------------------------------------------------

/**
 * Maps a hook error code to the corresponding i18n key under the
 * `aiTextImprove.error` namespace. Falls back to the `default` key
 * when the code is not one of the known values (defensive — the hook
 * already normalises to `INTERNAL_ERROR` for unknowns).
 */
const resolveErrorI18nKey = (code: string): TranslationKey => {
    const known = AI_TEXT_IMPROVE_ERROR_CODES as readonly string[];
    if (known.includes(code)) {
        return `admin-common.aiTextImprove.error.${code}` as TranslationKey;
    }
    return 'admin-common.aiTextImprove.error.default';
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * AI text-improvement panel. Renders a trigger button and a conditional
 * suggestion panel with streaming display, accept/discard actions, and
 * error handling. See spec §5.3.7 for the full design.
 */
export function AiTextImprovePanel({
    fieldType,
    fieldValue,
    locale = 'es',
    onAccept,
    canUse,
    className
}: AiTextImprovePanelProps) {
    const { t } = useTranslations();
    const { status, suggestion, error, improve, accept, discard } = useAiTextImprove();

    // Ref for focus management: when the panel opens, focus the region.
    const panelRef = useRef<HTMLDivElement>(null);
    const prevStatusRef = useRef(status);

    // Focus the panel region when it transitions from idle to any active state.
    useEffect(() => {
        if (prevStatusRef.current === 'idle' && status !== 'idle' && panelRef.current) {
            panelRef.current.focus();
        }
        prevStatusRef.current = status;
    }, [status]);

    // -----------------------------------------------------------------
    // Handlers
    // -----------------------------------------------------------------

    const handleTrigger = useCallback(() => {
        if (!canUse || status === 'loading' || status === 'streaming') return;
        improve({ fieldType, fieldValue, locale } as Parameters<typeof improve>[0]);
    }, [canUse, status, improve, fieldType, fieldValue, locale]);

    const handleAccept = useCallback(() => {
        const text = accept();
        if (text) {
            onAccept(text);
        }
    }, [accept, onAccept]);

    const handleDiscard = useCallback(() => {
        discard();
    }, [discard]);

    // -----------------------------------------------------------------
    // Derived state
    // -----------------------------------------------------------------

    const isTriggerDisabled = !canUse || status === 'loading' || status === 'streaming';
    const triggerTooltip = canUse
        ? t('admin-common.aiTextImprove.triggerTooltip')
        : t('admin-common.aiTextImprove.upgradeTooltip');
    const showPanel = status !== 'idle';

    // -----------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------

    return (
        <div className={cn('flex flex-col gap-2', className)}>
            {/* Trigger button — always visible */}
            <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isTriggerDisabled}
                title={triggerTooltip}
                onClick={handleTrigger}
                leftIcon={<SparkleIcon className="h-4 w-4" />}
                data-testid="ai-text-improve-trigger"
            >
                {t('admin-common.aiTextImprove.trigger')}
            </Button>

            {/* Panel — rendered only when status !== 'idle' */}
            {showPanel && (
                <section
                    ref={panelRef}
                    aria-label={t('admin-common.aiTextImprove.panelLabel')}
                    tabIndex={-1}
                    className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm"
                    data-testid="ai-text-improve-panel"
                >
                    {/* Loading state */}
                    {status === 'loading' && (
                        <div
                            aria-busy="true"
                            data-testid="ai-text-improve-loading"
                            className="flex flex-col gap-2"
                        >
                            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
                            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                            <span className="text-muted-foreground text-sm">
                                {t('admin-common.aiTextImprove.loading')}
                            </span>
                        </div>
                    )}

                    {/* Streaming state */}
                    {status === 'streaming' && (
                        <div
                            aria-live="polite"
                            data-testid="ai-text-improve-streaming"
                            className="whitespace-pre-wrap text-sm"
                        >
                            {suggestion}
                            <span
                                className="ml-0.5 inline-block animate-pulse text-primary"
                                aria-hidden="true"
                            >
                                |
                            </span>
                        </div>
                    )}

                    {/* Done state */}
                    {status === 'done' && (
                        <div data-testid="ai-text-improve-done">
                            <div className="whitespace-pre-wrap text-sm">{suggestion}</div>
                            <div className="mt-3 flex gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={handleAccept}
                                    data-testid="ai-text-improve-accept"
                                >
                                    {t('admin-common.aiTextImprove.accept')}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleDiscard}
                                    data-testid="ai-text-improve-discard"
                                >
                                    {t('admin-common.aiTextImprove.discard')}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Error state */}
                    {status === 'error' && (
                        <div data-testid="ai-text-improve-error">
                            <div
                                role="alert"
                                className="text-destructive text-sm"
                                data-testid="ai-text-improve-error-message"
                            >
                                {error
                                    ? t(resolveErrorI18nKey(error.code))
                                    : t('admin-common.aiTextImprove.error.default')}
                            </div>
                            <div className="mt-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleDiscard}
                                    data-testid="ai-text-improve-dismiss"
                                >
                                    {t('admin-common.aiTextImprove.dismiss')}
                                </Button>
                            </div>
                        </div>
                    )}
                </section>
            )}
        </div>
    );
}
