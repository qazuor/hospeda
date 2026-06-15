/**
 * Tests for icon-resolver.ts and resolver.ts re-export.
 *
 * Importing ICON_MAP and resolveIcon exercises the entire module-level
 * import block (lines 19-530) under v8 coverage, providing line coverage
 * for the map literal without needing to render every component.
 */

import { describe, expect, it } from 'vitest';
import { ICON_MAP, resolveIcon } from '../src/icon-resolver';

describe('ICON_MAP', () => {
    it('is defined and is a non-null object', () => {
        // Arrange / Act / Assert
        expect(ICON_MAP).toBeDefined();
        expect(typeof ICON_MAP).toBe('object');
        expect(ICON_MAP).not.toBeNull();
    });

    it('contains amenity icon entries', () => {
        expect(ICON_MAP.WifiIcon).toBeDefined();
        expect(ICON_MAP.PoolIcon).toBeDefined();
        expect(ICON_MAP.KitchenIcon).toBeDefined();
    });

    it('contains feature icon entries', () => {
        expect(ICON_MAP.PetFriendlyIcon).toBeDefined();
        expect(ICON_MAP.EcologicalIcon).toBeDefined();
        expect(ICON_MAP.PanoramicViewIcon).toBeDefined();
    });

    it('contains entity icon entries', () => {
        expect(ICON_MAP.AccommodationIcon).toBeDefined();
        expect(ICON_MAP.EventIcon).toBeDefined();
        expect(ICON_MAP.PostIcon).toBeDefined();
    });

    it('contains booking state icon entries', () => {
        expect(ICON_MAP.AvailableIcon).toBeDefined();
        expect(ICON_MAP.CancelledIcon).toBeDefined();
        expect(ICON_MAP.ConfirmedIcon).toBeDefined();
        expect(ICON_MAP.PendingIcon).toBeDefined();
    });

    it('contains social icon entries', () => {
        expect(ICON_MAP.FacebookIcon).toBeDefined();
        expect(ICON_MAP.InstagramIcon).toBeDefined();
        expect(ICON_MAP.TwitterIcon).toBeDefined();
        expect(ICON_MAP.WhatsappIcon).toBeDefined();
    });

    it('contains communication icon entries', () => {
        expect(ICON_MAP.EmailIcon).toBeDefined();
        expect(ICON_MAP.PhoneIcon).toBeDefined();
        expect(ICON_MAP.ChatIcon).toBeDefined();
    });

    it('contains system icon entries', () => {
        expect(ICON_MAP.BuildingIcon).toBeDefined();
        expect(ICON_MAP.CompassIcon).toBeDefined();
        expect(ICON_MAP.StarIcon).toBeDefined();
    });

    it('contains attraction icon entries', () => {
        expect(ICON_MAP.MuseumIcon).toBeDefined();
        expect(ICON_MAP.BeachIcon).toBeDefined();
        expect(ICON_MAP.NatureReserveIcon).toBeDefined();
    });

    it('contains declarative system icons (CarIcon, DogIcon, MapIcon, PriceIcon)', () => {
        expect(ICON_MAP.CarIcon).toBeDefined();
        expect(ICON_MAP.DogIcon).toBeDefined();
        expect(ICON_MAP.MapIcon).toBeDefined();
        expect(ICON_MAP.PriceIcon).toBeDefined();
    });

    it('maps each value to a React component (function)', () => {
        for (const key of Object.keys(ICON_MAP)) {
            expect(typeof ICON_MAP[key]).toBe('function');
        }
    });
});

describe('resolveIcon', () => {
    it('returns the correct component for a known icon name', () => {
        // Arrange
        const iconName = 'WifiIcon';

        // Act
        const component = resolveIcon({ iconName });

        // Assert
        expect(component).toBeDefined();
        expect(component).toBe(ICON_MAP.WifiIcon);
    });

    it('returns undefined for an unknown icon name', () => {
        // Arrange
        const iconName = 'NonExistentIconXYZ';

        // Act
        const component = resolveIcon({ iconName });

        // Assert
        expect(component).toBeUndefined();
    });

    it('returns undefined for an empty string', () => {
        const component = resolveIcon({ iconName: '' });
        expect(component).toBeUndefined();
    });

    it('resolves PoolIcon correctly', () => {
        const component = resolveIcon({ iconName: 'PoolIcon' });
        expect(component).toBeDefined();
        expect(component).toBe(ICON_MAP.PoolIcon);
    });

    it('resolves AgriculturalCenterIcon (attraction) correctly', () => {
        const component = resolveIcon({ iconName: 'AgriculturalCenterIcon' });
        expect(component).toBeDefined();
    });

    it('resolves WhatsappIcon (social) correctly', () => {
        const component = resolveIcon({ iconName: 'WhatsappIcon' });
        expect(component).toBeDefined();
    });

    it('resolves CheckInIcon (booking) correctly', () => {
        const component = resolveIcon({ iconName: 'CheckInIcon' });
        expect(component).toBeDefined();
    });
});

/**
 * Covers resolver.ts line 8 (the re-export) by importing from the subpath.
 * The barrel re-exports { ICON_MAP, resolveIcon } from './icon-resolver', so
 * simply importing it under coverage execution visits that line.
 */
describe('resolver.ts re-export', () => {
    it('re-exports ICON_MAP and resolveIcon from the subpath entry', async () => {
        // Arrange: dynamic import covers the re-export line under v8
        const resolver = await import('../src/resolver');

        // Assert
        expect(resolver.ICON_MAP).toBeDefined();
        expect(typeof resolver.resolveIcon).toBe('function');
    });

    it('resolveIcon from re-export works identically to direct import', async () => {
        const resolver = await import('../src/resolver');
        const component = resolver.resolveIcon({ iconName: 'WifiIcon' });
        expect(component).toBeDefined();
        expect(component).toBe(ICON_MAP.WifiIcon);
    });
});
