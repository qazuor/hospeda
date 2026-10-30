/**
 * Action 15 (ACC:15, HOS-1493) reaches the service only through
 * `runListingContentCall`: the admin route that ran the listing-access chain
 * opens the ACC_15 scope around its ONE content service call, and the service
 * authorizes, audits and notifies the owner only inside that scope.
 *
 * This guard pins the inventory of admin EDIT routes of the three verticals:
 * - every route wraps exactly one call, and that call is its content method
 *   (never a read, never the whole handler, never a second call);
 * - the venue and experience photo and FAQ routes call module-level
 *   service functions, named here instead of a `service.method`;
 * - a new admin EDIT route fails here until it is classified.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROUTES_DIR = join(import.meta.dirname, '../../src/routes');
const VERTICALS = ['accommodation', 'venue', 'experience'] as const;

/** Wired route (relative to `src/routes`) → the content method its scope wraps. */
const WIRED: Readonly<Record<string, string>> = {
    'accommodation/admin/patch.ts': 'accommodationService.update',
    'accommodation/admin/update.ts': 'accommodationService.update',
    'accommodation/admin/restoreMedia.ts': 'accommodationService.restoreMedia',
    'accommodation/admin/addMedia.ts': 'accommodationService.addMedia',
    'accommodation/admin/addFeaturedMedia.ts': 'accommodationService.addFeaturedMedia',
    'accommodation/admin/archiveMedia.ts': 'accommodationService.archiveMedia',
    'accommodation/admin/removeMedia.ts': 'accommodationService.removeMedia',
    'accommodation/admin/reorderMedia.ts': 'accommodationService.reorderMedia',
    'accommodation/admin/setFeaturedMedia.ts': 'accommodationService.setFeaturedMedia',
    'accommodation/admin/updateMedia.ts': 'accommodationService.updateMedia',
    'accommodation/admin/addFaq.ts': 'accommodationService.addFaq',
    'accommodation/admin/removeFaq.ts': 'accommodationService.removeFaq',
    'accommodation/admin/updateFaq.ts': 'accommodationService.updateFaq',
    'accommodation/admin/reorderFaqs.ts': 'accommodationService.reorderFaqs',
    'venue/admin/patch.ts': 'venueService.update',
    'venue/admin/update.ts': 'venueService.update',
    'experience/admin/patch.ts': 'experienceService.update',
    'experience/admin/update.ts': 'experienceService.update',
    'venue/admin/addFaq.ts': 'addVenueFaq',
    'venue/admin/addFeaturedMedia.ts': 'addVenueFeaturedMedia',
    'venue/admin/addMedia.ts': 'addVenueMedia',
    'venue/admin/removeFaq.ts': 'removeVenueFaq',
    'venue/admin/removeMedia.ts': 'removeVenueMedia',
    'venue/admin/reorderFaqs.ts': 'reorderVenueFaqs',
    'venue/admin/reorderMedia.ts': 'reorderVenueMedia',
    'venue/admin/setFeaturedMedia.ts': 'setFeaturedVenueMedia',
    'venue/admin/updateFaq.ts': 'updateVenueFaq',
    'venue/admin/updateMedia.ts': 'updateVenueMedia',
    'experience/admin/addFaq.ts': 'addExperienceFaq',
    'experience/admin/addFeaturedMedia.ts': 'addExperienceFeaturedMedia',
    'experience/admin/addMedia.ts': 'addExperienceMedia',
    'experience/admin/removeFaq.ts': 'removeExperienceFaq',
    'experience/admin/removeMedia.ts': 'removeExperienceMedia',
    'experience/admin/reorderFaqs.ts': 'reorderExperienceFaqs',
    'experience/admin/reorderMedia.ts': 'reorderExperienceMedia',
    'experience/admin/setFeaturedMedia.ts': 'setFeaturedExperienceMedia',
    'experience/admin/updateFaq.ts': 'updateExperienceFaq',
    'experience/admin/updateMedia.ts': 'updateExperienceMedia'
};

/** Source without block and line comments, so prose never satisfies a pattern. */
function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function adminEditRoutes(): string[] {
    return VERTICALS.flatMap((vertical) => {
        const base = join(ROUTES_DIR, vertical, 'admin');
        return readdirSync(base)
            .filter((file) => file.endsWith('.ts'))
            .filter((file) =>
                /operation:\s*'EDIT'/.test(stripComments(readFileSync(join(base, file), 'utf8')))
            )
            .map((file) => `${vertical}/admin/${file}`);
    }).sort();
}

const read = (route: string): string =>
    stripComments(readFileSync(join(ROUTES_DIR, route), 'utf8'));

describe('ACC:15 admin content routes open the scope around their content call only', () => {
    it('wires every admin EDIT route of the three verticals', () => {
        // Arrange
        const classified = Object.keys(WIRED).sort();

        // Act
        const discovered = adminEditRoutes();

        // Assert
        expect(discovered).toEqual(classified);
    });

    for (const [route, method] of Object.entries(WIRED)) {
        it(`${route} wraps exactly ${method} and nothing else`, () => {
            // Arrange
            const source = read(route);
            const escaped = method.replace('.', '\\.');

            // Act
            const scopes = source.match(/runListingContentCall\(/g) ?? [];
            const wrapped = new RegExp(
                `runListingContentCall\\(\\{\\s*ctx,\\s*run:\\s*\\(\\)\\s*=>\\s*${escaped}\\(`
            ).test(source);
            const contentCalls = source.match(new RegExp(`${escaped}\\(`, 'g')) ?? [];

            // Assert
            expect(scopes).toHaveLength(1);
            expect(wrapped).toBe(true);
            expect(contentCalls).toHaveLength(1);
            // Action 15 is the default action of a foreign EDIT; declaring it would
            // send a host editing her own listing through step 3 and refuse her.
            expect(source).not.toMatch(/administrativeAction:/);
        });
    }
});
