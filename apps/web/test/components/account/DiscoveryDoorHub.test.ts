/**
 * @file DiscoveryDoorHub.test.ts
 * @description Source-level tests for the shared discovery-door hub component
 * (HOS-131 §6.2/§6.3) — Astro components can't render in Vitest, so this
 * asserts on the source (imports, per-state branches, i18n keys) plus
 * engine-level coverage of the state resolution it wires to
 * `resolveDoorOptionState`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';

import { ACCOUNT_DISCOVERY_DOORS } from '../../../src/config/discovery-doors';
import { isVisibleByRole, resolveDoorOptionState } from '../../../src/lib/nav-gating';

const source = readFileSync(
    resolve(__dirname, '../../../src/components/account/DiscoveryDoorHub.astro'),
    'utf8'
);

describe('DiscoveryDoorHub.astro — wiring', () => {
    it('resolves per-option state via resolveDoorOptionState + isVisibleByRole (HOS-131 D-4, server-side role approximation)', () => {
        expect(source).toContain(
            "import { isVisibleByRole, resolveDoorOptionState } from '@/lib/nav-gating';"
        );
        expect(source).toContain('resolveDoorOptionState({ option, visibility })');
    });

    it('renders all three per-option states: acquired, comingSoon, unacquired', () => {
        expect(source).toContain("state === 'acquired'");
        expect(source).toContain("state === 'comingSoon'");
        expect(source).toContain("state === 'unacquired'");
    });

    it('shows a "Gestionar" button linking option.manageHref (falling back to the door href) when acquired', () => {
        expect(source).toContain("t('account.doors.common.manageCta')");
        expect(source).toContain('option.manageHref ?? door.href');
    });

    it('resolves the manage href to the absolute adminUrl for a managesInAdminPanel acquired option, and hides the Gestionar button entirely when adminUrl is unset (HOS-134)', () => {
        expect(source).toContain('readonly adminUrl?: string;');
        // manageHref is computed once per acquired option: absolute adminUrl for
        // managesInAdminPanel, else the relative built href.
        expect(source).toContain('option.managesInAdminPanel');
        expect(source).toContain('? adminUrl');
        expect(source).toContain('buildUrl({ locale, path: option.manageHref ?? door.href })');
        // The button only renders when a href resolved — no self-referential
        // link when adminUrl is undefined.
        expect(source).toContain('manageHref && (');
    });

    it('shows a "Próximamente" badge for comingSoon options', () => {
        expect(source).toContain("t('account.doors.common.comingSoonBadge')");
    });

    it('reads the comingSoon CTA label from option.ctaI18nKey, not a hardcoded key (avoids drift with the config)', () => {
        const comingSoonBranch = source.slice(
            source.indexOf("state === 'comingSoon'"),
            source.indexOf("state === 'unacquired'")
        );
        expect(comingSoonBranch).toContain('t(option.ctaI18nKey)');
        expect(comingSoonBranch).not.toContain("t('account.doors.common.contactCta')");
    });

    it('shows the acquire CTA (option.ctaI18nKey) for unacquired options', () => {
        expect(source).toContain('t(option.ctaI18nKey)');
    });

    it('renders the door subtitle and every option title/description via i18n, never hardcoded text', () => {
        expect(source).toContain('t(door.subtitleI18nKey)');
        expect(source).toContain('t(option.i18nKey)');
        expect(source).toContain('t(option.descriptionI18nKey)');
    });
});

describe('DiscoveryDoorHub — per-option state resolution (engine integration)', () => {
    const listing = ACCOUNT_DISCOVERY_DOORS.find((door) => door.id === 'listing');
    const partner = ACCOUNT_DISCOVERY_DOORS.find((door) => door.id === 'partner');

    it('resolves "accommodation" to acquired for a HOST role, unacquired for a plain USER', () => {
        const accommodation = listing?.options.find((option) => option.id === 'accommodation');
        expect(accommodation).toBeDefined();
        if (!accommodation) return;

        expect(
            resolveDoorOptionState({
                option: accommodation,
                visibility: (node) => isVisibleByRole(node, RoleEnum.HOST)
            })
        ).toBe('acquired');
        expect(
            resolveDoorOptionState({
                option: accommodation,
                visibility: (node) => isVisibleByRole(node, RoleEnum.USER)
            })
        ).toBe('unacquired');
    });

    it('resolves "gastronomy" and "experience" to acquired for a COMMERCE_OWNER role, unacquired for a HOST (HOS-134)', () => {
        const gastronomy = listing?.options.find((option) => option.id === 'gastronomy');
        const experience = listing?.options.find((option) => option.id === 'experience');
        expect(gastronomy).toBeDefined();
        expect(experience).toBeDefined();
        if (!gastronomy || !experience) return;

        for (const option of [gastronomy, experience]) {
            expect(
                resolveDoorOptionState({
                    option,
                    visibility: (node) => isVisibleByRole(node, RoleEnum.COMMERCE_OWNER)
                })
            ).toBe('acquired');
            expect(
                resolveDoorOptionState({
                    option,
                    visibility: (node) => isVisibleByRole(node, RoleEnum.HOST)
                })
            ).toBe('unacquired');
        }
    });

    it('resolves the three placeholder partner-door options to comingSoon regardless of role (NG-2, no acquiredPermission exists)', () => {
        const placeholders = partner?.options.filter((option) => option.id !== 'editor') ?? [];
        for (const option of placeholders) {
            expect(
                resolveDoorOptionState({
                    option,
                    visibility: (node) => isVisibleByRole(node, RoleEnum.ADMIN)
                })
            ).toBe('comingSoon');
        }
    });

    it('resolves "editor" to acquired for an EDITOR role, unacquired for a plain USER (HOS-134)', () => {
        const editor = partner?.options.find((option) => option.id === 'editor');
        expect(editor).toBeDefined();
        if (!editor) return;

        expect(
            resolveDoorOptionState({
                option: editor,
                visibility: (node) => isVisibleByRole(node, RoleEnum.EDITOR)
            })
        ).toBe('acquired');
        expect(
            resolveDoorOptionState({
                option: editor,
                visibility: (node) => isVisibleByRole(node, RoleEnum.USER)
            })
        ).toBe('unacquired');
    });

    it('resolves both listing-door options to acquired for platform staff (ADMIN)', () => {
        for (const option of listing?.options ?? []) {
            expect(
                resolveDoorOptionState({
                    option,
                    visibility: (node) => isVisibleByRole(node, RoleEnum.ADMIN)
                })
            ).toBe('acquired');
        }
    });
});

describe('DiscoveryDoorHub — sanity guard against a stray permission enum', () => {
    it('every acquirable option in ACCOUNT_DISCOVERY_DOORS declares a real PermissionEnum member', () => {
        const permissionValues = new Set(Object.values(PermissionEnum));
        for (const door of ACCOUNT_DISCOVERY_DOORS) {
            for (const option of door.options) {
                if (option.acquiredPermission) {
                    expect(permissionValues.has(option.acquiredPermission)).toBe(true);
                }
            }
        }
    });
});
