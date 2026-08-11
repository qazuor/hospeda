/**
 * Guard: no public post/event read path is reachable without the public read
 * floor (HOS-374 §5.1.1 / §7.6.5).
 *
 * Background: before this guard, `PostService` and `EventService` exposed
 * eleven bespoke read methods (`getNews`, `getFeatured`, `getUpcoming`,
 * `getByOrganizer`, ...) that never passed through `_executeSearch`, and each
 * one re-implemented its own conditional `visibility` default. None of them
 * filtered `moderationState` or `lifecycleState` at all. Fixing the eleven
 * leaves the trap armed for the twelfth.
 *
 * So this guard closes the class: it walks the public route tree, collects
 * every service method those routes actually call, and fails when one of them
 * does not apply the floor. Adding a public route that calls a new unfloored
 * service method fails CI here rather than leaking unapproved content.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '../../../..');
const API_ROUTES_DIR = join(__dirname, '../../src/routes');
const SERVICES_DIR = join(REPO_ROOT, 'packages/service-core/src/services');

/**
 * The two entities the floor governs, each mapped to the route directory that
 * must be scanned, the service source that must apply it, and the permission
 * helper that carries the single-row half of the predicate.
 */
const GOVERNED_ENTITIES = [
    {
        entity: 'post',
        publicRoutesDir: join(API_ROUTES_DIR, 'post/public'),
        serviceInstance: 'postService',
        serviceSource: join(SERVICES_DIR, 'post/post.service.ts'),
        permissionsSource: join(SERVICES_DIR, 'post/post.permissions.ts'),
        viewCheck: 'checkCanViewPost'
    },
    {
        entity: 'event',
        publicRoutesDir: join(API_ROUTES_DIR, 'event/public'),
        serviceInstance: 'eventService',
        serviceSource: join(SERVICES_DIR, 'event/event.service.ts'),
        permissionsSource: join(SERVICES_DIR, 'event/event.permissions.ts'),
        viewCheck: 'checkCanViewEvent'
    }
] as const;

/**
 * Methods that do not exist on the concrete service because `BaseCrudRead`
 * owns them. Each maps to the concrete symbols that must carry the floor on
 * its behalf.
 *
 * `getById` / `getBySlug` load the row first and authorize it through
 * `_canView`, so their floor lives in the permission helper — represented here
 * by the sentinel `PERMISSION_HELPER`, asserted separately below.
 */
const PERMISSION_HELPER = Symbol('permission-helper');
const BASE_METHOD_DELEGATES: Readonly<Record<string, readonly (string | symbol)[]>> = {
    search: ['_executeSearch', '_executeCount'],
    count: ['_executeCount'],
    getById: [PERMISSION_HELPER],
    getBySlug: [PERMISSION_HELPER],
    getByField: [PERMISSION_HELPER]
};

/**
 * Any one of these, present in a method body, satisfies the floor: either the
 * filter helper is applied, or the row is authorized through `_canView` (which
 * reaches the permission helper asserted separately).
 */
const FLOOR_MARKERS = ['applyPublicReadFloor', '_canView'] as const;

/** Collect every .ts file directly under a routes directory. */
const collectRouteFiles = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true })
        .filter(
            (entry) => entry.isFile() && entry.name.endsWith('.ts') && entry.name !== 'index.ts'
        )
        .map((entry) => join(dir, entry.name));

/**
 * Extract the service methods a route file calls, e.g. `postService.getNews(`.
 */
const extractCalledMethods = (source: string, serviceInstance: string): string[] => {
    const pattern = new RegExp(`${serviceInstance}\\.([a-zA-Z_][a-zA-Z0-9_]*)\\s*\\(`, 'g');
    const found = new Set<string>();
    let match = pattern.exec(source);
    while (match !== null) {
        found.add(match[1] as string);
        match = pattern.exec(source);
    }
    return [...found];
};

/**
 * Extract a method body from a service source file.
 *
 * Relies on the repo's Biome formatting: class members are indented four
 * spaces and close with a four-space `}` on its own line. Returns null when
 * the method is not declared in this file (i.e. it is inherited).
 */
const extractMethodBody = (source: string, methodName: string): string | null => {
    const lines = source.split('\n');
    const declaration = new RegExp(
        `^ {4}(?:public |protected |private )?(?:async )?${methodName}\\(`
    );
    const start = lines.findIndex((line) => declaration.test(line));
    if (start === -1) return null;

    const body: string[] = [];
    for (let i = start; i < lines.length; i++) {
        body.push(lines[i] as string);
        if (i > start && lines[i] === '    }') break;
    }
    return body.join('\n');
};

describe('public read floor coverage (guard, HOS-374 §7.6.5)', () => {
    for (const config of GOVERNED_ENTITIES) {
        describe(config.entity, () => {
            const routeFiles = collectRouteFiles(config.publicRoutesDir);
            const serviceSource = readFileSync(config.serviceSource, 'utf8');
            const permissionsSource = readFileSync(config.permissionsSource, 'utf8');

            const calledMethods = [
                ...new Set(
                    routeFiles.flatMap((file) =>
                        extractCalledMethods(readFileSync(file, 'utf8'), config.serviceInstance)
                    )
                )
            ].sort();

            it('finds public routes calling the service', () => {
                // Protects the guard from passing vacuously: if the route
                // layout or the `<entity>Service.` call convention changes and
                // the scan returns nothing, every assertion below would pass
                // while checking nothing at all.
                expect(routeFiles.length).toBeGreaterThan(0);
                expect(calledMethods.length).toBeGreaterThan(0);
            });

            it('enforces the platform half of the floor in the view permission check', () => {
                const viewCheck = extractMethodBodyFromFunction(
                    permissionsSource,
                    config.viewCheck
                );
                expect(
                    viewCheck,
                    `${config.viewCheck} was not found in ${config.permissionsSource}`
                ).not.toBeNull();
                // Reachability only: this asserts the predicate is CONSULTED,
                // not that it is consulted correctly. The behavior it must
                // produce is covered by post.permissions.test.ts /
                // event.permissions.test.ts.
                expect(
                    (viewCheck as string).includes('isContentStateApproved'),
                    `${config.viewCheck} does not consult isContentStateApproved. Every public single-row read (getById/getBySlug/getSummary/getStats) authorizes through it, so without that call they serve pending and archived content to anonymous readers.`
                ).toBe(true);
            });

            for (const method of calledMethods) {
                it(`applies the public read floor in ${config.serviceInstance}.${method}`, () => {
                    const delegates = BASE_METHOD_DELEGATES[method];

                    // Base-class reads authorized through the permission
                    // helper are covered by the assertion above.
                    if (delegates?.includes(PERMISSION_HELPER)) {
                        expect(permissionsSource).toContain('isContentStateApproved');
                        return;
                    }

                    const symbols = (delegates as readonly string[] | undefined) ?? [method];
                    for (const symbol of symbols) {
                        const body = extractMethodBody(serviceSource, symbol);
                        expect(
                            body,
                            `${symbol} is called from a public ${config.entity} route but is not declared in ${config.serviceSource}. If it is a new base-class read, add it to BASE_METHOD_DELEGATES with the concrete symbols that carry the floor.`
                        ).not.toBeNull();

                        const applied = FLOOR_MARKERS.some((marker) =>
                            (body as string).includes(marker)
                        );
                        expect(
                            applied,
                            `${config.entity}: ${symbol} is reachable from a public route but applies no public read floor. Wrap its filters in applyPublicReadFloor() (see packages/service-core/src/services/moderation/public-read-floor.ts), or authorize the loaded row through _canView. Without it this path serves pending, private and archived content to anonymous readers.`
                        ).toBe(true);
                    }
                });
            }
        });
    }
});

/**
 * Extract a top-level exported function body from a permissions module.
 *
 * These are module-level `export function name(...)` declarations, so they
 * close with a zero-indent `}` rather than the four-space form used by class
 * members.
 */
function extractMethodBodyFromFunction(source: string, functionName: string): string | null {
    const lines = source.split('\n');
    const declaration = new RegExp(`^export function ${functionName}\\(`);
    const start = lines.findIndex((line) => declaration.test(line));
    if (start === -1) return null;

    const body: string[] = [];
    for (let i = start; i < lines.length; i++) {
        body.push(lines[i] as string);
        if (i > start && lines[i] === '}') break;
    }
    return body.join('\n');
}
