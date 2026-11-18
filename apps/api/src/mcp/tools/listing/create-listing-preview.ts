/**
 * HOS-2329 — what the `create_listing` preview shows the model: the listing
 * record with its labels (type, destination, price in pesos) and the
 * instruction to confirm with the user.
 *
 * @module mcp/tools/listing/create-listing-preview
 */

import { VerticalEnum } from '@repo/schemas';
import {
    experiencePriceUnitLabel,
    formatContextMoney
} from '../../../services/ai-context/listing-labels';
import {
    blockForConfirmation,
    quoteForConfirmation,
    sanitizeForConfirmation
} from '../confirmation-text';
import type { CreateListingInput } from './create-listing-input';
import { listingTypeLabel } from './listing-creation-catalog';

/**
 * Builds the preview's instruction to the model.
 *
 * @param args - How long the confirmation token lives
 * @returns The instruction text
 */
export function previewInstructions({
    expiresInSeconds
}: {
    readonly expiresInSeconds: number;
}): string {
    const minutes = Math.round(expiresInSeconds / 60);
    return `Todavía NO se creó nada. Mostrale al usuario los datos de "listing" y de "location" (si hay coordenadas, pasale "mapCheckUrl" para que verifique el punto) y preguntale si lo confirma. El precio mostralo como dice "listing.priceLabel", nunca el número de "priceFrom", que está en centavos. Solo si responde que sí de forma explícita, volvé a llamar a create_listing con EXACTAMENTE los mismos datos y este confirmationToken. Si quiere cambiar algo, empezá de nuevo sin confirmationToken. El token es de un solo uso y vence en ${minutes} minutos. Se crea como borrador: no se publica.`;
}

/**
 * The listing as the user will see it in the preview: the input minus the
 * location fields and the token, plus the labels the model must show.
 *
 * @param args - The validated input and the destination's name
 * @returns The preview record
 */
export function previewListing(args: {
    readonly input: CreateListingInput;
    readonly destinationName: string;
}): Readonly<Record<string, unknown>> {
    const { input, destinationName } = args;
    const {
        vertical,
        mapsUrl: _maps,
        street: _street,
        number: _number,
        confirmationToken: _t,
        ...rest
    } = input;
    return {
        ...Object.fromEntries(Object.entries(rest).filter(([, value]) => value !== undefined)),
        typeLabel: listingTypeLabel({ vertical, type: input.type }),
        ...(vertical === VerticalEnum.EXPERIENCE ? { priceLabel: priceLabelOf({ input }) } : {}),
        destinationName
    };
}

/** The preview's price label when the experience has no price to show. */
export const PRICE_ON_REQUEST_LABEL = 'Consultar precio';

/**
 * Formats an experience's price for the preview: `Desde $ 15.000 por persona`,
 * or {@link PRICE_ON_REQUEST_LABEL} when it has none. `priceFrom` is centavos
 * (HOS-2095), so it is divided by 100 before formatting.
 *
 * @param args - The validated input
 * @returns The label
 */
export function priceLabelOf({ input }: { readonly input: CreateListingInput }): string {
    if (input.isPriceOnRequest || input.priceFrom === undefined || input.priceFrom === null) {
        return PRICE_ON_REQUEST_LABEL;
    }
    const amount = formatContextMoney({ amount: input.priceFrom / 100, locale: 'es' }).text;
    const unit = input.priceUnit
        ? ` ${experiencePriceUnitLabel({ unit: input.priceUnit, locale: 'es' }).label}`
        : '';
    return `Desde ${amount}${unit}`;
}

/** Spanish name of each vertical, as the portal names it. */
const VERTICAL_LABELS: Readonly<Record<CreateListingInput['vertical'], string>> = {
    [VerticalEnum.ACCOMMODATION]: 'Alojamiento',
    [VerticalEnum.VENUE]: 'Comer y salir',
    [VerticalEnum.EXPERIENCE]: 'Experiencia'
};

/** Server-built labels of the preview record, listed with the facts. */
const FACT_FIELD_LABELS: ReadonlyArray<readonly [string, string]> = [
    ['typeLabel', 'Tipo'],
    ['destinationName', 'Ciudad'],
    ['priceLabel', 'Precio']
];

/** Fields the user (through the model) wrote, each a quoted one-line value. */
const TEXT_FIELD_LABELS: ReadonlyArray<readonly [string, string, number]> = [
    ['name', 'Nombre', 120],
    ['summary', 'Resumen', 300],
    ['maxGuests', 'Huéspedes como máximo', 20],
    ['bedrooms', 'Dormitorios', 20],
    ['bathrooms', 'Baños', 20],
    ['beds', 'Camas', 20],
    ['businessLines', 'Líneas de negocio', 120]
];

/** Cap of the description block in the form, in characters. */
const DESCRIPTION_MAX_LENGTH = 1000;

/** Renders a preview value as text; anything else is left out. */
function fieldText(value: unknown): string | undefined {
    if (typeof value === 'string' || typeof value === 'number') {
        return String(value);
    }
    if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
        return value.join(', ');
    }
    return undefined;
}

/**
 * The text the client's confirmation form shows the human (HOS-2247, AC-C64):
 * the listing as the preview shows it, and the location exactly as the commit
 * will write it, the resolved point included.
 *
 * The facts the server resolved come FIRST (vertical, type, city, price, map
 * point, warning). The values the model supplied follow, each sanitized and
 * quoted on one line, and the description last, as a block whose every line is
 * prefixed (`confirmation-text.ts`), so no value can fake a line of the message.
 *
 * @param args - The vertical, the preview record and the location the preview resolved
 * @returns The Spanish form message
 */
export function createListingConfirmationMessage(args: {
    readonly vertical: CreateListingInput['vertical'];
    readonly listing: Readonly<Record<string, unknown>>;
    readonly point: { readonly lat: number; readonly lng: number } | null;
    readonly street?: string;
    readonly number?: string;
    readonly duplicateAddressWarning?: string;
}): string {
    const facts = FACT_FIELD_LABELS.flatMap(([key, label]) => {
        const text = fieldText(args.listing[key]);
        return text === undefined ? [] : [`${label}: ${quoteForConfirmation({ text })}`];
    });
    const location = [
        args.point === null
            ? 'Ubicación en el mapa: sin marcar (se puede marcar después en el editor)'
            : `Ubicación en el mapa: ${args.point.lat}, ${args.point.lng} (verificala en https://www.google.com/maps?q=${args.point.lat},${args.point.lng})`,
        ...(args.duplicateAddressWarning === undefined
            ? []
            : [
                  `Atención: ${sanitizeForConfirmation({ text: args.duplicateAddressWarning, maxLength: 300 })}`
              ])
    ];
    const address = [args.street, args.number].filter((part) => part !== undefined).join(' ');
    const written = [
        ...TEXT_FIELD_LABELS.flatMap(([key, label, maxLength]) => {
            const text = fieldText(args.listing[key]);
            return text === undefined
                ? []
                : [`${label}: ${quoteForConfirmation({ text, maxLength })}`];
        }),
        ...(address === '' ? [] : [`Dirección: ${quoteForConfirmation({ text: address })}`])
    ];
    const description = fieldText(args.listing.description);
    return [
        'Vas a crear esta publicación en Hospeda como BORRADOR (no se publica).',
        `Categoría: ${VERTICAL_LABELS[args.vertical]}`,
        ...facts,
        ...location,
        'Datos de la publicación:',
        ...written,
        ...(description === undefined
            ? []
            : [
                  'Descripción:',
                  blockForConfirmation({ text: description, maxLength: DESCRIPTION_MAX_LENGTH })
              ]),
        '¿Confirmás que se cree?'
    ].join('\n');
}
