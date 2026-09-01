/**
 * @file onboarding-return-url.guard.test.ts
 * @description HOS-838 — the onboarding chain must carry the interrupted
 * destination end to end.
 *
 * A user who clicks "Empezar ahora" on a marketing landing and creates an
 * account is bounced through up to three gates before reaching the form they
 * came for: change-password, complete-profile, set-password. Every one of those
 * hops used to hard-code its own destination, so finishing the chain dropped the
 * person on `/mi-cuenta/` with no link onward — the loop HOS-810 reported,
 * reopened one step later.
 *
 * The wiring lives in a middleware and in three `.astro` pages, none of which a
 * component test can mount (the middleware performs network calls at module
 * scope; the pages are server templates). So it is pinned by reading the source.
 *
 * Each check asserts BOTH halves — that the thing being guarded still exists,
 * and that it carries the destination — so a rename or a deletion fails loudly
 * here instead of silently matching nothing.
 *
 * @see HOS-838
 * @see HOS-810
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB_ROOT = join(import.meta.dirname, '..', '..');

/** Reads a file under `apps/web/src`. */
function readSource(relPath: string): string {
    return readFileSync(join(WEB_ROOT, 'src', relPath), 'utf-8');
}

/**
 * Returns every `name({ ... })` call in `source`, brace-balanced, so an
 * assertion reads the actual call rather than a nearby line that happens to
 * mention the same words.
 */
function readCalls({ source, name }: { source: string; name: string }): readonly string[] {
    const calls: string[] = [];
    const needle = `${name}({`;
    let searchFrom = 0;

    while (true) {
        const callIndex = source.indexOf(needle, searchFrom);
        if (callIndex === -1) {
            return calls;
        }

        const openIndex = source.indexOf('{', callIndex);
        let depth = 0;

        for (let index = openIndex; index < source.length; index += 1) {
            const char = source[index];
            if (char === '{') depth += 1;
            if (char === '}') {
                depth -= 1;
                if (depth === 0) {
                    calls.push(source.slice(openIndex, index + 1));
                    searchFrom = index + 1;
                    break;
                }
            }
        }

        if (depth !== 0) {
            throw new Error(`Unbalanced braces in a ${name} call.`);
        }
    }
}

describe('HOS-838: the middleware hands each gate the interrupted destination', () => {
    const middleware = readSource('middleware.ts');

    it('derives the destination from the path AND its query string', () => {
        // A destination like `/es/publicar/?tipo=gastronomia` is only useful
        // with its params intact; the bare pathname loses the choice the user
        // already made on the landing.
        expect(
            middleware,
            'The middleware must build `interruptedDestination` from the pathname plus `context.url.search` (HOS-838).'
        ).toContain('const interruptedDestination = `${path}${context.url.search}`;');
    });

    for (const builder of [
        'buildChangePasswordRedirect',
        'buildProfileCompletionRedirect',
        'buildSetPasswordRedirect'
    ]) {
        it(`passes returnUrl to every ${builder} call`, () => {
            // Act
            const calls = readCalls({ source: middleware, name: builder });

            // Assert — existence first: a rename must fail here, never pass by
            // matching an empty set.
            expect(
                calls.length,
                `No \`${builder}({ ... })\` call found in the middleware — if it was renamed, update this guard (HOS-838).`
            ).toBeGreaterThan(0);

            for (const call of calls) {
                expect(
                    call,
                    `A \`${builder}\` call does not carry \`returnUrl\`, so finishing that gate drops the user on /mi-cuenta/ (HOS-838).`
                ).toContain('returnUrl: interruptedDestination');
            }
        });
    }
});

describe('HOS-838: each onboarding page validates and forwards the destination', () => {
    const PAGES = [
        {
            label: 'completar-perfil',
            path: 'pages/[lang]/mi-cuenta/completar-perfil/index.astro',
            island: 'ProfileCompletion'
        },
        {
            label: 'agregar-contrasena',
            path: 'pages/[lang]/mi-cuenta/agregar-contrasena/index.astro',
            island: 'SetPassword'
        },
        {
            label: 'cambiar-contrasena',
            path: 'pages/[lang]/mi-cuenta/cambiar-contrasena/index.astro',
            island: 'ChangePasswordForm'
        }
    ] as const;

    for (const page of PAGES) {
        describe(page.label, () => {
            const source = readSource(page.path);

            it('reads returnUrl from the query string', () => {
                expect(
                    source,
                    `${page.label} must read the \`returnUrl\` the middleware handed it (HOS-838).`
                ).toContain("Astro.url.searchParams.get('returnUrl')");
            });

            it('runs it through the shared open-redirect guard', () => {
                // By the time it reaches the page the value is attacker
                // controlled — anyone can hand-edit the query. The page must
                // not trust it, and must not hand-roll a second guard either.
                expect(
                    source,
                    `${page.label} must validate \`returnUrl\` with resolveSafeReturnPath, never use the raw query value (HOS-838).`
                ).toContain('resolveSafeReturnPath({ rawReturn: rawReturnUrl, locale })');
            });

            it(`forwards the validated value to the ${page.island} island`, () => {
                expect(
                    source,
                    `${page.label} resolves \`returnUrl\` but never hands it to <${page.island}> — the island would navigate to undefined (HOS-838).`
                ).toContain('returnUrl={returnUrl}');
            });
        });
    }

    it('completar-perfil chains the destination through the set-password step', () => {
        // The set-password gate can follow profile completion. Building its URL
        // on the server is what keeps the island free of URL assembly and of
        // the open-redirect guard that belongs to the server.
        const source = readSource(PAGES[0].path);

        expect(
            source,
            'completar-perfil must build the set-password URL server-side with the destination attached (HOS-838).'
        ).toContain('buildSetPasswordRedirect({ locale, returnUrl })');
        expect(source).toContain('setPasswordUrl={setPasswordUrl}');
    });
});
