/**
 * @file venue_event.dbschema.test.ts
 * @description HOS-2255: `venue_events` carries a nullable `ticket_url` text
 * column, and the migration that adds it is the only SQL touching it.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { venueEvents } from '../../src/schemas/venue/venue_event.dbschema.ts';

describe('venue_events.ticket_url (HOS-2255)', () => {
    it('is a nullable text column without default', () => {
        const column = getTableConfig(venueEvents).columns.find((c) => c.name === 'ticket_url');

        expect(column).toBeDefined();
        expect(column?.dataType).toBe('string');
        expect(column?.notNull).toBe(false);
        expect(column?.hasDefault).toBe(false);
    });

    it('is added by a single ADD COLUMN migration', () => {
        const sql = readFileSync(
            resolve(__dirname, '../../src/migrations/0238_hos2255_venue_event_ticket_url.sql'),
            'utf8'
        );

        expect(sql.trim()).toBe('ALTER TABLE "venue_events" ADD COLUMN "ticket_url" text;');
    });
});
