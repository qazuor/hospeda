/**
 * HOS-2410 (spec §5.2, `docs/data-model.md` §1–§5, D-H3, D-H9) — the generator
 * of `help-index.json`, by mutation: each test starts from a green synthetic
 * catalog, changes ONE thing, and asserts the exact predicate that must fail.
 *
 * @module test/generator
 */

import { describe, expect, it } from 'vitest';
import { HelpIndexSchema } from '../src/article.schema';
import { buildHelpIndex, type HelpContentFile } from '../src/generator/build-index';
import { toCanonicalJson } from '../src/generator/canonical-json';
import type { HelpCatalogPredicate } from '../src/generator/issues';
import { parseHelpBody, slugifyHelpHeading } from '../src/generator/parse-article';
import { articleFile, greenCatalog } from './fixtures/article-source';

/** The predicates of a build, deduplicated. */
const predicatesOf = (files: readonly HelpContentFile[]): HelpCatalogPredicate[] => [
    ...new Set(buildHelpIndex({ files }).issues.map((issue) => issue.predicate))
];

/** The details of a build's issues. */
const detailsOf = (files: readonly HelpContentFile[]) =>
    buildHelpIndex({ files }).issues.map((issue) => `${issue.predicate} ${issue.detail}`);

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

    describe('a5, a6, a7 and a2: references inside the catalog', () => {
        it('fails a7 when a related id is not an article', () => {
            expect(
                predicatesOf(greenCatalog({ a: { frontmatter: { related: ['b', 'nope'] } } }))
            ).toContain('a7');
        });

        it('fails a5 when two articles claim the same entryFor', () => {
            // Arrange
            const entry = { frontmatter: { entryFor: ['page:mi-cuenta/suscripcion'] } };

            // Act / Assert
            expect(predicatesOf(greenCatalog({ a: entry, b: entry }))).toContain('a5');
        });

        it('fails a2 when a helpArticle destination names no article', () => {
            expect(
                predicatesOf(
                    greenCatalog({
                        a: { frontmatter: { destinations: [{ kind: 'helpArticle', id: 'nope' }] } }
                    })
                )
            ).toContain('a2');
        });

        it.each([
            ['a link with no vertical', '{{link:plans}}'],
            ['an unknown link target', '{{link:nowhere}}'],
            ['a section slug the vertical lacks', '{{link:section:venue:calendario}}'],
            ['an article that does not exist', '{{article:nope}}'],
            ['an unknown token kind', '{{price:x}}'],
            ['a broken brace', 'Mirá {{link:faq'],
            [
                'a limit with a vertical the article lacks',
                '{{limit:max_photos_per_accommodation:venue}}'
            ]
        ])('fails a6 with %s (AC-27)', (_label, token) => {
            expect(predicatesOf(greenCatalog({ c: { expect: `Ver ${token}.` } }))).toContain('a6');
        });

        it('fails a6 with a limit token without vertical in a multi-vertical article (AC-27)', () => {
            // Arrange
            const files = greenCatalog({
                c: {
                    frontmatter: { verticals: ['accommodation', 'venue', 'experience'] },
                    expect: 'Hasta {{limit:max_photos_per_accommodation}}.'
                }
            });

            // Act / Assert
            expect(predicatesOf(files)).toContain('a6');
        });

        it('accepts a limit token without vertical in a single-vertical article', () => {
            expect(
                predicatesOf(
                    greenCatalog({ c: { expect: 'Hasta {{limit:max_photos_per_accommodation}}.' } })
                )
            ).toEqual([]);
        });
    });

    describe('interlinking (D-H9)', () => {
        it('fails IL-1 when a covered page has no link token in the body', () => {
            // Arrange: drop the only {{link:subscription}}.
            const files = greenCatalog({ a: { canDo: 'Leer {{article:b|el otro}}.' } });

            // Act / Assert
            expect(predicatesOf(files)).toEqual(['IL-1']);
        });

        it('fails IL-1 for a covered editor section, and passes once it is linked', () => {
            // Arrange
            const covers = { covers: ['page:mi-cuenta/suscripcion', 'section:venue.carta'] };
            const unlinked = greenCatalog({ a: { frontmatter: covers } });
            const linked = greenCatalog({
                a: {
                    frontmatter: covers,
                    canDo: 'Ir a {{link:subscription}}, {{link:section:venue:carta}} y {{article:b|el otro}}.'
                }
            });

            // Act / Assert
            expect(predicatesOf(unlinked)).toEqual(['IL-1']);
            expect(predicatesOf(linked)).toEqual([]);
        });

        it('fails IL-3 when an article token points at an anchor the target lacks', () => {
            expect(
                predicatesOf(
                    greenCatalog({
                        a: { canDo: 'Ir a {{link:subscription}} y {{article:b:nope|el otro}}.' }
                    })
                )
            ).toEqual(['IL-3']);
        });

        it('accepts an article token to a ### anchor of the target', () => {
            expect(
                predicatesOf(
                    greenCatalog({
                        a: {
                            canDo: 'Ir a {{link:subscription}} y {{article:b:algo-falla|el otro}}.'
                        }
                    })
                )
            ).toEqual([]);
        });

        it('fails IL-4 when an article has no inbound link', () => {
            // Arrange: nobody relates to or links to "c".
            const orphaned = [
                articleFile({
                    id: 'a',
                    frontmatter: { related: ['b', 'd'] },
                    canDo: 'Ir a {{link:subscription}} y {{article:b|b}}.'
                }),
                articleFile({
                    id: 'b',
                    frontmatter: { related: ['a', 'd'] },
                    canDo: 'Ir a {{link:subscription}} y {{article:a|a}}.'
                }),
                articleFile({
                    id: 'd',
                    frontmatter: { related: ['a', 'b'] },
                    canDo: 'Ir a {{link:subscription}} y {{article:a|a}}.'
                }),
                articleFile({
                    id: 'c',
                    frontmatter: { related: ['a', 'b'] },
                    canDo: 'Ir a {{link:subscription}} y {{article:a|a}}.'
                })
            ];

            // Act
            const issues = buildHelpIndex({ files: orphaned }).issues;

            // Assert
            expect(issues.map((issue) => `${issue.predicate}:${issue.articleId}`)).toEqual([
                'IL-4:c'
            ]);
        });

        it('fails IL-5 when the body has no article token', () => {
            expect(
                predicatesOf(greenCatalog({ a: { canDo: 'Ir a {{link:subscription}}.' } }))
            ).toContain('IL-5');
        });

        it('fails IL-2 when another title is quoted without a token, but not inside a step', () => {
            expect(predicatesOf(greenCatalog({ a: { expect: 'Mirá «Título b».' } }))).toContain(
                'IL-2'
            );
            expect(predicatesOf(greenCatalog({ a: { steps: ['Mirá «Título b».'] } }))).toEqual([]);
        });
    });
});

describe('parseHelpBody', () => {
    it('collects the section anchors and every ### anchor, explicit or slugified', () => {
        // Arrange
        const body = [
            '## Qué podés hacer',
            '',
            'x',
            '',
            '## Cómo se hace',
            '',
            '1. x',
            '',
            '### Después del paso',
            '',
            'y',
            '',
            '## Qué esperar',
            '',
            'x',
            '',
            '## Qué NO esperar',
            '',
            'x',
            '',
            '## Problemas comunes',
            '',
            '### Mis fotos no se ven {#fotos}',
            '',
            'z'
        ].join('\n');

        // Act
        const result = parseHelpBody({ body, locale: 'es' });

        // Assert
        expect('body' in result && result.body.anchors).toEqual([
            'que-podes-hacer',
            'como-se-hace',
            'que-esperar',
            'que-no-esperar',
            'problemas-comunes',
            'despues-del-paso',
            'fotos'
        ]);
    });

    it('rejects a duplicated ### anchor', () => {
        // Arrange
        const body = [
            '## Qué podés hacer',
            '',
            '### Igual',
            '',
            'x',
            '',
            '### Igual',
            '',
            'x'
        ].join('\n');

        // Act
        const result = parseHelpBody({ body, locale: 'es' });

        // Assert
        expect('errors' in result && result.errors.join('\n')).toContain(
            'duplicate anchor id "igual"'
        );
    });

    it('rejects a locale with no headings defined yet', () => {
        expect(parseHelpBody({ body: '', locale: 'pt' })).toEqual({
            errors: ['no section headings are defined for locale "pt"']
        });
    });
});

describe('slugifyHelpHeading', () => {
    it('lowercases, strips accents and joins words with hyphens', () => {
        expect(slugifyHelpHeading({ text: '¿Cómo SUBO fotos?  Rápido' })).toBe(
            'como-subo-fotos-rapido'
        );
    });
});

describe('toCanonicalJson', () => {
    it('sorts keys recursively, keeps array order, drops undefined and ends with a newline', () => {
        expect(toCanonicalJson({ value: { b: [2, 1], a: { d: 1, c: undefined } } })).toBe(
            '{\n  "a": {\n    "d": 1\n  },\n  "b": [\n    2,\n    1\n  ]\n}\n'
        );
    });
});
