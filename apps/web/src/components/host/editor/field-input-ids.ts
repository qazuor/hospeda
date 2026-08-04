/**
 * @file field-input-ids.ts
 * @description Maps each Zod field of `AccommodationEditFormSchema` to the DOM
 * `id` of the input that should receive focus when it fails (HOS-373 phase 2).
 *
 * This table exists because three naming layers drifted apart independently and
 * no string rule can bridge them — see `fieldInputId` in
 * `@/components/ui/FieldError` for the worked examples.
 *
 * Every entry is verified against the rendered sections by
 * `test/lib/forms/field-input-id-contract.test.ts`. Adding a field here without
 * a matching `id` in the markup fails that guard, which is the whole point: a
 * wrong id makes focus a silent no-op that nobody notices.
 */

import type { FieldInputIdMap } from '@/components/ui/FieldError';

/**
 * Accommodation editor: Zod field path → input id.
 *
 * Notable rows:
 * - `destinationId` → `acc-destination` (the id slug drops the `Id` suffix).
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
    destinationId: 'acc-destination',
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
