/**
 * @file get-listing-creation-guide.ts
 * @description `get_listing_creation_guide` (HOS-2329, spec HOS-2335 §6.4): what
 * the model needs to walk the user through `create_listing`, read-only.
 *
 * - the ordered steps, with the fields each one asks for;
 * - each field's limits, read from the SAME schemas `create_listing` validates
 *   with (`create-listing-input.ts`, a `.pick()` of the portal route schema), so
 *   the guide and the create never drift;
 * - the type options (and experience price units) with Spanish labels, the CITY
 *   destinations, and the venue business lines per type;
 * - the owner's open drafts of the vertical with their editor links (resume
 *   instead of starting over) and the informational publish quota, which never
 *   blocks: drafts are unlimited (§11 U-2).
 *
 * `READ_OWN`: the guide reads only the caller's own drafts.
 */

import { VerticalEnum } from '@repo/schemas';
import { z } from 'zod';
import { env } from '../../../utils/env';
import { buildPortalUrl } from '../../portal/build-portal-url';
import { defineTool, type ToolHandlerResult } from '../tool-definition';
import {
    AccommodationCreateFieldsSchema,
    ExperienceCreateFieldsSchema,
    VenueCreateFieldsSchema
} from './create-listing-input';
import {
    type CreationDestination,
    type CreationOption,
    experiencePriceUnitOptions,
    listCreationDestinations,
    listingTypeOptions,
    type PublishQuotaNote,
    readPublishQuotaNote,
    venueBusinessLineOptions
} from './listing-creation-catalog';
import { type ListingToolVertical, ListingToolVerticalSchema } from './listing-services';

/** Input of `get_listing_creation_guide`. */
export const GetListingCreationGuideInputSchema = z
    .object({
        vertical: ListingToolVerticalSchema.describe(
            'accommodation, venue or experience: what the user wants to publish.'
        )
    })
    .strict();

/** One field of a step, with its limits. */
export interface GuideField {
    readonly name: string;
    readonly required: boolean;
    readonly minLength?: number;
    readonly maxLength?: number;
    readonly minimum?: number;
    readonly maximum?: number;
}

/** One step of the wizard. */
export interface GuideStep {
    readonly step: string;
    readonly ask: string;
    readonly fields: readonly GuideField[];
}

/** What the guide answers. */
export interface ListingCreationGuide {
    readonly vertical: ListingToolVertical;
    readonly steps: readonly GuideStep[];
    readonly types: readonly CreationOption[];
    readonly priceUnits?: readonly CreationOption[];
    readonly businessLinesByType?: ReturnType<typeof venueBusinessLineOptions>;
    readonly destinations: readonly CreationDestination[] | null;
    readonly existingDrafts: readonly {
        readonly id: string;
        readonly name: string;
        readonly editorUrl: string;
    }[];
    readonly publishQuota: PublishQuotaNote;
    readonly createPageUrl: string;
}

/** The fields schema per vertical (what `create_listing` validates with). */
const FIELDS_SCHEMA: Readonly<Record<ListingToolVertical, z.ZodObject>> = {
    [VerticalEnum.ACCOMMODATION]: AccommodationCreateFieldsSchema,
    [VerticalEnum.VENUE]: VenueCreateFieldsSchema,
    [VerticalEnum.EXPERIENCE]: ExperienceCreateFieldsSchema
};

/** Street and number bounds of venue/experience (`PostalAddressSchema`). */
const POSTAL_LIMITS: readonly GuideField[] = [
    { name: 'street', required: false, minLength: 2, maxLength: 50 },
    { name: 'number', required: false, minLength: 1, maxLength: 10 }
];

/** The steps, in order, and the fields each asks for. */
const STEP_PLAN: Readonly<
    Record<ListingToolVertical, readonly { step: string; ask: string; fields: readonly string[] }[]>
> = {
    [VerticalEnum.ACCOMMODATION]: [
        { step: 'basics', ask: 'Nombre y tipo de alojamiento', fields: ['name', 'type'] },
        { step: 'destination', ask: 'Ciudad', fields: ['destinationId'] },
        { step: 'description', ask: 'Resumen y descripción', fields: ['summary', 'description'] },
        {
            step: 'capacity',
            ask: 'Capacidad (opcional)',
            fields: ['maxGuests', 'bedrooms', 'bathrooms', 'beds']
        },
        {
            step: 'location',
            ask: 'Link de Google Maps del lugar, calle y número',
            fields: ['mapsUrl', 'street', 'number']
        }
    ],
    [VerticalEnum.VENUE]: [
        { step: 'basics', ask: 'Nombre y tipo de local', fields: ['name', 'type'] },
        { step: 'destination', ask: 'Ciudad', fields: ['destinationId'] },
        { step: 'description', ask: 'Resumen y descripción', fields: ['summary', 'description'] },
        {
            step: 'businessLines',
            ask: 'Líneas de negocio (opcional, según el tipo)',
            fields: ['businessLines']
        },
        {
            step: 'location',
            ask: 'Link de Google Maps del lugar, calle y número',
            fields: ['mapsUrl', 'street', 'number']
        }
    ],
    [VerticalEnum.EXPERIENCE]: [
        { step: 'basics', ask: 'Nombre y tipo de experiencia', fields: ['name', 'type'] },
        { step: 'destination', ask: 'Ciudad', fields: ['destinationId'] },
        { step: 'description', ask: 'Resumen y descripción', fields: ['summary', 'description'] },
        {
            step: 'price',
            ask: 'Precio desde (en centavos) y unidad, o precio a consultar',
            fields: ['priceFrom', 'priceUnit', 'isPriceOnRequest']
        },
        {
            step: 'meetingPoint',
            ask: 'Link de Google Maps del punto de encuentro, calle y número',
            fields: ['mapsUrl', 'street', 'number']
        }
    ]
};

/** The JSON Schema facts the guide reads per property. */
const PropertyLimitsSchema = z.looseObject({
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    minimum: z.number().optional(),
    maximum: z.number().optional()
});

const ObjectJsonSchema = z.looseObject({
    properties: z.record(z.string(), z.unknown()).optional(),
    required: z.array(z.string()).optional()
});

/**
 * Reads the limits of every field of a schema from its JSON Schema.
 *
 * @param args - The fields schema
 * @returns The fields, by name
 */
export function readFieldLimits({
    schema
}: {
    readonly schema: z.ZodObject;
}): ReadonlyMap<string, GuideField> {
    const json = ObjectJsonSchema.parse(
        z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' })
    );
    const required = new Set(json.required ?? []);
    const fields = new Map<string, GuideField>();
    for (const [name, property] of Object.entries(json.properties ?? {})) {
        const limits = PropertyLimitsSchema.safeParse(property);
        const { minLength, maxLength, minimum, maximum } = limits.success ? limits.data : {};
        fields.set(name, {
            name,
            required: required.has(name),
            ...(minLength === undefined ? {} : { minLength }),
            ...(maxLength === undefined ? {} : { maxLength }),
            ...(minimum === undefined ? {} : { minimum }),
            ...(maximum === undefined ? {} : { maximum })
        });
    }
    return fields;
}

/** The steps of a vertical with each field's limits. */
function stepsFor(vertical: ListingToolVertical): readonly GuideStep[] {
    const limits = readFieldLimits({ schema: FIELDS_SCHEMA[vertical] });
    const postal = new Map(POSTAL_LIMITS.map((field) => [field.name, field]));
    return STEP_PLAN[vertical].map(({ step, ask, fields }) => ({
        step,
        ask,
        fields: fields.map(
            (name) =>
                limits.get(name) ??
                (vertical === VerticalEnum.ACCOMMODATION ? undefined : postal.get(name)) ?? {
                    name,
                    required: false
                }
        )
    }));
}

/**
 * `get_listing_creation_guide`: read-only, own data only.
 */
export const getListingCreationGuideTool = defineTool({
    name: 'get_listing_creation_guide',
    title: 'Guía para crear una publicación',
    description:
        "Returns what is needed to create a listing of one vertical (accommodation, venue or experience) for the connected Hospeda user: the ordered steps and the fields each one asks for with their limits, the type options with Spanish labels, the city destinations, business lines (venues) or price units (experiences), the user's open drafts of that vertical with links to resume them, and an informational publish quota. Call it before create_listing and ask the user one step at a time, in their own words; if the user already has a draft, offer to resume it instead of creating another one.",
    inputSchema: GetListingCreationGuideInputSchema,
    isWrite: false,
    emailUnverifiedOperation: 'READ_OWN',
    handler: async ({
        actor,
        input,
        context
    }): Promise<ToolHandlerResult<ListingCreationGuide>> => {
        const { vertical } = input;
        const [destinations, publishQuota] = await Promise.all([
            listCreationDestinations(),
            readPublishQuotaNote({ actor, vertical })
        ]);
        const siteUrl = env.HOSPEDA_SITE_URL;
        const { locale } = context;
        return {
            data: {
                vertical,
                steps: stepsFor(vertical),
                types: listingTypeOptions({ vertical }),
                ...(vertical === VerticalEnum.EXPERIENCE
                    ? { priceUnits: experiencePriceUnitOptions() }
                    : {}),
                ...(vertical === VerticalEnum.VENUE
                    ? { businessLinesByType: venueBusinessLineOptions() }
                    : {}),
                destinations: destinations ?? null,
                existingDrafts: publishQuota.drafts.map((draft) => ({
                    id: draft.id,
                    name: draft.name,
                    editorUrl: buildPortalUrl({
                        destination: { kind: 'listingEditor', vertical, id: draft.id },
                        locale,
                        siteUrl
                    })
                })),
                publishQuota,
                createPageUrl: buildPortalUrl({
                    destination: { kind: 'createListing', vertical },
                    locale,
                    siteUrl
                })
            }
        };
    }
});
