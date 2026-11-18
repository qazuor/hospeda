/**
 * HOS-2333 (spec HOS-2335 §5.4, AC-C41, AC-C43) — the owner-help guard, by
 * mutation. The help catalog is the only thing that tells owners how the portal
 * works, so the guard must turn red when a page a topic links to disappears or
 * is renamed, when a FAQ item it extends is gone, or when a review date is bad,
 * stay green on the real tree, and only WARN (never fail) on a stale topic.
 *
 * Each mutation starts from a green tree and changes ONE thing. Two kinds of tree
 * are used: a synthetic one holding exactly the pages the topics name, and the
 * REAL web page tree reproduced as empty files.
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
import { OWNER_HELP_TOPICS } from '../../apps/api/src/data/owner-help/owner-help';
import type { OwnerHelpTopic } from '../../apps/api/src/data/owner-help/owner-help.types';
import { portalDestinationTemplate } from '../../apps/api/src/mcp/portal/build-portal-url';
import { checkOwnerHelp, ES_FAQ_FILE, PREDICATE_MESSAGES, run } from '../check-owner-help';
import { PORTAL_PAGES_DIR } from '../check-portal-routes';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const NOW = new Date('2026-11-18T12:00:00Z');
const DAY_MS = 86_400_000;

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

/** The `YYYY-MM-DD` of `days` before the fixed clock. */
const daysAgo = (days: number): string =>
    new Date(NOW.getTime() - days * DAY_MS).toISOString().slice(0, 10);

/** A topic with one destination of each shape the guard handles. */
const topic = (overrides: Partial<OwnerHelpTopic> = {}): OwnerHelpTopic => ({
    id: 'sample',
    audience: 'any',
    title: 'Un tema',
    keywords: ['tema'],
    steps: ['Un paso'],
    destinations: [
        { kind: 'ownEditorSection', vertical: 'accommodation', section: 'photos' },
        { kind: 'ownEditorSection', vertical: 'venue', section: 'media' },
        { kind: 'subscription' },
        { kind: 'plans', vertical: 'venue' }
    ],
    faqKey: 'owners.pause',
    reviewedAt: daysAgo(1),
    ...overrides
});

const FAQ = {
    categories: {
        owners: { items: { pause: { question: 'Pausar' }, ready: { question: 'Listo' } } }
    }
};

/** A tree holding exactly the pages `topics` name, plus a FAQ file. */
function syntheticTree({
    topics,
    faq = FAQ
}: {
    readonly topics: readonly OwnerHelpTopic[];
    readonly faq?: unknown;
}): string {
    const root = mkdtempSync(path.join(tmpdir(), 'owner-help-'));
    tempDirs.push(root);
    for (const entry of topics) {
        for (const destination of entry.destinations) {
            const template = portalDestinationTemplate({
                destination:
                    destination.kind === 'ownEditorSection'
                        ? {
                              kind: 'listingEditor',
                              vertical: destination.vertical,
                              id: 'x',
                              section: destination.section
                          }
                        : destination
            });
            touch({ root, file: path.join(PORTAL_PAGES_DIR, `${template}.astro`) });
        }
    }
    mkdirSync(path.dirname(path.join(root, ES_FAQ_FILE)), { recursive: true });
    writeFileSync(path.join(root, ES_FAQ_FILE), JSON.stringify(faq));
    return root;
}

/** Copies the real page tree as empty files, and the real es FAQ. */
function realShapedTree(): string {
    const root = mkdtempSync(path.join(tmpdir(), 'owner-help-real-'));
    tempDirs.push(root);
    const walk = (dir: string): void => {
        for (const entry of readdirSync(dir)) {
            const full = path.join(dir, entry);
            if (statSync(full).isDirectory()) walk(full);
            else if (entry.endsWith('.astro'))
                touch({ root, file: path.relative(REPO_ROOT, full) });
        }
    };
    walk(path.join(REPO_ROOT, PORTAL_PAGES_DIR));
    mkdirSync(path.dirname(path.join(root, ES_FAQ_FILE)), { recursive: true });
    writeFileSync(
        path.join(root, ES_FAQ_FILE),
        readFileSync(path.join(REPO_ROOT, ES_FAQ_FILE), 'utf8')
    );
    return root;
}

const PAGES = (root: string, ...parts: string[]) => path.join(root, PORTAL_PAGES_DIR, ...parts);

const predicatesOf = (root: string, topics: readonly OwnerHelpTopic[]) =>
    checkOwnerHelp({ root, topics, now: NOW }).violations.map((v) => v.predicate);

describe('GUARD owner-help', () => {
    describe('green', () => {
        it('passes on the real repository', () => {
            // Act
            const result = run({ now: NOW });

            // Assert
            expect(result.exitCode).toBe(0);
            expect(result.output).toContain('OK GUARD:owner-help');
            expect(result.output).toContain(`${OWNER_HELP_TOPICS.length} help topics`);
        });

        it('passes on a tree that holds exactly what the topics name', () => {
            // Arrange
            const topics = [topic()];

            // Act / Assert
            expect(checkOwnerHelp({ root: syntheticTree({ topics }), topics, now: NOW })).toEqual({
                violations: [],
                stale: []
            });
        });

        it('passes on the real page tree reproduced as empty files', () => {
            // Act
            const result = run({ root: realShapedTree(), now: NOW });

            // Assert
            expect(result.exitCode).toBe(0);
        });
    });

    describe('(a) a link to a page that is not there', () => {
        it('fails when a page a topic links to is deleted', () => {
            // Arrange
            const topics = [topic()];
            const root = syntheticTree({ topics });
            rmSync(PAGES(root, 'mi-cuenta', 'suscripcion.astro'));

            // Act
            const result = run({ root, topics, now: NOW });

            // Assert
            expect(result.exitCode).toBe(1);
            expect(result.output).toContain(PREDICATE_MESSAGES.a);
            expect(result.output).toContain('sample: no page for mi-cuenta/suscripcion');
        });

        it('fails when an editor section page is renamed', () => {
            // Arrange
            const topics = [topic()];
            const root = syntheticTree({ topics });
            renameSync(
                PAGES(root, 'mi-cuenta', 'propiedades', '[id]', 'editar', 'fotos.astro'),
                PAGES(root, 'mi-cuenta', 'propiedades', '[id]', 'editar', 'imagenes.astro')
            );

            // Act / Assert
            expect(predicatesOf(root, topics)).toEqual(['a']);
        });

        it('fails when a dynamic segment is renamed', () => {
            // Arrange
            const topics = [topic()];
            const root = syntheticTree({ topics });
            renameSync(
                PAGES(root, 'mi-cuenta', 'propiedades', '[id]'),
                PAGES(root, 'mi-cuenta', 'propiedades', '[propertyId]')
            );

            // Act / Assert
            expect(predicatesOf(root, topics)).toEqual(['a']);
        });

        it('fails when an editor section is one the vertical does not have', () => {
            // Arrange: `calendar` is an accommodation section; a venue has none.
            const topics = [
                topic({
                    destinations: [
                        { kind: 'ownEditorSection', vertical: 'venue', section: 'calendar' }
                    ]
                })
            ];

            // Act
            const result = checkOwnerHelp({
                root: syntheticTree({ topics: [topic()] }),
                topics,
                now: NOW
            });

            // Assert
            expect(result.violations).toEqual([
                { predicate: 'a', detail: 'sample: venue has no editor section calendar' }
            ]);
        });

        it('names every offending topic, not just the first', () => {
            // Arrange
            const topics = [
                topic({ id: 'one', destinations: [{ kind: 'subscription' }] }),
                topic({ id: 'two', destinations: [{ kind: 'subscription' }] })
            ];
            const root = syntheticTree({ topics });
            rmSync(PAGES(root, 'mi-cuenta', 'suscripcion.astro'));

            // Act
            const details = checkOwnerHelp({ root, topics, now: NOW }).violations.map(
                (v) => v.detail
            );

            // Assert
            expect(details).toHaveLength(2);
            expect(details[0]).toContain('one:');
            expect(details[1]).toContain('two:');
        });

        it('fails on the real tree when the real photos page is deleted', () => {
            // Arrange
            const root = realShapedTree();
            rmSync(PAGES(root, 'mi-cuenta', 'propiedades', '[id]', 'editar', 'fotos.astro'));

            // Act
            const result = run({ root, now: NOW });

            // Assert
            expect(result.exitCode).toBe(1);
            expect(result.output).toContain(
                'photos: no page for mi-cuenta/propiedades/[id]/editar/fotos'
            );
        });
    });

    describe('(b) a FAQ item that is gone', () => {
        it('fails when the faqKey is not an item of the FAQ', () => {
            // Arrange
            const topics = [topic({ faqKey: 'owners.nope' })];

            // Act
            const result = run({ root: syntheticTree({ topics }), topics, now: NOW });

            // Assert
            expect(result.exitCode).toBe(1);
            expect(result.output).toContain(PREDICATE_MESSAGES.b);
            expect(result.output).toContain('owners.nope');
        });

        it('fails when the category is gone, or the key has no item part', () => {
            // Arrange
            const topics = [topic({ faqKey: 'partners.pause' })];
            const other = [topic({ faqKey: 'owners' })];

            // Act / Assert
            expect(predicatesOf(syntheticTree({ topics }), topics)).toEqual(['b']);
            expect(predicatesOf(syntheticTree({ topics: other }), other)).toEqual(['b']);
        });

        it('fails when the FAQ file is missing', () => {
            // Arrange
            const topics = [topic()];
            const root = syntheticTree({ topics });
            rmSync(path.join(root, ES_FAQ_FILE));

            // Act / Assert
            expect(predicatesOf(root, topics)).toEqual(['b']);
        });

        it('does not look at the FAQ for a topic with no faqKey', () => {
            // Arrange
            const topics = [topic({ faqKey: undefined })];
            const root = syntheticTree({ topics });
            rmSync(path.join(root, ES_FAQ_FILE));

            // Act / Assert
            expect(predicatesOf(root, topics)).toEqual([]);
        });
    });

    describe('(c) a review date that is not a date', () => {
        it.each([
            ['an impossible date', '2026-02-31'],
            ['a date with a time', '2026-11-17T00:00:00Z'],
            ['free text', 'ayer'],
            ['an empty string', ''],
            ['a date in the future', '2026-11-19']
        ])('fails for %s', (_label, reviewedAt) => {
            // Arrange
            const topics = [topic({ reviewedAt })];

            // Act / Assert
            expect(predicatesOf(syntheticTree({ topics }), topics)).toEqual(['c']);
        });

        it('accepts today', () => {
            // Arrange
            const topics = [topic({ reviewedAt: '2026-11-18' })];

            // Act / Assert
            expect(predicatesOf(syntheticTree({ topics }), topics)).toEqual([]);
        });
    });

    describe('(d) nothing to check', () => {
        it('fails on an empty catalog, so an emptied catalog cannot turn the guard green', () => {
            // Act
            const result = run({ root: syntheticTree({ topics: [] }), topics: [], now: NOW });

            // Assert
            expect(result.exitCode).toBe(1);
            expect(result.output).toContain(PREDICATE_MESSAGES.d);
        });
    });

    describe('stale topics (AC-C43)', () => {
        it('lists a topic reviewed more than 180 days ago, without failing', () => {
            // Arrange
            const topics = [topic({ id: 'old', reviewedAt: daysAgo(200) })];

            // Act
            const result = run({ root: syntheticTree({ topics }), topics, now: NOW });

            // Assert
            expect(result.exitCode).toBe(0);
            expect(result.output).toContain('OK GUARD:owner-help');
            expect(result.output).toContain(
                'WARN GUARD:owner-help: 1 topic(s) older than 180 days'
            );
            expect(result.output).toContain(`old: reviewed ${daysAgo(200)}, 200 days ago`);
        });

        it('draws the line after 180 days', () => {
            // Arrange
            const edge = [topic({ id: 'edge', reviewedAt: daysAgo(180) })];
            const over = [topic({ id: 'over', reviewedAt: daysAgo(181) })];

            // Act / Assert
            expect(
                checkOwnerHelp({ root: syntheticTree({ topics: edge }), topics: edge, now: NOW })
                    .stale
            ).toEqual([]);
            expect(
                checkOwnerHelp({ root: syntheticTree({ topics: over }), topics: over, now: NOW })
                    .stale
            ).toEqual([{ id: 'over', reviewedAt: daysAgo(181), ageDays: 181 }]);
        });

        it('says nothing when every topic is fresh', () => {
            // Arrange
            const topics = [topic({ reviewedAt: daysAgo(30) })];

            // Act
            const result = run({ root: syntheticTree({ topics }), topics, now: NOW });

            // Assert
            expect(result.output).not.toContain('WARN');
        });

        it('honours a different limit', () => {
            // Arrange
            const topics = [topic({ id: 'tight', reviewedAt: daysAgo(40) })];

            // Act
            const result = run({
                root: syntheticTree({ topics }),
                topics,
                now: NOW,
                staleDays: 30
            });

            // Assert
            expect(result.output).toContain('tight: reviewed');
            expect(result.output).toContain('(limit 30)');
        });

        it('still lists the stale topics when something else fails the run', () => {
            // Arrange
            const topics = [topic({ id: 'old', reviewedAt: daysAgo(400), faqKey: 'owners.nope' })];

            // Act
            const result = run({ root: syntheticTree({ topics }), topics, now: NOW });

            // Assert
            expect(result.exitCode).toBe(1);
            expect(result.output).toContain('STALE topics:');
            expect(result.output).toContain('old: reviewed');
        });
    });
});
