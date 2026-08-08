/**
 * HOS-377 T-030 — AC-3 copy guard for the partner mentions log.
 *
 * ## Why a guard and not N assertions
 *
 * AC-3 is a constraint over EVERY string in this feature — the ones that exist
 * today and the ones somebody adds next year. A list of assertions can only
 * cover the first kind, and the failure mode is silent: a new key with the
 * wrong word in it simply is not asserted about. This walks the whole subtree
 * instead, so a key added tomorrow is covered the moment it is added.
 *
 * ## What the feature promises, and why the vocabulary is banned
 *
 * The mentions log is a record of ACTIONS the Hospeda team took — a post, a
 * newsletter inclusion, a broadcast — each with a link so the partner can go and
 * check it. Hospeda does not measure how any of it performed and has no
 * mechanism to. So a partner who reads "alcance" or "estadísticas" here will ask
 * for the number behind it, and there is none. The narrow promise is the one
 * that can actually be kept.
 *
 * ## Where this runs
 *
 * HERE, as a vitest test, because CI runs `turbo run test` and therefore reaches
 * `@repo/i18n`'s suite. It is ALSO reachable from `pnpm check:guards` via
 * `scripts/check-partner-mention-copy.sh`, but that is a convenience only:
 * `check:guards` is invoked by NO workflow and NO git hook — it appears exactly
 * once in the repo, in `package.json`. A guard registered only there does not
 * run on a pull request.
 *
 * @module test/partner-mention-copy.guard
 */

import { describe, expect, it } from 'vitest';
import accountEn from '../src/locales/en/account.json';
import adminEn from '../src/locales/en/admin-pages.json';
import accountEs from '../src/locales/es/account.json';
import adminEs from '../src/locales/es/admin-pages.json';
import accountPt from '../src/locales/pt/account.json';
import adminPt from '../src/locales/pt/admin-pages.json';

/**
 * Every partner-mentions copy subtree, across both surfaces and all locales.
 *
 * Adding a locale or a surface means adding a row here. That is deliberate: an
 * auto-discovering version would silently cover nothing if a namespace were
 * renamed, and a guard that quietly stops guarding is the failure this exists
 * to prevent.
 */
const SUBTREES: ReadonlyArray<{
    readonly label: string;
    readonly tree: unknown;
}> = [
    { label: 'es admin-pages.partnerMentions', tree: adminEs.partnerMentions },
    { label: 'en admin-pages.partnerMentions', tree: adminEn.partnerMentions },
    { label: 'pt admin-pages.partnerMentions', tree: adminPt.partnerMentions },
    { label: 'es account.partnerMentions', tree: accountEs.partnerMentions },
    { label: 'en account.partnerMentions', tree: accountEn.partnerMentions },
    { label: 'pt account.partnerMentions', tree: accountPt.partnerMentions }
];

/**
 * The banned vocabulary, as word patterns.
 *
 * Matched on a WORD boundary rather than as a bare substring, and the reason is
 * concrete: "clic" is a substring of "cíclico" (which normalises to "ciclico" —
 * c-l-i-c sits inside it), so a substring check would fail on a legitimate word
 * and the failure message would be a lie about what the string contains. A
 * guard whose message overstates its predicate gets disabled the first time it
 * cries wolf.
 *
 * Plurals and the English spellings are folded in per term so "impresiones",
 * "estadísticas" and "clicks" are all caught by their own pattern.
 */
const BANNED = [
    { term: 'alcance', pattern: /\balcances?\b/ },
    { term: 'impresiones', pattern: /\bimpres[ií]on(es)?\b|\bimpressions?\b/ },
    { term: 'clics', pattern: /\bclic(k)?s?\b/ },
    { term: 'estadísticas', pattern: /\bestad[ií]stica(s)?\b|\bstatistics?\b/ }
] as const;

/**
 * Strips accents so "estadísticas" and "estadisticas" are the same string.
 *
 * NFD splits an accented character into its base plus a combining mark; the
 * range below removes the marks. Without this the guard is trivially bypassed
 * by typing the word correctly.
 */
function fold(value: string): string {
    return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Every leaf string in a nested object, with its dotted key path. */
function collectStrings(tree: unknown, prefix = ''): ReadonlyArray<[string, string]> {
    if (typeof tree === 'string') return [[prefix, tree]];
    if (tree === null || typeof tree !== 'object') return [];

    return Object.entries(tree as Record<string, unknown>).flatMap(([key, value]) =>
        collectStrings(value, prefix ? `${prefix}.${key}` : key)
    );
}

describe('HOS-377 AC-3 — the mentions log never speaks of metrics', () => {
    for (const { label, tree } of SUBTREES) {
        it(`${label} contains no banned metric word`, () => {
            const offences: string[] = [];

            for (const [path, value] of collectStrings(tree)) {
                const folded = fold(value);
                for (const { term, pattern } of BANNED) {
                    if (pattern.test(folded)) {
                        offences.push(`  ${label}.${path} — matched "${term}": ${value}`);
                    }
                }
            }

            // The message states exactly what the predicate checked and nothing
            // more: which key, which term, and the string it matched. It does
            // not claim the copy is "wrong" in some broader sense, because the
            // predicate cannot know that.
            expect(
                offences,
                offences.length === 0
                    ? ''
                    : [
                          'AC-3: these partner-mentions strings match a banned metric word.',
                          'The log records ACTIONS taken, with a link to verify each one.',
                          'Hospeda measures none of alcance / impresiones / clics /',
                          'estadísticas, so copy promising them cannot be honoured.',
                          '',
                          ...offences
                      ].join('\n')
            ).toEqual([]);
        });
    }

    it('covers every locale of both surfaces', () => {
        // A subtree that went missing (renamed namespace, dropped locale) would
        // otherwise make this suite pass by checking nothing.
        expect(SUBTREES).toHaveLength(6);
        for (const { label, tree } of SUBTREES) {
            expect(tree, `${label} is missing — the guard would check nothing`).toBeDefined();
            expect(collectStrings(tree).length, `${label} has no strings`).toBeGreaterThan(0);
        }
    });

    it('would actually catch a violation — the predicate is live', () => {
        // Without this, every assertion above passes just as happily on a
        // regex that matches nothing.
        const planted = { section: { subtitle: 'Mirá el alcance de tus publicaciones' } };
        const matched = collectStrings(planted).filter(([, value]) =>
            BANNED.some(({ pattern }) => pattern.test(fold(value)))
        );

        expect(matched).toHaveLength(1);
    });

    it('does not fire on a legitimate word that merely contains a banned one', () => {
        // "cíclico" folds to "ciclico", which contains the letters c-l-i-c. A
        // substring check would flag it; the word-boundary patterns must not.
        const innocent = { a: 'Publicación cíclica', b: 'Reciclamos el contenido' };
        const matched = collectStrings(innocent).filter(([, value]) =>
            BANNED.some(({ pattern }) => pattern.test(fold(value)))
        );

        expect(matched).toEqual([]);
    });
});
