/**
 * HOS-2410 (`docs/data-model.md` §3, D-H9, AC-27) — the generator's checks of
 * references inside the catalog (a2, a5, a6, a7) and the interlinking rules
 * IL-1…IL-5, by mutation of a green synthetic catalog.
 *
 * @module test/generator-references
 */

import { describe, expect, it } from 'vitest';
import { buildHelpIndex } from '../src/generator/build-index';
import { articleFile, greenCatalog } from './fixtures/article-source';
import { predicatesOf } from './fixtures/build-helpers';

describe('buildHelpIndex', () => {
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

        it('counts a link token inside a step for IL-1, now that get_help resolves it (PR-12)', () => {
            // Arrange: the only {{link:subscription}} moves into a step.
            const files = greenCatalog({
                a: {
                    canDo: 'Leer {{article:b|el otro}}.',
                    steps: ['Entrá a {{link:subscription}}.', 'Segundo paso.']
                }
            });

            // Act / Assert
            expect(predicatesOf(files)).toEqual([]);
        });

        it('fails IL-1 for a covered page reachable only by a page key, naming the token, and passes with it', () => {
            // Arrange
            const covers = { covers: ['page:mi-cuenta/suscripcion', 'page:mi-cuenta'] };
            const unlinked = greenCatalog({ a: { frontmatter: covers } });
            const linked = greenCatalog({
                a: {
                    frontmatter: covers,
                    canDo: 'Ir a {{link:subscription}}, {{link:page:accountHome}} y {{article:b|el otro}}.'
                }
            });
            const wrongKey = greenCatalog({
                a: {
                    frontmatter: covers,
                    canDo: 'Ir a {{link:subscription}}, {{link:page:promotions}} y {{article:b|el otro}}.'
                }
            });

            // Act / Assert
            expect(buildHelpIndex({ files: unlinked }).issues.map((issue) => issue.detail)).toEqual(
                [
                    'page:mi-cuenta is covered but the body has no {{link:…}} token to it (for example {{link:page:accountHome}})'
                ]
            );
            expect(predicatesOf(linked)).toEqual([]);
            expect(predicatesOf(wrongKey)).toEqual(['IL-1']);
        });

        it('counts an {{article}} token as a link to the help article page (IL-1)', () => {
            // Arrange: no {{link}} target names an article id
            const covers = { covers: ['page:mi-cuenta/suscripcion', 'page:mi-cuenta/ayuda/[id]'] };
            const withArticle = greenCatalog({ a: { frontmatter: covers } });
            const withoutArticle = greenCatalog({
                a: { frontmatter: covers, canDo: 'Ir a {{link:subscription}}.' }
            });

            // Act / Assert
            expect(predicatesOf(withArticle)).toEqual([]);
            expect(
                buildHelpIndex({ files: withoutArticle }).issues.map((issue) => issue.detail)
            ).toContain(
                'page:mi-cuenta/ayuda/[id] is covered but the body has no {{link:…}} token to it'
            );
        });

        it('fails a6 on a page key that names a record', () => {
            expect(
                predicatesOf(greenCatalog({ c: { expect: 'Ver {{link:page:promotionEdit}}.' } }))
            ).toEqual(['a6']);
        });

        it('lets a token link a covered editor page that is not a catalog section (politicas)', () => {
            // Arrange: a5 accepts section:accommodation.politicas, so a token must be able to link it.
            const covers = {
                covers: ['page:mi-cuenta/suscripcion', 'section:accommodation.politicas']
            };
            const unlinked = greenCatalog({ a: { frontmatter: covers } });
            const linked = greenCatalog({
                a: {
                    frontmatter: covers,
                    canDo: 'Ir a {{link:subscription}}, {{link:section:accommodation:politicas}} y {{article:b|el otro}}.'
                }
            });

            // Act / Assert
            expect(predicatesOf(unlinked)).toEqual(['IL-1']);
            expect(predicatesOf(linked)).toEqual([]);
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
