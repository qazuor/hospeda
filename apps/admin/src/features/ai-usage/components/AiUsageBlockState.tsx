/**
 * AiUsageBlockState — Shared presentational state helper for AI usage blocks (SPEC-260 T-019).
 *
 * Renders one of three standard block states — loading, error, or empty — with
 * consistent spacing, icon, and colour. Every AI usage table/chart component
 * delegates its non-data branches to this component so the visual language is
 * identical across all blocks.
 *
 * Usage:
 * ```tsx
 * if (isLoading) return <AiUsageBlockState status="loading" title={t('...')} />;
 * if (isError)   return <AiUsageBlockState status="error"   title={t('...')} hint={t('...')} />;
 * if (!hasData)  return <AiUsageBlockState status="empty"   title={t('...')} hint={t('...')} />;
 * ```
 *
 * @module features/ai-usage/components/AiUsageBlockState
 */

import { LoaderIcon } from '@repo/icons';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The three non-data states a usage block can be in.
 *
 * - `loading` — data is being fetched; renders a spinner + primary text.
 * - `error`   — the request failed; renders a destructive title + muted hint.
 * - `empty`   — data loaded but the result set is empty; renders muted title + hint.
 */
export type AiUsageBlockStatus = 'loading' | 'error' | 'empty';

/**
 * Props for {@link AiUsageBlockState}.
 */
export interface AiUsageBlockStateProps {
    /**
     * Which state to render.
     * Determines icon presence and colour treatment of `title` and `hint`.
     */
    readonly status: AiUsageBlockStatus;
    /**
     * Primary message for the state.
     * Shown in destructive colour for `error`, muted colour for `empty` and `loading`.
     */
    readonly title: string;
    /**
     * Optional secondary hint shown below the title.
     * Not shown for `loading` (pass `undefined` or omit).
     */
    readonly hint?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Shared presentational state block for AI usage dashboard widgets.
 *
 * Rendered inside a `<CardContent>` with `py-10 text-center` padding so all
 * blocks maintain consistent vertical rhythm when in a non-data state.
 *
 * @param props - {@link AiUsageBlockStateProps}
 */
export function AiUsageBlockState({ status, title, hint }: AiUsageBlockStateProps) {
    return (
        <div className="py-10 text-center">
            {status === 'loading' && (
                <LoaderIcon className="mx-auto h-6 w-6 animate-spin text-primary" />
            )}
            <p
                className={[
                    status === 'loading' ? 'mt-3' : '',
                    status === 'error'
                        ? 'text-destructive text-sm'
                        : 'text-muted-foreground text-sm'
                ]
                    .filter(Boolean)
                    .join(' ')}
            >
                {title}
            </p>
            {hint && <p className="mt-1 text-muted-foreground text-xs">{hint}</p>}
        </div>
    );
}
