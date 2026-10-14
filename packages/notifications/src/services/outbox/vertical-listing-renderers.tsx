import type { EmailOutboxRow } from '@repo/db';
import { getLocalDateString } from '@repo/utils';
import { formatDate } from '../../templates/utils/index.js';
import {
    LISTING_CONTENT_EDITED_BY_SUPPORT_SUBJECT,
    LISTING_RETURNED_TO_COPY,
    ListingContentEditedBySupport,
    ListingFixRequested,
    ListingModerated,
    ListingModerationLevelChanged,
    ListingModerationLifted,
    ListingPurged,
    ListingRestitution,
    type ListingReturnedTo,
    PriceAlertClosed
} from '../../templates/verticals/index.js';
import type { OutboxMailRenderer } from './email-outbox-delivery.service.js';

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
// These literals mirror SupportEditPartSchema in @repo/schemas, which notifications does not depend on.
const SUPPORT_EDIT_PART_LABELS = {
    texts: 'los textos',
    photos: 'las fotos',
    faq: 'las preguntas frecuentes',
    hours: 'los horarios',
    other: 'otros datos'
} as const;

/**
 * The verticals whose listings share the publication machine. Literal values
 * of `VerticalEnum` (`@repo/schemas`), which this package does not depend on.
 */
export type ListingNoticeVertical = 'accommodation' | 'gastronomy' | 'experience';

/**
 * Reads the names of listings of one vertical by id, whatever their state
 * (a `PURGED` listing keeps its name). A missing id means the listing could
 * not be named, and the renderer throws instead of mailing a gap (H9).
 */
export type ListingNamesReader = (input: {
    readonly vertical: ListingNoticeVertical;
    readonly ids: readonly string[];
}) => Promise<ReadonlyMap<string, string>>;

/** The owner's Mi Cuenta listing page, per vertical. */
const ACCOUNT_LISTINGS_PATH: Readonly<Record<ListingNoticeVertical, string>> = {
    accommodation: '/es/mi-cuenta/propiedades/',
    gastronomy: '/es/mi-cuenta/comercio/',
    experience: '/es/mi-cuenta/comercio/'
};

const SUBSCRIPTION_PATH = '/es/mi-cuenta/suscripcion/';

function objectPayload(row: EmailOutboxRow): Record<string, unknown> {
    const payload: unknown = row.payload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError('El payload del aviso de ficha no es válido');
    }
    return payload as Record<string, unknown>;
}

function readVertical(data: Record<string, unknown>): ListingNoticeVertical {
    const vertical = data.vertical;
    if (typeof vertical !== 'string' || !Object.hasOwn(ACCOUNT_LISTINGS_PATH, vertical)) {
        throw new TypeError('El aviso de ficha no tiene una vertical válida');
    }
    return vertical as ListingNoticeVertical;
}

function readText(data: Record<string, unknown>, key: string): string {
    const value = data[key];
    if (typeof value !== 'string' || value.trim() === '') {
        throw new TypeError(`Falta el dato requerido «${key}» del aviso de ficha`);
    }
    return value;
}

function readIds(data: Record<string, unknown>, key: string): readonly string[] {
    const value = data[key];
    if (!Array.isArray(value) || !value.every((id) => typeof id === 'string' && id.trim() !== '')) {
        throw new TypeError(`Falta el dato requerido «${key}» del aviso de ficha`);
    }
    return value as string[];
}

function readReturnedTo(value: unknown): ListingReturnedTo {
    if (typeof value !== 'string' || !Object.hasOwn(LISTING_RETURNED_TO_COPY, value)) {
        throw new TypeError('El aviso de ficha no dice a dónde volvió la ficha');
    }
    return value as ListingReturnedTo;
}

function readSuggestedDate(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new TypeError('La fecha sugerida del pedido de arreglo no es válida');
    }
    return value;
}

function readBoolean(data: Record<string, unknown>, key: string): boolean {
    const value = data[key];
    if (typeof value !== 'boolean') {
        throw new TypeError(`Falta el dato requerido «${key}» del aviso de ficha`);
    }
    return value;
}

/**
 * Renderers for the listing notices that the publication machine enqueues
 * (V/19 §4 rows 19, 24, 27, 30 and 31, plus the common PB12 confirmation).
 * The payloads carry ids, not names: names come from `readListingNames`, and
 * an id without a name throws, so the mail retries instead of going out with
 * a gap (H9 of HOS-1492).
 *
 * Also renders action 15 support content edits (V/19 §4 row 26, HOS-1675).
 * @param input - Site URL for links, and the listing names reader.
 * @returns The renderers keyed by outbox template.
 */
export function createVerticalListingRenderers(input: {
    readonly siteUrl: string;
    readonly readListingNames: ListingNamesReader;
}): Readonly<Record<string, OutboxMailRenderer>> {
    const site = input.siteUrl.replace(/\/$/, '');
    const accountUrl = (vertical: ListingNoticeVertical) =>
        `${site}${ACCOUNT_LISTINGS_PATH[vertical]}`;
    const subscriptionUrl = `${site}${SUBSCRIPTION_PATH}`;

    async function names(
        vertical: ListingNoticeVertical,
        ids: readonly string[]
    ): Promise<readonly string[]> {
        if (ids.length === 0) return [];
        const found = await input.readListingNames({ vertical, ids });
        return ids.map((id) => {
            const name = found.get(id);
            if (typeof name !== 'string' || name.trim() === '') {
                throw new TypeError(`La ficha ${id} no tiene nombre para el aviso`);
            }
            return name;
        });
    }

    async function listingName(data: Record<string, unknown>): Promise<string> {
        const vertical = readVertical(data);
        const [name] = await names(vertical, [readText(data, 'listingId')]);
        if (name === undefined) throw new TypeError('La ficha del aviso no tiene nombre');
        return name;
    }

    return {
        'verticals.listing-content-edited-by-support': async ({ row }) => {
            const data = objectPayload(row);
            const vertical = readVertical(data);
            const listingId = readText(data, 'listingId');
            const instant =
                typeof data.editedAt === 'string' && ISO_INSTANT.test(data.editedAt)
                    ? new Date(data.editedAt)
                    : null;
            if (!instant || Number.isNaN(instant.getTime()))
                throw new TypeError('La fecha de edición del aviso de soporte no es válida');
            if (!Array.isArray(data.parts))
                throw new TypeError('Las partes editadas del aviso de soporte no son válidas');
            const labels: string[] = [];
            for (const part of data.parts) {
                if (typeof part !== 'string' || !Object.hasOwn(SUPPORT_EDIT_PART_LABELS, part))
                    throw new TypeError(
                        'El aviso de soporte contiene una parte editada desconocida'
                    );
                labels.push(
                    SUPPORT_EDIT_PART_LABELS[part as keyof typeof SUPPORT_EDIT_PART_LABELS]
                );
            }
            const carriedName =
                typeof data.listingName === 'string' && data.listingName.trim() !== ''
                    ? data.listingName
                    : null;
            const name = carriedName ?? (await listingName({ ...data, vertical, listingId }));
            const editedDate = formatDate({ dateString: getLocalDateString({ instant }) });
            const partsText =
                labels.length === 0
                    ? null
                    : new Intl.ListFormat('es-AR', { style: 'long', type: 'conjunction' }).format(
                          labels
                      );
            return {
                subject: LISTING_CONTENT_EDITED_BY_SUPPORT_SUBJECT,
                react: (
                    <ListingContentEditedBySupport
                        listingName={name}
                        editedDate={editedDate}
                        partsText={partsText}
                        contactUrl={`${site}/es/contacto/`}
                    />
                )
            };
        },
        'verticals.price-alert-closed': async ({ row }) => {
            const data = objectPayload(row);
            readText(data, 'alertId');
            return {
                subject: 'Tu alerta de precio se cerró',
                react: <PriceAlertClosed listingName={await listingName(data)} />
            };
        },
        'verticals.listing-purged': async ({ row }) => {
            const data = objectPayload(row);
            const bySupport = readBoolean(data, 'bySupport');
            // PB12 may carry the name it read under its lock; otherwise it is read here.
            const name =
                typeof data.listingName === 'string' && data.listingName.trim() !== ''
                    ? data.listingName
                    : null;
            readVertical(data);
            readText(data, 'listingId');
            return {
                subject: 'Se borró tu ficha',
                react: (
                    <ListingPurged
                        listingName={name ?? (await listingName(data))}
                        bySupport={bySupport}
                    />
                )
            };
        },
        'verticals.listing-moderated': async ({ row }) => {
            const data = objectPayload(row);
            const reason = readText(data, 'reason');
            return {
                subject: 'Tu ficha está moderada',
                react: (
                    <ListingModerated
                        listingName={await listingName(data)}
                        reason={reason}
                        subscriptionUrl={subscriptionUrl}
                    />
                )
            };
        },
        'verticals.listing-fix-requested': async ({ row }) => {
            const data = objectPayload(row);
            const reason = readText(data, 'reason');
            const suggestedDate = readSuggestedDate(data.suggestedDate);
            const vertical = readVertical(data);
            return {
                subject: 'Te pedimos un arreglo en tu ficha',
                react: (
                    <ListingFixRequested
                        listingName={await listingName(data)}
                        reason={reason}
                        suggestedDate={suggestedDate}
                        accountUrl={accountUrl(vertical)}
                    />
                )
            };
        },
        'verticals.listing-moderation-level-changed': async ({ row }) => {
            const data = objectPayload(row);
            const reason = readText(data, 'reason');
            const fixRequestOpen = readBoolean(data, 'fixRequestOpen');
            const returnedTo =
                data.returnedTo === undefined || data.returnedTo === null
                    ? null
                    : readReturnedTo(data.returnedTo);
            const vertical = readVertical(data);
            return {
                subject: 'Cambió la moderación de tu ficha',
                react: (
                    <ListingModerationLevelChanged
                        listingName={await listingName(data)}
                        reason={reason}
                        returnedTo={returnedTo}
                        fixRequestOpen={fixRequestOpen}
                        accountUrl={accountUrl(vertical)}
                        subscriptionUrl={subscriptionUrl}
                    />
                )
            };
        },
        'verticals.listing-moderation-lifted': async ({ row }) => {
            const data = objectPayload(row);
            const returnedTo = readReturnedTo(data.returnedTo);
            const vertical = readVertical(data);
            return {
                subject: 'Se levantó la moderación de tu ficha',
                react: (
                    <ListingModerationLifted
                        listingName={await listingName(data)}
                        returnedTo={returnedTo}
                        accountUrl={accountUrl(vertical)}
                    />
                )
            };
        },
        'verticals.listing-restitution': async ({ row }) => {
            const data = objectPayload(row);
            const vertical = readVertical(data);
            const restoredIds = readIds(data, 'restoredListingIds');
            const notRestoredIds = readIds(data, 'notRestoredListingIds');
            if (data.criterion !== 'LAST_FELL_FIRST_BACK') {
                throw new TypeError('El aviso de restitución no trae su criterio');
            }
            if (restoredIds.length === 0 && notRestoredIds.length === 0) {
                throw new TypeError('El aviso de restitución no nombra ninguna ficha');
            }
            return {
                subject: 'Tus fichas volvieron a publicarse',
                react: (
                    <ListingRestitution
                        restoredNames={await names(vertical, restoredIds)}
                        notRestoredNames={await names(vertical, notRestoredIds)}
                        accountUrl={accountUrl(vertical)}
                    />
                )
            };
        }
    };
}
