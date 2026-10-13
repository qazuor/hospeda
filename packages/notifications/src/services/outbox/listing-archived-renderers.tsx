import type { EmailOutboxRow } from '@repo/db';
import { getLocalDateString } from '@repo/utils';
import { ListingArchived } from '../../templates/listing/index.js';
import { formatDate } from '../../templates/utils/index.js';
import { formatTrialVerticals } from '../../utils/product-domain-copy.js';
import type { OutboxMailRenderer } from './email-outbox-delivery.service.js';

/** Outbox template key of the on-archive listing notice (`@repo/verticals` enqueues it). */
const LISTING_ARCHIVED = 'verticals.listing-archived';
const LISTING_VERTICALS: readonly string[] = ['accommodation', 'gastronomy', 'experience'];
const TRANSITIONS: readonly string[] = ['PB4', 'PB5'];
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

interface ListingArchivedData {
    readonly vertical: string;
    readonly transition: 'PB4' | 'PB5';
    readonly deletionAnnouncedAt: Date;
    readonly listingAddonCount: number;
}

function parsePayload(row: EmailOutboxRow): ListingArchivedData {
    const payload: unknown = row.payload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError('El payload del aviso de ficha archivada no es válido');
    }
    const data = payload as Record<string, unknown>;
    const instant =
        typeof data.deletionAnnouncedAt === 'string' && ISO_INSTANT.test(data.deletionAnnouncedAt)
            ? new Date(data.deletionAnnouncedAt)
            : null;
    if (
        typeof data.vertical !== 'string' ||
        !LISTING_VERTICALS.includes(data.vertical) ||
        typeof data.listingId !== 'string' ||
        data.listingId.length === 0 ||
        typeof data.transition !== 'string' ||
        !TRANSITIONS.includes(data.transition) ||
        !instant ||
        Number.isNaN(instant.getTime()) ||
        typeof data.listingAddonCount !== 'number' ||
        !Number.isInteger(data.listingAddonCount) ||
        data.listingAddonCount < 0
    )
        throw new TypeError('Faltan datos requeridos del aviso de ficha archivada');
    return {
        vertical: data.vertical,
        transition: data.transition as 'PB4' | 'PB5',
        deletionAnnouncedAt: instant,
        listingAddonCount: data.listingAddonCount
    };
}

function listingArchived(row: EmailOutboxRow) {
    const data = parsePayload(row);
    const verticalName = formatTrialVerticals({ verticals: [data.vertical] }).toLocaleLowerCase(
        'es-AR'
    );
    // The announced deletion is an instant: name the market day it falls on (NUCLEO/07 §3).
    const deletionDate = formatDate({
        dateString: getLocalDateString({ instant: data.deletionAnnouncedAt })
    });
    return {
        subject: `Archivamos tu ficha de ${verticalName} por inactividad`,
        react: (
            <ListingArchived
                verticalName={verticalName}
                transition={data.transition}
                deletionDate={deletionDate}
                listingAddonCount={data.listingAddonCount}
            />
        )
    };
}

/**
 * Renderers for the on-archive listing notice that PB4 and PB5 enqueue (AC:V6:28).
 *
 * @param _input - Renderer configuration (the notice carries no link)
 * @returns The renderer keyed by its outbox template
 */
export function createListingArchivedRenderers(_input: {
    readonly siteUrl: string;
}): Readonly<Record<string, OutboxMailRenderer>> {
    return {
        [LISTING_ARCHIVED]: ({ row }) => listingArchived(row)
    };
}
