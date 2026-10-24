/**
 * @file SubscriptionCancel.styles.test.ts
 * @description TEST:1762:6 (HOS-1762): the cancellation flow's button hierarchy.
 *
 * The button that opens the confirmation is a normal-size red outline aligned to
 * the start (never a full-width bar), the one that confirms is the strongest
 * action (solid danger), back is ghost and retry is secondary. No button of the
 * island uses a `Compact` variant. Vitest cannot render `.astro`, but this island
 * is a `.tsx`; the CSS Modules and the JSX call-sites are asserted from source,
 * which is what pins the classes the rendered markup receives.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MODULE_CSS = readFileSync(
    resolve(__dirname, '../../../src/components/account/SubscriptionCancel.module.css'),
    'utf8'
);

const BUTTON_CSS = readFileSync(
    resolve(__dirname, '../../../src/components/account/AccountButton.module.css'),
    'utf8'
);

const ISLAND = readFileSync(
    resolve(__dirname, '../../../src/components/account/SubscriptionCancel.client.tsx'),
    'utf8'
);

function classBlock(source: string, className: string): string {
    const start = source.indexOf(`${className} {`);
    if (start < 0) return '';
    const end = source.indexOf('}', start);
    return source.slice(start, end + 1);
}

function buttonBlocks(tsx: string): readonly string[] {
    const blocks: string[] = [];
    let from = 0;
    while (from < tsx.length) {
        const start = tsx.indexOf('<button', from);
        if (start < 0) return blocks;
        const end = tsx.indexOf('>', start);
        if (end < 0) return blocks;
        blocks.push(tsx.slice(start, end + 1));
        from = end + 1;
    }
    return blocks;
}

describe('TEST:1762:6 the cancellation flow ranks its actions', () => {
    it('opens with the outline danger variant aligned to the start', () => {
        const open = classBlock(MODULE_CSS, '.open');

        expect(open).toContain('composes: danger from "./AccountButton.module.css"');
        expect(open).toContain('align-self: flex-start');
    });

    it('confirms with the solid danger variant, back with ghost and retry with secondary', () => {
        expect(classBlock(MODULE_CSS, '.confirm')).toContain(
            'composes: dangerSolid from "./AccountButton.module.css"'
        );
        expect(classBlock(MODULE_CSS, '.back')).toContain(
            'composes: ghost from "./AccountButton.module.css"'
        );
        expect(classBlock(MODULE_CSS, '.retry')).toContain(
            'composes: secondary from "./AccountButton.module.css"'
        );
    });

    it('uses no compact variant anywhere in the module', () => {
        expect(MODULE_CSS).not.toContain('Compact');
    });

    it('defines the solid danger variant with tokens only', () => {
        const solid = classBlock(BUTTON_CSS, '.dangerSolid');

        expect(solid).toContain('background-color: var(--destructive)');
        expect(solid).toContain('color: var(--destructive-foreground)');
    });

    it('wires the open and confirm buttons to their variants', () => {
        const blocks = buttonBlocks(ISLAND);
        const open = blocks.find((block) => block.includes('data-testid="self-cancel-open"'));
        const confirm = blocks.find((block) => block.includes('data-testid="self-cancel-confirm"'));

        expect(open).toContain('className={styles.open}');
        expect(confirm).toContain('className={styles.confirm}');
    });

    it('leaves no button without a variant class and drops the old names', () => {
        const blocks = buttonBlocks(ISLAND);

        expect(blocks.length).toBeGreaterThan(0);
        for (const block of blocks) {
            expect(block).toContain('className={styles.');
        }
        expect(ISLAND).not.toContain('styles.danger');
        expect(ISLAND).not.toContain('styles.secondary');
    });
});
