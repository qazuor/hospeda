/**
 * @file hos-2611-create-actions.source.test.ts
 * @description HOS-2611 guards over source for the one «create» pattern of Mi
 * cuenta (owner decision, 25/11): every create action is the kit primary
 * button with a «+» icon (`AddIcon`) and an «Agregar …» label, and a screen
 * shows ONE of them — the header drops its action while the empty state owns
 * it. Also guards that the location-exception controls left the green pill.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (rel: string): string => readFileSync(resolve(__dirname, '../../src', rel), 'utf8');

const readLocale = (locale: string, namespace: string): Record<string, unknown> =>
    JSON.parse(
        readFileSync(
            resolve(
                __dirname,
                '../../../../packages/i18n/src/locales',
                locale,
                `${namespace}.json`
            ),
            'utf8'
        )
    ) as Record<string, unknown>;

/** Reads a dotted path out of a parsed locale file. */
const pick = (tree: Record<string, unknown>, path: string): unknown =>
    path
        .split('.')
        .reduce<unknown>(
            (node, key) =>
                node && typeof node === 'object'
                    ? (node as Record<string, unknown>)[key]
                    : undefined,
            tree
        );

describe('create actions use the kit primary button with a «+» icon', () => {
    it.each([
        ['pages/[lang]/mi-cuenta/propiedades/index.astro', 2],
        ['pages/[lang]/mi-cuenta/comercio/index.astro', 2],
        ['components/account/my-content/OwnContentListView.tsx', 2],
        ['components/host/PromotionList.client.tsx', 1],
        ['components/venue/VenuePromotionsManager.client.tsx', 1],
        ['components/account/favorites/CreateCollectionAction.tsx', 1]
    ])('%s', (file, iconCount) => {
        // Arrange
        const source = read(file);

        // Assert: one AddIcon per create action, and no legacy «+ Nuevo …» text.
        expect(source.match(/<AddIcon\b/g)?.length ?? 0).toBe(iconCount);
        expect(source).not.toMatch(/'\+ Nuev/);
    });
});

describe('one solid primary per screen: the header hides its create action when empty', () => {
    it('comercio list renders the header action only with listings', () => {
        expect(read('pages/[lang]/mi-cuenta/comercio/index.astro')).toMatch(
            /\{listings\.length > 0 && !listingsLoadFailed && !usageBadges\.some\(\(usage\) => usage\.currentUsage >= usage\.maxAllowed\) && \(\s*<LinkButton slot="actions"/
        );
    });

    it('properties list keeps the header action out of the empty state', () => {
        expect(read('pages/[lang]/mi-cuenta/propiedades/index.astro')).toMatch(
            /\{!isEmpty && !fetchError && \(\s*<LinkButton slot="actions"/
        );
    });

    it('own-content list offers the header action only when the list is ready', () => {
        expect(read('components/account/my-content/OwnContentListView.tsx')).toMatch(
            /status === 'ready' \? \(\s*<LinkButton href=\{createHref\}>/
        );
    });
});

describe('create labels read «Agregar …» in every locale', () => {
    const KEYS = [
        ['host', 'properties.list.add'],
        ['host', 'promotions.addButton'],
        ['listing', 'owner.list.createCta.venue'],
        ['listing', 'owner.list.createCta.experience'],
        ['listing', 'owner.list.emptyCta.venue'],
        ['listing', 'owner.list.emptyCta.experience'],
        ['account', 'myContent.contentList.events.create'],
        ['account', 'myContent.contentList.posts.create'],
        ['account', 'myContent.events.list.emptyCta'],
        ['account', 'myContent.posts.list.emptyCta'],
        ['account', 'favorites.collections.add'],
        ['venue', 'owner.editor.promotionsManager.create']
    ] as const;
    const VERB = { es: /^Agregar /, en: /^Add /, pt: /^Adicionar / } as const;

    for (const [locale, verb] of Object.entries(VERB)) {
        it.each(KEYS)(`${locale}: %s.%s`, (namespace, key) => {
            expect(pick(readLocale(locale, namespace), key)).toMatch(verb);
        });
    }
});

describe('location-exception controls use the kit Button, not the green pill', () => {
    it.each([
        'components/listing/LocationExceptionPanel.client.tsx',
        'components/listing/LocationExceptionRequestForm.client.tsx',
        'components/listing/LocationExceptionRequestTrigger.client.tsx'
    ])('%s', (file) => {
        const source = read(file);
        expect(source).toMatch(/from '@\/components\/account\/ui\/Button'/);
        expect(source).not.toMatch(/styles\.(button|primary|secondary)\b/);
    });

    it('the module no longer carries the pill recipe', () => {
        expect(read('components/listing/LocationExceptionRequest.module.css')).not.toMatch(
            /oklch\(0\.55 0\.18 145\);\s*color: #ffffff/
        );
    });
});
