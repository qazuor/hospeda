import { openSection } from '@/components/entity-form/accordion/section-navigation';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTranslations } from '@/hooks/use-translations';
import { cn } from '@/lib/utils';
import { ArrowRightIcon, CheckCircleIcon, CircleIcon, CrownIcon, SparkleIcon } from '@repo/icons';
import * as React from 'react';
import type { EvaluatedSignal, ScoreResult, SignalHint } from './types';

// ---------------------------------------------------------------------------
// Threshold buckets — keep in sync with the trigger bar styling.
// ---------------------------------------------------------------------------

type Bucket = 'low' | 'medium' | 'high';

function bucketOf(score: number): Bucket {
    if (score < 40) return 'low';
    if (score < 70) return 'medium';
    return 'high';
}

const BUCKET_STYLES: Record<Bucket, { ring: string; bar: string; text: string }> = {
    low: {
        ring: 'ring-destructive/30',
        bar: 'bg-destructive',
        text: 'text-destructive'
    },
    medium: {
        ring: 'ring-warning/30',
        bar: 'bg-warning',
        text: 'text-warning'
    },
    high: {
        ring: 'ring-success/30',
        bar: 'bg-success',
        text: 'text-success'
    }
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface QualityScoreProps {
    /** Result of `computeScore(...)` — caller owns recomputation. */
    readonly result: ScoreResult;
    /** Compact mode used by the sticky reduced header on scroll. */
    readonly compact?: boolean;
    /** Optional extra classes for the trigger. */
    readonly className?: string;
}

/**
 * Quality score widget — the trigger button (number + bar) plus the popover
 * with three groups (Done / Room to improve / Premium upsell).
 *
 * Stateless about its data — the parent passes the precomputed `ScoreResult`,
 * which is what enables "live in edit": the same instance re-renders as the
 * subscribed form values change. The widget owns only the popover open state.
 */
export const QualityScore = React.memo(function QualityScoreComponent({
    result,
    compact = false,
    className
}: QualityScoreProps) {
    const { t } = useTranslations();
    const { score, done, pending, premium } = result;
    const bucket = bucketOf(score);
    const styles = BUCKET_STYLES[bucket];

    const triggerAriaLabel = t('admin-entities.qualityScore.triggerAriaLabel', { score });
    const handleNavigate = React.useCallback((sectionId: string) => {
        openSection(sectionId);
    }, []);

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label={triggerAriaLabel}
                    className={cn(
                        // Layout
                        'inline-flex items-center gap-2 rounded-full',
                        compact ? 'px-2.5 py-1' : 'px-3 py-1.5',
                        // Surface
                        'bg-card ring-1 transition-colors',
                        styles.ring,
                        'hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                        className
                    )}
                    data-testid="quality-score-trigger"
                >
                    <SparkleIcon
                        className={cn('h-4 w-4 flex-none', styles.text)}
                        aria-hidden="true"
                    />
                    <span
                        className={cn(
                            'font-heading font-semibold tabular-nums',
                            compact ? 'text-sm' : 'text-base',
                            styles.text
                        )}
                    >
                        {score}
                    </span>
                    {!compact && (
                        <span
                            className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"
                            aria-hidden="true"
                        >
                            <span
                                className={cn(
                                    'block h-full rounded-full transition-[width] duration-300',
                                    styles.bar
                                )}
                                style={{ width: `${score}%` }}
                            />
                        </span>
                    )}
                    {!compact && (
                        <span className="font-normal text-muted-foreground text-xs">
                            {t('admin-entities.qualityScore.triggerLabel')}
                        </span>
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent
                align="end"
                sideOffset={8}
                className="w-96 p-0"
                data-testid="quality-score-popover"
            >
                <PopoverHeader
                    score={score}
                    bucket={bucket}
                />
                <SignalGroup
                    title={t('admin-entities.qualityScore.groups.done')}
                    count={done.length}
                    emptyMessage={t('admin-entities.qualityScore.emptyDone')}
                    signals={done}
                    variant="done"
                />
                <SignalGroup
                    title={t('admin-entities.qualityScore.groups.pending')}
                    count={pending.length}
                    emptyMessage={t('admin-entities.qualityScore.emptyPending')}
                    signals={pending}
                    variant="pending"
                    actionLabel={t('admin-entities.qualityScore.goToSection')}
                    onNavigate={handleNavigate}
                />
                {premium.length > 0 && (
                    <SignalGroup
                        title={t('admin-entities.qualityScore.groups.premium')}
                        description={t('admin-entities.qualityScore.premiumDescription')}
                        count={premium.length}
                        signals={premium}
                        variant="premium"
                        actionLabel={t('admin-entities.qualityScore.premiumCta')}
                    />
                )}
            </PopoverContent>
        </Popover>
    );
});

QualityScore.displayName = 'QualityScore';

// ---------------------------------------------------------------------------
// Popover header
// ---------------------------------------------------------------------------

function PopoverHeader({ score, bucket }: { score: number; bucket: Bucket }) {
    const { t } = useTranslations();
    const styles = BUCKET_STYLES[bucket];

    return (
        <div className="border-border border-b px-4 py-3">
            <div className="flex items-baseline justify-between">
                <h3 className="font-heading font-semibold text-base text-foreground">
                    {t('admin-entities.qualityScore.popoverHeading')}
                </h3>
                <span className={cn('font-bold font-heading text-2xl tabular-nums', styles.text)}>
                    {score}
                    <span className="ml-0.5 font-normal text-muted-foreground text-sm">/100</span>
                </span>
            </div>
            <div
                className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                aria-hidden="true"
            >
                <span
                    className={cn(
                        'block h-full rounded-full transition-[width] duration-300',
                        styles.bar
                    )}
                    style={{ width: `${score}%` }}
                />
            </div>
            <p className="mt-2 text-muted-foreground text-xs">
                {t('admin-entities.qualityScore.popoverHint')}
            </p>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Signal group + row
// ---------------------------------------------------------------------------

interface SignalGroupProps {
    readonly title: string;
    readonly description?: string;
    readonly count: number;
    readonly emptyMessage?: string;
    readonly signals: readonly EvaluatedSignal[];
    readonly variant: 'done' | 'pending' | 'premium';
    readonly actionLabel?: string;
    readonly onNavigate?: (sectionId: string) => void;
}

function SignalGroup({
    title,
    description,
    count,
    emptyMessage,
    signals,
    variant,
    actionLabel,
    onNavigate
}: SignalGroupProps) {
    return (
        <div className="border-border border-b px-4 py-3 last:border-b-0">
            <div className="mb-2 flex items-center gap-2">
                <h4 className="font-medium text-foreground text-xs uppercase tracking-wide">
                    {title}
                </h4>
                <span className="rounded-full bg-muted px-1.5 py-0.5 font-medium text-muted-foreground text-xs tabular-nums">
                    {count}
                </span>
            </div>
            {description && <p className="mb-2 text-muted-foreground text-xs">{description}</p>}
            {signals.length === 0 && emptyMessage ? (
                <p className="text-muted-foreground text-xs italic">{emptyMessage}</p>
            ) : (
                <ul className="space-y-1.5">
                    {signals.map((signal) => (
                        <SignalRow
                            key={signal.id}
                            signal={signal}
                            variant={variant}
                            actionLabel={actionLabel}
                            onNavigate={onNavigate}
                        />
                    ))}
                </ul>
            )}
        </div>
    );
}

interface SignalRowProps {
    readonly signal: EvaluatedSignal;
    readonly variant: 'done' | 'pending' | 'premium';
    readonly actionLabel?: string;
    readonly onNavigate?: (sectionId: string) => void;
}

function SignalRow({ signal, variant, actionLabel, onNavigate }: SignalRowProps) {
    const { t } = useTranslations();
    const hint = signal.hint ? hintToText(t, signal.hint) : undefined;
    const Icon =
        variant === 'done' ? CheckCircleIcon : variant === 'premium' ? CrownIcon : CircleIcon;

    return (
        <li className="flex items-start gap-2">
            <Icon
                className={cn(
                    'mt-0.5 h-4 w-4 flex-none',
                    variant === 'done' && 'text-success',
                    variant === 'pending' && 'text-muted-foreground',
                    variant === 'premium' && 'text-warning'
                )}
                aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
                <p
                    className={cn(
                        'truncate text-sm',
                        variant === 'premium' ? 'text-muted-foreground' : 'text-foreground'
                    )}
                >
                    {t(signal.labelKey)}
                </p>
                {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
            </div>
            {variant === 'pending' && actionLabel && onNavigate && (
                <button
                    type="button"
                    onClick={() => onNavigate(signal.sectionId)}
                    className="inline-flex flex-none items-center gap-0.5 rounded text-primary text-xs hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    data-testid={`quality-score-goto-${signal.id}`}
                >
                    {actionLabel}
                    <ArrowRightIcon
                        className="h-3 w-3"
                        aria-hidden="true"
                    />
                </button>
            )}
            {variant === 'premium' && actionLabel && (
                <span
                    aria-disabled="true"
                    className="inline-flex flex-none items-center gap-0.5 rounded bg-muted px-2 py-0.5 text-muted-foreground text-xs"
                    data-testid={`quality-score-premium-${signal.id}`}
                >
                    {actionLabel}
                </span>
            )}
        </li>
    );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hintToText(
    t: (key: SignalHint['key'], params?: Record<string, unknown>) => string,
    hint: SignalHint
): string {
    return t(hint.key, hint.params as Record<string, unknown> | undefined);
}
