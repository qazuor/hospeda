#!/usr/bin/env bun
/**
 * Aggregate axe violations across all per-page reports in audits/spec-131/.
 * Outputs:
 *   - _fixtures/axe-aggregate.json: rule -> { impact, pages: [{url, nodes, sampleHtml}] }
 *   - stdout: top-N table by page count
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUDIT_ROOT = join(__dirname, '..');
const REPORT = JSON.parse(readFileSync(join(AUDIT_ROOT, '_fixtures', 'sweep-report.json'), 'utf8'));

type AggregatedRule = {
    id: string;
    impact: string;
    help: string;
    helpUrl: string;
    affectedPages: Array<{
        url: string;
        nodeCount: number;
        sampleTarget?: string;
        sampleHtml?: string;
    }>;
};

const byRule = new Map<string, AggregatedRule>();

for (const result of REPORT.results) {
    if (result.status !== 'ok') continue;
    const entity = result.entity;
    // Derive axe report path from page entry.
    // Slug rules in md-to-json mirror sweep.ts slug generation.
    const slug = result.url.replace(/^\//, '').replace(/\$/g, '').replace(/\//g, '__') || 'root';
    const axePath = join(AUDIT_ROOT, entity, `${slug}-axe.json`);
    if (!existsSync(axePath)) continue;
    const axe = JSON.parse(readFileSync(axePath, 'utf8'));
    for (const v of axe.violations) {
        if (!byRule.has(v.id)) {
            byRule.set(v.id, {
                id: v.id,
                impact: v.impact,
                help: v.help,
                helpUrl: v.helpUrl,
                affectedPages: []
            });
        }
        const rule = byRule.get(v.id)!;
        rule.affectedPages.push({
            url: result.url,
            nodeCount: v.nodes.length,
            sampleTarget: JSON.stringify(v.nodes[0]?.target),
            sampleHtml: v.nodes[0]?.html?.slice(0, 300)
        });
    }
}

const rules = Array.from(byRule.values()).sort((a, b) => {
    // Sort: impact severity desc, then affected page count desc.
    const impactOrder = { critical: 0, serious: 1, moderate: 2, minor: 3 };
    const ai = impactOrder[a.impact as keyof typeof impactOrder] ?? 4;
    const bi = impactOrder[b.impact as keyof typeof impactOrder] ?? 4;
    if (ai !== bi) return ai - bi;
    return b.affectedPages.length - a.affectedPages.length;
});

writeFileSync(
    join(AUDIT_ROOT, '_fixtures', 'axe-aggregate.json'),
    JSON.stringify({ totalRules: rules.length, rules }, null, 2)
);

console.log(`\n=== Axe Aggregated Findings (${rules.length} unique rules) ===\n`);
console.log('| Impact   | Rule                              | Pages | Help');
console.log(
    '|----------|-----------------------------------|-------|-------------------------------------------'
);
for (const r of rules) {
    const id = r.id.padEnd(34);
    const impact = r.impact.padEnd(8);
    const pages = r.affectedPages.length.toString().padStart(5);
    console.log(`| ${impact} | ${id} | ${pages} | ${r.help}`);
}
console.log('\nWrote details to _fixtures/axe-aggregate.json');
