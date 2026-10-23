/**
 * @file eventos-nuevo-no-access.i18n.test.ts
 * @description Source-level translations for the account event no-access states
 * (HOS-1767, TEST:1767:23 and TEST:1767:26).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const LOCALES = ['es', 'en', 'pt'] as const;

interface NoAccessCopy {
    readonly title: string;
    readonly description: string;
    readonly cta: string;
}

interface AccountJson {
    readonly myContent: {
        readonly events: {
            readonly create: {
                readonly noAccess?: NoAccessCopy;
            };
            readonly noAccess?: NoAccessCopy;
        };
    };
}

function readAccountJson({ locale }: { readonly locale: (typeof LOCALES)[number] }): AccountJson {
    return JSON.parse(
        readFileSync(
            resolve(__dirname, `../../../../packages/i18n/src/locales/${locale}/account.json`),
            'utf8'
        )
    ) as AccountJson;
}

function expectCopy({
    copy,
    id
}: {
    readonly copy: NoAccessCopy | undefined;
    readonly id: string;
}) {
    expect(copy, `${id} is missing`).toBeDefined();
    expect(copy?.title.trim().length).toBeGreaterThan(0);
    expect(copy?.description.trim().length).toBeGreaterThan(0);
    expect(copy?.cta.trim().length).toBeGreaterThan(0);
}

describe('account event no-access copy (HOS-1767)', () => {
    it.each(LOCALES)('TEST:1767:23 — %s has the create-page copy', (locale) => {
        expectCopy({
            copy: readAccountJson({ locale }).myContent.events.create.noAccess,
            id: 'account.myContent.events.create.noAccess'
        });
    });

    it.each(LOCALES)('TEST:1767:26 — %s has the neutral list/editor copy', (locale) => {
        expectCopy({
            copy: readAccountJson({ locale }).myContent.events.noAccess,
            id: 'account.myContent.events.noAccess'
        });
    });
});
