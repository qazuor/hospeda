import type { EmailOutboxRow } from '@repo/db';
import { getLocalDateString } from '@repo/utils';
import {
    ListingRetentionBeforeArchive,
    ListingRetentionBeforeDeletion
} from '../../templates/listing/index.js';
import { formatDate } from '../../templates/utils/index.js';
import { formatTrialVerticalInline } from '../../utils/product-domain-copy.js';
import {
    isListingNoticeVertical,
    type ListingNoticeVertical,
    resolveAccountListingsUrl
} from './account-listing-paths.js';
import type { OutboxMailRenderer } from './email-outbox-delivery.service.js';

const BEFORE_ARCHIVE = 'verticals.listing-retention-before-archive';
const BEFORE_DELETION = 'verticals.listing-retention-before-deletion';
const TRANSITIONS: readonly string[] = ['PB4', 'PB5'];
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

interface RetentionPayload {
    readonly vertical: ListingNoticeVertical;
    readonly listingId: string;
    readonly transition?: 'PB4' | 'PB5';
    readonly instant: Date;
}

function parsePayload(row: EmailOutboxRow, kind: 'archive' | 'deletion'): RetentionPayload {
    const payload: unknown = row.payload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError('El payload del aviso de retención no es válido');
    }
    const data = payload as Record<string, unknown>;
    const instantValue = kind === 'archive' ? data.archiveAt : data.deletionAt;
    const instant =
        typeof instantValue === 'string' && ISO_INSTANT.test(instantValue)
            ? new Date(instantValue)
            : null;
    if (
        typeof data.vertical !== 'string' ||
        !isListingNoticeVertical(data.vertical) ||
        typeof data.listingId !== 'string' ||
        data.listingId.length === 0 ||
        !instant ||
        Number.isNaN(instant.getTime()) ||
        (kind === 'archive' &&
            (typeof data.transition !== 'string' || !TRANSITIONS.includes(data.transition)))
    ) {
        throw new TypeError('Faltan datos requeridos del aviso previo de retención');
    }
    return {
        vertical: data.vertical,
        listingId: data.listingId,
        ...(kind === 'archive' ? { transition: data.transition as 'PB4' | 'PB5' } : {}),
        instant
    };
}

function verticalName(vertical: string): string {
    return formatTrialVerticalInline({ vertical });
}

function marketDate(instant: Date): string {
    return formatDate({ dateString: getLocalDateString({ instant }) });
}

/** Renderers for the two pre-retention notices; each links to the owner's listing page. */
export function createListingRetentionRenderers(input: {
    readonly siteUrl: string;
}): Readonly<Record<string, OutboxMailRenderer>> {
    return {
        [BEFORE_ARCHIVE]: ({ row }) => {
            const data = parsePayload(row, 'archive');
            const name = verticalName(data.vertical);
            const archiveDate = marketDate(data.instant);
            return {
                subject: `Tu ficha de ${name} se va a archivar por inactividad`,
                react: (
                    <ListingRetentionBeforeArchive
                        verticalName={name}
                        transition={data.transition as 'PB4' | 'PB5'}
                        archiveDate={archiveDate}
                        actionUrl={resolveAccountListingsUrl({
                            siteUrl: input.siteUrl,
                            vertical: data.vertical
                        })}
                    />
                )
            };
        },
        [BEFORE_DELETION]: ({ row }) => {
            const data = parsePayload(row, 'deletion');
            const name = verticalName(data.vertical);
            const deletionDate = marketDate(data.instant);
            return {
                subject: `El contenido de tu ficha de ${name} se va a borrar`,
                react: (
                    <ListingRetentionBeforeDeletion
                        verticalName={name}
                        deletionDate={deletionDate}
                        actionUrl={resolveAccountListingsUrl({
                            siteUrl: input.siteUrl,
                            vertical: data.vertical
                        })}
                    />
                )
            };
        }
    };
}
