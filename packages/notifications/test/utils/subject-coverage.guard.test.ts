/**
 * CI guard: every subject placeholder must be resolvable (H-64 / H-75).
 *
 * ## Why a guard and not more unit tests
 *
 * The defect was never one broken call site. It was N of them: three whole
 * families of notifications shipped, each declaring `{placeholders}` in its
 * subject, and none of them was added to the resolution chain. Unit tests only
 * cover the types somebody remembered to write a test for — which is the same
 * memory that failed in the first place. So the assertion has to be made over
 * the WHOLE set of notification types, mechanically, at build time.
 *
 * ## What is asserted
 *
 * For every `NotificationType`, each `{placeholder}` its subject pattern
 * declares must be either:
 *   - a field its payload interface declares (the generic resolution path), or
 *   - a member of `DERIVED_SUBJECT_KEYS` (a value computed rather than copied).
 *
 * The guard is FAIL-CLOSED: a type whose subject has placeholders and whose
 * payload interface cannot be located fails, rather than being skipped. A guard
 * that skips what it cannot parse reports success on exactly the case it exists
 * to catch.
 *
 * The parser itself is verified before it is trusted — a regex over TypeScript
 * that quietly matches nothing would turn this whole file green while proving
 * nothing.
 *
 * Note on optional fields: a declared-but-optional field satisfies this guard
 * by name and can still be `undefined` at run time. That residual case is
 * covered at run time instead, by the fallback in
 * `NotificationService.generateSubject`, which refuses to hand a subject
 * carrying template syntax to a transport.
 *
 * @module test/utils/subject-coverage.guard.test
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NotificationType } from '../../src/types/notification.types';
import { getSubjectPlaceholders } from '../../src/utils/subject-builder';
import { DERIVED_SUBJECT_KEYS } from '../../src/utils/subject-data';

const SRC = join(__dirname, '..', '..', 'src');
const TYPES_FILE = join(SRC, 'types', 'notification.types.ts');
const SERVICE_FILE = join(SRC, 'services', 'notification.service.ts');

/**
 * Notification types deliberately exempt from payload-field coverage.
 *
 * The exemption is not taken on trust: a dedicated test below re-proves the
 * reason still holds, so the entry stops being valid the moment the type
 * becomes reachable.
 */
const UNREACHABLE_TYPES: readonly NotificationType[] = [NotificationType.NEWSLETTER_CAMPAIGN];

/** Fields every payload inherits and can therefore interpolate. */
const BASE_PAYLOAD_FIELDS: readonly string[] = [
    'type',
    'recipientEmail',
    'recipientName',
    'userId',
    'customerId',
    'idempotencyKey'
];

/**
 * Maps each notification type to the field names its payload interface
 * declares, by reading the source of truth rather than a copy of it.
 *
 * One interface may serve several notification types (`type: A | B`), which is
 * why the result is keyed by type and not by interface name.
 */
function parsePayloadFieldsByType(): Map<string, Set<string>> {
    const source = readFileSync(TYPES_FILE, 'utf8');
    const byType = new Map<string, Set<string>>();

    // An interface body runs from its opening brace to the first `}` that sits
    // at column 0 — the file's own formatting, enforced by Biome.
    const blocks = source.matchAll(
        /export interface (\w+) extends BaseNotificationPayload \{\n([\s\S]*?)\n\}/g
    );

    for (const block of blocks) {
        const body = block[2] ?? '';

        const declaredTypes = [...body.matchAll(/NotificationType\.([A-Z0-9_]+)/g)]
            .map((m) => m[1])
            .filter((name): name is string => name !== undefined);

        if (declaredTypes.length === 0) {
            continue;
        }

        const fields = new Set<string>(BASE_PAYLOAD_FIELDS);
        for (const line of body.split('\n')) {
            // Property declarations only: four-space indent, never a line that
            // belongs to a JSDoc block (` * ...`), whose `@example` snippets
            // otherwise read as properties.
            const match = /^ {4}(?:readonly )?(\w+)\??:/.exec(line);
            if (match?.[1] !== undefined) {
                fields.add(match[1]);
            }
        }

        for (const typeName of declaredTypes) {
            const existing = byType.get(typeName);
            if (existing) {
                for (const field of fields) {
                    existing.add(field);
                }
            } else {
                byType.set(typeName, new Set(fields));
            }
        }
    }

    return byType;
}

describe('Subject placeholder coverage guard (H-64 / H-75)', () => {
    const fieldsByType = parsePayloadFieldsByType();

    describe('the parser is trustworthy before its verdict is', () => {
        it('locates payload interfaces for the great majority of notification types', () => {
            const allTypes = Object.values(NotificationType);
            const covered = allTypes.filter((t) => fieldsByType.has(enumKeyOf(t)));

            // A regex that silently stopped matching would leave this near zero
            // and turn every coverage assertion below into a no-op.
            expect(covered.length).toBeGreaterThan(allTypes.length / 2);
        });

        it('reads the concrete fields of a known payload', () => {
            const fields = fieldsByType.get('PARTNER_MENTIONS_LOGGED');

            expect(fields).toBeDefined();
            expect([...(fields ?? [])]).toEqual(
                expect.arrayContaining(['partnerName', 'mentionedAtLabel', 'mentions'])
            );
        });

        it('does not mistake a JSDoc @example line for a declared field', () => {
            // `AllianceClaimInvitePayload`'s JSDoc example lists `claimUrl:` and
            // also `expiresAt:`; both are real fields, so the discriminating
            // case is a key that appears ONLY in an example block.
            const fields = fieldsByType.get('ALLIANCE_CLAIM_INVITE');

            expect(fields).toBeDefined();
            expect(fields?.has('programLabel')).toBe(true);
            // Present in the example object literal, never declared:
            expect(fields?.has('const')).toBe(false);
        });
    });

    describe('every declared placeholder is resolvable', () => {
        const derived = new Set<string>(DERIVED_SUBJECT_KEYS);

        for (const type of Object.values(NotificationType)) {
            const { placeholders } = getSubjectPlaceholders({ type });

            if (placeholders.length === 0) {
                continue;
            }

            if (UNREACHABLE_TYPES.includes(type)) {
                continue;
            }

            it(`${type}: ${placeholders.join(', ')}`, () => {
                const fields = fieldsByType.get(enumKeyOf(type));

                // Fail-closed: no located payload is a failure, never a skip.
                expect(
                    fields,
                    `No payload interface found for ${type}. Its subject declares ` +
                        `${placeholders.join(', ')} and nothing can supply them.`
                ).toBeDefined();

                const unresolvable = placeholders.filter(
                    (key) => !derived.has(key) && !(fields?.has(key) ?? false)
                );

                expect(
                    unresolvable,
                    `${type} declares {${unresolvable.join('}, {')}} in its subject, but its ` +
                        'payload has no field of that name and it is not listed in ' +
                        'DERIVED_SUBJECT_KEYS. Either rename the placeholder to match the ' +
                        'payload field, or add a branch in buildDerivedSubjectData and list ' +
                        'the key in DERIVED_SUBJECT_KEYS.'
                ).toEqual([]);
            });
        }
    });

    describe('the exemption list stays honest', () => {
        it('NEWSLETTER_CAMPAIGN is exempt only while it remains unsendable', () => {
            // It has no payload interface AND no template branch, so
            // NotificationService.send() throws before any subject is built.
            // The day either appears, the exemption must be withdrawn.
            const service = readFileSync(SERVICE_FILE, 'utf8');

            expect(fieldsByType.has('NEWSLETTER_CAMPAIGN')).toBe(false);
            expect(service).not.toContain("case 'newsletter_campaign'");
        });

        it('lists nothing that is actually reachable', () => {
            const service = readFileSync(SERVICE_FILE, 'utf8');

            for (const type of UNREACHABLE_TYPES) {
                expect(service, `${type} is exempt but has a template branch`).not.toContain(
                    `case '${type}'`
                );
            }
        });
    });
});

/**
 * Recovers the enum KEY (e.g. `PARTNER_REVOKED`) from its VALUE
 * (`partner_revoked`).
 *
 * The parser keys off the source-level `NotificationType.KEY` reference, while
 * iteration yields values; this bridges the two without assuming the two
 * spellings are related by case conversion alone.
 */
function enumKeyOf(value: NotificationType): string {
    const entry = Object.entries(NotificationType).find(([, v]) => v === value);
    return entry?.[0] ?? '';
}
