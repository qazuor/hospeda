/**
 * @file field-input-ids.ts
 * @description Maps each Zod field of the commerce owner-update schema to the
 * DOM `id` of the input that should receive focus when it fails (HOS-373
 * phase 2).
 *
 * ## Transitional as of HOS-385
 *
 * The commerce sections no longer write these ids — they DERIVE them with
 * `buildFieldId`. This table survives only because `useZodForm` still takes a
 * `FieldInputIdMap`; PR 4 of HOS-385 switches `focusFirstInvalidField` to the
 * derivation and deletes this file.
 *
 * Until then every row here must equal `buildFieldId({ prefix, name, suffix })`
 * for its key, and `test/components/commerce/commerce-field-ids.test.tsx`
 * asserts exactly that. The old text-scanning guard cannot: it searched the
 * sources for an id literal, and there are none left to find.
 */

import type { FieldInputIdMap } from '@/components/ui/FieldError';

/**
 * Commerce editor: Zod field path → input id.
 *
 * Notable rows:
 * - `contactInfo.mobilePhone` → the `-number` input of the composite phone
 *   field (country combobox + number), matching `aria-describedby`.
 * - `openingHours` → the first day's "closed" checkbox. The field carries one
 *   aggregate error across 7 days × N shifts, so this is the group's first
 *   control rather than the actual failing input (OQ-3).
 * - `richDescription` → a contenteditable that had no id until HOS-373.
 *
 * The 8 dotted keys renamed under HOS-385: the hand-written ids dropped the
 * parent block entirely (`ce-workEmail`, `ce-social-facebook`), while the
 * derivation normalises the dot to a hyphen and keeps it.
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
    'contactInfo.mobilePhone': 'ce-contactInfo-mobilePhone-number',
    'contactInfo.workEmail': 'ce-contactInfo-workEmail',
    'socialNetworks.facebook': 'ce-socialNetworks-facebook',
    'socialNetworks.instagram': 'ce-socialNetworks-instagram',
    'socialNetworks.twitter': 'ce-socialNetworks-twitter',
    'socialNetworks.tiktok': 'ce-socialNetworks-tiktok',
    'socialNetworks.youtube': 'ce-socialNetworks-youtube',
    'socialNetworks.linkedIn': 'ce-socialNetworks-linkedIn'
} as const;
