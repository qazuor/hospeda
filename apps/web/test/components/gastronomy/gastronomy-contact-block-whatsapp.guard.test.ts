/**
 * @file gastronomy-contact-block-whatsapp.guard.test.ts
 * @description Static guard against re-introducing `socialNetworks.whatsapp`
 * on the gastronomy public detail path (HOS-1076).
 *
 * `whatsapp` never existed in `SocialNetworkSchema` (the shape backing the
 * `socialNetworks` JSONB column — `packages/schemas/src/common/social.schema.ts`),
 * so nothing writes it today. But three files used to treat it as a real
 * field: the web-side `GastronomySocialNetworks` type declared it, the API
 * transform copied it off the raw payload, and `GastronomyContactBlock.astro`
 * rendered it with NO entitlement gate — unlike accommodation's
 * `CAN_CONTACT_WHATSAPP_DISPLAY` channel. Any of the three re-appearing would
 * re-open the render path.
 *
 * Vitest cannot render `.astro` files in this repo (no Astro test runtime is
 * wired up), so the `.astro` half of this guard is a SOURCE-level check: it
 * proves the `SOCIAL_LINKS` array — the declared list of keys the component
 * will render — has no `whatsapp` entry, not that a live render omits a
 * WhatsApp link. The check is anchored on that array literal specifically
 * (not a whole-file text match) because the file's own explanatory comments
 * legitimately mention "whatsapp" when documenting why it was removed.
 * The transform half (`toGastronomyDetailPageProps` in transforms.test.ts)
 * covers the actual runtime behavior of the data that would feed that render.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const CONTACT_BLOCK_PATH = join(
    __dirname,
    '../../../src/components/gastronomy/GastronomyContactBlock.astro'
);
const DATA_TYPES_PATH = join(__dirname, '../../../src/data/types.ts');
const TRANSFORMS_PATH = join(__dirname, '../../../src/lib/api/transforms.ts');

describe('GastronomyContactBlock — no whatsapp read path (HOS-1076)', () => {
    it('SOCIAL_LINKS in GastronomyContactBlock.astro has no whatsapp entry', () => {
        const source = readFileSync(CONTACT_BLOCK_PATH, 'utf-8');
        const match = source.match(
            /const SOCIAL_LINKS: readonly SocialLink\[\] = \[[\s\S]*?\] as const;/
        );
        expect(match).not.toBeNull();
        expect(match?.[0]).not.toMatch(/whatsapp/i);
    });

    it('GastronomySocialNetworks (data/types.ts) does not declare a whatsapp field', () => {
        const source = readFileSync(DATA_TYPES_PATH, 'utf-8');
        const match = source.match(/export interface GastronomySocialNetworks \{[^}]*\}/s);
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
