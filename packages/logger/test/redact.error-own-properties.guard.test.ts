/**
 * Guard: `redactSensitiveData`'s `Error` branch must project an error down to
 * `name`/`message`/`stack`/`cause` and DISCARD its own enumerable properties.
 *
 * ## Why this is load-bearing, and why it was not pinned before
 *
 * HOS-1174 made `@repo/db`'s `DbError` carry the caught driver error as its
 * `cause`, so the chain that reaches every log line now ends in a pg
 * `DatabaseError`. That object's own enumerable properties include `detail`,
 * which embeds the OFFENDING VALUE of the failing row — `Key
 * (email)=(alice@example.com) already exists.` — alongside `hint`, `where` and
 * the bound `params`. None of that is schema metadata; it is row data, and
 * `redactSensitiveData` only masks known PII PATTERNS (email, phone, card,
 * SSN, IP, JWT, CUIT), so a raw DNI, a person's name or a street address
 * embedded in `detail` would go out unmasked.
 *
 * The only thing stopping that today is that the `Error` branch returns a
 * fixed projection instead of enumerating the object. Nothing pinned that
 * behaviour, and the appetite to change it already exists in the repo:
 * `packages/service-core/src/utils/logging.ts` deliberately reaches INTO the
 * cause to lift `code`/`constraint`/`table` because they are wanted in logs.
 * "We are losing the SQLSTATE, let's just spread the error's own properties"
 * is a one-line edit that would turn on a PII leak for the whole repo with CI
 * silent. This guard is what makes that edit fail.
 *
 * It deliberately asserts on ARBITRARY property names, not on `detail`: the
 * property is the projection itself, not a blocklist of known-bad keys.
 */

import { describe, expect, it } from 'vitest';
import { redactSensitiveData } from '../src/redact.js';

describe('redactSensitiveData discards an Error’s own enumerable properties', () => {
    it('keeps only name, message and stack for an error carrying extra fields', () => {
        // Arrange
        const error = Object.assign(new Error('something failed'), {
            detail: 'Key (national_id)=(30123456) already exists.',
            hint: 'consider an upsert',
            where: 'PL/pgSQL function do_thing() line 3',
            params: ['Juan Perez', 'Calle Falsa 123'],
            internalQuery: 'select * from users where national_id = $1'
        });

        // Act
        const redacted = redactSensitiveData(error) as Record<string, unknown>;

        // Assert
        expect(Object.keys(redacted).sort()).toEqual(['message', 'name', 'stack']);
        expect(redacted.message).toBe('something failed');
    });

    it('does not let an error’s own property reach the serialized output', () => {
        // Arrange — none of these values match a known PII pattern, so the
        // pattern-based masking would NOT save us if they were emitted.
        const error = Object.assign(new Error('insert failed'), {
            detail: 'Key (full_name)=(Juan Perez) already exists.',
            arbitraryField: 'Calle Falsa 123, Concepcion del Uruguay'
        });

        // Act
        const serialized = JSON.stringify(redactSensitiveData(error));

        // Assert
        expect(serialized).not.toContain('Juan Perez');
        expect(serialized).not.toContain('Calle Falsa 123');
        expect(serialized).not.toContain('arbitraryField');
        expect(serialized).not.toContain('detail');
    });

    it('applies the same projection at EVERY depth of the cause chain', () => {
        // Arrange — the exact shape HOS-1174 now produces:
        // DbError -> DrizzleQueryError -> pg.DatabaseError.
        const driverError = Object.assign(
            new Error('duplicate key value violates unique constraint "users_email_unique"'),
            {
                code: '23505',
                constraint: 'users_email_unique',
                detail: 'Key (national_id)=(30123456) already exists.'
            }
        );
        const drizzleError = Object.assign(new Error('Failed query: insert into "users" ...'), {
            query: 'insert into "users" ...',
            params: ['30123456'],
            cause: driverError
        });
        const dbError = Object.assign(new Error('Failed query: insert into "users" ...'), {
            entity: 'user',
            cause: drizzleError
        });

        // Act
        const redacted = redactSensitiveData(dbError) as Record<string, unknown>;
        const serialized = JSON.stringify(redacted);

        // Assert — the cause is followed (so a failure is still diagnosable),
        // but no link contributes its own properties.
        expect(redacted.cause).toBeDefined();
        expect(serialized).not.toContain('30123456');
        expect(serialized).not.toContain('already exists.');
        // The pg error's MESSAGE survives and mentions the constraint — that is
        // schema metadata and is wanted. What must not survive is its own
        // `constraint`/`detail`/`params` FIELDS, which the key checks below pin.
        const depth1 = redacted.cause as Record<string, unknown>;
        expect(Object.keys(depth1).sort()).toEqual(['cause', 'message', 'name', 'stack']);
        const depth2 = depth1.cause as Record<string, unknown>;
        expect(Object.keys(depth2).sort()).toEqual(['message', 'name', 'stack']);
    });

    it('still follows `cause` — the projection must not flatten the chain away', () => {
        // Arrange
        const root = new Error('root cause');
        const wrapper = new Error('wrapper', { cause: root });

        // Act
        const redacted = redactSensitiveData(wrapper) as Record<string, unknown>;

        // Assert
        expect((redacted.cause as Record<string, unknown>).message).toBe('root cause');
    });
});
