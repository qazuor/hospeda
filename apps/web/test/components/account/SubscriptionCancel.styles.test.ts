/**
 * @file SubscriptionCancel.styles.test.ts
 * @description TEST:1762:6 (HOS-1762, reworked by HOS-2599): the cancellation
 * flow's button hierarchy, pinned through the kit `Button` variants in source.
 *
 * Open is a danger-ghost, confirm is the strongest action (danger), back is
 * ghost and retry is secondary. The island uses the kit only: no native
 * `<button>` or `<select>`, no `AccountButton.module.css` composes, and no
 * ad hoc red-bordered panel.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (name: string) =>
    readFileSync(resolve(__dirname, '../../../src/components/account', name), 'utf8');

const MODULE_CSS = read('SubscriptionCancel.module.css');
const ISLAND = read('SubscriptionCancel.client.tsx');

/** Returns every `<Button ...>` opening tag with its props. */
function buttonTags(tsx: string): readonly string[] {
    return [...tsx.matchAll(/<Button\b[^>]*>/gu)].map(([tag]) => tag);
}

/** The first Button tag whose props contain `needle`, or undefined. */
function tagWith(tsx: string, needle: string): string | undefined {
    return buttonTags(tsx).find((tag) => tag.includes(needle));
}

describe('TEST:1762:6 the cancellation flow ranks its actions', () => {
    it('opens with the danger-ghost variant (never a full-width bar)', () => {
        const open = tagWith(ISLAND, 'data-testid="self-cancel-open"');

        expect(open).toContain('variant="danger-ghost"');
        expect(open).not.toContain('fullWidth');
    });

    it('confirms with danger, goes back with ghost and retries with secondary', () => {
        expect(tagWith(ISLAND, 'data-testid="self-cancel-confirm"')).toContain('variant="danger"');
        const variants = buttonTags(ISLAND).map((tag) => /variant="([^"]+)"/u.exec(tag)?.[1]);
        expect(variants.filter((variant) => variant === 'ghost')).toHaveLength(3);
        expect(variants).toContain('secondary');
    });

    it('gives every button an explicit variant and size', () => {
        const tags = buttonTags(ISLAND);

        expect(tags.length).toBeGreaterThan(0);
        for (const tag of tags) {
            expect(tag).toContain('variant="');
            expect(tag).toContain('size="sm"');
        }
    });

    it('uses the kit only: no native button or select, no composes', () => {
        expect(ISLAND).not.toContain('<button');
        expect(ISLAND).not.toContain('<select');
        expect(ISLAND).toContain('<Select');
        expect(ISLAND).toContain('<Field');
        expect(ISLAND).toContain('<Alert');
        expect(MODULE_CSS).not.toContain('composes');
        expect(MODULE_CSS).not.toContain('Compact');
    });

    it('drops the ad hoc red-bordered panel', () => {
        expect(MODULE_CSS).not.toContain('border-left');
        expect(MODULE_CSS).not.toContain('--destructive');
        expect(MODULE_CSS).not.toContain('--surface-warm');
    });
});
