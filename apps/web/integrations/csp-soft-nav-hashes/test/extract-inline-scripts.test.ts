/**
 * @file extract-inline-scripts.test.ts
 * @description Unit tests for the build-time scan that feeds the CSP soft-nav
 * union (HOS-807): template-literal collection and inline-script extraction.
 *
 * AAA pattern. The ASTs are hand-built ESTree fragments, shaped like the
 * compiled output of an `.astro` component (`renderTemplate`\`…\``).
 */

import { describe, expect, it } from 'vitest';
import { collectTemplateQuasis } from '../collect-template-quasis';
import { extractInlineScripts } from '../extract-inline-scripts';

const templateLiteral = (cooked: readonly (string | null)[], raw?: readonly string[]) => ({
    type: 'TemplateLiteral',
    quasis: cooked.map((value, index) => ({
        type: 'TemplateElement',
        value: { cooked: value, raw: raw?.[index] ?? value ?? '' }
    })),
    expressions: cooked.slice(1).map(() => ({ type: 'Identifier', name: 'x' }))
});

describe('collectTemplateQuasis', () => {
    it('collects the cooked quasis of nested template literals anywhere in the tree', () => {
        // Arrange
        const ast = {
            type: 'Program',
            body: [
                {
                    type: 'ExpressionStatement',
                    expression: {
                        type: 'TaggedTemplateExpression',
                        tag: { type: 'Identifier', name: 'renderTemplate' },
                        quasi: templateLiteral(['<div>', '</div>'])
                    }
                },
                { type: 'ExpressionStatement', expression: templateLiteral(['<p>`a`</p>']) }
            ]
        };

        // Act
        const { templates } = collectTemplateQuasis({ ast });

        // Assert
        expect(templates).toHaveLength(2);
        expect(templates).toContainEqual(['<div>', '</div>']);
        expect(templates).toContainEqual(['<p>`a`</p>']);
    });

    it('falls back to the raw text when a quasi has no cooked value', () => {
        // Arrange
        const ast = { type: 'Program', body: [templateLiteral([null], ['\\unicode'])] };

        // Act
        const { templates } = collectTemplateQuasis({ ast });

        // Assert
        expect(templates).toEqual([['\\unicode']]);
    });
});

describe('extractInlineScripts', () => {
    it('returns the body of a static inline script byte for byte', () => {
        // Arrange
        const body = "\n\t(function () { var s = `x`; console.log('</p>'); })();\n";

        // Act
        const result = extractInlineScripts({
            templates: [[`<footer></footer> <script>${body}</script>`]]
        });

        // Assert
        expect(result.staticBodies).toEqual([body]);
        expect(result.dynamicScripts).toEqual([]);
    });

    it('includes type="module" scripts and deduplicates identical bodies', () => {
        // Act
        const result = extractInlineScripts({
            templates: [
                ['<script type="module">a()</script>'],
                ['<script>a()</script><script type="text/javascript">b()</script>']
            ]
        });

        // Assert
        expect(result.staticBodies).toEqual(['a()', 'b()']);
    });

    it('reports a script whose body is split by an expression as dynamic, not static', () => {
        // Arrange: `<script is:inline set:html={x} />` compiles to
        // `<script>«expr»</script>` — two quasis around one expression.
        const templates = [
            ['<script>', '</script>'],
            ['<script>(function(){', 'go()})()</script>']
        ];

        // Act
        const result = extractInlineScripts({ templates });

        // Assert
        expect(result.staticBodies).toEqual([]);
        expect(result.dynamicScripts).toHaveLength(2);
        expect(result.dynamicScripts[1]?.bodyPreview).toBe('(function(){«expr»go()})()');
    });

    it('treats an expression only in the opening tag as static when the body is literal', () => {
        // Act
        const result = extractInlineScripts({
            templates: [['<script data-x="', '">run()</script>']]
        });

        // Assert
        expect(result.staticBodies).toEqual(['run()']);
        expect(result.dynamicScripts).toEqual([]);
    });

    it('treats a script whose type is an expression as executable (conservative)', () => {
        // Act
        const result = extractInlineScripts({
            templates: [['<script type="', '">run()</script>']]
        });

        // Assert
        expect(result.staticBodies).toEqual(['run()']);
    });

    it('skips external scripts, data blocks and empty scripts', () => {
        // Act
        const result = extractInlineScripts({
            templates: [
                [
                    '<script src="/a.js"></script>',
                    '<script type="application/ld+json">{"a":1}</script>',
                    '<script type="application/json">{}</script>',
                    '<script></script>'
                ]
            ]
        });

        // Assert
        expect(result.staticBodies).toEqual([]);
        expect(result.dynamicScripts).toEqual([]);
    });

    it('does not treat data-type as the type attribute', () => {
        // Act
        const result = extractInlineScripts({
            templates: [['<script data-type="application/json">run()</script>']]
        });

        // Assert
        expect(result.staticBodies).toEqual(['run()']);
    });
});
