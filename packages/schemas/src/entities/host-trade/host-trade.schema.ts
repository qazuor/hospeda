import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { DestinationIdSchema } from '../../common/id.schema.js';
import { HostTradeCategoryEnumSchema } from '../../enums/host-trade-category.schema.js';

/**
 * HostTradeSchema — base entity schema for the host-trades directory.
 *
 * Represents an admin-curated entry for a local tradesperson or service provider
 * that hosts can contact when they need maintenance, cleaning, or other services.
 * Each entry is scoped to a destination (city / locality).
 */
export const HostTradeSchema = z.object({
    /** Unique identifier for this host-trade entry (UUID v4) */
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),

    /** URL-safe slug derived from name (auto-generated server-side if omitted on create) */
    slug: z.string().min(1, { message: 'zodError.hostTrade.slug.min' }),

    /** Display name of the tradesperson or business */
    name: z.string().min(1, { message: 'zodError.hostTrade.name.min' }),

    /** Service category (e.g. PLOMERIA, ELECTRICIDAD) */
    category: HostTradeCategoryEnumSchema,

    /**
     * Contact information for the tradesperson.
     * Plain text — may be a phone number or a wa.me deep-link.
     * No format validation is applied; admin is responsible for accuracy.
     */
    contact: z.string().min(1, { message: 'zodError.hostTrade.contact.min' }),

    /**
     * Description of the benefit or special terms available to hosts
     * who mention Hospeda (e.g. "10 % de descuento presentando la app").
     */
    benefit: z.string().min(1, { message: 'zodError.hostTrade.benefit.min' }),

    /** Destination this trade entry is associated with */
    destinationId: DestinationIdSchema,

    /** Whether this tradesperson is available 24 hours a day */
    is24h: z.boolean().default(false),

    /**
     * Human-readable schedule text when not 24h
     * (e.g. "Lunes a Viernes 8:00–18:00").
     * Optional and nullable.
     */
    scheduleText: z.string().nullish(),

    /** Whether this entry is currently active and visible to hosts */
    isActive: z.boolean().default(true),

    // Shared audit + soft-delete fields
    ...BaseAuditFields
});

/**
 * Inferred TypeScript type for a full HostTrade entity record.
 */
export type HostTrade = z.infer<typeof HostTradeSchema>;
