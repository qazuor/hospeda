import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '../../../..');

function sourceFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory()
            ? sourceFiles(path)
            : entry.isFile() && path.endsWith('.ts')
              ? [path]
              : [];
    });
}

function endOfCall(source: string, openParen: number): number {
    let depth = 0;
    let quote: "'" | '"' | '`' | null = null;
    for (let index = openParen; index < source.length; index++) {
        const char = source[index];
        if (quote) {
            if (char === '\\') index++;
            else if (char === quote) quote = null;
            continue;
        }
        if (char === "'" || char === '"' || char === '`') {
            quote = char;
            continue;
        }
        if (char === '(') depth++;
        if (char === ')' && --depth === 0) return index + 1;
    }
    return source.length;
}

describe('domain_event chronological ordering has seq tie-breaks', () => {
    it('requires seq in Drizzle order clauses and raw SQL ORDER BY clauses', () => {
        const violations: string[] = [];
        const roots = ['packages', 'apps'].flatMap((group) =>
            readdirSync(join(REPO_ROOT, group), { withFileTypes: true })
                .filter((entry) => entry.isDirectory())
                .map((entry) => join(REPO_ROOT, group, entry.name, 'src'))
                .filter((path) => {
                    try {
                        return readdirSync(path).length >= 0;
                    } catch {
                        return false;
                    }
                })
        );

        for (const root of roots) {
            for (const path of sourceFiles(root)) {
                const source = readFileSync(path, 'utf8');
                const name = relative(REPO_ROOT, path).replaceAll('\\', '/');
                const callPattern = /\.orderBy\s*\(/g;
                for (const match of source.matchAll(callPattern)) {
                    const openParen = (match.index ?? 0) + match[0].lastIndexOf('(');
                    const clause = source.slice(openParen, endOfCall(source, openParen));
                    if (
                        clause.includes('domainEvent.occurredAt') &&
                        !clause.includes('domainEvent.seq')
                    ) {
                        violations.push(
                            `${name}: ${match[1]} domainEvent.occurredAt without domainEvent.seq`
                        );
                    }
                }

                for (const template of source.matchAll(/\bsql(?:<[^`]*>)?`([^`]*)`/gs)) {
                    const body = template[1] ?? '';
                    const offset = template.index ?? 0;
                    for (const order of body.matchAll(/\bORDER\s+BY\b[^)]*/gi)) {
                        if (!/occurred_at/i.test(order[0])) continue;
                        const tail = body.slice((order.index ?? 0) + order[0].length);
                        const boundary = tail.search(/\bLIMIT\b|\)/i);
                        const clause = `${order[0]}${boundary < 0 ? tail : tail.slice(0, boundary)}`;
                        if (!/\bseq\b/i.test(clause)) {
                            violations.push(
                                `${name}: raw SQL ORDER BY occurred_at without seq (offset ${offset})`
                            );
                        }
                    }
                }
            }
        }

        expect(violations, violations.join('\n')).toEqual([]);
    });
});

/*
 * Scope: this source guard sees direct Drizzle column references and sql`...`
 * templates under package and app src directories. Aliased table references,
 * ordering performed in JavaScript, and SQL assembled outside a tagged template
 * are outside its scan and need explicit coverage if introduced.
 */
