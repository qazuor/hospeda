/**
 * Acceptance tests — Inicio sidebar (AC-23, AC-24) and deferred roles (AC-14)
 * Tasks: T-035 (deferred roles), T-033/T-034 (Inicio sidebar items)
 *
 * AC-23: validatedConfig.sidebars.inicioSidebar.items has exactly 2 items:
 *        a 'dashboard' link and an 'inbox' link labeled "Mi inbox (beta)".
 * AC-24: the inbox item's route === '/notifications'.
 * AC-14: SPONSOR.enabled === false and CLIENT_MANAGER.enabled === false.
 */

import { validatedConfig } from '@/config/ia/validate';
import { RoleEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// AC-23 + AC-24 — Inicio sidebar structure
// ---------------------------------------------------------------------------

describe('AC-23/24 — inicioSidebar structure', () => {
    it('inicioSidebar has exactly 2 items', () => {
        // Arrange
        const sidebar = validatedConfig.sidebars.inicioSidebar;

        // Act
        const itemCount = sidebar.items.length;

        // Assert
        expect(itemCount).toBe(2);
    });

    it('first item is a link with id "dashboard"', () => {
        // Arrange
        const sidebar = validatedConfig.sidebars.inicioSidebar;

        // Act
        const firstItem = sidebar.items[0];

        // Assert
        expect(firstItem).toBeDefined();
        expect(firstItem?.type).toBe('link');
        expect(firstItem?.id).toBe('dashboard');
    });

    it('second item is a link with id "inbox" labeled "Mi inbox (beta)" in Spanish', () => {
        // Arrange
        const sidebar = validatedConfig.sidebars.inicioSidebar;

        // Act
        const secondItem = sidebar.items[1];

        // Assert
        expect(secondItem).toBeDefined();
        expect(secondItem?.type).toBe('link');
        expect(secondItem?.id).toBe('inbox');
        // Verify the Spanish label (AC-23)
        expect(secondItem?.type === 'link' ? secondItem.label.es : undefined).toBe(
            'Mi inbox (beta)'
        );
    });

    it('AC-24 — inbox item route is "/notifications"', () => {
        // Arrange
        const sidebar = validatedConfig.sidebars.inicioSidebar;
        const inboxItem = sidebar.items[1];

        // Act
        const route = inboxItem?.type === 'link' ? inboxItem.route : undefined;

        // Assert
        expect(route).toBe('/notifications');
    });

    it('inbox item has English label "My inbox (beta)"', () => {
        // Arrange
        const sidebar = validatedConfig.sidebars.inicioSidebar;
        const inboxItem = sidebar.items[1];

        // Act / Assert
        expect(inboxItem?.type === 'link' ? inboxItem.label.en : undefined).toBe('My inbox (beta)');
    });

    it('both items are link type — no groups or separators in inicioSidebar', () => {
        // Arrange
        const sidebar = validatedConfig.sidebars.inicioSidebar;

        // Act
        const allLinks = sidebar.items.every((item) => item.type === 'link');

        // Assert
        expect(allLinks).toBe(true);
    });

    it('dashboard item has route "/dashboard"', () => {
        // Arrange
        const sidebar = validatedConfig.sidebars.inicioSidebar;
        const dashboardItem = sidebar.items[0];

        // Act
        const route = dashboardItem?.type === 'link' ? dashboardItem.route : undefined;

        // Assert
        expect(route).toBe('/dashboard');
    });
});

// ---------------------------------------------------------------------------
// AC-14 — Deferred roles
// ---------------------------------------------------------------------------

describe('AC-14 — deferred roles config flags', () => {
    it(`${RoleEnum.SPONSOR} role is disabled (enabled === false)`, () => {
        // Arrange
        const sponsorRole = validatedConfig.roles[RoleEnum.SPONSOR];

        // Act / Assert
        expect(sponsorRole).toBeDefined();
        expect(sponsorRole?.enabled).toBe(false);
    });

    it(`${RoleEnum.CLIENT_MANAGER} role is disabled (enabled === false)`, () => {
        // Arrange
        const clientManagerRole = validatedConfig.roles[RoleEnum.CLIENT_MANAGER];

        // Act / Assert
        expect(clientManagerRole).toBeDefined();
        expect(clientManagerRole?.enabled).toBe(false);
    });

    it(`${RoleEnum.SPONSOR} role has no mainMenu (deferred roles omit nav fields)`, () => {
        // Arrange
        const sponsorRole = validatedConfig.roles[RoleEnum.SPONSOR];

        // Act / Assert
        // mainMenu is optional on disabled roles per RoleConfigSchema
        expect(sponsorRole?.mainMenu).toBeUndefined();
    });

    it(`${RoleEnum.CLIENT_MANAGER} role has no mainMenu (deferred roles omit nav fields)`, () => {
        // Arrange
        const clientManagerRole = validatedConfig.roles[RoleEnum.CLIENT_MANAGER];

        // Act / Assert
        expect(clientManagerRole?.mainMenu).toBeUndefined();
    });

    it(`${RoleEnum.SPONSOR} has a label defined even though deferred`, () => {
        // Arrange
        const sponsorRole = validatedConfig.roles[RoleEnum.SPONSOR];

        // Act / Assert
        expect(sponsorRole?.label).toBeDefined();
        expect(sponsorRole?.label.es).toBe('Sponsor');
    });

    it(`${RoleEnum.CLIENT_MANAGER} has a label defined even though deferred`, () => {
        // Arrange
        const clientManagerRole = validatedConfig.roles[RoleEnum.CLIENT_MANAGER];

        // Act / Assert
        expect(clientManagerRole?.label).toBeDefined();
        expect(clientManagerRole?.label.es).toBe('Client manager');
    });

    it('config validates successfully — both deferred roles pass schema (boot does not crash)', () => {
        /**
         * If validatedConfig is importable (module load did not throw), the schema
         * allows disabled roles without nav fields. This test asserts that by
         * verifying the config object exists and has the expected roles.
         */
        // Arrange / Act / Assert
        expect(validatedConfig).toBeDefined();
        expect(validatedConfig.roles[RoleEnum.SPONSOR]).toBeDefined();
        expect(validatedConfig.roles[RoleEnum.CLIENT_MANAGER]).toBeDefined();
    });
});
