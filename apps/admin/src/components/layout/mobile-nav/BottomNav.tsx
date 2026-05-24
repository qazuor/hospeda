/**
 * BottomNav Component (T-026)
 *
 * Mobile-only bottom navigation bar (AC-19). Renders the section IDs listed in
 * `roleConfig.mobile.bottomNav` as nav links, and optionally a Floating Action
 * Button (FAB) for a single create action.
 *
 * Visibility:
 * - Hidden on `md` and above via `md:hidden`.
 * - Each section still respects the user's real-permission visibility:
 *   if the user has 0 accessible items in the section's sidebar, the section
 *   is hidden (same rule as MainMenu — AC-17).
 * - The FAB respects its create action's permission gate.
 *
 * ARCHITECTURAL RULE (SPEC-154): All visibility checks use `useUserPermissions()`.
 * The role only selects the layout template — it is NEVER used as a permission gate.
 *
 * @module mobile-nav/BottomNav
 * @see apps/admin/src/hooks/use-current-role-config.ts — template selector
 * @see apps/admin/src/lib/nav/permission-visibility.ts — shared visibility logic
 * @see SPEC-154 T-026
 */

import type { CreateAction, Section } from '@/config/ia/schema';
import { validatedConfig } from '@/config/ia/validate';
import { useCurrentRoleConfig } from '@/hooks/use-current-role-config';
import { useCurrentSection } from '@/hooks/use-current-section';
import { useLocalizedLabel } from '@/hooks/use-localized-label';
import { useUserPermissions } from '@/hooks/use-user-permissions';
import { hasSidebarAccessibleItem, isPermissionGateGranted } from '@/lib/nav/permission-visibility';
import { cn } from '@/lib/utils';
import { resolveIcon } from '@repo/icons';
import type { PermissionEnum } from '@repo/schemas';
import { Link, useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns `true` if the section should appear in the bottom nav for this user.
 *
 * @param section - The IA Section definition.
 * @param userPermissions - The current user's PermissionEnum VALUES.
 */
function isSectionVisibleForUser(
    section: Section,
    userPermissions: readonly PermissionEnum[]
): boolean {
    if (section.sidebar === null) return true;
    const sidebar = validatedConfig.sidebars[section.sidebar];
    if (!sidebar) return false;
    return hasSidebarAccessibleItem({ items: sidebar.items, userPermissions });
}

/**
 * Checks whether the user has access to execute the given create action.
 *
 * @param action - The create action to check.
 * @param userPermissions - The current user's PermissionEnum VALUES.
 */
function canAccessAction(
    action: CreateAction,
    userPermissions: readonly PermissionEnum[]
): boolean {
    return isPermissionGateGranted({ gate: action.permissions, userPermissions });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface BottomNavItemProps {
    readonly section: Section;
    readonly isActive: boolean;
}

/**
 * Renders a single bottom-nav section link (icon + label).
 */
function BottomNavItem({ section, isActive }: BottomNavItemProps) {
    const label = useLocalizedLabel(section.label);
    const IconComponent = section.icon ? resolveIcon({ iconName: section.icon }) : undefined;
    const href = section.defaultRoute ?? section.route;

    return (
        <Link
            to={href}
            className={cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 font-medium text-xs transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
            aria-current={isActive ? 'page' : undefined}
            data-section-id={section.id}
        >
            {IconComponent ? (
                <IconComponent
                    size="md"
                    weight={isActive ? 'fill' : 'regular'}
                    aria-hidden="true"
                />
            ) : (
                <span
                    className="h-6 w-6"
                    aria-hidden="true"
                />
            )}
            <span className="max-w-16 truncate">{label}</span>
        </Link>
    );
}

interface BottomNavFabProps {
    readonly action: CreateAction;
}

/**
 * Renders the Floating Action Button for the single FAB create action.
 */
function BottomNavFab({ action }: BottomNavFabProps) {
    const label = useLocalizedLabel(action.label);
    const navigate = useNavigate();
    const IconComponent = action.icon ? resolveIcon({ iconName: action.icon }) : undefined;

    return (
        <button
            type="button"
            onClick={() => {
                navigate({ to: action.route });
            }}
            className={cn(
                '-translate-x-1/2 absolute bottom-full left-1/2 mb-3',
                'flex h-14 w-14 items-center justify-center rounded-full',
                'bg-primary text-primary-foreground shadow-lg',
                'transition-transform hover:bg-primary/90 active:scale-95',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
            )}
            aria-label={label}
            data-action-id={action.id}
        >
            {IconComponent ? (
                <IconComponent
                    size="lg"
                    aria-hidden="true"
                />
            ) : (
                <span
                    className="font-medium text-2xl leading-none"
                    aria-hidden="true"
                >
                    +
                </span>
            )}
        </button>
    );
}

// ---------------------------------------------------------------------------
// Exported component
// ---------------------------------------------------------------------------

/**
 * BottomNav renders the mobile bottom navigation bar and optional FAB.
 *
 * - Visible only on small screens (`md:hidden`).
 * - Renders sections from `roleConfig.mobile.bottomNav` in order.
 * - Sections with 0 accessible items for this user are hidden (same rule as MainMenu).
 * - If `roleConfig.mobile.fab` is set and the user has permission, renders a FAB.
 * - Returns `null` when no role config is available or `bottomNav` is `null`.
 *
 * @example
 * ```tsx
 * // At the root of the admin shell, after the main content area:
 * <BottomNav />
 * ```
 */
export function BottomNav() {
    const roleConfig = useCurrentRoleConfig();
    const activeSection = useCurrentSection();
    const userPermissions = useUserPermissions();

    const visibleSections = useMemo(() => {
        const bottomNav = roleConfig?.mobile?.bottomNav;
        if (!bottomNav) return [];

        return bottomNav.flatMap((sectionId) => {
            const section = validatedConfig.sections[sectionId];
            if (!section) return [];
            if (!isSectionVisibleForUser(section, userPermissions)) return [];
            return [section];
        });
    }, [roleConfig, userPermissions]);

    const fabAction = useMemo((): CreateAction | null => {
        const fabId = roleConfig?.mobile?.fab;
        if (!fabId) return null;
        const action = validatedConfig.createActions[fabId];
        if (!action) return null;
        if (!canAccessAction(action, userPermissions)) return null;
        return action;
    }, [roleConfig, userPermissions]);

    if (!roleConfig) return null;
    if (!roleConfig.mobile?.bottomNav) return null;
    if (visibleSections.length === 0 && !fabAction) return null;

    return (
        <nav
            className="fixed right-0 bottom-0 left-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden"
            aria-label="Mobile navigation"
        >
            <div className="relative flex items-stretch">
                {/* FAB spacer — leaves a gap in the center when FAB is present */}
                {fabAction && (
                    <div
                        className="pointer-events-none flex-1"
                        aria-hidden="true"
                    />
                )}

                {visibleSections.map((section) => (
                    <BottomNavItem
                        key={section.id}
                        section={section}
                        isActive={activeSection?.id === section.id}
                    />
                ))}

                {fabAction && <BottomNavFab action={fabAction} />}
            </div>
        </nav>
    );
}
