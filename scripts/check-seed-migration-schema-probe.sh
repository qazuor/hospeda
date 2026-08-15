#!/usr/bin/env bash
# check-seed-migration-schema-probe.sh
#
# HOS-513: seed data-migrations must not gate their work on a SCHEMA-EXISTENCE
# probe.
#
# The pattern this rejects, verbatim from 0034/0037:
#
#   const columnExists = await db.execute(
#       sql`SELECT 1 FROM information_schema.columns
#           WHERE table_schema = 'public' AND table_name = ${table} AND column_name = 'media'`
#   );
#   if ((columnExists.rows?.length ?? 0) === 0) return [];
#
# Read that failure path: the source is missing, so the migration reads nothing,
# reports "Backfilled 0 photo(s)" as a SUCCESS, and the runner ledgers it as
# applied. A migration that never migrated is now permanently marked done, and
# nobody will ever look at it again. Any transient failure to read
# information_schema produces the same outcome. That is worse than a crash: a
# crash rolls the transaction back and leaves the migration pending for a retry.
#
# The other 52 migrations verify the TARGET STATE instead (UPDATE ... WHERE
# <exact old value>, or findOne + a counter), so a zero result is a fact about
# the data, not about the schema. When that count is zero they investigate it:
# 0042-reattribute-imported-events.ts is the model — it distinguishes "already
# applied" (returns success) from "ambiguous" (THROWS, so the runner rolls back
# and never writes a ledger row).
#
# There is deliberately NO in-file escape comment. An opt-out marker anyone can
# paste is exactly how the pattern spread from 0034 to 0037 in the first place;
# the only exemptions are the two frozen historical files listed below.
#
# Override for tests: MIGRATIONS_DIR_OVERRIDE points the scan at a fixture
# directory instead of the real one.

set -euo pipefail

MIGRATIONS_DIR="${MIGRATIONS_DIR_OVERRIDE:-packages/seed/src/data-migrations}"

# Frozen historical exemptions. Both already ran against production and are
# ledgered, so rewriting them would change an applied migration's checksum for
# no runtime benefit — the real vector is a THIRD copy, which this guard blocks.
#
#   0034 — the original. Its probe at least had a rationale: gastronomies/
#          experiences.media IS dropped (structural migration 0072), so an
#          absent column genuinely meant "cutover already done".
#   0037 — the copy-paste, and the worse one: posts/events.media is never
#          dropped (its own JSDoc says so, and both columns exist in production
#          today), so the probe guards a scenario that cannot occur while still
#          converting any failed read into a silent success.
LEGACY_EXEMPT=(
    "0034-hos-372-commerce-media-to-relational.ts"
    "0037-hos-390-content-media-to-relational.ts"
)

# Catalog probes: asking the database about its own shape rather than about the
# data being migrated.
PROBE_PATTERN='information_schema|to_regclass|pg_catalog|pg_class|has_table_privilege|has_column_privilege'

echo "=== Checking seed data-migrations for schema-existence probes (HOS-513) ==="
echo ""

if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo "ERROR: migrations directory not found: $MIGRATIONS_DIR"
    exit 1
fi

# Numbered migrations only — the infrastructure modules beside them (runner.ts,
# discover.ts, ...) are not migrations and are legitimately allowed to inspect
# the schema.
MIGRATION_FILES=$(find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '[0-9][0-9][0-9][0-9]-*.ts' | sort)
SCANNED=$(echo "$MIGRATION_FILES" | grep -c . || true)

# A guard that scans nothing reports "no findings" forever. Fail instead.
if [ "$SCANNED" -eq 0 ]; then
    echo "ERROR: scanned 0 migration files under $MIGRATIONS_DIR — the guard is broken, not the code."
    exit 1
fi

MATCHES=""
for file in $MIGRATION_FILES; do
    base=$(basename "$file")

    exempt=0
    for legacy in "${LEGACY_EXEMPT[@]}"; do
        if [ "$base" = "$legacy" ]; then
            exempt=1
            break
        fi
    done
    if [ "$exempt" -eq 1 ]; then
        continue
    fi

    # Comment-leading lines are excluded, not stripped: several migrations
    # discuss information_schema in their JSDoc precisely to explain why they do
    # NOT probe it, and matching that prose would make the guard cry wolf until
    # someone disabled it. Excluding by leading `*` / `//` cannot hide a probe —
    # a real one always sits on an executable line — so this filter can only
    # produce false negatives on prose, never on code.
    FOUND=$(grep -nE "$PROBE_PATTERN" "$file" 2>/dev/null | grep -vE '^[0-9]+: *(\*|//)' || true)
    if [ -n "$FOUND" ]; then
        while IFS= read -r line; do
            MATCHES="${MATCHES}${file}:${line}"$'\n'
        done <<< "$FOUND"
    fi
done

MATCHES=$(echo "$MATCHES" | sed '/^$/d')

echo "  Scanned $SCANNED numbered data-migration(s) in $MIGRATIONS_DIR"
echo "  (${#LEGACY_EXEMPT[@]} frozen historical file(s) exempt — see this script's header)"
echo ""

if [ -n "$MATCHES" ]; then
    echo "ERROR: schema-existence probe in a seed data-migration:"
    echo "$MATCHES"
    echo ""
    echo "  A migration that returns early because a column or table is missing"
    echo "  reports SUCCESS without migrating anything, and the runner ledgers it"
    echo "  as applied — permanently. Any failed read produces the same outcome."
    echo ""
    echo "  Verify the TARGET STATE instead (UPDATE ... WHERE <exact old value>,"
    echo "  or findOne + a counter). When the count is zero, distinguish 'already"
    echo "  applied' from 'ambiguous' and THROW on the ambiguous case, so the"
    echo "  transaction rolls back and the migration stays pending for a retry."
    echo ""
    echo "  Model to copy: packages/seed/src/data-migrations/0042-reattribute-imported-events.ts"
    exit 1
fi

echo "OK — no schema-existence probes found."
exit 0
