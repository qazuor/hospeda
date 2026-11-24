/**
 * @file venue-contact-block-whatsapp.guard.test.ts
 * @description Static guard against re-introducing `socialNetworks.whatsapp`
 * on the venue public detail path (HOS-1076).
 *
 * `whatsapp` never existed in `SocialNetworkSchema` (the shape backing the
 * `socialNetworks` JSONB column — `packages/schemas/src/common/social.schema.ts`),
 * so nothing writes it today. But three files used to treat it as a real
 * field: the web-side `VenueSocialNetworks` type declared it, the API
 * transform copied it off the raw payload, and `VenueContactBlock.astro`
 * rendered it with NO entitlement gate — unlike accommodation's
 * `CAN_CONTACT_WHATSAPP_DISPLAY` channel. Any of the three re-appearing would
 * re-open the render path.
 *
 * HOS-2579 moved the venue's social list out of the deleted
 * `VenueContactBlock.astro` into `buildVenueContactBlock`
 * (`lib/listing-contact/listing-contact-block.ts`). This guard is a SOURCE-level
 * check on the two declarations that decide which networks may render, the
 * `PublicSocialKey` type and the `PUBLIC_SOCIAL_LINKS` list: neither may name
 * `whatsapp`. It is anchored on those declarations rather than a whole-file
 * text match because the module's comments legitimately mention "whatsapp"
 * when documenting why it is excluded. The behavioural half (a payload carrying
 * a whatsapp key renders no link) is in
 * `test/lib/listing-contact/listing-contact-block.test.ts`.
 * The transform half (`toVenueDetailPageProps` in transforms.test.ts)
 * covers the actual runtime behavior of the data that would feed that render.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const CONTACT_BLOCK_PATH = join(
    __dirname,
    '../../../src/lib/listing-contact/listing-contact-block.ts'
);
const DATA_TYPES_PATH = join(__dirname, '../../../src/data/types.ts');
const TRANSFORMS_PATH = join(__dirname, '../../../src/lib/api/transforms.ts');

describe('venue contact block — no whatsapp read path (HOS-1076)', () => {
    it('the allowed social keys and their list in listing-contact-block.ts have no whatsapp entry', () => {
        const source = readFileSync(CONTACT_BLOCK_PATH, 'utf-8');
        const keys = source.match(/type PublicSocialKey = [^;]*;/);
        const list = source.match(/const PUBLIC_SOCIAL_LINKS: [\s\S]*?\n\];/);
        expect(keys).not.toBeNull();
        expect(list).not.toBeNull();
        expect(keys?.[0]).not.toMatch(/whatsapp/i);
        expect(list?.[0]).not.toMatch(/whatsapp/i);
    });

    it('VenueSocialNetworks (data/types.ts) does not declare a whatsapp field', () => {
        const source = readFileSync(DATA_TYPES_PATH, 'utf-8');
        const match = source.match(/export interface VenueSocialNetworks \{[^}]*\}/s);
        expect(match).not.toBeNull();
        expect(match?.[0]).not.toMatch(/whatsapp/i);
    });

    it('normalizeSocialNetworks (transforms.ts) does not read obj.whatsapp', () => {
        const source = readFileSync(TRANSFORMS_PATH, 'utf-8');
        const match = source.match(/function normalizeSocialNetworks\([^{]*\{[\s\S]*?\n\}/);
        expect(match).not.toBeNull();
        expect(match?.[0]).not.toMatch(/whatsapp/i);
    });
});
