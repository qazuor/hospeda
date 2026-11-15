/**
 * @file accommodation-section-locks.ts
 * @description Hub status lines for the accommodation sections the owner's plan
 * withholds (HOS-1809).
 *
 * The resolver already decides which section is `locked`
 * (`GET /protected/accommodations/:id/sections`); this module only turns that
 * state map into the same `locked` status line the venue and experience hubs
 * show, without ever comparing a section id to a literal (G-FAC-05). The
 * section's own page keeps its page-level entitlement gate.
 */

import type { EditorSectionStatus } from '@/lib/editor/editor-hub-status-model';
import type { ListingSectionStates } from '@/lib/editor/listing-editor-registry';

/**
 * Overlays a `locked` line on every section the resolver reports as `locked`.
 *
 * A `blocking` status wins: a section that cannot publish for a missing field
 * is a to-do, not a plan limit (same precedence as the venue hub).
 *
 * @param params - The statuses the hub already computed and the resolved state map.
 * @returns The statuses with the locked lines applied; the input is not mutated.
 */
export function applyLockedSectionStatuses({
    statuses,
    sectionStates
}: {
    readonly statuses: Readonly<Record<string, EditorSectionStatus>>;
    readonly sectionStates: ListingSectionStates;
}): Record<string, EditorSectionStatus> {
    const result: Record<string, EditorSectionStatus> = { ...statuses };
    for (const [sectionId, section] of Object.entries(sectionStates)) {
        if (section.state !== 'locked' || result[sectionId]?.tone === 'blocking') continue;
        result[sectionId] = {
            labelKey: 'listing.owner.editor.hub.status.lockedEmpty',
            tone: 'locked'
        };
    }
    return result;
}
