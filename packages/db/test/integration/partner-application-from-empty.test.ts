import { RoleEnum } from '@repo/schemas';
import type { PoolClient } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { closeTestPool, getTestPool } from './helpers.ts';

afterAll(closeTestPool);
type PgError = { code?: string; constraint?: string; message?: string };

async function inRollback(
    run: (
        client: PoolClient,
        attempt: (sql: string, params?: unknown[]) => Promise<PgError | null>
    ) => Promise<void>
) {
    const client = await getTestPool().connect();
    try {
        await client.query('BEGIN');
        const attempt = async (statement: string, params: unknown[] = []) => {
            await client.query('SAVEPOINT attempt');
            try {
                await client.query(statement, params);
                await client.query('RELEASE SAVEPOINT attempt');
                return null;
            } catch (error) {
                await client.query('ROLLBACK TO SAVEPOINT attempt');
                return error as PgError;
            }
        };
        await run(client, attempt);
    } finally {
        await client.query('ROLLBACK');
        client.release();
    }
}

const APP_INSERT = `INSERT INTO partner_application (email, status, resolved_at, partner_id, wait_cancelled_at, wait_cancelled_by, deadlines_version)
    VALUES ($1, $2, $3, $4, $5, $6, $7)`;

async function newUser(client: PoolClient, slug: string): Promise<string> {
    const result = await client.query<{ id: string }>(
        'INSERT INTO users (slug, display_name, email) VALUES ($1, $2, $3) RETURNING id',
        [slug, slug, `${slug}@example.test`]
    );
    return result.rows[0]!.id;
}

async function rejected(
    client: PoolClient,
    email: string,
    ageDays: number,
    version: number | null,
    cancelled = false,
    by: string | null = null
) {
    return client.query(APP_INSERT, [
        email,
        'REJECTED',
        new Date(Date.now() - ageDays * 86_400_000),
        null,
        cancelled ? new Date() : null,
        by,
        version
    ]);
}

describe('TEST:V6:32 — partner application and V7 schema from empty', () => {
    it('TEST:V6:32 has the exact application columns, enum, defaults, checks, and case-insensitive pending index', async () => {
        const pool = getTestPool();
        const columns = await pool.query<{
            column_name: string;
            is_nullable: string;
            column_default: string | null;
        }>(
            `SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'partner_application' ORDER BY column_name`
        );
        expect(columns.rows.map((r) => r.column_name)).toEqual([
            'created_at',
            'deadlines_version',
            'email',
            'id',
            'partner_id',
            'resolved_at',
            'status',
            'updated_at',
            'wait_cancelled_at',
            'wait_cancelled_by'
        ]);
        const byName = Object.fromEntries(columns.rows.map((row) => [row.column_name, row]));
        expect(byName.email).toMatchObject({ is_nullable: 'NO' });
        expect(byName.status).toMatchObject({ is_nullable: 'NO' });
        expect(byName.status?.column_default).toContain('PENDING');
        expect(byName.resolved_at?.is_nullable).toBe('YES');
        expect(byName.partner_id?.is_nullable).toBe('YES');
        expect(byName.deadlines_version?.is_nullable).toBe('YES');
        const labels = await pool.query<{ enumlabel: string }>(
            `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='partner_application_status_enum' ORDER BY e.enumsortorder`
        );
        expect(labels.rows.map((r) => r.enumlabel)).toEqual(['PENDING', 'APPROVED', 'REJECTED']);
        const index = await pool.query<{ indexdef: string }>(
            `SELECT indexdef FROM pg_indexes WHERE indexname='uq_partner_application_pending_email'`
        );
        expect(index.rows[0]?.indexdef).toContain('lower(email)');
        expect(index.rows[0]?.indexdef).toContain(
            "WHERE (status = 'PENDING'::partner_application_status_enum)"
        );
        const checks = await pool.query<{ conname: string; def: string }>(
            `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid='partner_application'::regclass`
        );
        const byConstraint = Object.fromEntries(checks.rows.map((row) => [row.conname, row.def]));
        expect(byConstraint.ck_partner_application_partner_iff_approved).toContain(
            'partner_id IS NOT NULL'
        );
        expect(byConstraint.ck_partner_application_wait_cancel_pair).toContain(
            'wait_cancelled_by IS NULL'
        );
    });

    it('TEST:V6:32 enforces pending uniqueness and the approved-partner CHECK, while allowing a resolved retry', async () => {
        await inRollback(async (client, attempt) => {
            const userId = await newUser(client, 'v611-app-owner');
            const partner = await client.query<{ id: string }>(
                "INSERT INTO partners (slug,name,type,owner_user_id) VALUES ('v611-app-partner','App partner','business',$1) RETURNING id",
                [userId]
            );
            expect(
                await attempt('INSERT INTO partner_application (email) VALUES ($1)', [
                    'Ana@Ejemplo.com'
                ])
            ).toBeNull();
            expect(
                await attempt('INSERT INTO partner_application (email) VALUES ($1)', [
                    'ana@ejemplo.com'
                ])
            ).toMatchObject({
                code: '23505',
                constraint: 'uq_partner_application_pending_email'
            });
            await client.query(
                "UPDATE partner_application SET status='REJECTED', resolved_at=now(), wait_cancelled_at=now() WHERE lower(email)=lower('Ana@Ejemplo.com')"
            );
            expect(
                await attempt('INSERT INTO partner_application (email) VALUES ($1)', [
                    'ana@ejemplo.com'
                ])
            ).toBeNull();
            expect(
                await attempt(
                    "INSERT INTO partner_application (email,status) VALUES ('bad-approved@example.test','APPROVED')"
                )
            ).toMatchObject({
                code: '23514',
                constraint: 'ck_partner_application_partner_iff_approved'
            });
            expect(
                await attempt(
                    "INSERT INTO partner_application (email,status,partner_id) VALUES ('bad-pending@example.test','PENDING',$1)",
                    [partner.rows[0]!.id]
                )
            ).toMatchObject({
                code: '23514',
                constraint: 'ck_partner_application_partner_iff_approved'
            });
            expect(
                await attempt(
                    "INSERT INTO partner_application (email,status,partner_id) VALUES ('bad-rejected@example.test','REJECTED',$1)",
                    [partner.rows[0]!.id]
                )
            ).toMatchObject({
                code: '23514',
                constraint: 'ck_partner_application_partner_iff_approved'
            });
            expect(
                await attempt(
                    "INSERT INTO partner_application (email,wait_cancelled_by) VALUES ('bad-pair@example.test',$1)",
                    [userId]
                )
            ).toMatchObject({
                code: '23514',
                constraint: 'ck_partner_application_wait_cancel_pair'
            });
            expect(
                await attempt(
                    "INSERT INTO partner_application (email,status,partner_id) VALUES ('approved@example.test','APPROVED',$1)",
                    [partner.rows[0]!.id]
                )
            ).toBeNull();
        });
    });

    it('TEST:V6:32 rejects an active rejection wait using the saved/current PLAZO:9 and fails closed when missing', async () => {
        await inRollback(async (client, attempt) => {
            const userId = await newUser(client, 'v611-app-canceller');
            await rejected(client, 'recent@example.test', 1, 1);
            expect(
                await attempt('INSERT INTO partner_application(email) VALUES ($1)', [
                    'RECENT@example.test'
                ])
            ).toMatchObject({
                code: 'P0001',
                message: expect.stringContaining('partner_application_wait_active')
            });
            await rejected(client, 'expired@example.test', 31, 1);
            expect(
                await attempt('INSERT INTO partner_application(email) VALUES ($1)', [
                    'expired@example.test'
                ])
            ).toBeNull();
            await rejected(client, 'cancelled@example.test', 1, 1, true, userId);
            expect(
                await attempt('INSERT INTO partner_application(email) VALUES ($1)', [
                    'cancelled@example.test'
                ])
            ).toBeNull();

            await client.query(
                `INSERT INTO vertical_deadline_version(version, "values") VALUES (2, '{"9":{"days":1}}')`
            );
            await rejected(client, 'saved-v1@example.test', 2, 1);
            expect(
                await attempt('INSERT INTO partner_application(email) VALUES ($1)', [
                    'saved-v1@example.test'
                ])
            ).toMatchObject({ code: 'P0001' });
            await rejected(client, 'current-v2@example.test', 2, null);
            expect(
                await attempt('INSERT INTO partner_application(email) VALUES ($1)', [
                    'current-v2@example.test'
                ])
            ).toBeNull();
            await rejected(client, 'missing-version@example.test', 1, 999);
            expect(
                await attempt('INSERT INTO partner_application(email) VALUES ($1)', [
                    'missing-version@example.test'
                ])
            ).toMatchObject({ code: 'P0001' });
        });
        const triggers = await getTestPool().query<{
            tgname: string;
            tgenabled: string;
            def: string;
        }>(
            `SELECT tgname, tgenabled, pg_get_triggerdef(oid) AS def FROM pg_trigger WHERE tgrelid='partner_application'::regclass AND NOT tgisinternal`
        );
        expect(triggers.rows).toHaveLength(1);
        expect(triggers.rows[0]).toMatchObject({
            tgname: 'partner_application_wait_active',
            tgenabled: 'O'
        });
        expect(triggers.rows[0]?.def).toContain('BEFORE INSERT');
    });

    it('TEST:V6:32 adds partner moderation and claim fields, the role, and leaves alliance_leads columns unchanged', async () => {
        const pool = getTestPool();
        const partnerColumns = await pool.query<{
            column_name: string;
            is_nullable: string;
            column_default: string | null;
        }>(
            `SELECT column_name,is_nullable,column_default FROM information_schema.columns WHERE table_name='partners' AND column_name IN ('presence_moderated','claim_secret_hash')`
        );
        expect(partnerColumns.rows).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ column_name: 'presence_moderated', is_nullable: 'NO' }),
                expect.objectContaining({ column_name: 'claim_secret_hash', is_nullable: 'YES' })
            ])
        );
        expect(
            partnerColumns.rows.find((r) => r.column_name === 'presence_moderated')?.column_default
        ).toContain('false');
        const role = await pool.query(
            `SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='role_enum' AND e.enumlabel='PARTNER_OWNER'`
        );
        expect(role.rowCount).toBe(1);
        expect(Object.values(RoleEnum)).toContain('PARTNER_OWNER');
        const leadColumns = await pool.query<{ column_name: string }>(
            `SELECT column_name FROM information_schema.columns WHERE table_name='alliance_leads' ORDER BY ordinal_position`
        );
        expect(leadColumns.rows.map((r) => r.column_name)).toEqual([
            'id',
            'kind',
            'contact_name',
            'email',
            'phone',
            'message',
            'status',
            'admin_note',
            'ops_notified_at',
            'business_name',
            'partner_type',
            'category',
            'destination_id',
            'benefit_type',
            'benefit_value',
            'benefit_text',
            'provisioned_host_trade_id',
            'provisioned_partner_id',
            'applicant_user_id',
            'claim_token',
            'claim_expires_at',
            'created_at',
            'updated_at',
            'deleted_at',
            'created_by_id',
            'updated_by_id',
            'deleted_by_id'
        ]);
    });
});
