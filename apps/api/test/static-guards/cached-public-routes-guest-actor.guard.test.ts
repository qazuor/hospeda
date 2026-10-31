/**
 * @file cached-public-routes-guest-actor.guard.test.ts
 * @description Defence in depth behind the HOS-1923 cache bypass (HOS-1924).
 *
 * The public handlers of `event`, `post`, `destination` and `attraction` sit under
 * prefixes the response cache stores with no actor in the key, and their services
 * (`checkCanViewEvent`, `checkCanViewPost`, `checkCanViewDestination`,
 * `checkCanViewAttraction`) branch on the actor. They must therefore resolve
 * against `createGuestActor()`; forwarding the request actor
 * (`getActorFromContext`) would make a stored body depend on whoever filled it.
 *
 * Scope is deliberate. Other cached prefixes (amenity, feature, partners,
 * event-location, event-organizer, author, tag, exchange-rates, stats,
 * testimonials) are not listed because their view checks do not depend on the
 * actor (permission-free or role-gated list only); extend `FAMILIES` if one of
 * them gains an actor-dependent visibility rule.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROUTES_DIR = join(__dirname, '../../src/routes');
const FAMILIES = ['event', 'post', 'destination', 'attraction'] as const;

/** Lists every `.ts` file under a directory. */
function listSourceFiles({ dir }: { readonly dir: string }): readonly string[] {
    return readdirSync(dir).flatMap((entry) => {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) return listSourceFiles({ dir: full });
        return entry.endsWith('.ts') ? [full] : [];
    });
}

describe('cached public routes resolve as a guest (HOS-1924)', () => {
    const files = FAMILIES.flatMap((family) =>
        listSourceFiles({ dir: join(ROUTES_DIR, family, 'public') })
    );

    it('finds the public handlers (the guard is not vacuous)', () => {
        expect(files.length).toBeGreaterThanOrEqual(30);
    });

    it('none of them reads the request actor', () => {
        // Arrange + Act
        const offenders = files.filter((file) =>
            readFileSync(file, 'utf-8').includes('getActorFromContext')
        );

        // Assert
        expect(offenders).toEqual([]);
    });
});
