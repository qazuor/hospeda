import { buildLoads, renderInsert } from '../../generate-catalog-sql.ts';
import type { SchemaClient } from './schema-fingerprint.ts';

/** Builds catalog and version-one deadline reference INSERTs from code and the cut database. */
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
        const result = await source.query(
            `SELECT "values"::text AS values FROM public."${table}" WHERE version = 1`
        );
        if (result.rows.length !== 1)
            throw new Error(
                `Expected exactly one version 1 row in ${table}, found ${result.rows.length}`
            );
        const versions = await source.query(
            `SELECT version FROM public."${table}" WHERE version <> 1 ORDER BY version`
        );
        if (versions.rows.length > 0)
            console.warn(
                `Step 6: ${table} also has versions ${versions.rows.map((row) => String(row.version)).join(', ')}; the baseline includes only version 1.`
            );
        const value = result.rows[0]?.values;
        if (typeof value !== 'string')
            throw new Error(`Could not read JSON values for version 1 in ${table}`);
        let tag = 'HOSPEDA_V6_JSON';
        while (value.includes(tag)) tag += '_X';
        inserts.push(
            `INSERT INTO "${table}" ("version", "values") VALUES (1, $${tag}$${value}$${tag}$);`
        );
    }
    return inserts.join('\n--> statement-breakpoint\n');
}
