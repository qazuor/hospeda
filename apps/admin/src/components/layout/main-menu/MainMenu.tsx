/**
 * MainMenu Component (T-023)
 *
 * Renders the Level 1 main navigation for the current role's IA template.
 * Sections are shown in the order declared in `roleConfig.mainMenu`.
 *
 * Visibility rule (SPEC-154 §8, AC-17):
 * A section is omitted when the user has ZERO accessible items in its associated
 * sidebar. Accessibility is determined by the user's REAL permissions via
 * `useUserPermissions()` — never by the role. Sections with `sidebar: null`
 * are always shown (no items to filter).
 *
 * ARCHITECTURAL RULE: this component never checks `user.role` for visibility.
 * The role only selects the template (via `useCurrentRoleConfig`). All
 * visibility decisions go through `useUserPermissions()`.
 *
 * @module main-menu/MainMenu
 * @see apps/admin/src/hooks/use-current-role-config.ts — template selector
 * @see apps/admin/src/lib/nav/permission-visibility.ts — shared visibility logic
 * @see SPEC-154 T-023
 */

import type { Section } from '@/config/ia/schema';
import { validatedConfig } from '@/config/ia/validate';
import { useCurrentRoleConfig } from '@/hooks/use-current-role-config';
import { useCurrentSection } from '@/hooks/use-current-section';
import { useLocalizedLabel } from '@/hooks/use-localized-label';
import { useUserPermissions } from '@/hooks/use-user-permissions';
import { resolveNavIcon } from '@/lib/nav-icon-map';
import { hasSidebarAccessibleItem } from '@/lib/nav/permission-visibility';
import { cn } from '@/lib/utils';
import type { PermissionEnum } from '@repo/schemas';
import { Link } from '@tanstack/react-router';
import { useMemo } from 'react';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Determines whether a section should appear in the main menu for this user.
 *
 * Rules:
 * - `sidebar: null` → always show (no items to filter).
 * - sidebar does not exist → hide (config inconsistency, safe default).
 * - sidebar has accessible items → show.
 * - sidebar has 0 accessible items → hide.
 *
 * @param section - The IA Section definition.
 * @param userPermissions - The current user's PermissionEnum VALUES.
 * @returns `true` if the section should appear in the main menu.
 */
function isSectionVisibleForUser(
    section: Section,
    userPermissions: readonly PermissionEnum[]
): boolean {
    if (section.sidebar === null) {
        // No sidebar — always show.
        return true;
    }
    const sidebar = validatedConfig.sidebars[section.sidebar];
    if (!sidebar) {
        // Sidebar reference not found — hide as a safe default.
        return false;
    }
    return hasSidebarAccessibleItem({ items: sidebar.items, userPermissions });
}

// ---------------------------------------------------------------------------
// Sub-component: single menu item
// ---------------------------------------------------------------------------

interface MainMenuItemProps {
    readonly section: Section;
    readonly isActive: boolean;
}

/**
 * Renders a single main-menu nav link with icon + label, matching
 * HeaderNavItem active styling.
 */
function MainMenuItem({ section, isActive }: MainMenuItemProps) {
    const label = useLocalizedLabel(section.label);
    const IconComponent = section.icon ? resolveNavIcon({ iconName: section.icon }) : undefined;
    const href = section.defaultRoute ?? section.route;

    return (
        <Link
            to={href}
            className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 font-medium text-sm transition-colors duration-150',
                'hover:bg-accent hover:text-accent-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground'
            )}
            aria-current={isActive ? 'page' : undefined}
            data-section-id={section.id}
        >
            {IconComponent && (
                <span className="flex-shrink-0">
                    <IconComponent
                        size="sm"
                        aria-hidden="true"
                    />
                </span>
            )}
            <span className="hidden lg:inline">{label}</span>
        </Link>
    );
}

// ---------------------------------------------------------------------------
// Exported component
// ---------------------------------------------------------------------------

/**
 * MainMenu renders the horizontal Level 1 navigation for the current role.
 *
 * - Sections are rendered in the order defined by `roleConfig.mainMenu`.
 * - Sections with 0 accessible items for THIS user are omitted (AC-17).
 * - Visibility is always driven by the user's real permissions, never by role.
 * - Returns `null` if no role config is available (unauthenticated / unknown role).
 *
 * @example
 * ```tsx
 * // Drop-in replacement for the static HeaderNavItem list in Header.tsx
 * <MainMenu />
 * ```
 */
export function MainMenu() {
    const roleConfig = useCurrentRoleConfig();
    const activeSection = useCurrentSection();
    const userPermissions = useUserPermissions();

    const visibleSections = useMemo(() => {
        if (!roleConfig?.mainMenu) return [];

        return roleConfig.mainMenu.flatMap((sectionId) => {
            const section = validatedConfig.sections[sectionId];
            if (!section) return [];
            if (!isSectionVisibleForUser(section, userPermissions)) return [];
            return [section];
        });
    }, [roleConfig, userPermissions]);

    if (!roleConfig) {
        return null;
    }

    if (visibleSections.length === 0) {
        return null;
    }

    return (
        <nav
            className="hidden items-center gap-1 md:flex"
            aria-label="Main navigation"
        >
            {visibleSections.map((section) => (
                <MainMenuItem
                    key={section.id}
                    section={section}
                    isActive={activeSection?.id === section.id}
                />
            ))}
        </nav>
    );
}
