/**
 * QuickCreate Component (T-025)
 *
 * Renders the "+" quick-create button in the topbar. Opens a dropdown menu
 * listing available create actions for the current user.
 *
 * Action resolution:
 * - `topbar.showQuickCreate === null` → button is hidden.
 * - `topbar.showQuickCreate === 'all'` → all create actions the user has
 *   permission for (gate via each action.permissions).
 * - `topbar.showQuickCreate === string[]` → those specific action IDs,
 *   filtered to only the ones the user has permission for.
 * - Empty result after permission filtering → button is hidden.
 *
 * Permission checking uses the same KEY→VALUE bridge as
 * `useVisibleSidebarItems`: IA config permission KEYS are expanded to
 * PermissionEnum VALUES via `expandPermissions()`, then compared against
 * the user's real permissions from `useUserPermissions()`.
 *
 * ARCHITECTURAL RULE (SPEC-154): visibility is NEVER gated by the role.
 * All permission checks go against the user's REAL permissions.
 *
 * @module quick-create/QuickCreate
 * @see apps/admin/src/hooks/use-current-role-config.ts
 * @see apps/admin/src/config/ia/permission-bundles.ts
 * @see SPEC-154 T-025
 */

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import type { CreateAction } from '@/config/ia/schema';
import { validatedConfig } from '@/config/ia/validate';
import { useCurrentRoleConfig } from '@/hooks/use-current-role-config';
import { useLocalizedLabel } from '@/hooks/use-localized-label';
import { useUserPermissions } from '@/hooks/use-user-permissions';
import { isPermissionGateGranted } from '@/lib/nav/permission-visibility';
import { resolveIcon } from '@repo/icons';
import type { PermissionEnum } from '@repo/schemas';
import { useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Checks whether the user has permission to execute the given create action.
 * Delegates to {@link isPermissionGateGranted} (the KEY→VALUE bridge):
 * action.permissions are KEYS, user's permissions are VALUES.
 *
 * @param action - The create action to check.
 * @param userPermissions - The current user's PermissionEnum VALUES.
 * @returns `true` if the user has access (no gate or at least one match).
 */
function canAccessAction(
    action: CreateAction,
    userPermissions: readonly PermissionEnum[]
): boolean {
    return isPermissionGateGranted({ gate: action.permissions, userPermissions });
}

// ---------------------------------------------------------------------------
// Sub-component: single dropdown item
// ---------------------------------------------------------------------------

interface QuickCreateItemProps {
    readonly action: CreateAction;
}

/**
 * Renders a single create action inside the dropdown menu.
 */
function QuickCreateItem({ action }: QuickCreateItemProps) {
    const label = useLocalizedLabel(action.label);
    const navigate = useNavigate();
    const IconComponent = action.icon ? resolveIcon({ iconName: action.icon }) : undefined;

    return (
        <DropdownMenuItem
            onSelect={() => {
                navigate({ to: action.route });
            }}
            className="flex cursor-pointer items-center gap-2"
            data-action-id={action.id}
        >
            {IconComponent && (
                <span className="flex-shrink-0">
                    <IconComponent
                        size="sm"
                        aria-hidden="true"
                    />
                </span>
            )}
            <span>{label}</span>
        </DropdownMenuItem>
    );
}

// ---------------------------------------------------------------------------
// Exported component
// ---------------------------------------------------------------------------

/**
 * QuickCreate renders a "+" topbar button that opens a dropdown listing
 * available create actions for the current user.
 *
 * Respects `roleConfig.topbar.showQuickCreate`:
 * - `null` → renders nothing.
 * - `'all'` → all create actions the user has permission for.
 * - `string[]` → those specific action IDs, permission-filtered.
 *
 * Returns `null` when:
 * - No role config is available.
 * - `showQuickCreate` is `null`.
 * - No actions remain after permission filtering.
 *
 * @example
 * ```tsx
 * // Inside the topbar right-side actions area:
 * <QuickCreate />
 * ```
 */
export function QuickCreate() {
    const roleConfig = useCurrentRoleConfig();
    const userPermissions = useUserPermissions();

    const accessibleActions = useMemo((): CreateAction[] => {
        if (!roleConfig?.topbar) return [];

        const showQuickCreate = roleConfig.topbar.showQuickCreate;
        if (showQuickCreate === null) return [];

        const allActions = Object.values(validatedConfig.createActions);

        if (showQuickCreate === 'all') {
            return allActions.filter((action) => canAccessAction(action, userPermissions));
        }

        // string[] — explicit list of action IDs.
        return showQuickCreate.flatMap((actionId) => {
            const action = validatedConfig.createActions[actionId];
            if (!action) return [];
            if (!canAccessAction(action, userPermissions)) return [];
            return [action];
        });
    }, [roleConfig, userPermissions]);

    if (!roleConfig) {
        return null;
    }

    if (roleConfig.topbar?.showQuickCreate === null) {
        return null;
    }

    if (accessibleActions.length === 0) {
        return null;
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Quick create"
            >
                <span
                    className="font-medium text-lg leading-none"
                    aria-hidden="true"
                >
                    +
                </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className="min-w-48"
            >
                {accessibleActions.map((action) => (
                    <QuickCreateItem
                        key={action.id}
                        action={action}
                    />
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
