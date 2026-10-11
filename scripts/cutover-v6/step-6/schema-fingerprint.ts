/** Schema-only comparison for the step 6 rehearsal. */

/** Minimal query interface shared by pg clients and test doubles. */
export interface SchemaClient {
    /** Executes a catalog query. */
    query(sql: string): Promise<{ readonly rows: readonly Record<string, unknown>[] }>;
}

/** Ordered schema object descriptions, with no table contents. */
export interface SchemaFingerprint {
    /** Canonical object records, sorted by kind and name. */
    readonly objects: readonly {
        readonly kind: string;
        readonly name: string;
        readonly definition: string;
    }[];
}

/** Reads public schema objects, excluding migration bookkeeping and the 5b passage table. */
export async function fingerprintSchema({
    client
}: {
    readonly client: SchemaClient;
}): Promise<SchemaFingerprint> {
    const queries: readonly { kind: string; sql: string }[] = [
        {
            kind: 'column',
            sql: `SELECT c.relname||'.'||a.attname AS name, format_type(a.atttypid,a.atttypmod)||'|nullable='||(NOT a.attnotnull)::text||'|default='||coalesce(pg_get_expr(d.adbin,d.adrelid),'')||'|generated='||a.attgenerated::text||'|identity='||a.attidentity::text AS definition FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname='public' AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped AND c.relname <> 'cutover_v6_deleted_listing' ORDER BY c.relname,a.attname`
        },
        {
            kind: 'constraint',
            sql: `SELECT t.relname||'.'||c.conname AS name, c.contype::text||'|'||pg_get_constraintdef(c.oid,true) AS definition FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND t.relname <> 'cutover_v6_deleted_listing' ORDER BY t.relname,c.conname`
        },
        {
            kind: 'index',
            sql: `SELECT i.relname AS name, pg_get_indexdef(i.oid) AS definition FROM pg_class i JOIN pg_namespace n ON n.oid=i.relnamespace WHERE n.nspname='public' AND i.relkind IN ('i','I') ORDER BY i.relname`
        },
        {
            kind: 'enum',
            sql: `SELECT t.typname AS name, json_agg(e.enumlabel ORDER BY e.enumsortorder)::text AS definition FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid WHERE n.nspname='public' GROUP BY t.typname ORDER BY t.typname`
        },
        {
            kind: 'domain',
            sql: `SELECT t.typname AS name, format_type(t.typbasetype,t.typtypmod)||'|notnull='||t.typnotnull::text||'|default='||coalesce(t.typdefault,'')||'|constraints='||coalesce(string_agg(pg_get_constraintdef(c.oid,true),';' ORDER BY c.conname),'') AS definition FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace LEFT JOIN pg_constraint c ON c.contypid=t.oid WHERE n.nspname='public' AND t.typtype='d' GROUP BY t.oid ORDER BY t.typname`
        },
        {
            kind: 'sequence',
            sql: `SELECT c.relname AS name, format_type(s.seqtypid,NULL)||'|start='||s.seqstart||'|increment='||s.seqincrement||'|min='||s.seqmin||'|max='||s.seqmax||'|cache='||s.seqcache||'|cycle='||s.seqcycle::text AS definition FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_sequence s ON s.seqrelid=c.oid WHERE n.nspname='public' ORDER BY c.relname`
        },
        {
            kind: 'view',
            sql: `SELECT c.relname AS name, pg_get_viewdef(c.oid,true) AS definition FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='v' ORDER BY c.relname`
        },
        {
            kind: 'materialized view',
            sql: `SELECT c.relname AS name, pg_get_viewdef(c.oid,true) AS definition FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='m' ORDER BY c.relname`
        },
        {
            kind: 'function',
            sql: `SELECT p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' AS name, pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY name`
        },
        {
            kind: 'trigger',
            sql: `SELECT c.relname||'.'||t.tgname AS name, pg_get_triggerdef(t.oid,true)||'|enabled='||t.tgenabled::text AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal AND c.relname <> 'cutover_v6_deleted_listing' ORDER BY c.relname,t.tgname`
        },
        {
            kind: 'extension',
            sql: `SELECT e.extname AS name, e.extversion||'|'||n.nspname AS definition FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace ORDER BY e.extname`
        }
    ];
    const objects: { kind: string; name: string; definition: string }[] = [];
    for (const query of queries) {
        const result = await client.query(query.sql);
        for (const row of result.rows)
            objects.push({
                kind: query.kind,
                name: String(row.name),
                definition: String(row.definition ?? '')
            });
    }
    return {
        objects: objects.sort((a, b) =>
            `${a.kind}\0${a.name}`.localeCompare(`${b.kind}\0${b.name}`)
        )
    };
}

/** Returns readable object-level differences; an empty list means equal fingerprints. */
export function diffFingerprints({
    a,
    b
}: {
    readonly a: SchemaFingerprint;
    readonly b: SchemaFingerprint;
}): readonly string[] {
    const key = (o: SchemaFingerprint['objects'][number]) => `${o.kind}\0${o.name}`;
    const left = new Map(a.objects.map((o) => [key(o), o]));
    const right = new Map(b.objects.map((o) => [key(o), o]));
    const differences: string[] = [];
    for (const [id, object] of left) {
        const match = right.get(id);
        if (!match) differences.push(`${object.kind} ${object.name} only in A`);
        else if (object.definition !== match.definition)
            differences.push(
                `${object.kind} ${object.name} differs: A=${object.definition}; B=${match.definition}`
            );
    }
    for (const [id, object] of right)
        if (!left.has(id)) differences.push(`${object.kind} ${object.name} only in B`);
    return differences.sort();
}
