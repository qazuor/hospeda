import { VenueTypeEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import enAdmin from '../src/locales/en/admin-entities.json';
import enVenue from '../src/locales/en/venue.json';
import esAdmin from '../src/locales/es/admin-entities.json';
import esVenue from '../src/locales/es/venue.json';
import ptAdmin from '../src/locales/pt/admin-entities.json';
import ptVenue from '../src/locales/pt/venue.json';

const locales = [
    { name: 'es', venue: esVenue, admin: esAdmin.venue },
    { name: 'en', venue: enVenue, admin: enAdmin.venue },
    { name: 'pt', venue: ptVenue, admin: ptAdmin.venue }
];

describe('venue type translations', () => {
    it('provides labels and descriptions for every venue type in every locale', () => {
        for (const locale of locales) {
            for (const type of Object.values(VenueTypeEnum)) {
                expect(locale.venue.types[type], `${locale.name} venue.types.${type}`).toBeTruthy();
                expect(
                    locale.venue.typeDescriptions[type],
                    `${locale.name} venue.typeDescriptions.${type}`
                ).toBeTruthy();
                expect(
                    locale.admin.types[type],
                    `${locale.name} admin venue.types.${type}`
                ).toBeTruthy();
                expect(
                    locale.admin.typeDescriptions[type],
                    `${locale.name} admin venue.typeDescriptions.${type}`
                ).toBeTruthy();
            }
        }
    });
});
