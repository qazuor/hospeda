/**
 * Regression + guard: the permission catalog screen must show EVERY permission
 * category (HOS-1124).
 *
 * `/access/permissions` grouped its categories with a chain of `if/else if`
 * branches that named each group's members by hand and ended without a final
 * `else`. A category no branch claimed was not collected anywhere — it simply
 * never rendered. Thirty-four of the enum's eighty-one categories were in that
 * state, `HOST_TRADE`, `PARTNER`, `MEDIA`, `MODERATION`, `COMMERCE` and every
 * `SOCIAL_*` among them, and this page is the only place an operator can see
 * what a role may be granted.
 *
 * The bug was invisible precisely because the screen looked fine: six populated
 * groups, no gap, no error, no red test. So the assertions here are about
 * TOTALITY, not about any particular group's contents — the thing nobody was
 * asking.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PermissionCategoryEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    CATEGORY_GROUP,
    categoryTranslationKey,
    GROUP_TRANSLATION_KEYS,
    groupPermissionCategories,
    PERMISSION_CATEGORY_GROUPS,
    UNGROUPED_CATEGORY_GROUP
} from '@/lib/permission-category-groups';

const ALL_CATEGORIES = Object.values(PermissionCategoryEnum);

/** Flattens the grouped output back into the categories it actually rendered. */
const renderedCategories = (
    grouped: ReadonlyArray<readonly [string, readonly string[]]>
): string[] => grouped.flatMap(([, categories]) => [...categories]);

describe('every permission category reaches the screen (HOS-1124)', () => {
    it('renders all of them, dropping none', () => {
        const rendered = renderedCategories(groupPermissionCategories(ALL_CATEGORIES));
        const missing = ALL_CATEGORIES.filter((category) => !rendered.includes(category));

        expect(
            missing,
            `${missing.length} permission categories never render on /access/permissions: ${missing.join(', ')}. That page is the read-only reference an operator consults to learn what the platform can express, so a missing family is invisible there while the screen still looks complete. (Assignment itself lives in PermissionPicker, which groups separately.)`
        ).toEqual([]);
    });

    it('renders each category exactly once', () => {
        const rendered = renderedCategories(groupPermissionCategories(ALL_CATEGORIES));
        const duplicated = rendered.filter((c, i) => rendered.indexOf(c) !== i);

        expect(
            duplicated,
            `categories rendered in more than one group: ${duplicated.join(', ')}`
        ).toEqual([]);
        expect(rendered).toHaveLength(ALL_CATEGORIES.length);
    });

    /**
     * The `Record<PermissionCategoryEnum, …>` type already forbids a missing
     * key, but a widening cast anywhere upstream would silence it. Re-check at
     * runtime so the guarantee does not depend on nobody ever writing `as`.
     */
    it('declares a group for every enum member at runtime, not only at compile time', () => {
        const unmapped = ALL_CATEGORIES.filter(
            (category) => !Object.hasOwn(CATEGORY_GROUP, category)
        );

        expect(
            unmapped,
            `CATEGORY_GROUP has no entry for: ${unmapped.join(', ')}. Add each to apps/admin/src/lib/permission-category-groups.ts — a category with no group lands in the catch-all instead of where it belongs.`
        ).toEqual([]);
    });

    it('maps every category to a group that actually exists', () => {
        const strays = Object.entries(CATEGORY_GROUP).filter(
            ([, group]) => !PERMISSION_CATEGORY_GROUPS.includes(group)
        );

        expect(strays, `categories mapped to an unknown group: ${JSON.stringify(strays)}`).toEqual(
            []
        );
    });
});

describe('the final else collects what nothing claims (HOS-1124)', () => {
    /**
     * The trap case. This is the exact shape of the old bug: a category value
     * that no branch — now, no map entry — accounts for. It must come out
     * somewhere visible.
     */
    it('puts an unmapped category in the catch-all group instead of discarding it', () => {
        const grouped = groupPermissionCategories(['DEFINITELY_NOT_A_DECLARED_CATEGORY']);

        expect(renderedCategories(grouped)).toEqual(['DEFINITELY_NOT_A_DECLARED_CATEGORY']);
        expect(grouped.map(([group]) => group)).toEqual([UNGROUPED_CATEGORY_GROUP]);
    });

    it('keeps a mapped category out of the catch-all', () => {
        const grouped = groupPermissionCategories([PermissionCategoryEnum.HOST_TRADE]);

        expect(grouped).toHaveLength(1);
        expect(grouped[0]?.[0]).not.toBe(UNGROUPED_CATEGORY_GROUP);
        expect(grouped[0]?.[1]).toEqual([PermissionCategoryEnum.HOST_TRADE]);
    });
});

describe('grouping output shape (HOS-1124)', () => {
    it('omits groups with no categories', () => {
        const grouped = groupPermissionCategories([PermissionCategoryEnum.USER]);

        expect(grouped).toHaveLength(1);
        expect(grouped[0]?.[0]).toBe('User & Access');
    });

    it('returns groups in the declared display order', () => {
        const order = groupPermissionCategories(ALL_CATEGORIES).map(([group]) => group);
        const expected = PERMISSION_CATEGORY_GROUPS.filter((group) => order.includes(group));

        expect(order).toEqual(expected);
    });

    it('handles an empty input without inventing groups', () => {
        expect(groupPermissionCategories([])).toEqual([]);
    });
});

describe('the permissions route uses the shared grouping (HOS-1124)', () => {
    const ROUTE = join(__dirname, '../../src/routes/_authed/access/permissions.tsx');

    /**
     * The map and its totality are worth nothing if the page grows its own
     * copy of the grouping again, which is how HOS-1124 happened in the first
     * place. Assert the wiring, and assert the hand-rolled chain is gone.
     */
    it('imports groupPermissionCategories rather than grouping inline', () => {
        const source = readFileSync(ROUTE, 'utf8');

        expect(
            source,
            'The permissions route no longer imports groupPermissionCategories. Grouping declared in the component is exactly what silently dropped 34 categories (HOS-1124).'
        ).toMatch(
            /import\s*\{[^}]*\bgroupPermissionCategories\b[^}]*\}\s*from\s*'@\/lib\/permission-category-groups'/
        );
        expect(source).toMatch(/\bgroupPermissionCategories\s*\(/);
    });

    it('no longer contains a branch chain over PermissionCategoryEnum', () => {
        const source = readFileSync(ROUTE, 'utf8');

        expect(
            /\}\s*else\s+if\s*\(/.test(source),
            'The permissions route has an `else if` chain again. Group membership belongs in CATEGORY_GROUP, where a missing category is a typecheck error instead of a category that vanishes.'
        ).toBe(false);
    });
});

describe('every category and group can be labelled in every locale (HOS-1124)', () => {
    const LOCALES = ['es', 'en', 'pt'] as const;

    /** Resolves a dotted `admin-pages.*` key against a locale bundle. */
    const resolve = (locale: string, translationKey: string): unknown => {
        const [namespace, ...path] = translationKey.split('.');
        const bundle: unknown = JSON.parse(
            readFileSync(
                join(
                    __dirname,
                    `../../../../packages/i18n/src/locales/${locale}/${namespace}.json`
                ),
                'utf8'
            )
        );

        return path.reduce<unknown>(
            (node, segment) =>
                typeof node === 'object' && node !== null
                    ? (node as Record<string, unknown>)[segment]
                    : undefined,
            bundle
        );
    };

    for (const locale of LOCALES) {
        it(`${locale} has a label for every permission category`, () => {
            const missing = ALL_CATEGORIES.filter(
                (category) => typeof resolve(locale, categoryTranslationKey(category)) !== 'string'
            );

            expect(
                missing,
                `locale '${locale}' has no admin-pages.access.permissions.categories entry for: ${missing.join(', ')}. The page would render the raw i18n key — visible, but not readable.`
            ).toEqual([]);
        });

        it(`${locale} has a heading for every domain group`, () => {
            const missing = PERMISSION_CATEGORY_GROUPS.filter(
                (group) => typeof resolve(locale, GROUP_TRANSLATION_KEYS[group]) !== 'string'
            );

            expect(
                missing,
                `locale '${locale}' has no group heading for: ${missing.join(', ')}`
            ).toEqual([]);
        });
    }
});
