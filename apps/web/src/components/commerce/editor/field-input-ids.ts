/**
 * @file field-input-ids.ts
 * @description Maps each Zod field of the commerce owner-update schema to the
 * DOM `id` of the input that should receive focus when it fails (HOS-373
 * phase 2).
 *
 * Companion to the accommodation table in
 * `@/components/host/editor/field-input-ids`. Both are verified against the
 * rendered markup by `test/lib/forms/field-input-id-contract.test.ts`.
 */

import type { FieldInputIdMap } from '@/components/ui/FieldError';

/**
 * Commerce editor: Zod field path → input id.
 *
 * Notable rows:
 * - `contactInfo.mobilePhone` → the `-number` input of the composite phone
 *   field (country combobox + number), matching `aria-describedby`.
 * - `socialNetworks.*` → `ce-social-<key>`. These inputs had NO id before
 *   HOS-373; the ids were added with this table.
 * - `openingHours` → `ce-openingHours`, the first day's "closed" checkbox. The
 *   field carries one aggregate error across 7 days × N shifts, so this is the
 *   group's first control rather than the actual failing input (OQ-3).
 * - `richDescription` → `ce-richDescription`, a contenteditable that also had no
 *   id until HOS-373.
 */
export const COMMERCE_FIELD_INPUT_IDS: FieldInputIdMap = {
    name: 'ce-name',
    destinationId: 'ce-destinationId',
    summary: 'ce-summary',
    description: 'ce-description',
    richDescription: 'ce-richDescription',
    menuUrl: 'ce-menuUrl',
    priceRange: 'ce-priceRange',
    priceFrom: 'ce-priceFrom',
    priceUnit: 'ce-priceUnit',
    openingHours: 'ce-openingHours',
    'contactInfo.mobilePhone': 'ce-phone-number',
    'contactInfo.workEmail': 'ce-workEmail',
    'socialNetworks.facebook': 'ce-social-facebook',
    'socialNetworks.instagram': 'ce-social-instagram',
    'socialNetworks.twitter': 'ce-social-twitter',
    'socialNetworks.tiktok': 'ce-social-tiktok',
    'socialNetworks.youtube': 'ce-social-youtube',
    'socialNetworks.linkedIn': 'ce-social-linkedIn'
} as const;
