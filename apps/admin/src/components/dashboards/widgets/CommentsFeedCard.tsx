/**
 * CommentsFeedCard — Recent comments feed widget (SPEC-165 T-016).
 *
 * Renders the EDITOR dashboard "Card H" as a live feed of recent comments
 * across posts and events. Each row shows:
 *   - Entity-type badge (POST / EVENT)
 *   - Content excerpt (~80 chars, with ellipsis)
 *   - Author name
 *   - Moderation-state badge (APPROVED → success, REJECTED → destructive, PENDING → outline)
 *   - Relative timestamp
 *
 * ## Permission AND-gate (AC-31)
 *
 * The card is hidden entirely when the current user lacks BOTH
 * POST_COMMENT_VIEW AND EVENT_COMMENT_VIEW. This is an AND-gate: both
 * permissions are required because the feed mixes both entity types.
 *
 * The `widget.permissions` field in the IA config declares `['POST_COMMENT_VIEW',
 * 'EVENT_COMMENT_VIEW']` as an OR-gate (schema limitation), so the actual AND
 * check is enforced here using `useHasPermission`. This is the canonical way to
 * add stricter permission logic than the IA config supports.
 *
 * ## Empty state (AC-32)
 *
 * When the endpoint returns an empty array the card renders a localised empty
 * message from `comments.homeCard.empty`.
 *
 * @module CommentsFeedCard
 * @see apps/admin/src/lib/dashboard-sources/editor.ts — `editor.comments.recent`
 * @see apps/admin/src/config/ia/dashboards.ts — `editor-card-h`
 * @see SPEC-165 T-016
 */

import type { Widget } from '@/config/ia/schema';
import { useDashboardResolver } from '@/contexts/dashboard-resolver-context';
import { useHasPermission } from '@/hooks/use-auth-context';
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { useQuery } from '@tanstack/react-query';
import type { RecentCommentItem } from '../../../lib/dashboard-sources/editor';
import {
    WidgetCard,
    WidgetEmptyBody,
    WidgetErrorBody,
    WidgetSkeletonBody,
    WidgetUnavailableBody
} from './widget-states';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum content excerpt length in characters before truncation. */
const EXCERPT_MAX_LENGTH = 80;

/** Permissions required to view this card (AND-gate). */
const REQUIRED_PERMISSIONS = ['POST_COMMENT_VIEW', 'EVENT_COMMENT_VIEW'] as const;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Truncates a comment body to `EXCERPT_MAX_LENGTH` characters.
 * Appends "…" when the content is truncated.
 */
function truncateExcerpt(content: string): string {
    if (content.length <= EXCERPT_MAX_LENGTH) return content;
    return `${content.slice(0, EXCERPT_MAX_LENGTH)}…`;
}

/**
 * Formats a UTC ISO timestamp as a relative human-readable string in Spanish.
 *
 * Uses the `Intl.RelativeTimeFormat` API with fixed thresholds:
 *   < 60 s   → "hace N segundos"
 *   < 60 min → "hace N minutos"
 *   < 24 h   → "hace N horas"
 *   otherwise → "hace N días"
 */
function formatRelativeTime(isoTimestamp: string): string {
    const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
    const diffMs = Date.now() - new Date(isoTimestamp).getTime();
    const diffSec = Math.floor(diffMs / 1_000);

    if (diffSec < 60) return rtf.format(-diffSec, 'seconds');
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return rtf.format(-diffMin, 'minutes');
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return rtf.format(-diffH, 'hours');
    return rtf.format(-Math.floor(diffH / 24), 'days');
}

// ============================================================================
// MODERATION BADGE
// ============================================================================

/** Tailwind classes for each moderation state badge variant. */
const MODERATION_BADGE_CLASSES: Readonly<Record<RecentCommentItem['moderationState'], string>> = {
    APPROVED: 'bg-success/10 text-success ring-success/20 ring-1 ring-inset',
    REJECTED: 'bg-destructive/10 text-destructive ring-destructive/20 ring-1 ring-inset',
    PENDING: 'bg-muted text-muted-foreground ring-border ring-1 ring-inset'
};

/** Moderation state → i18n key mapping. */
const MODERATION_LABEL_KEYS: Readonly<
    Record<RecentCommentItem['moderationState'], TranslationKey>
> = {
    APPROVED: 'comments.moderation.approved' as TranslationKey,
    REJECTED: 'comments.moderation.rejected' as TranslationKey,
    PENDING: 'comments.moderation.pending' as TranslationKey
};

// ============================================================================
// ENTITY-TYPE BADGE
// ============================================================================

/** Tailwind classes per entity type. */
const ENTITY_BADGE_CLASSES: Readonly<Record<RecentCommentItem['entityType'], string>> = {
    POST: 'bg-success/10 text-success',
    EVENT: 'bg-sky-100 text-sky-700'
};

// ============================================================================
// ITEM ROW
// ============================================================================

/**
 * Props for a single comment row.
 */
interface CommentRowProps {
    readonly item: RecentCommentItem;
}

/**
 * Renders a single recent comment row:
 * entity-type badge | excerpt | author | moderation badge | timestamp.
 */
function CommentRow({ item }: CommentRowProps) {
    const { t } = useTranslations();
    const excerpt = truncateExcerpt(item.content);
    const relativeTime = formatRelativeTime(item.createdAt);
    const moderationLabel = t(MODERATION_LABEL_KEYS[item.moderationState]);

    return (
        <li
            className="flex items-start gap-3 border-border border-b py-3 first:pt-0 last:border-b-0 last:pb-0"
            data-testid="comment-feed-item"
        >
            {/* Entity-type badge */}
            <span
                className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 font-semibold text-[0.65rem] uppercase tracking-wide ${ENTITY_BADGE_CLASSES[item.entityType]}`}
                data-testid="comment-entity-badge"
            >
                {item.entityType}
            </span>

            {/* Content excerpt + author */}
            <div className="min-w-0 flex-1">
                <p
                    className="text-foreground text-sm leading-snug"
                    data-testid="comment-excerpt"
                >
                    {excerpt}
                </p>
                <p
                    className="mt-0.5 text-muted-foreground text-xs"
                    data-testid="comment-author"
                >
                    {item.authorName}
                </p>
            </div>

            {/* Moderation state + timestamp */}
            <div className="flex shrink-0 flex-col items-end gap-1">
                <span
                    className={`rounded-full px-2 py-0.5 font-semibold text-[0.65rem] uppercase tracking-wide ${MODERATION_BADGE_CLASSES[item.moderationState]}`}
                    data-testid="comment-moderation-badge"
                >
                    {moderationLabel}
                </span>
                <span
                    className="text-[0.65rem] text-muted-foreground tabular-nums"
                    data-testid="comment-timestamp"
                >
                    {relativeTime}
                </span>
            </div>
        </li>
    );
}

// ============================================================================
// PROPS
// ============================================================================

/**
 * Props for CommentsFeedCard.
 * Follows the RO-RO pattern — single readonly object.
 */
export interface CommentsFeedCardProps {
    /**
     * Full widget definition from the IA config.
     * The renderer reads `widget.config.source`, `widget.scope`, `widget.label`,
     * and `widget.config.maxItems` from this object.
     */
    readonly widget: Widget;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * CommentsFeedCard — live recent-comments feed for the EDITOR dashboard card H.
 *
 * Hides itself entirely (renders `null`) when the current user lacks
 * POST_COMMENT_VIEW OR EVENT_COMMENT_VIEW (AND-gate — both must be held).
 * This satisfies AC-31.
 *
 * Renders an empty-state message when the resolver returns an empty array
 * (AC-32).
 *
 * @example
 * ```tsx
 * <CommentsFeedCard widget={widget} />
 * ```
 */
export function CommentsFeedCard({ widget }: CommentsFeedCardProps) {
    // -- 0. AND permission gate (AC-31) --------------------------------------
    // Both permissions must be present; if either is missing the card is hidden.
    const canViewPostComments = useHasPermission(REQUIRED_PERMISSIONS[0]);
    const canViewEventComments = useHasPermission(REQUIRED_PERMISSIONS[1]);

    const { t } = useTranslations();

    // -- 1. Extract source id and config overrides ---------------------------
    const config = (widget.config ?? {}) as {
        source?: string;
        maxItems?: number;
        accent?: string;
        icon?: string;
    };
    const sourceId = config.source ?? '';

    // -- 2. Resolve to query options (always — hooks cannot be conditional) --
    const { resolveForScope } = useDashboardResolver();
    const { found, options } = resolveForScope(sourceId, widget.scope);

    // -- 3. Fetch with TanStack Query ----------------------------------------
    const { data, isLoading, error, refetch } = useQuery(options);

    // -- 4. Permission check (AC-31) — return null AFTER all hooks -----------
    if (!canViewPostComments || !canViewEventComments) {
        return null;
    }

    const displayLabel = widget.label.es;

    // -- 5. Unavailable (source not registered) ------------------------------
    if (!found) {
        return (
            <WidgetCard
                label={displayLabel}
                variant="list"
                dataTestId="comments-feed-card"
                accent={config.accent}
                icon={config.icon}
            >
                <WidgetUnavailableBody variant="list" />
            </WidgetCard>
        );
    }

    // -- 6. Loading ----------------------------------------------------------
    if (isLoading) {
        return (
            <WidgetCard
                label={displayLabel}
                variant="list"
                dataTestId="comments-feed-card"
                accent={config.accent}
                icon={config.icon}
            >
                <WidgetSkeletonBody variant="list" />
            </WidgetCard>
        );
    }

    // -- 7. Error ------------------------------------------------------------
    if (error) {
        return (
            <WidgetCard
                label={displayLabel}
                variant="list"
                dataTestId="comments-feed-card"
                accent={config.accent}
                icon={config.icon}
            >
                <WidgetErrorBody
                    variant="list"
                    onRetry={() => void refetch()}
                />
            </WidgetCard>
        );
    }

    // -- 8. Empty (null / undefined / empty array) ---------------------------
    const rawItems = Array.isArray(data) ? (data as RecentCommentItem[]) : [];
    const slicedItems =
        config.maxItems !== undefined ? rawItems.slice(0, config.maxItems) : rawItems;

    if (slicedItems.length === 0) {
        return (
            <WidgetCard
                label={displayLabel}
                variant="list"
                dataTestId="comments-feed-card"
                accent={config.accent}
                icon={config.icon}
            >
                <WidgetEmptyBody
                    variant="list"
                    text={t('comments.homeCard.empty' as TranslationKey)}
                    icon={config.icon}
                />
            </WidgetCard>
        );
    }

    // -- 9. Data — render the comments feed ----------------------------------
    return (
        <WidgetCard
            label={displayLabel}
            variant="list"
            dataTestId="comments-feed-card"
            accent={config.accent}
            icon={config.icon}
        >
            <ul
                className="divide-y divide-transparent"
                data-testid="comments-feed-list"
            >
                {slicedItems.map((item) => (
                    <CommentRow
                        key={item.id}
                        item={item}
                    />
                ))}
            </ul>
        </WidgetCard>
    );
}
