/**
 * @file destination-template.ts
 * @description The web route template a {@link HelpDestination} resolves to,
 * with no locale and no record id. Shared by the generator (IL-1) and guard
 * (a) (a2, which checks the page exists).
 */

import {
    editorSlugOf,
    type PortalDestination,
    portalDestinationTemplate
} from '@repo/portal-routes';
import type { HelpDestination } from './destination.schema';

/**
 * The portal destination a help destination stands for. An editor section of
 * the owner's own listings becomes that section of a listing whose id is the
 * template's `[id]` placeholder.
 *
 * @param args.destination - A help destination
 * @returns The portal destination
 */
export function toPortalDestination({
    destination
}: {
    readonly destination: HelpDestination;
}): PortalDestination {
    if (destination.kind === 'ownEditorSection') {
        return {
            kind: 'listingEditor',
            vertical: destination.vertical,
            id: '[id]',
            section: destination.section
        };
    }
    return destination;
}

/**
 * The route template under `apps/web/src/pages/[lang]/` a help destination
 * resolves to.
 *
 * @param args.destination - A help destination
 * @returns For example `mi-cuenta/propiedades/[id]/editar/fotos`
 */
export function helpDestinationTemplate({
    destination
}: {
    readonly destination: HelpDestination;
}): string {
    return portalDestinationTemplate({ destination: toPortalDestination({ destination }) });
}

/**
 * The editor slug of an `ownEditorSection` destination.
 *
 * @param args.destination - An editor-section destination
 * @returns The slug, for example `fotos` or `politicas`
 */
export function helpEditorSectionSlug({
    destination
}: {
    readonly destination: Extract<HelpDestination, { readonly kind: 'ownEditorSection' }>;
}): string {
    return editorSlugOf({ vertical: destination.vertical, section: destination.section }) ?? '';
}
