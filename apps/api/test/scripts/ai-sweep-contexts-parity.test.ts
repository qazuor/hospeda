/**
 * HOS-2095: the AI sweep must measure the chat EXACTLY as production runs it.
 *
 * The sweep (packages/ai-core/scripts/ai-sweep) reads `contexts.generated.json`
 * and builds each system message as `context + systemSuffixes[feature][locale]`.
 * These tests prove, from the apps/api side where the real builders live, that
 * this concatenation is byte-identical to what `buildChatSystemMessage` produces
 * over the real context builders and the in-code prompts — one case per feature,
 * built WITHOUT the generator's own render helper — and that the committed file
 * is not stale.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { composeSystemPrompt, DEFAULT_PROMPTS, DEFAULT_RULES } from '@repo/ai-core';
import { OpeningHoursSchema } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { buildGeneratedFile, SWEEP_DIR } from '../../scripts/ai-sweep/generate-sweep-contexts.js';
import {
    CatalogCurationFileSchema,
    EntityFileSchema,
    type SweepEntity
} from '../../scripts/ai-sweep/render-sweep-contexts.js';
import { buildMarkdownContext } from '../../src/services/accommodation-ai-context.js';
import { buildExperienceMarkdownContext } from '../../src/services/ai-context/experience-ai-context.js';
import { buildChatSystemMessage } from '../../src/services/ai-context/owner-data-fence.js';
import { buildVenueMarkdownContext } from '../../src/services/ai-context/venue-ai-context.js';
import { toVenueNightContext } from '../../src/services/ai-context/venue-night-context.js';

const read = (name: string): string => readFileSync(resolve(SWEEP_DIR, name), 'utf8');
const generated = JSON.parse(read('contexts.generated.json')) as {
    systemSuffixes: Record<string, Record<string, string>>;
    cases: Record<string, { feature: string; entity: string; locale: string; context: string }>;
};
const snapshots = EntityFileSchema.parse(JSON.parse(read('inputs/accommodation-snapshots.json')));
const synthetic = EntityFileSchema.parse(JSON.parse(read('inputs/synthetic-entities.json')));
const curation = CatalogCurationFileSchema.parse(JSON.parse(read('inputs/catalog-curation.json')));

/** What the sweep sends for a case: plain concatenation of generated strings. */
function sweepSystem(caseId: string): string {
    const c = generated.cases[caseId];
    if (!c) throw new Error(`case ${caseId} missing from contexts.generated.json`);
    const suffix = generated.systemSuffixes[c.feature]?.[c.locale];
    if (suffix === undefined) throw new Error(`no suffix for ${c.feature}/${c.locale}`);
    return c.context + suffix;
}

/** What production sends: the real builder of the system message. */
function productionSystem(
    feature: 'chat' | 'chat_venue' | 'chat_experience',
    context: string
): string {
    const prompt = composeSystemPrompt({
        content: DEFAULT_PROMPTS[feature],
        rules: DEFAULT_RULES[feature]
    });
    return buildChatSystemMessage(context, prompt, 'es');
}

function entity<K extends SweepEntity['kind']>(
    file: typeof snapshots,
    id: string,
    kind: K
): Extract<SweepEntity, { kind: K }> {
    const found = file.entities[id];
    if (!found || found.kind !== kind) throw new Error(`entity ${id} is not a ${kind}`);
    return found as Extract<SweepEntity, { kind: K }>;
}

describe('HOS-2095 sweep system messages are byte-identical to production', () => {
    it('chat_venue: venue-nightclub-minor', () => {
        // Arrange
        const e = entity(synthetic, 'club-nocturno-uruguay', 'venue');
        const night = e.night
            ? toVenueNightContext({
                  row: {
                      entryKind: e.night.entryKind,
                      entryNoteI18n: e.night.entryNoteI18n,
                      entryPriceFrom: e.night.entryPriceFrom,
                      policies: e.venue.policies
                  },
                  available: e.night.available,
                  locale: 'es'
              })
            : null;

        // Act
        const context = buildVenueMarkdownContext(
            { id: 'sweep', ...e.venue },
            e.faqs,
            e.menuItems,
            e.includeMenu,
            night,
            'es'
        );

        // Assert
        expect(sweepSystem('venue-nightclub-minor')).toBe(productionSystem('chat_venue', context));
    });

    it('chat_experience: experience-meeting-point', () => {
        // Arrange
        const e = entity(synthetic, 'paseo-lancha-punto-encuentro', 'experience');

        // Act
        const context = buildExperienceMarkdownContext(
            { id: 'sweep', ...e.experience },
            e.faqs,
            e.includeDirections,
            'es'
        );

        // Assert
        expect(sweepSystem('experience-meeting-point')).toBe(
            productionSystem('chat_experience', context)
        );
    });

    it('chat: acc-real-casa-pool-heated-ac (public snapshot + catalog curation)', () => {
        // Arrange
        const e = entity(snapshots, 'real-casa', 'accommodation');
        const row = (slug: string, table: typeof curation.amenities) => ({
            name: slug,
            isFeatured: table[slug]?.isFeatured ?? false,
            displayWeight: table[slug]?.displayWeight ?? 50
        });

        // Act
        const context = buildMarkdownContext(
            {
                id: 'sweep',
                name: e.accommodation.name,
                summary: e.accommodation.summary,
                description: e.accommodation.description,
                type: e.accommodation.type,
                destinationId: 'sweep',
                ownerId: 'sweep',
                averageRating: e.accommodation.averageRating,
                reviewsCount: e.accommodation.reviewsCount,
                destination: { name: e.accommodation.destinationName },
                extraInfo: e.accommodation.extraInfo,
                price: e.accommodation.price,
                policies: null
            },
            e.faqs,
            e.amenities.map((slug) => row(slug, curation.amenities)),
            e.features.map((slug) => row(slug, curation.features)),
            [],
            'es'
        );

        // Assert
        expect(sweepSystem('acc-real-casa-pool-heated-ac')).toBe(productionSystem('chat', context));
        expect(context).toContain('- Aire acondicionado');
    });

    it('the committed contexts.generated.json is not stale', () => {
        // Parsed, not textual: a formatter pass over the JSON must not read as drift.
        expect(JSON.parse(buildGeneratedFile().json)).toEqual(
            JSON.parse(read('contexts.generated.json'))
        );
    });

    it('synthetic schedules use the real OpeningHoursSchema shape (one partial row on purpose)', () => {
        const partial = new Set(['heladeria-dia-sin-cargar']);
        for (const [id, e] of Object.entries(synthetic.entities)) {
            const hours =
                e.kind === 'venue'
                    ? e.venue.openingHours
                    : e.kind === 'experience'
                      ? e.experience.openingHours
                      : null;
            if (hours === null) continue;
            expect(OpeningHoursSchema.safeParse(hours).success, id).toBe(!partial.has(id));
        }
    });
});
