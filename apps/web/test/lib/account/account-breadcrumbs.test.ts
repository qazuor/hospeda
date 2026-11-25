import { describe, expect, it } from 'vitest';
import { buildAccountBreadcrumbs } from '../../../src/lib/account/account-breadcrumbs';
import { createT } from '../../../src/lib/i18n';

describe('buildAccountBreadcrumbs', () => {
    it('prepends the translated account root and appends the current page without changing parents', () => {
        const parents = Object.freeze([{ label: 'Favoritos', path: 'mi-cuenta/favoritos' }]);
        expect(
            buildAccountBreadcrumbs({ t: createT('es'), parents, current: 'Colección' })
        ).toEqual([{ label: 'Mi cuenta', path: 'mi-cuenta' }, ...parents, { label: 'Colección' }]);
        expect(parents).toHaveLength(1);
    });
});
