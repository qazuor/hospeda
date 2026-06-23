/**
 * @file SocialPostAuditTab.tsx
 * @description Audit tab for the social post detail page (SPEC-254 T-040).
 * Fetches audit-log entries for the given post from the admin audit endpoint
 * and renders them with actor, event type, and timestamp.
 */

import { useTranslations } from '@/hooks/use-translations';
import { fetchApi } from '@/lib/api/client';

import { useQuery } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuditLogEntry {
    readonly id: string;
    readonly actorId?: string;
    readonly eventType: string;
    readonly entityType: string;
    readonly entityId: string;
    readonly createdAt: string;
}

interface AuditLogResponse {
    readonly success: boolean;
    readonly data: {
        readonly items: AuditLogEntry[];
    };
}

/** Props for the SocialPostAuditTab component. */
export interface SocialPostAuditTabProps {
    readonly postId: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetches audit-log entries for a given social post from the admin endpoint.
 *
 * @param postId - The social post ID to fetch audit entries for.
 * @returns TanStack Query result with the array of audit entries.
 */
export function useAuditLog(postId: string) {
    return useQuery({
        queryKey: ['social-audit-log', postId],
        queryFn: async () => {
            const result = await fetchApi<AuditLogResponse>({
                path: `/api/v1/admin/social/audit-log?entityType=social_post&entityId=${postId}&pageSize=50`
            });
            return result.data.data.items;
        },
        staleTime: 60_000,
        enabled: postId.length > 0
    });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Audit tab for the social post detail view.
 * Fetches and renders the audit-log entries for this post.
 */
export function SocialPostAuditTab({ postId }: SocialPostAuditTabProps) {
    const { t } = useTranslations();
    const { data, isLoading, error } = useAuditLog(postId);

    if (isLoading) {
        return (
            <div className="space-y-2">
                {['a1', 'a2', 'a3'].map((k) => (
                    <div
                        key={k}
                        className="h-10 animate-pulse rounded bg-muted"
                    />
                ))}
            </div>
        );
    }

    if (error || !data) {
        return (
            <p
                className="text-destructive text-sm"
                role="alert"
            >
                {t('social.posts.detail.loadingError')}
            </p>
        );
    }

    if (data.length === 0) {
        return (
            <p
                className="text-muted-foreground text-sm"
                data-testid="audit-empty"
            >
                {t('social.posts.detail.audit.empty')}
            </p>
        );
    }

    const STABLE_AUDIT_KEYS = data.map((entry) => `audit-${String(entry.id)}`);

    return (
        <div className="space-y-2">
            {data.map((entry, idx) => (
                <div
                    key={STABLE_AUDIT_KEYS[idx]}
                    className="rounded-md border p-3 text-sm"
                    data-testid={`audit-row-${String(entry.id)}`}
                >
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="font-medium">{String(entry.eventType)}</span>
                        <span className="text-muted-foreground">
                            {entry.actorId
                                ? String(entry.actorId)
                                : t('social.posts.detail.audit.systemActor')}
                        </span>
                        <span className="text-muted-foreground">
                            {new Date(entry.createdAt as string).toLocaleString()}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}
