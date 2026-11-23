/**
 * @file editor-switcher-model.ts
 * @description Pure view model for the editor's sticky section switcher
 * (HOS-2486, spec HOS-2415 §6.1, D2 «nav del editor por container query»).
 *
 * The switcher is the narrow-container form of the section column: previous,
 * next, the position «n/N» and a menu of every section. It reads the SAME nav
 * model as the column (`buildEditorNavModel`), so the two can never list
 * different sections or a different order.
 */

import type { EditorNavGroup, EditorNavLink } from '@/lib/editor/editor-route-nav-model';

/** What the switcher renders. */
export interface EditorSwitcherModel {
    /** 1-based position of the active section, or `null` when none is active. */
    readonly position: number | null;
    /** How many sections the switcher walks. */
    readonly total: number;
    /** The section before the active one, if any. */
    readonly previous: EditorNavLink | null;
    /** The section after the active one, if any. */
    readonly next: EditorNavLink | null;
    /** The active section, if any. */
    readonly current: EditorNavLink | null;
    /** The groups, for the menu (same order as the column). */
    readonly groups: readonly EditorNavGroup[];
}

/**
 * Builds the switcher model from the nav groups.
 *
 * Previous / next walk the sections in nav order across groups. With no active
 * section (the hub) there is no position, no previous and `next` is the first
 * section.
 *
 * @param params - The nav groups from `buildEditorNavModel`.
 * @returns The {@link EditorSwitcherModel}.
 */
export function buildEditorSwitcherModel({
    groups
}: {
    readonly groups: readonly EditorNavGroup[];
}): EditorSwitcherModel {
    const links = groups.flatMap((group) => group.links);
    const index = links.findIndex((link) => link.isActive);

    if (index === -1) {
        return {
            position: null,
            total: links.length,
            previous: null,
            next: links[0] ?? null,
            current: null,
            groups
        };
    }

    return {
        position: index + 1,
        total: links.length,
        previous: links[index - 1] ?? null,
        next: links[index + 1] ?? null,
        current: links[index] ?? null,
        groups
    };
}
