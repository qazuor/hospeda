/**
 * HOS-2410 `docs/data-model.md` §5.2 — the shared token resolution: each kind
 * reaches its resolver with the vertical, destination or target worked out, and
 * no raw token survives a link that names no destination.
 *
 * @module test/resolve-tokens
 */

import { describe, expect, it } from 'vitest';
import type { HelpArticle } from '../src/article.schema';
import {
    type HelpTokenResolvers,
    helpDestinationLabel,
    resolveHelpText
} from '../src/resolve-tokens';

const TARGET = { id: 'photos', title: 'Fotos' } as HelpArticle;

const findArticle = ({ id }: { readonly id: string }) => (id === 'photos' ? TARGET : undefined);

/** Resolvers that print what they received. */
const echo: HelpTokenResolvers = {
    limit: ({ key, vertical, label }) => `[limit ${key} ${vertical ?? '-'} ${label ?? '-'}]`,
    link: ({ destination, label }) => `[link ${destination.kind} ${label ?? '-'}]`,
    article: ({ id, anchor, target, label }) =>
        `[article ${id} ${anchor ?? '-'} ${target?.title ?? '-'} ${label ?? '-'}]`
};

const resolve = (text: string, verticals: HelpArticle['verticals'] = ['accommodation']) =>
    resolveHelpText({ text, article: { verticals }, findArticle, resolvers: echo });

describe('resolveHelpText', () => {
    it("defaults a limit's vertical to the article's only one", () => {
        expect(resolve('{{limit:max_photos_per_accommodation}}')).toBe(
            '[limit max_photos_per_accommodation accommodation -]'
        );
    });

    it("uses the limit's own vertical, and none when the article has several", () => {
        expect(resolve('{{limit:k:venue}}', ['accommodation', 'venue'])).toBe('[limit k venue -]');
        expect(resolve('{{limit:k}}', ['accommodation', 'venue'])).toBe('[limit k - -]');
    });

    it('hands a link its destination and label', () => {
        expect(resolve('Mirá {{link:plans:venue|los planes}}.')).toBe(
            'Mirá [link plans los planes].'
        );
    });

    it('turns a link that names no destination into its label, never the raw token', () => {
        expect(resolve('{{link:nowhere|acá}} y {{link:nowhere}}')).toBe('acá y ');
    });

    it('hands an article token its target and anchor', () => {
        expect(resolve('{{article:photos:problemas-comunes|si falla}}')).toBe(
            '[article photos problemas-comunes Fotos si falla]'
        );
        expect(resolve('{{article:missing}}')).toBe('[article missing - - -]');
    });

    it('leaves a malformed token as written', () => {
        expect(resolve('{{ algo }}')).toBe('{{ algo }}');
    });
});

describe('helpDestinationLabel', () => {
    it("is the portal's default label of the destination", () => {
        expect(helpDestinationLabel({ destination: { kind: 'faq' } })).toBe(
            'Ver las preguntas frecuentes'
        );
    });
});
