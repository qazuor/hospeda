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
import type { RoleEnum } from '@repo/schemas';
import { getRoleLabel } from '../config/sections/role-permissions.consolidated';

export interface UseUserHeaderPropsArgs {
    /** The user entity returned by `useUserPage`; `undefined` while loading. */
    readonly entity: Record<string, unknown> | undefined;
}

export interface UserHeaderProps {
    /** Header media slot (circular avatar with initials fallback). */
    readonly media: EntityPageHeaderMedia | undefined;
    /** Role label (e.g. "Anfitrión") — undefined when the role isn't known. */
    readonly subtitle: string | undefined;
    /** Stack of status badges (lifecycle state, etc.). */
    readonly badges: ReactNode;
}

export const useUserHeaderProps = ({ entity }: UseUserHeaderPropsArgs): UserHeaderProps => {
    return useMemo<UserHeaderProps>(() => {
        if (!entity) {
            return { media: undefined, subtitle: undefined, badges: null };
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

        // ---- Subtitle (role label) ----------------------------------------
        const role = entity.role as RoleEnum | undefined;
        const subtitle = role ? getRoleLabel(role) : undefined;

        // ---- Badges (lifecycle state) -------------------------------------
        const lifecycleState = entity.lifecycleState as string | undefined;
        const badges = lifecycleState ? (
            <Badge variant={badgeVariantForLifecycle(lifecycleState)}>
                {lifecycleLabel(lifecycleState)}
            </Badge>
        ) : null;

        return { media, subtitle, badges };
    }, [entity]);
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
