/**
 * HOS-2410 (spec §5.2, `docs/data-model.md` §1–§2, D-H3) — the generator of
 * `help-index.json`, by mutation: each test starts from a green synthetic
 * catalog, changes ONE thing, and asserts the exact predicate that must fail.
 * This file covers the build itself and a1; references and interlinking are in
 * `generator-references.test.ts`.
 *
 * @module test/generator
 */

import { describe, expect, it } from 'vitest';
import { HelpIndexSchema } from '../src/article.schema';
import { buildHelpIndex } from '../src/generator/build-index';
import { articleFile, greenCatalog } from './fixtures/article-source';
import { detailsOf, predicatesOf } from './fixtures/build-helpers';

describe('buildHelpIndex', () => {
    describe('a green catalog', () => {
        it('has no issues and builds an index that passes its own schema', () => {
            // Act
            const result = buildHelpIndex({ files: greenCatalog() });

            // Assert
            expect(result.issues).toEqual([]);
            expect(result.fileCount).toBe(3);
            expect(HelpIndexSchema.safeParse(result.index).success).toBe(true);
            expect(result.index?.locales.es.map((article) => article.id)).toEqual(['a', 'b', 'c']);
        });

        it('is deterministic: the same files give byte-equal JSON whatever their order', () => {
            // Arrange
            const files = greenCatalog();

            // Act
            const first = buildHelpIndex({ files }).json;
            const second = buildHelpIndex({ files: [...files].reverse() }).json;

            // Assert
            expect(first).toBeDefined();
            expect(second).toBe(first);
            expect(first?.endsWith('}\n')).toBe(true);
        });

        it('sorts the set-like arrays and keeps the ordered ones as written', () => {
            // Arrange
            const files = greenCatalog({
                a: {
                    frontmatter: {
                        audiences: ['venue', 'host'],
                        verticals: ['venue', 'accommodation'],
                        keywords: ['zeta', 'alfa'],
                        related: ['c', 'b']
                    },
                    folder: 'common',
                    canDo: 'Ir a {{link:subscription}} y leer {{article:b|el otro}}.'
                }
            });

            // Act
            const article = buildHelpIndex({ files }).index?.locales.es[0];

            // Assert
            expect(article?.audiences).toEqual(['host', 'venue']);
            expect(article?.verticals).toEqual(['accommodation', 'venue']);
            expect(article?.keywords).toEqual(['zeta', 'alfa']);
            expect(article?.related).toEqual(['c', 'b']);
        });

        it('stores the steps verbatim and the rest of «Cómo se hace» apart', () => {
            // Arrange
            const files = greenCatalog({
                a: { steps: ['Tocá «Guardar» (hasta 10 MB).', 'Listo.'], after: 'Un detalle.' }
            });

            // Act
            const howTo = buildHelpIndex({ files }).index?.locales.es[0]?.sections.howTo;

            // Assert
            expect(howTo).toEqual({
                steps: ['Tocá «Guardar» (hasta 10 MB).', 'Listo.'],
                after: 'Un detalle.'
            });
        });

        it('changes contentHash when any content byte changes', () => {
            // Arrange
            const files = greenCatalog();
            const changed = greenCatalog({ c: { expect: 'Que funcione bien.' } });

            // Act / Assert
            expect(buildHelpIndex({ files }).index?.contentHash).not.toBe(
                buildHelpIndex({ files: changed }).index?.contentHash
            );
        });

        it('builds no index when a file does not parse, but still reports the rest', () => {
            // Arrange
            const files = [...greenCatalog(), { path: 'es/host/d.md', source: 'no frontmatter' }];

            // Act
            const result = buildHelpIndex({ files });

            // Assert
            expect(result.index).toBeUndefined();
            expect(result.json).toBeUndefined();
            expect(result.issues.map((issue) => issue.predicate)).toContain('a1');
        });
    });

    describe('a1: frontmatter, body and layout', () => {
        it.each([
            ['an unknown key', { frontmatter: { price: 100 } }],
            ['no reviewedAt', { omit: ['reviewedAt'] }],
            ['no public flag', { omit: ['public'] }],
            ['a reviewedAt that is not a real date', { frontmatter: { reviewedAt: '2026-13-45' } }],
            ['a tourist audience', { frontmatter: { audiences: ['tourist'] } }],
            ['the tourist vertical', { frontmatter: { verticals: ['tourist'] } }],
            ['a token in the title', { frontmatter: { title: 'Ver {{link:faq}}' } }],
            ['a covers anchor of an unknown kind', { frontmatter: { covers: ['nope:x'] } }],
            [
                'an entryFor that is not a page or section',
                { frontmatter: { entryFor: ['tool:get_help'] } }
            ],
            [
                'a destination naming a record',
                { frontmatter: { destinations: [{ kind: 'inquiry', conversationId: 'x' }] } }
            ],
            [
                'a section the vertical does not have',
                {
                    frontmatter: {
                        destinations: [
                            { kind: 'ownEditorSection', vertical: 'venue', section: 'calendar' }
                        ]
                    }
                }
            ],
            ['a related list of one', { frontmatter: { related: ['b'] } }],
            ['itself as related', { frontmatter: { related: ['a', 'b'] } }],
            ['duplicated keywords', { frontmatter: { keywords: ['x', 'x'] } }]
        ])('fails with %s', (_label, change) => {
            expect(predicatesOf(greenCatalog({ a: change }))).toContain('a1');
        });

        it.each([
            ['a "#" heading', '# Título\n\n## Qué podés hacer\n\nx'],
            ['sections out of order', '## Cómo se hace\n\n1. x\n\n## Qué podés hacer\n\nx'],
            [
                'an authored «Relacionados» (D-H3)',
                '## Qué podés hacer\n\nx\n\n## Relacionados\n\nx'
            ],
            ['a missing section', '## Qué podés hacer\n\nx\n\n## Cómo se hace\n\n1. x']
        ])('fails with %s', (_label, body) => {
            expect(predicatesOf(greenCatalog({ a: { body } }))).toContain('a1');
        });

        it.each([
            ['a Markdown link', { expect: 'Mirá [acá](https://example.test).' }],
            ['a bare URL', { expect: 'Mirá https://example.test ahora.' }],
            ['raw HTML', { expect: 'Un <b>texto</b>.' }],
            ['an image', { expect: '![foto](x.png)' }],
            ['a table', { expect: '| a | b |\n|---|---|\n| 1 | 2 |' }],
            ['a code block', { expect: '```\ncode\n```' }],
            ['a quote', { expect: '> cita' }],
            ['a "####" heading', { troubleshooting: '#### Muy chico\n\nx' }]
        ])('fails with %s', (_label, change) => {
            expect(predicatesOf(greenCatalog({ a: change }))).toContain('a1');
        });

        it('fails with more steps than the limit, and with none', () => {
            expect(
                predicatesOf(
                    greenCatalog({ a: { steps: Array.from({ length: 13 }, () => 'Paso.') } })
                )
            ).toContain('a1');
            expect(predicatesOf(greenCatalog({ a: { steps: [] } }))).toContain('a1');
        });

        it('fails with text before the steps of «Cómo se hace»', () => {
            // Arrange
            const body = articleFile({ id: 'a' })
                .source.split('---\n\n')[1]
                ?.replace('## Cómo se hace\n\n', '## Cómo se hace\n\nAntes de empezar.\n\n');

            // Act / Assert
            expect(predicatesOf(greenCatalog({ a: { body } }))).toContain('a1');
        });

        it.each([
            ['a link token', 'Entrá a {{link:subscription}}.'],
            ['an article token', 'Leé {{article:b}}.']
        ])('accepts %s in a step, which get_help resolves since PR-12', (_label, step) => {
            expect(predicatesOf(greenCatalog({ a: { steps: ['Primero.', step] } }))).toEqual([]);
        });

        it('fails with a broken token in a step (a6)', () => {
            // Act
            const details = detailsOf(
                greenCatalog({ a: { steps: ['Primero.', 'Escribí {{ algo.'] } })
            ).join('\n');

            // Assert
            expect(details).toContain('a6 ');
        });

        it('accepts the same token in the prose after the steps', () => {
            expect(
                predicatesOf(greenCatalog({ a: { after: 'Después, {{link:subscription}}.' } }))
            ).toEqual([]);
        });

        it('fails with a second ordered list in «Cómo se hace»', () => {
            expect(predicatesOf(greenCatalog({ a: { after: '1. Otra lista.' } }))).toContain('a1');
        });

        it('fails with an empty section', () => {
            expect(predicatesOf(greenCatalog({ a: { notExpect: '' } }))).toContain('a1');
        });

        it('fails over the 5 000-character ceiling', () => {
            // Arrange
            const long = 'palabra '.repeat(700);

            // Act / Assert
            expect(detailsOf(greenCatalog({ a: { expect: long } })).join('\n')).toMatch(
                /a1 renders to \d+ characters, over the 5000 ceiling/
            );
        });

        it('fails R-1 when the file name is not the id', () => {
            // Arrange
            const files = greenCatalog();
            const renamed = files.map((file) =>
                file.path === 'es/host/a.md' ? { ...file, path: 'es/host/aa.md' } : file
            );

            // Act / Assert
            expect(detailsOf(renamed).join('\n')).toContain('R-1');
        });

        it('fails R-2 when a single-audience article is in common, or a shared one is not', () => {
            expect(detailsOf(greenCatalog({ a: { folder: 'common' } })).join('\n')).toContain(
                'R-2'
            );
            expect(
                detailsOf(
                    greenCatalog({ a: { frontmatter: { audiences: ['host', 'venue'] } } })
                ).join('\n')
            ).toContain('R-2');
        });

        it('fails R-3 when two files of a locale share an id', () => {
            // Arrange
            const files = [
                ...greenCatalog(),
                { ...articleFile({ id: 'a' }), path: 'es/venue/a.md' }
            ];

            // Act / Assert
            expect(detailsOf(files).join('\n')).toContain('R-3');
        });

        it('fails on a path outside <locale>/<folder>/<id>.md', () => {
            expect(
                predicatesOf([...greenCatalog(), { path: 'es/tourist/x.md', source: '' }])
            ).toContain('a1');
            expect(
                predicatesOf([...greenCatalog(), { path: 'es/host/x.txt', source: '' }])
            ).toContain('a1');
        });

        it('fails a non-es article with no es counterpart or no translation block', () => {
            // Arrange: en headings are not defined yet, so the body cannot pass either.
            const files = [...greenCatalog(), articleFile({ id: 'z', locale: 'en' })];

            // Act / Assert
            expect(predicatesOf(files)).toContain('a1');
        });

        it('fails an es article that carries a translation block', () => {
            expect(
                detailsOf(
                    greenCatalog({
                        a: {
                            frontmatter: {
                                translation: { status: 'machine', sourceReviewedAt: '2026-11-17' }
                            }
                        }
                    })
                ).join('\n')
            ).toContain('must not carry a "translation" block');
        });
    });
});
