/**
 * @file field-input-ids.ts
 * @description Maps each Zod field of `AccommodationEditFormSchema` to the DOM
 * `id` of the input that should receive focus when it fails (HOS-373 phase 2).
 *
 * This table exists because three naming layers drifted apart independently and
 * no string rule can bridge them — see `fieldInputId` in
 * `@/components/ui/FieldError` for the worked examples.
 *
 * ## Transitional as of HOS-385
 *
 * The accommodation sections no longer write these ids — they DERIVE them with
 * `buildFieldId`. This table survives only because `useZodForm` still takes a
 * `FieldInputIdMap`; PR 4 of HOS-385 switches `focusFirstInvalidField` to the
 * derivation and deletes this file.
 *
 * Until then every row here must equal `buildFieldId({ prefix, name, suffix })`
 * for its key, and `test/components/host/accommodation-field-ids.test.tsx`
 * asserts exactly that. The old text-scanning guard cannot: it searches the
 * sources for an id literal, and there are none left to find.
 */

import type { FieldInputIdMap } from '@/components/ui/FieldError';

/**
 * Accommodation editor: Zod field path → input id.
 *
 * Notable rows:
 * - `destinationId` → `acc-destinationId`. It was `acc-destination` until
 *   HOS-385: the slug dropped the `Id` the Zod key carries, and the derivation
 *   restores it. Ids here are internal, so the rename is safe at runtime.
 * - `facebook`/`instagram`/… → `acc-<network>` while React state calls them
 *   `<network>Url`; `SOCIAL_FIELD_TO_SCHEMA_KEY` in the editor bridges the other
 *   half of that drift.
 * - `phone`/`whatsapp` → the `-number` input, not the country combobox: one Zod
 *   field, two DOM inputs, and the number is what `aria-describedby` points at.
 * - `description` → `acc-description` in BOTH branches. The plain `<textarea>`
 *   already carried that id; the entitled rich-text branch renders a
 *   contenteditable that had NO id until HOS-373 added one (which also fixes a
 *   pre-existing a11y bug — the section's `<label htmlFor="acc-description">`
 *   pointed at nothing whenever the rich branch rendered).
 */
export const ACCOMMODATION_FIELD_INPUT_IDS: FieldInputIdMap = {
    name: 'acc-name',
    summary: 'acc-summary',
    description: 'acc-description',
    type: 'acc-type',
    destinationId: 'acc-destinationId',
    maxGuests: 'acc-maxGuests',
    bedrooms: 'acc-bedrooms',
    bathrooms: 'acc-bathrooms',
    basePrice: 'acc-basePrice',
    latitude: 'acc-latitude',
    longitude: 'acc-longitude',
    phone: 'acc-phone-number',
    whatsapp: 'acc-whatsapp-number',
    email: 'acc-email',
    website: 'acc-website',
    facebook: 'acc-facebook',
    instagram: 'acc-instagram',
    twitter: 'acc-twitter',
    linkedin: 'acc-linkedin',
    tiktok: 'acc-tiktok',
    youtube: 'acc-youtube'
} as const;
