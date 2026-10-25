import { buildLoads, renderInsert } from '../../generate-catalog-sql.ts';
import type { SchemaClient } from './schema-fingerprint.ts';

/** Builds catalog and every deadline version reference INSERT from code and the cut database. */
export async function buildReferenceRowsSql({
    source
}: {
    readonly source: SchemaClient;
}): Promise<string> {
    const loads = buildLoads();
    const inserts = [
        renderInsert({ load: loads.catalog_key }),
        renderInsert({ load: loads.vertical })
    ];
    for (const table of ['billing_deadline_version', 'vertical_deadline_version'] as const) {
        const initialVersion = await source.query(
            `SELECT version FROM public."${table}" WHERE version = 1`
        );
        if (initialVersion.rows.length !== 1)
            throw new Error(
                `Expected exactly one version 1 row in ${table}, found ${initialVersion.rows.length}`
            );
        const result = await source.query(
            `SELECT row_to_json(t)::text AS row_json
             FROM public."${table}" AS t
             ORDER BY version`
        );
        for (const row of result.rows) {
            const rowJson = row.row_json;
            if (typeof rowJson !== 'string')
                throw new Error(`Could not read JSON row for ${table}`);
            let tag = 'HOSPEDA_V6_JSON';
            while (rowJson.includes(tag)) tag += '_X';
            inserts.push(
                `INSERT INTO "${table}" SELECT * FROM json_populate_record(NULL::"${table}", $${tag}$${rowJson}$${tag}$);`
            );
        }
    }
    return inserts.join('\n--> statement-breakpoint\n');
}
