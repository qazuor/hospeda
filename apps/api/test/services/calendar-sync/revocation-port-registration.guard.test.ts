/**
 * HOS-663 — static guard: the revocation adapter is actually registered.
 *
 * The port/adapter split has three pieces and only two of them were tested.
 * `service-core` declares the port and falls back to
 * `{ revoked: false, reason: 'no revocation adapter registered' }` when nothing
 * is registered; `apps/api` implements the adapter. The wire between them is a
 * single call in `apps/api/src/index.ts`, and if it goes missing NOTHING fails:
 * the cascade keeps working, the delete succeeds, every unit test stays green,
 * and every single grant is quietly left open with a stamped row nobody is
 * watching. A missing registration degrades exactly like a provider with no
 * revocation endpoint, which is the one failure mode designed to look normal.
 *
 * `index.ts` cannot be imported here — it boots the server on import — so this
 * reads the source. It anchors on the two SYMBOLS rather than on a formatted
 * line, so Biome reflowing the call cannot break it, and a rename of either
 * symbol fails the typecheck at the real call site as well as here.
 *
 * @module test/services/calendar-sync/revocation-port-registration.guard
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const INDEX_PATH = resolve(HERE, '../../../src/index.ts');
const ADAPTER_PATH = resolve(
    HERE,
    '../../../src/services/calendar-sync/calendar-connection-revocation.adapter.ts'
);

const SETTER = 'setCalendarConnectionRevocationPort';
const ADAPTER = 'calendarConnectionRevocationAdapter';

describe('HOS-663 — the revocation port is wired at API startup', () => {
    const indexSource = readFileSync(INDEX_PATH, 'utf8');

    it('imports the setter from @repo/service-core', () => {
        expect(indexSource).toContain(SETTER);
        // The import block is the one place it can come from.
        expect(indexSource).toMatch(
            new RegExp(
                `import\\s*\\{[^}]*\\b${SETTER}\\b[^}]*\\}\\s*from\\s*'@repo/service-core'`,
                's'
            )
        );
    });

    it('imports the concrete adapter from the calendar-sync module', () => {
        expect(indexSource).toMatch(
            new RegExp(
                `import\\s*\\{[^}]*\\b${ADAPTER}\\b[^}]*\\}\\s*from\\s*'\\./services/calendar-sync/calendar-connection-revocation\\.adapter'`,
                's'
            )
        );
    });

    it('CALLS the setter with the adapter — importing it is not wiring it', () => {
        // Whitespace-tolerant so a reformat cannot fail this, but it does
        // require the adapter to be the argument: `setCalendar...Port(undefined)`
        // would import both symbols and register nothing.
        expect(indexSource).toMatch(new RegExp(`${SETTER}\\s*\\(\\s*${ADAPTER}\\s*\\)`));
    });

    it('the adapter module actually exports that symbol', () => {
        // Closes the other half: the guard above proves index.ts names it, this
        // proves the name resolves to something real rather than to a stale
        // identifier a rename left behind.
        const adapterSource = readFileSync(ADAPTER_PATH, 'utf8');
        expect(adapterSource).toMatch(new RegExp(`export\\s+const\\s+${ADAPTER}\\b`));
    });
});
