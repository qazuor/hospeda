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
