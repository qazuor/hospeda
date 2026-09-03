/**
 * Guard: a write-input schema derived with `.omit()` may not silently inherit a
 * new server-written column from its base entity schema (HOS-1113).
 *
 * ## The mechanism
 *
 * Every content/commerce entity derives its write schemas from ONE base, and
 * not all of them the same way:
 *
 * ```
 * GastronomyOwnerUpdateInputSchema = GastronomySchema.pick({...})            ← allowlist
 * GastronomyAdminCreateInputSchema = GastronomySchema.omit({...})            ← denylist
 * GastronomyOwnerCreateInputSchema = GastronomySchema.omit({...})            ← denylist
 * GastronomyUpdateInputSchema      = GastronomySchema.omit({...}).partial()  ← denylist
 * ```
 *
 * A `.omit()` schema accepts every base field it does not NAME. So adding a
 * column to the base makes it body-writable in three of those four the moment
 * it lands, while the `.pick()` one — the owner PATCH, the schema anybody
 * asking "can a merchant set this?" looks at first — keeps refusing it. The
 * asymmetry is the trap: the reviewer checks the strictest schema, sees the
 * field absent, and concludes it is closed everywhere.
 *
 * Nothing greppable records this. The three `.omit()` files contain no mention
 * of the new field at all, precisely because not naming it is what admits it.
 *
 * ## What it cost (HOS-895, fixed in PR #3172)
 *
 * Three menu-attachment columns were added to `GastronomySchema`. Measured with
 * a hostile body against the real schemas, three of the four accepted them:
 *
 * - `menuFileUrl` — stored XSS. `z.string().url()` accepts `javascript:`,
 *   `data:` and `vbscript:` (the same gap as HOS-592), and the value survived
 *   verbatim.
 * - `menuFilePublicId` — cross-tenant asset destruction. That column is the
 *   handle `DELETE /gastronomies/{id}/menu-file` gives the media provider, so an
 *   owner could create a listing carrying ANOTHER venue's Cloudinary id and then
 *   delete that venue's file.
 *
 * The worst reach was `GastronomyOwnerCreateInputSchema`: no staff account in
 * the path, any signed-in merchant. The second hole was found only because
 * finding the first prompted someone to look at the siblings that shipped with
 * it — no guard flagged it, and none would have.
 *
 * ## What this asserts
 *
 * Three things, all measured by parsing a hostile body through the real
 * schemas rather than by reading their `omit` lists:
 *
 * 1. **Frozen inventory** — for each registered write schema, the exact set of
 *    BASE fields it accepts. Adding a field to a base schema changes this set
 *    for every `.omit()`-derived schema at once, so the failure names the field
 *    and the schemas that just started accepting it. Closing it means naming it
 *    in those `omit` lists; opening it deliberately means adding it here. Either
 *    way the decision becomes an explicit line in a diff instead of an
 *    inheritance nobody wrote down.
 * 2. **Never from a body** — fields no write schema of that entity may accept at
 *    any tier (audit columns, verification state, materialised-path columns, the
 *    menu-file handles). Each carries its reason.
 * 3. **Never from an OWNER body** — fields an admin may legitimately seed but a
 *    merchant-reachable schema must refuse (ownership, control fields, review
 *    aggregates, staff notes, translation curation metadata).
 *
 * (2) and (3) overlap with (1) by construction. That is deliberate: (1) fails
 * with a diff, (2) and (3) fail with the reason the field is dangerous.
 *
 * ## How the probe works, and why not `.shape`
 *
 * `acceptedBaseFields` parses a body carrying EVERY base field, twice — once
 * with an object sentinel, once with a string sentinel — and unions two signals
 * per parse: keys surviving into the parsed output, and keys named by a
 * validation issue. A field the schema knows shows up in one or the other; a
 * field it does not know is silently stripped by Zod's default object mode and
 * shows up in neither.
 *
 * Two sentinels because one is not enough. A single object sentinel is swallowed
 * by every loose jsonb field (`adminInfo`, `contactInfo`, `seo`, `location`,
 * `media`, `price`, `socialNetworks`, `extraInfo`) — it parses clean, raises no
 * issue, and on a CREATE schema the overall parse still fails on the other
 * required fields, so the output is unavailable and eight accepted fields read
 * as refused. A single string sentinel has the mirror blind spot on every
 * `z.string()` field. Their union has neither, and that is asserted rather than
 * assumed: `probe agrees with the declared shape` compares the probe's answer to
 * `Object.keys(schema.shape)` for all twelve schemas, so a future Zod version or
 * a field type that swallows both sentinels fails there instead of quietly
 * shrinking every inventory to nothing.
 *
 * `expect(parse.success).toBe(false)` would be vacuous for all of this: these
 * schemas are strip-mode, so an unknown key does not fail a parse — it is
 * dropped. Acceptance is visible only in the parsed OUTPUT (or in an issue that
 * names the key), never in the success flag.
 *
 * ## What it does NOT cover
 *
 * - The HTTP-layer bodies (`AccommodationUpdateHttpSchema` and its siblings).
 *   Those are hand-written `z.object({...})` allowlists, so the mechanism cannot
 *   reach them: a new base field is not writable there until somebody types it
 *   in.
 * - Whether a field that IS body-writable is validated well enough. That a
 *   `menuUrl` cannot be `javascript:` is a schema-content question, not a
 *   derivation question.
 * - Entities outside the five registered here.
 *
 * The data half — which schemas are registered, who can reach each one, what it
 * accepts today, and why each denied field is server-written — lives in
 * `write-input-server-written.registry.ts` next to this file. A failure here is
 * almost always resolved by editing an `omit` list in `src/`, or, when the field
 * really is caller-supplied, that registry.
 */

import { describe, expect, it } from 'vitest';
import {
    ExperienceOwnerCreateInputCheckedSchema,
    ExperienceOwnerCreateInputSchema
} from '../../src/entities/experience/experience.crud.schema.js';
import { ExperienceSchema } from '../../src/entities/experience/experience.schema.js';
import type { Parseable, Shaped } from './write-input-server-written.registry.js';
import { ENTITIES } from './write-input-server-written.registry.js';

// ============================================================================
// Probe
// ============================================================================

/**
 * The two sentinel values fed to every field. See the module docstring: one is
 * swallowed by loose jsonb fields, the other by string fields, and only their
 * union has no blind spot.
 */
const SENTINELS: readonly unknown[] = [{ __hos1113: 'probe' }, '__hos1113__'];

/**
 * Base fields a write schema accepts, measured by parsing rather than by
 * reading `.omit()` lists.
 *
 * @param schema - The write-input schema under test.
 * @param baseFields - Every field name declared by the entity's base schema.
 * @returns Sorted names of the base fields the schema accepts from a body.
 */
const acceptedBaseFields = (schema: Parseable, baseFields: readonly string[]): string[] => {
    const seen = new Set<string>();

    for (const sentinel of SENTINELS) {
        const body = Object.fromEntries(baseFields.map((field) => [field, sentinel]));
        const result = schema.safeParse(body);

        if (result.success) {
            // Survived the strip: the schema knows this key.
            for (const key of Object.keys(result.data as object)) seen.add(key);
        } else {
            // Named by a validation issue: the schema knows this key too — it
            // simply refused this particular value.
            for (const issue of result.error.issues) seen.add(String(issue.path[0]));
        }
    }

    return baseFields.filter((field) => seen.has(field)).sort();
};

/** Sorted field names declared by an entity's base schema. */
const declaredFields = (schema: Shaped): string[] => Object.keys(schema.shape).sort();

// ============================================================================
// Assertions
// ============================================================================

describe('HOS-1113 — write-input schemas may not inherit server-written columns', () => {
    describe.each(ENTITIES)('$entity', (entry) => {
        const baseFields = declaredFields(entry.base);

        it.each(
            entry.writeSchemas
        )('$name accepts exactly the frozen set of base fields', (target) => {
            const actual = acceptedBaseFields(target.schema, baseFields);
            const gained = actual.filter((field) => !target.accepts.includes(field));
            const lost = target.accepts.filter((field) => !actual.includes(field));

            expect(
                { gained, lost },
                `${target.name} no longer accepts the frozen set of ${entry.entity} fields.\n` +
                    `NEWLY ACCEPTED: ${gained.join(', ') || '(none)'}\n` +
                    `NO LONGER ACCEPTED: ${lost.join(', ') || '(none)'}\n` +
                    'A field added to the base schema lands here automatically when the ' +
                    'schema is built with .omit(). If it is server-written, name it in that ' +
                    'omit list; if a caller may really set it, add it to this frozen list.'
            ).toEqual({ gained: [], lost: [] });
        });

        it.each(entry.writeSchemas)('$name probe agrees with the declared shape', (target) => {
            const byProbe = acceptedBaseFields(target.schema, baseFields);
            const byShape = Object.keys((target.schema as unknown as Shaped).shape ?? {})
                .filter((field) => baseFields.includes(field))
                .sort();

            expect(
                byProbe,
                `The hostile-body probe and ${target.name}'s declared shape disagree. The probe ` +
                    'is what every other assertion in this file relies on, so a disagreement ' +
                    'means the sentinels have a blind spot — not that the schema changed.'
            ).toEqual(byShape);
        });

        const neverEntries = Object.entries(entry.neverFromBody);
        if (neverEntries.length > 0) {
            it.each(neverEntries)('no write schema accepts "%s" from a body', (field, reason) => {
                const offenders = entry.writeSchemas
                    .filter((target) =>
                        acceptedBaseFields(target.schema, baseFields).includes(field)
                    )
                    .map((target) => target.name);

                expect(
                    offenders,
                    `${entry.entity}.${field} is server-written (${reason}) and must not be ` +
                        `settable from a request body, but it is accepted by: ${offenders.join(', ')}.`
                ).toEqual([]);
            });
        }

        const ownerEntries = Object.entries(entry.neverFromOwnerBody);
        if (ownerEntries.length > 0) {
            it.each(
                ownerEntries
            )('no OWNER-tier write schema accepts "%s" from a body', (field, reason) => {
                const offenders = entry.writeSchemas
                    .filter((target) => target.tier === 'owner')
                    .filter((target) =>
                        acceptedBaseFields(target.schema, baseFields).includes(field)
                    )
                    .map((target) => target.name);

                expect(
                    offenders,
                    `${entry.entity}.${field} must never come from a merchant-reachable body ` +
                        `(${reason}), but it is accepted by: ${offenders.join(', ')}.`
                ).toEqual([]);
            });
        }

        // The mirror. Without it a schema that refused EVERY field would satisfy
        // all three assertions above, and so would a probe that always answered
        // "not accepted".
        it.each(entry.writeSchemas)('$name still accepts a genuinely writable field', (target) => {
            expect(
                acceptedBaseFields(target.schema, baseFields),
                `${target.name} no longer accepts "${entry.writableProbe}". Either the schema ` +
                    'was over-tightened, or the probe has stopped detecting acceptance — in ' +
                    'which case every assertion in this file is passing vacuously.'
            ).toContain(entry.writableProbe);
        });
    });
});

// ============================================================================
// The refined variant
// ============================================================================

describe('HOS-1113 — the refined owner-create variant matches its plain schema', () => {
    // `ExperienceOwnerCreateInputCheckedSchema` — not the plain schema — is what
    // the owner-create route declares as its `requestBody`. A `superRefine` can
    // only ever reject MORE, never accept more keys, so its accepted set must be
    // identical; asserting it stops the checked variant from being quietly
    // rebuilt on a wider base (the admin create schema, say).
    it('ExperienceOwnerCreateInputCheckedSchema accepts what the plain schema accepts', () => {
        const baseFields = declaredFields(ExperienceSchema as unknown as Shaped);

        expect(
            acceptedBaseFields(
                ExperienceOwnerCreateInputCheckedSchema as unknown as Parseable,
                baseFields
            )
        ).toEqual(
            acceptedBaseFields(ExperienceOwnerCreateInputSchema as unknown as Parseable, baseFields)
        );
    });
});
