import { describe, expect, it } from 'vitest';
import {
    findForbiddenNotificationMentions,
    NOTIFICATION_WRITER_FILES
} from '../check-decision-rereads-notification-writes.js';
import { maskSource } from '../payments-guard-scan.js';

const [SCHEMA, MODEL] = NOTIFICATION_WRITER_FILES;
const TABLE = ['provider', 'notification'].join('_');
const IDENTIFIER = ['provider', 'Notification'].join('');

function forbidden(file: string, source: string): readonly string[] {
    return findForbiddenNotificationMentions({ file, masked: maskSource({ source }) }).map(
        ({ mention }) => mention
    );
}

describe('G17(c) notification write shapes', () => {
    it('allows the schema pgTable declaration', () => {
        expect(forbidden(SCHEMA, `export const ${IDENTIFIER}s = pgTable('${TABLE}', {});`)).toEqual(
            []
        );
    });

    it('allows table names in import and export clauses', () => {
        expect(
            forbidden(
                MODEL,
                `import { ${IDENTIFIER}s } from './schema'; export { ${IDENTIFIER}s };`
            )
        ).toEqual([]);
    });

    it('allows insert and delete as the first call argument', () => {
        expect(
            forbidden(
                MODEL,
                `db.insert(${IDENTIFIER}s).values({}); db.delete(${IDENTIFIER}s).where(x);`
            )
        ).toEqual([]);
    });

    it('allows inferred insert and select types', () => {
        expect(
            forbidden(
                SCHEMA,
                `type I = typeof ${IDENTIFIER}s.$inferInsert; type S = typeof ${IDENTIFIER}s.$inferSelect;`
            )
        ).toEqual([]);
    });

    it.each([
        ['a select/from read', `db.select().from(${IDENTIFIER}s)`],
        ['a query read', `db.query.${IDENTIFIER}s.findMany()`],
        ['a join read', `db.select().leftJoin(${IDENTIFIER}s, on)`],
        ['a SQL string', `db.execute(sql\`select * from ${TABLE}\`)`],
        ['a table name outside its declaration', `const name = '${TABLE}';`]
    ])('rejects %s', (_label, source) => {
        expect(forbidden(MODEL, source)).not.toEqual([]);
    });

    it('rejects allowed write syntax outside the frozen routes', () => {
        expect(
            forbidden('apps/api/src/routes/payments/notices.ts', `db.insert(${IDENTIFIER}s)`)
        ).not.toEqual([]);
        expect(NOTIFICATION_WRITER_FILES).toEqual([
            'packages/db/src/schemas/vertical/provider-notification.dbschema.ts',
            'packages/db/src/models/provider-notification/provider-notification.model.ts'
        ]);
        expect(Object.isFrozen(NOTIFICATION_WRITER_FILES)).toBe(true);
    });
});
