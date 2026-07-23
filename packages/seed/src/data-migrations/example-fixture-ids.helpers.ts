/**
 * @fileoverview
 * Colocated helper for the `0023-soft-delete-example-data` data-migration.
 *
 * This file is deliberately NOT named with a `NNNN-` numeric prefix: the
 * migration discovery step (`discover.ts`) scans this directory with the
 * pattern `^(\d{4})-.+\.(?:ts|js)$` and loads every match as a migration
 * module. A `0023-*.helpers.ts` file would (a) be picked up as a second
 * migration with the SAME `0023` prefix (→ "duplicate numeric prefix" throw)
 * and (b) fail the `meta`/`up` shape check. A prefix-less name sidesteps both,
 * so this file is invisible to discovery and importable only by the migration
 * that references it.
 *
 * Copied from `hospeda-purge-seed-example-data`'s
 * `purge-seed-example-data.helpers.ts` (HOS-261 Phase 2, hard-delete). This
 * Phase 1 (soft-delete, HOS-261) migration only needs the content-id half —
 * {@link computeFakeExampleIds} — which recomputes the exact deterministic
 * UUIDv5 ids the `example` seed assigned to accommodations, posts, events,
 * event organizers, and event locations, by reading the SAME
 * `manifest-example.json` the seed reads and applying the SAME
 * `deterministicFixtureId` helper with the SAME per-entity seed-key prefix.
 * Every `example` fixture id equals its filename stem (verified across all
 * five entity types), so the seed-key is `"<prefix>:<basename-without-.json>"`.
 *
 * `EXAMPLE_USER_EMAILS` is also carried over (unused by this migration —
 * Phase 1 never touches `users` — but kept so this file stays a faithful,
 * easily-diffable copy of its Phase 2 counterpart; import only what you need).
 */
import path from 'node:path';
import exampleManifest from '../manifest-example.json';
import { deterministicFixtureId } from '../utils/deterministicFixtureId.js';

/** The `manifest-example.json` keys whose files receive deterministic ids. */
type DeterministicManifestKey =
    | 'accommodations'
    | 'posts'
    | 'events'
    | 'eventOrganizers'
    | 'eventLocations';

/**
 * The seed-key entity prefix used by each `example` seed when deriving its
 * fixture id (e.g. `accommodations.seed.ts` uses `accommodation:${item.id}`).
 * Kept in one place so the migration cannot drift from the seed's key shape.
 */
const SEED_KEY_PREFIX: Readonly<Record<DeterministicManifestKey, string>> = {
    accommodations: 'accommodation',
    posts: 'post',
    events: 'event',
    eventOrganizers: 'eventOrganizer',
    eventLocations: 'eventLocation'
} as const;

/**
 * Strips the directory and `.json` extension from a manifest entry, yielding
 * the fixture's stable `id`. `path.basename(file, '.json')` handles both the
 * subdir'd accommodation entries (`"chajari/001-....json"`) and the flat
 * post/event/organizer/location entries (`"001-....json"`).
 */
const fixtureStem = (manifestEntry: string): string => path.basename(manifestEntry, '.json');

/**
 * Recomputes the deterministic UUIDv5 ids for every fixture declared under
 * `manifest-example.json[key]`, using the same seed-key shape the seed used.
 */
const idsForKey = (key: DeterministicManifestKey): string[] => {
    const manifest = exampleManifest as unknown as Record<string, readonly string[] | undefined>;
    const files = manifest[key] ?? [];
    return files.map((file) =>
        deterministicFixtureId({ seedKey: `${SEED_KEY_PREFIX[key]}:${fixtureStem(file)}` })
    );
};

/** The deterministic id sets of the fake `example` content to be soft-deleted. */
export interface FakeExampleIds {
    /** UUIDv5 ids of the 104 example accommodations. */
    readonly accommodationIds: readonly string[];
    /** UUIDv5 ids of the 18 example blog `posts` (content, NOT `social_posts`). */
    readonly postIds: readonly string[];
    /** UUIDv5 ids of the 24 example events. */
    readonly eventIds: readonly string[];
    /** UUIDv5 ids of the 5 example event organizers. */
    readonly eventOrganizerIds: readonly string[];
    /** UUIDv5 ids of the 5 example event locations. */
    readonly eventLocationIds: readonly string[];
}

/**
 * Recomputes the exact deterministic ids the `example` seed assigned, so the
 * migration soft-deletes ONLY those rows (never "soft-delete all
 * accommodations").
 */
export function computeFakeExampleIds(): FakeExampleIds {
    return {
        accommodationIds: idsForKey('accommodations'),
        postIds: idsForKey('posts'),
        eventIds: idsForKey('events'),
        eventOrganizerIds: idsForKey('eventOrganizers'),
        eventLocationIds: idsForKey('eventLocations')
    };
}

/**
 * Fixture emails of the 38 `example` users (the value seeded into
 * `users.email`). NOT used by this Phase 1 (soft-delete) migration — carried
 * over from the Phase 2 (hard-delete) helper only so this file stays a
 * faithful copy. See the Phase 2 migration for how it is actually consumed
 * as a strict allowlist.
 *
 * Source of truth: `packages/seed/src/data/user/example/*.json`
 * (`contactInfo.personalEmail`). Do NOT add a required/admin email here.
 */
export const EXAMPLE_USER_EMAILS: readonly string[] = [
    'carlos.martinez@hospeda.com.ar',
    'guest@hospeda.com',
    'ana.rodriguez@hospeda.com.ar',
    'miguel.torres@hospeda.com.ar',
    'laura.vega@gmail.com',
    'lucas.fernandez@gmail.com',
    'sofia.morales@hospeda.com.ar',
    'roberto.mendoza@hospeda.com.ar',
    'carmen.silva@hospeda.com.ar',
    'fernando.lopez@hospeda.com.ar',
    'patricia.ruiz@hospeda.com.ar',
    'andres.castro@hospeda.com.ar',
    'monica.herrera@hospeda.com.ar',
    'daniel.jimenez@hospeda.com.ar',
    'silvia.moreno@hospeda.com.ar',
    'javier.ramirez@hospeda.com.ar',
    'claudia.torres@hospeda.com.ar',
    'sergio.vargas@hospeda.com.ar',
    'gabriela.medina@hospeda.com.ar',
    'ricardo.delgado@hospeda.com.ar',
    'beatriz.sanchez@hospeda.com.ar',
    'alejandro.ortega@hospeda.com.ar',
    'mariana.guerrero@hospeda.com.ar',
    'gustavo.pena@hospeda.com.ar',
    'valeria.aguilar@hospeda.com.ar',
    'ernesto.flores@hospeda.com.ar',
    'lucia.ramos@hospeda.com.ar',
    'hector.cabrera@hospeda.com.ar',
    'natalia.vega@hospeda.com.ar',
    'raul.molina@hospeda.com.ar',
    'alejandra.cortes@hospeda.com.ar',
    'marcos.mendez@hospeda.com.ar',
    'elena.paredes@hospeda.com.ar',
    'gonzalo.reyes@hospeda.com.ar',
    'rosario.navarro@hospeda.com.ar',
    'tomas.lara@hospeda.com.ar',
    'cristina.romero@hospeda.com.ar',
    'romina.villaverde@gmail.com'
] as const;
