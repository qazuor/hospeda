/**
 * HOS-2410 (`docs/data-model.md` §1.2) — the body parser and the canonical JSON
 * writer of the generator.
 *
 * @module test/parse-article
 */

import { describe, expect, it } from 'vitest';
import { toCanonicalJson } from '../src/generator/canonical-json';
import { parseHelpBody, slugifyHelpHeading } from '../src/generator/parse-article';

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
            'relacionados',
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

    it('reserves the «Relacionados» anchor like the five section anchors', () => {
        // Act
        const result = parseHelpBody({
            body: ['## Qué podés hacer', '', '### Relacionados', '', 'x'].join('\n'),
            locale: 'es'
        });

        // Assert
        expect('errors' in result && result.errors.join('\n')).toContain(
            'duplicate anchor id "relacionados"'
        );
    });

    it('rejects an explicit anchor that starts with a digit, naming it', () => {
        // Act
        const result = parseHelpBody({
            body: ['## Qué podés hacer', '', '### En un día {#24h}', '', 'x'].join('\n'),
            locale: 'es'
        });

        // Assert
        expect('errors' in result && result.errors.join('\n')).toContain(
            'explicit anchor "{#24h}" ("### En un día {#24h}") must start with a letter'
        );
    });

    it('prefixes a slugged anchor whose heading starts with a digit', () => {
        // Act
        const result = parseHelpBody({
            body: [
                '## Qué podés hacer',
                '',
                'x',
                '',
                '## Cómo se hace',
                '',
                '1. x',
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
                '### 48 horas sin respuesta',
                '',
                'x'
            ].join('\n'),
            locale: 'es'
        });

        // Assert
        expect('body' in result && result.body.anchors).toContain('h-48-horas-sin-respuesta');
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
