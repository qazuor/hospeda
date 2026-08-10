/**
 * @file editor-breadcrumbs-model.ts
 * @description Pure view model for the editor breadcrumbs (HOS-318 T-009).
 *
 * The breadcrumbs are not decoration here. The editor's audience is largely
 * older, non-technical hosts, and the whole navigation redesign rests on the
 * user always knowing where they are and how to get back. So the trail renders
 * on every editor page, including the hub.
 */

import {
    buildEditorHubUrl,
    type EditorSection,
    findEditorSectionBySlug
} from '@/lib/editor/accommodation-editor-sections';
import type { SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One crumb in the trail. */
export interface EditorBreadcrumb {
    /** Literal text (the accommodation's name) when set. */
    readonly label?: string;
    /** i18n key, when the label is translatable. Exactly one of the two is set. */
    readonly labelKey?: string;
    /** `null` on the last crumb — the current page is not a link to itself. */
    readonly href: string | null;
    readonly isCurrent: boolean;
}

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

/**
 * Builds the breadcrumb trail for an editor page.
 *
 * Two crumbs on the hub (`Mis propiedades › <name>`), three on a section page
 * (`… › <section>`). The last crumb is never a link.
 *
 * @param params - Locale, accommodation identity, and the active section slug.
 * @returns The crumbs, outermost first.
 */
export function buildEditorBreadcrumbs({
    locale,
    accommodationId,
    accommodationName,
    currentSectionSlug
}: {
    readonly locale: SupportedLocale;
    readonly accommodationId: string;
    readonly accommodationName: string;
    /** `null` on the hub. An unknown slug degrades to the hub trail. */
    readonly currentSectionSlug: string | null;
}): readonly EditorBreadcrumb[] {
    const section: EditorSection | undefined =
        currentSectionSlug === null
            ? undefined
            : findEditorSectionBySlug({ slug: currentSectionSlug });

    const hubUrl = buildEditorHubUrl({ locale, accommodationId });

    const crumbs: EditorBreadcrumb[] = [
        {
            labelKey: 'host.properties.editor.breadcrumb.properties',
            href: buildUrl({ locale, path: 'mi-cuenta/propiedades' }),
            isCurrent: false
        },
        {
            label: accommodationName,
            // On the hub this crumb IS the current page, so it stops being a link.
            href: section ? hubUrl : null,
            isCurrent: !section
        }
    ];

    if (section) {
        crumbs.push({ labelKey: section.labelKey, href: null, isCurrent: true });
    }

    return crumbs;
}
