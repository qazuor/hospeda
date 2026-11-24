/**
 * Owner conversation thread page: inquiry summary header (HOS-2534).
 *
 * `.astro` files cannot be rendered by vitest in this repo (see
 * `test/components/listing/location/LocationSection.test.ts`), so the page
 * wiring is asserted at the source level. What the header SAYS, with and
 * without data, is executed for real in `test/lib/format-inquiry-summary.test.ts`;
 * here we prove the page feeds it the stored columns and only renders the
 * block when there is a summary.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(
    resolve(
        __dirname,
        '../../src/pages/[lang]/mi-cuenta/consultas-propietario/[conversationId].astro'
    ),
    'utf8'
);

describe('owner thread page inquiry header', () => {
    it('builds the summary from the conversation columns', () => {
        expect(SOURCE).toContain(
            "import { formatInquirySummary } from '@/lib/format-inquiry-summary'"
        );
        expect(SOURCE).toContain('checkIn: conversation.checkIn');
        expect(SOURCE).toContain('checkOut: conversation.checkOut');
        expect(SOURCE).toContain('guests: conversation.guests');
    });

    it('shows the summary in the page header description only when it exists', () => {
        expect(SOURCE).toContain('if (inquirySummary) headerDescription =');
        expect(SOURCE).toContain('description={headerDescription}');
    });
});
