import { describe, expect, it } from 'vitest';
import type { RehearsalEmailsCliDeps } from '../../cutover/cli-rehearsal-emails-main.ts';
import { runRehearsalEmailsCli } from '../../cutover/cli-rehearsal-emails-main.ts';
import type { ReadOnlyClient } from '../../cutover/known-ids.ts';
import { FOREIGN_EMAIL_RE, WHOLE_EMAIL_RE } from '../../cutover/rehearsal-email-rewrite.ts';

/**
 * G2 of HOS-1957: the rehearsal email rewrite. The CLI is driven against a simulated database
 * (no real Postgres here: the SQL itself is exercised by `cutover-db/rehearsal-copy.test.ts`).
 */

interface FakeDb {
    readonly client: ReadOnlyClient;
    readonly queries: string[];
    ended: number;
}

/** One column with `pending` rows to rewrite; the UPDATE clears them unless `stuck`. */
function fakeDb({
    name = 'hospeda_staging',
    role = 'hospeda_staging_user',
    pending = 3,
    whole = 2,
    stuck = false,
    refuseUpdate = false
}: {
    readonly name?: string;
    readonly role?: string;
    readonly pending?: number;
    readonly whole?: number;
    readonly stuck?: boolean;
    readonly refuseUpdate?: boolean;
} = {}): FakeDb {
    let left = pending;
    const db: FakeDb = {
        queries: [],
        ended: 0,
        client: {
            query: async (sql) => {
                db.queries.push(sql.trim());
                if (sql.includes('current_database()')) return { rows: [{ name, role }] };
                if (sql.includes('FROM pg_attribute')) {
                    return {
                        rows: [
                            {
                                schema_name: 'public',
                                table_name: 'users',
                                column_name: 'email',
                                column_type: 'text',
                                shape: 'scalar'
                            }
                        ]
                    };
                }
                if (sql.includes('UPDATE')) {
                    if (refuseUpdate)
                        throw Object.assign(new Error('duplicate a@b.com'), { code: '23505' });
                    const n = left;
                    if (!stuck) left = 0;
                    return { rows: [{ n }] };
                }
                if (sql.includes('AS total'))
                    return { rows: [{ whole: left === 0 ? 0 : whole, total: left }] };
                return { rows: [] };
            },
            end: async () => {
                db.ended += 1;
            }
        }
    };
    return db;
}

function harness({
    db = fakeDb(),
    session = { CUTOVER_STAGING_DATABASE_URL: 'postgres://x/y' },
    failConnect = false
}: {
    readonly db?: FakeDb;
    readonly session?: Readonly<Record<string, string | undefined>>;
    readonly failConnect?: boolean;
} = {}) {
    const outLines: string[] = [];
    const errLines: string[] = [];
    const deps = (args: readonly string[]): RehearsalEmailsCliDeps => ({
        args,
        session,
        connectDb: async () => {
            if (failConnect) throw new Error('refused');
            return db.client;
        },
        salt: () => 'salt',
        out: (line) => outLines.push(line),
        err: (line) => errLines.push(line)
    });
    return {
        db,
        outLines,
        errLines,
        run: (args: readonly string[]) => runRehearsalEmailsCli(deps(args))
    };
}

const wrote = (db: FakeDb): boolean => db.queries.some((q) => q.includes('UPDATE'));

describe('G2 email rewrite: guards refuse before any write (exit 2)', () => {
    const refusals: readonly {
        readonly title: string;
        readonly h: () => ReturnType<typeof harness>;
        readonly args: readonly string[];
    }[] = [
        { title: 'no --target', h: () => harness(), args: ['--confirm'] },
        { title: '--target=prod', h: () => harness(), args: ['--target=prod', '--confirm'] },
        { title: 'an unknown flag', h: () => harness(), args: ['--target=staging', '--yes'] },
        {
            title: 'a missing database variable',
            h: () => harness({ session: {} }),
            args: ['--target=staging', '--confirm']
        },
        {
            title: "production's database name",
            h: () => harness({ db: fakeDb({ name: 'postgres' }) }),
            args: ['--target=staging', '--confirm']
        },
        {
            title: "production's database role",
            h: () => harness({ db: fakeDb({ role: 'postgres' }) }),
            args: ['--target=staging', '--confirm']
        },
        {
            title: 'a failed connection',
            h: () => harness({ failConnect: true }),
            args: ['--target=staging', '--confirm']
        }
    ];

    for (const { title, h: build, args } of refusals) {
        it(`refuses on ${title}`, async () => {
            // Arrange
            const h = build();
            // Act
            const code = await h.run(args);
            // Assert
            expect(code).toBe(2);
            expect(wrote(h.db)).toBe(false);
        });
    }
});

describe('G2 email rewrite: runs', () => {
    it('dry run (the default) counts inside a READ ONLY transaction and writes nothing', async () => {
        // Arrange
        const h = harness();
        // Act
        const code = await h.run(['--target=staging']);
        // Assert
        expect(code).toBe(0);
        expect(h.db.queries).toContain('BEGIN READ ONLY');
        expect(wrote(h.db)).toBe(false);
        expect(h.outLines[0]).toContain('outcome=dry-run');
        expect(h.outLines[0]).toContain('rows=3 whole=2 embedded=1 remaining=3');
        expect(h.outLines[1]).toBe('  public.users.email: whole=2 embedded=1');
    });

    it('--confirm rewrites in one transaction and commits only when nothing is left', async () => {
        // Arrange
        const h = harness();
        // Act
        const code = await h.run(['--target=staging', '--confirm']);
        // Assert
        expect(code).toBe(0);
        expect(h.db.queries).toContain('BEGIN');
        expect(h.db.queries).toContain('COMMIT');
        expect(h.outLines[0]).toContain('outcome=ok');
        expect(h.outLines[0]).toContain('remaining=0');
        expect(h.db.ended).toBe(1);
    });

    it('rolls back when rows are left after the rewrite', async () => {
        // Arrange
        const h = harness({ db: fakeDb({ stuck: true }) });
        // Act
        const code = await h.run(['--target=staging', '--confirm']);
        // Assert
        expect(code).toBe(1);
        expect(h.db.queries).toContain('ROLLBACK');
        expect(h.db.queries).not.toContain('COMMIT');
    });

    it('rolls back a column the database refuses, naming the column and never the value', async () => {
        // Arrange
        const h = harness({ db: fakeDb({ refuseUpdate: true }) });
        // Act
        const code = await h.run(['--target=staging', '--confirm']);
        // Assert
        expect(code).toBe(1);
        expect(h.db.queries).not.toContain('COMMIT');
        expect(h.errLines.join('\n')).toContain('public.users.email (23505)');
        expect(h.errLines.join('\n')).not.toContain('@');
    });
});

describe('G2 email rewrite: the two patterns', () => {
    const whole = new RegExp(WHOLE_EMAIL_RE, 'i');
    const foreign = new RegExp(FOREIGN_EMAIL_RE, 'gi');

    it('treats a value that is one address as whole, and text around one as not', () => {
        // Arrange / Act / Assert
        expect(whole.test('Ana.Perez+x@Mail.example.com')).toBe(true);
        expect(whole.test('write to ana@example.com today')).toBe(false);
        expect(whole.test('not an email')).toBe(false);
    });

    it('finds deliverable addresses but never one already on the rehearsal domain', () => {
        // Arrange
        const json = '{"to":"ana@example.com","cc":["REHEARSAL@EXAMPLE.INVALID","b@x.co"]}';
        // Act
        const matches = json.match(foreign) ?? [];
        // Assert
        expect(matches).toEqual(['ana@example.com', 'b@x.co']);
        expect('rehearsal+0f1e@example.invalid'.match(foreign)).toBeNull();
    });

    it('does not let a look-alike of the rehearsal domain through', () => {
        // Arrange / Act / Assert
        expect('a@example.invalid.com'.match(foreign)).toEqual(['a@example.invalid.com']);
        expect('a@example.invalidx.org'.match(foreign)).toEqual(['a@example.invalidx.org']);
    });
});
