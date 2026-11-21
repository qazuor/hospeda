/**
 * HOS-2326 (spec HOS-2335 AC-C5, risk R-2) — the portal-routes guard, by
 * mutation. The API keeps a COPY of the web's owner-portal paths; this guard is
 * the only thing keeping the copy honest, so it must turn red when the web drops
 * a page or renames an editor section, and stay green on the real tree.
 *
 * Each mutation starts from a green tree and changes ONE thing. Two kinds of
 * tree are used: a synthetic one built from the route data (every page the data
 * names, and nothing else), and the REAL web page tree reproduced as empty files.
 */
import {
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    renameSync,
    rmSync,
    statSync,
    writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
    DEFAULT_ROUTE_DATA,
    editorSlugsByVertical,
    LISTING_EDITOR_VERTICALS_FILE,
    PORTAL_PAGES_DIR,
    type PortalRouteData,
    PREDICATE_MESSAGES,
    pageExists,
    run
} from '../check-portal-routes';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const tempDirs: string[] = [];

afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Writes an empty file, creating its folders. */
function touch({ root, file }: { readonly root: string; readonly file: string }): void {
    const full = path.join(root, file);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, '---\n---\n');
}

const WEB_VERTICALS_SOURCE = `export const LISTING_EDITOR_VERTICALS: Readonly<Record<VenueOrExperience, true>> = {
    venue: true,
    experience: true
};
`;

/** A tree holding exactly the pages `data` names, plus the web vertical lookup. */
function syntheticTree({
    data = DEFAULT_ROUTE_DATA
}: {
    readonly data?: PortalRouteData;
} = {}): string {
    const root = mkdtempSync(path.join(tmpdir(), 'portal-routes-'));
    tempDirs.push(root);
    const pages = path.join(PORTAL_PAGES_DIR);
    let alternate = false;
    const addPage = (route: string): void => {
        // Both file forms are valid pages: `<path>.astro` and `<path>/index.astro`.
        alternate = !alternate;
        touch({
            root,
            file: alternate
                ? path.join(pages, `${route}.astro`)
                : path.join(pages, route, 'index.astro')
        });
    };
    for (const template of Object.values(data.templates)) {
        if (!template.includes(data.sectionPlaceholder)) addPage(template);
    }
    for (const [vertical, slugs] of Object.entries(editorSlugsByVertical({ data }))) {
        const key = data.sectionTemplateByVertical[vertical];
        const template = key === undefined ? undefined : data.templates[key];
        if (template === undefined) continue;
        for (const slug of Object.values(slugs)) {
            touch({
                root,
                file: path.join(pages, `${template.replace(data.sectionPlaceholder, slug)}.astro`)
            });
        }
    }
    touch({ root, file: LISTING_EDITOR_VERTICALS_FILE });
    writeFileSync(path.join(root, LISTING_EDITOR_VERTICALS_FILE), WEB_VERTICALS_SOURCE);
    return root;
}

/** Copies the real page tree as empty files, and the real vertical lookup. */
function realShapedTree(): string {
    const root = mkdtempSync(path.join(tmpdir(), 'portal-routes-real-'));
    tempDirs.push(root);
    const walk = (dir: string): void => {
        for (const entry of readdirSync(dir)) {
            const full = path.join(dir, entry);
            if (statSync(full).isDirectory()) walk(full);
            else if (entry.endsWith('.astro')) {
                touch({ root, file: path.relative(REPO_ROOT, full) });
            }
        }
    };
    walk(path.join(REPO_ROOT, PORTAL_PAGES_DIR));
    touch({ root, file: LISTING_EDITOR_VERTICALS_FILE });
    writeFileSync(
        path.join(root, LISTING_EDITOR_VERTICALS_FILE),
        readFileSync(path.join(REPO_ROOT, LISTING_EDITOR_VERTICALS_FILE), 'utf8')
    );
    return root;
}

const PAGES = (root: string, ...parts: string[]) => path.join(root, PORTAL_PAGES_DIR, ...parts);

/** Replaces one slug of the data. */
function withSlug({
    vertical,
    section,
    slug
}: {
    readonly vertical: string;
    readonly section: string;
    readonly slug: string;
}): PortalRouteData {
    return {
        ...DEFAULT_ROUTE_DATA,
        sectionSlugs: {
            ...DEFAULT_ROUTE_DATA.sectionSlugs,
            [vertical]: { ...DEFAULT_ROUTE_DATA.sectionSlugs[vertical], [section]: slug }
        }
    };
}

describe('GUARD portal-routes', () => {
    describe('green', () => {
        it('passes on the real repository', () => {
            const result = run({ root: REPO_ROOT });

            expect(result.output).toMatch(/^OK GUARD:portal-routes/);
            expect(result.exitCode).toBe(0);
        });

        it('passes on a tree holding exactly the pages the map names', () => {
            expect(run({ root: syntheticTree() }).exitCode).toBe(0);
        });

        it('passes on the real page tree reproduced as empty files', () => {
            expect(run({ root: realShapedTree() }).exitCode).toBe(0);
        });
    });

    describe('(a) an unreleased route (HOS-2410 help center)', () => {
        it('stays green while its page does not exist', () => {
            const root = syntheticTree();
            rmSync(PAGES(root, 'mi-cuenta/ayuda'), { recursive: true, force: true });
            rmSync(PAGES(root, 'mi-cuenta/ayuda.astro'), { force: true });

            expect(run({ root }).exitCode).toBe(0);
        });

        it('turns red once it is no longer listed as unreleased', () => {
            const root = syntheticTree();
            rmSync(PAGES(root, 'mi-cuenta/ayuda'), { recursive: true, force: true });
            rmSync(PAGES(root, 'mi-cuenta/ayuda.astro'), { force: true });

            const result = run({ root, data: { ...DEFAULT_ROUTE_DATA, unreleasedRouteKeys: [] } });

            expect(result.exitCode).toBe(1);
            expect(result.output).toContain('helpLanding');
        });
    });

    describe('(a) a missing page turns it red', () => {
        it('deleting the subscription page', () => {
            const root = syntheticTree();
            rmSync(PAGES(root, 'mi-cuenta/suscripcion'), { recursive: true, force: true });
            rmSync(PAGES(root, 'mi-cuenta/suscripcion.astro'), { force: true });

            const result = run({ root });

            expect(result.exitCode).toBe(1);
            expect(result.output).toContain(PREDICATE_MESSAGES.a);
            expect(result.output).toContain('subscription');
        });

        it('deleting the real directory page, found as <path>/index.astro', () => {
            const root = realShapedTree();
            rmSync(PAGES(root, 'mi-cuenta/directorio-proveedores/index.astro'));

            const result = run({ root });

            expect(result.exitCode).toBe(1);
            expect(result.output).toContain('providerDirectory');
        });

        it('deleting the real inquiry thread page, found as <path>.astro', () => {
            const root = realShapedTree();
            rmSync(PAGES(root, 'mi-cuenta/consultas-propietario/[conversationId].astro'));

            const result = run({ root });

            expect(result.exitCode).toBe(1);
            expect(result.output).toContain('inquiry');
        });

        it('renaming a dynamic folder: [id] must match by name', () => {
            const root = realShapedTree();
            renameSync(
                PAGES(root, 'mi-cuenta/propiedades/[id]'),
                PAGES(root, 'mi-cuenta/propiedades/[propertyId]')
            );

            const result = run({ root });

            expect(result.exitCode).toBe(1);
            expect(result.output).toContain(PREDICATE_MESSAGES.a);
            expect(result.output).toContain(PREDICATE_MESSAGES.b);
        });

        it('moving a static folder', () => {
            const root = realShapedTree();
            renameSync(PAGES(root, 'planes/anfitriones'), PAGES(root, 'planes/hosts'));

            const result = run({ root });

            expect(result.exitCode).toBe(1);
            expect(result.output).toContain('plansAccommodation');
        });
    });

    describe('(b) a renamed editor section turns it red', () => {
        it('renaming the slug in the map: the page of the new slug does not exist', () => {
            const root = syntheticTree();

            const result = run({
                root,
                data: withSlug({
                    vertical: 'accommodation',
                    section: 'amenities',
                    slug: 'comodidades'
                })
            });

            expect(result.exitCode).toBe(1);
            expect(result.output).toContain(PREDICATE_MESSAGES.b);
            expect(result.output).toContain('accommodation/amenities');
            expect(result.output).toContain('comodidades');
        });

        it('renaming the page in the web: the map slug has no page any more', () => {
            const root = realShapedTree();
            renameSync(
                PAGES(root, 'mi-cuenta/propiedades/[id]/editar/servicios.astro'),
                PAGES(root, 'mi-cuenta/propiedades/[id]/editar/comodidades.astro')
            );

            const result = run({ root });

            expect(result.exitCode).toBe(1);
            expect(result.output).toContain('accommodation/amenities');
            expect(result.output).toContain('mi-cuenta/propiedades/[id]/editar/servicios');
        });

        it('deleting a venue editor section page', () => {
            const root = realShapedTree();
            rmSync(PAGES(root, 'mi-cuenta/comercio/[vertical]/[id]/editar/carta.astro'));

            const result = run({ root });

            expect(result.exitCode).toBe(1);
            expect(result.output).toContain('venue/menu');
        });

        it('deleting the accommodation «Políticas» page, which is not a catalog section', () => {
            const root = realShapedTree();
            rmSync(PAGES(root, 'mi-cuenta/propiedades/[id]/editar/politicas.astro'));

            const result = run({ root });

            expect(result.exitCode).toBe(1);
            expect(result.output).toContain(PREDICATE_MESSAGES.b);
            expect(result.output).toContain('accommodation/policies');
        });

        it('deleting the venue/experience «Preguntas a la IA» page', () => {
            const root = realShapedTree();
            rmSync(PAGES(root, 'mi-cuenta/comercio/[vertical]/[id]/editar/preguntas-ia.astro'));

            const result = run({ root });

            expect(result.exitCode).toBe(1);
            expect(result.output).toContain('venue/aiQuestions');
            expect(result.output).toContain('experience/aiQuestions');
        });

        it('a non-section page renamed in the map: the page of the new slug does not exist', () => {
            const root = syntheticTree();

            const result = run({
                root,
                data: {
                    ...DEFAULT_ROUTE_DATA,
                    editorPageSlugs: {
                        ...DEFAULT_ROUTE_DATA.editorPageSlugs,
                        accommodation: { policies: 'reglas', aiQuestions: 'preguntas-ia' }
                    }
                }
            });

            expect(result.exitCode).toBe(1);
            expect(result.output).toContain('accommodation/policies');
            expect(result.output).toContain('reglas');
        });

        it('deleting an experience-only editor section page', () => {
            const root = realShapedTree();
            rmSync(
                PAGES(root, 'mi-cuenta/comercio/[vertical]/[id]/editar/punto-de-encuentro.astro')
            );

            const result = run({ root });

            expect(result.exitCode).toBe(1);
            expect(result.output).toContain('experience/meetingPoint');
        });

        it('a vertical with no section template to expand its slugs over', () => {
            const root = syntheticTree();

            const result = run({
                root,
                data: {
                    ...DEFAULT_ROUTE_DATA,
                    sectionTemplateByVertical: {
                        ...DEFAULT_ROUTE_DATA.sectionTemplateByVertical,
                        venue: 'nope'
                    }
                }
            });

            expect(result.exitCode).toBe(1);
            expect(result.output).toContain(PREDICATE_MESSAGES.b);
        });
    });

    describe('(c) a section template nobody expands', () => {
        it('is reported instead of passing unchecked', () => {
            const root = syntheticTree();

            const result = run({
                root,
                data: {
                    ...DEFAULT_ROUTE_DATA,
                    sectionTemplateByVertical: {
                        accommodation: 'accommodationEditorSection',
                        venue: 'accommodationEditorSection',
                        experience: 'accommodationEditorSection'
                    }
                }
            });

            expect(result.exitCode).toBe(1);
            expect(result.output).toContain(PREDICATE_MESSAGES.c);
        });
    });

    describe('(d) the [vertical] values', () => {
        it('the web no longer serves experience', () => {
            const root = syntheticTree();
            writeFileSync(
                path.join(root, LISTING_EDITOR_VERTICALS_FILE),
                WEB_VERTICALS_SOURCE.replace('    experience: true\n', '')
            );

            const result = run({ root });

            expect(result.exitCode).toBe(1);
            expect(result.output).toContain(PREDICATE_MESSAGES.d);
            expect(result.output).toContain('[vertical]=experience');
        });

        it('the web lookup file is gone', () => {
            const root = syntheticTree();
            rmSync(path.join(root, LISTING_EDITOR_VERTICALS_FILE));

            const result = run({ root });

            expect(result.exitCode).toBe(1);
            expect(result.output).toContain(PREDICATE_MESSAGES.d);
        });

        it('the API fills in a value the web does not serve', () => {
            const root = syntheticTree();

            const result = run({
                root,
                data: { ...DEFAULT_ROUTE_DATA, verticalValues: ['venue', 'experience', 'hotel'] }
            });

            expect(result.exitCode).toBe(1);
            expect(result.output).toContain('[vertical]=hotel');
        });
    });

    describe('(e) it fails closed', () => {
        it('an empty tree is not a clean tree', () => {
            const root = mkdtempSync(path.join(tmpdir(), 'portal-routes-empty-'));
            tempDirs.push(root);

            const result = run({ root });

            expect(result.exitCode).toBe(1);
            expect(result.output).toContain(PREDICATE_MESSAGES.e);
        });
    });

    describe('pageExists', () => {
        it('accepts both file forms and nothing else', () => {
            const root = mkdtempSync(path.join(tmpdir(), 'portal-routes-page-'));
            tempDirs.push(root);
            touch({ root, file: 'p/a.astro' });
            touch({ root, file: 'p/b/index.astro' });
            touch({ root, file: 'p/c/other.astro' });

            expect(pageExists({ pagesRoot: path.join(root, 'p'), path: 'a' })).toBe(true);
            expect(pageExists({ pagesRoot: path.join(root, 'p'), path: 'b' })).toBe(true);
            expect(pageExists({ pagesRoot: path.join(root, 'p'), path: 'c' })).toBe(false);
            expect(pageExists({ pagesRoot: path.join(root, 'p'), path: 'a/x' })).toBe(false);
            expect(pageExists({ pagesRoot: path.join(root, 'p'), path: '' })).toBe(false);
        });
    });

    describe('wiring', () => {
        const rootPkg = JSON.parse(readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')) as {
            readonly scripts: Readonly<Record<string, string>>;
        };
        const ci = readFileSync(path.join(REPO_ROOT, '.github/workflows/ci.yml'), 'utf8').split(
            '\n'
        );
        const start = ci.indexOf('  guards:');
        const end = ci.findIndex(
            (line, index) => index > start && /^ {2}[A-Za-z0-9_-]+:\s*$/.test(line)
        );
        const guardsJob =
            start === -1 ? '' : ci.slice(start, end === -1 ? undefined : end).join('\n');

        it('has its own script', () => {
            expect(rootPkg.scripts['check:portal-routes']).toBe(
                'tsx scripts/check-portal-routes.ts'
            );
        });

        it('is chained into pnpm check:guards, which still ends with check:fake-lies', () => {
            const chain = (rootPkg.scripts['check:guards'] ?? '').split('&&').map((s) => s.trim());

            expect(chain).toContain('pnpm check:portal-routes');
            expect(chain.indexOf('pnpm check:portal-routes')).toBeLessThan(
                chain.indexOf('pnpm check:fake-lies')
            );
            expect(chain.at(-1)).toBe('pnpm check:fake-lies');
        });

        it('is its OWN step of the Guards job of ci.yml, not only chained in check:guards', () => {
            expect(guardsJob).toMatch(/^\s+run: pnpm check:portal-routes\s*$/m);
        });
    });
});
