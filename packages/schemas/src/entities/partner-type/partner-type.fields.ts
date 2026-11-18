import { z } from 'zod';
import { I18nTextSchema } from '../../common/i18n.schema.js';

/**
 * Shared field definitions for the partner type catalog (HOS-2336).
 */

/**
 * Maximum slug length. `alliance_leads.partner_type` is `varchar(30)` and
 * stores the slug, so a longer slug could never be submitted by a lead.
 */
export const PARTNER_TYPE_SLUG_MAX_LENGTH = 30;

/** Kebab-case slug pattern shared by the catalog and the lead field. */
export const PARTNER_TYPE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Partner type slug: kebab-case machine identifier (`business`, `media`).
 * Immutable once created (spec AC-3.3) because alliance leads store slugs.
 */
export const PartnerTypeSlugSchema = z
    .string({ message: 'zodError.partnerType.slug.required' })
    .min(2, { message: 'zodError.partnerType.slug.min' })
    .max(PARTNER_TYPE_SLUG_MAX_LENGTH, { message: 'zodError.partnerType.slug.max' })
    .regex(PARTNER_TYPE_SLUG_PATTERN, { message: 'zodError.partnerType.slug.pattern' });

/**
 * Display name in the three locales. Spanish must be non-blank: it is the
 * fallback every consumer uses when a locale is empty.
 */
export const PartnerTypeNameSchema = I18nTextSchema.refine((value) => value.es.trim().length > 0, {
    message: 'zodError.partnerType.nameI18n.esRequired',
    path: ['es']
});

/** Ordering weight: lower renders first. */
export const PartnerTypeDisplayWeightSchema = z
    .number({ message: 'zodError.partnerType.displayWeight.required' })
    .int({ message: 'zodError.partnerType.displayWeight.int' })
    .min(1, { message: 'zodError.partnerType.displayWeight.min' })
    .max(1000, { message: 'zodError.partnerType.displayWeight.max' })
    .default(50);
