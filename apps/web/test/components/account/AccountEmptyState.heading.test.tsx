/**
 * @file AccountEmptyState.heading.test.tsx
 * @description Regression for HOS-2453: the empty-state title was an `<h3>`, but
 * account pages render it right under the page `<h1>`, which skipped a level.
 * Both the React and the Astro variants now use `<h2>`.
 *
 * @module test/components/account/AccountEmptyState.heading
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AccountEmptyState } from '../../../src/components/account/AccountEmptyState';

describe('AccountEmptyState heading level (HOS-2453)', () => {
    it('React variant titles itself with an h2', () => {
        render(
            <AccountEmptyState
                title="Nada por acá"
                description="Todavía no hay nada."
            />
        );

        expect(screen.getByRole('heading', { level: 2, name: 'Nada por acá' })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { level: 3 })).toBeNull();
    });

    it('Astro variant titles itself with an h2', () => {
        const source = readFileSync(
            resolve(__dirname, '../../../src/components/account/AccountEmptyState.astro'),
            'utf8'
        );

        expect(source).toContain('<h2 class="account-empty__title">');
        expect(source).not.toMatch(/<h3[\s>]/);
    });
});
