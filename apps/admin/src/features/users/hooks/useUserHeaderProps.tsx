/**
 * useUserHeaderProps — derives the EntityPageHeader props (media / subtitle /
 * badges) from a loaded user entity.
 *
 * Centralizes the header derivation so the view (`$id.tsx`), edit
 * (`$id_.edit.tsx`), permissions (`$id_.permissions.tsx`) and activity
 * (`$id_.activity.tsx`) routes render the same chrome.
 */

import type { ReactNode } from 'react';
import { useMemo } from 'react';
import type { EntityPageHeaderMedia } from '@/components/entity-header/EntityPageHeader';
import { Badge } from '@/components/ui/badge';
import { useUserRoles } from '@/features/users/hooks/useUserRoles';
import { buildRoleLabelKey } from '@/features/users/utils/role-label';
import { useTranslations } from '@/hooks/use-translations';

export interface UseUserHeaderPropsArgs {
    /** The user entity returned by `useUserPage`; `undefined` while loading. */
    readonly entity: Record<string, unknown> | undefined;
    /**
     * Id of the user being rendered — used to resolve the role set.
     *
     * HOS-296: the roles do NOT travel on the user entity. `UserPublicSchema`
     * declares `roles` with a `.default([])`, but no read path resolves it, so
     * reading `entity.roles` produced a permanently blank subtitle. They live
     * in `user_role` and come from `GET /admin/users/:id/role-grants`, the same
     * endpoint `UserRolesCard` uses — so this is a cache hit, not a second
     * request, whenever the roles tab has already loaded.
     */
    readonly userId: string | undefined;
}

export interface UserHeaderProps {
    /** Header media slot (circular avatar with initials fallback). */
    readonly media: EntityPageHeaderMedia | undefined;
    /**
     * Comma-joined labels for every role the user holds (e.g. "Anfitrión,
     * Editor") — HOS-296: an account can hold multiple hats, so this is never
     * a single "primary" role. `undefined` while the roles are still loading;
     * an explicit error label when the read FAILED (see {@link rolesFailed}).
     */
    readonly subtitle: string | undefined;
    /**
     * `true` when the role read failed (permissions, network, server).
     *
     * Surfaced instead of collapsing into the same `undefined` subtitle as
     * "still loading": a 403 rendered as a blank header is indistinguishable
     * from a slow request, has no error, no log and no compile failure — the
     * exact silent-blank symptom this header was fixed to remove.
     */
    readonly rolesFailed: boolean;
    /** Stack of status badges (lifecycle state, etc.). */
    readonly badges: ReactNode;
}

export const useUserHeaderProps = ({
    entity,
    userId
}: UseUserHeaderPropsArgs): UserHeaderProps => {
    const { t } = useTranslations();
    const { data: roleGrants, isError: rolesFailed } = useUserRoles(userId ?? '', {
        enabled: Boolean(userId)
    });

    return useMemo<UserHeaderProps>(() => {
        if (!entity) {
            return { media: undefined, subtitle: undefined, rolesFailed, badges: null };
        }

        const displayName =
            (entity.displayName as string | undefined) ?? (entity.slug as string | undefined) ?? '';

        // ---- Media (circular avatar with initials fallback) ---------------
        const profile = entity.profile as { avatarUrl?: string } | undefined;
        const src =
            (entity.profilePicture as string | undefined) ??
            (entity.avatarUrl as string | undefined) ??
            profile?.avatarUrl;

        const media: EntityPageHeaderMedia = {
            type: 'avatar',
            src,
            alt: displayName,
            fallback: <span className="font-semibold text-sm">{getInitials(displayName)}</span>
        };

        // ---- Subtitle (role labels) -----------------------------------------
        // HOS-296: `entity.role` (single scalar) is gone and the entity carries
        // no resolved role set either, so the labels come from the dedicated
        // role-grants endpoint. Render the FULL held set, not one "primary"
        // role. Labels resolve through `@repo/i18n` via the shared
        // `buildRoleLabelKey`, the same catalogue `UserRolesCard` reads.
        const roles = roleGrants?.roles ?? [];
        let subtitle: string | undefined;
        if (rolesFailed) {
            subtitle = t('admin-pages.access.users.roles.error');
        } else if (roles.length > 0) {
            subtitle = roles.map((entry) => t(buildRoleLabelKey({ role: entry.role }))).join(', ');
        }

        // ---- Badges (lifecycle state) -------------------------------------
        const lifecycleState = entity.lifecycleState as string | undefined;
        const badges = lifecycleState ? (
            <Badge variant={badgeVariantForLifecycle(lifecycleState)}>
                {lifecycleLabel(lifecycleState)}
            </Badge>
        ) : null;

        return { media, subtitle, rolesFailed, badges };
    }, [entity, roleGrants, rolesFailed, t]);
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getInitials(displayName: string): string {
    const parts = displayName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return (parts[0] as string).slice(0, 2).toUpperCase();
    return `${(parts[0] as string)[0] ?? ''}${(parts[parts.length - 1] as string)[0] ?? ''}`.toUpperCase();
}

function badgeVariantForLifecycle(
    state: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
    switch (state) {
        case 'ACTIVE':
            return 'default';
        case 'INACTIVE':
        case 'ARCHIVED':
            return 'outline';
        case 'BANNED':
        case 'SUSPENDED':
            return 'destructive';
        default:
            return 'secondary';
    }
}

function lifecycleLabel(state: string): string {
    const labels: Record<string, string> = {
        ACTIVE: 'Activo',
        INACTIVE: 'Inactivo',
        ARCHIVED: 'Archivado',
        BANNED: 'Bloqueado',
        SUSPENDED: 'Suspendido'
    };
    return labels[state] ?? state;
}
