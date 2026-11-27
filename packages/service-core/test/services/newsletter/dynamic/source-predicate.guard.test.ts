import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const root = new URL('../../../../src/services/newsletter/dynamic/', import.meta.url);

describe('shared dynamic accommodation predicate', () => {
    it.each([
        'sources/newest.source.ts',
        'sources/most-viewed.source.ts',
        'sources/top-rated.source.ts',
        'drizzle-dynamic-source.ts'
    ])('%s calls the canonical predicate', (file) => {
        const content = readFileSync(new URL(file, root), 'utf8');
        const tree = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
        let calls = 0;
        const inlineEligibility: string[] = [];
        function visit(node: ts.Node) {
            if (ts.isCallExpression(node)) {
                if (node.expression.getText(tree) === 'eligibleAccommodationPredicate') calls++;
                if (
                    ['eq', 'isNull', 'gte'].includes(node.expression.getText(tree)) &&
                    node.arguments.some((arg) =>
                        /accommodations\.(publicationStatus|deletedAt|destinationId|reviewsCount)/.test(
                            arg.getText(tree)
                        )
                    )
                ) {
                    inlineEligibility.push(node.getText(tree));
                }
            }
            ts.forEachChild(node, visit);
        }
        visit(tree);
        expect(calls).toBeGreaterThan(0);
        expect(inlineEligibility).toEqual([]);
    });
});
