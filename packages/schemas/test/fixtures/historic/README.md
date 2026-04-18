# Historic Shape Fixtures

Static, deterministic snapshots of schema shapes that were valid at a point in time. They enforce the additive-only schema compatibility policy: today's schemas MUST `safeParse` every fixture in this directory successfully.

See the full policy at `packages/schemas/docs/guides/schema-compat-policy.md`.

## Rules

1. **No faker, no randomness.** Fixtures are committed verbatim so diffs are meaningful across releases.
2. **JSDoc each fixture** with WHEN it was produced (release tag, SPEC id) and WHY it is preserved.
3. **Never mutate an existing fixture.** To retire a shape, move it under `archived/` during the removal phase of a breaking-change migration and leave a note explaining why.
4. **Use `as const`** so fixtures stay readonly and TypeScript infers literal types.
5. **Consumed only by `.compat.test.ts` files** that live next to the schema under test.

## Layout

```
test/fixtures/historic/
  README.md                  # this file
  media.historic.ts          # @repo/schemas common/media compat shapes
  <domain>.historic.ts       # one file per domain as needed
  archived/                  # formally retired shapes (created lazily)
```

## Adding a new historic fixture

1. Capture the real payload from production logs, a stored JSONB column, or an older tag of the repo.
2. Strip secrets and PII; keep only fields that the schema validates.
3. Add it to the relevant `<domain>.historic.ts` with a JSDoc explaining provenance.
4. Import it from a `.compat.test.ts` file and assert `safeParse(...).success === true`.
5. If the current schema does not parse the fixture, the change under review is BREAKING. Follow the three-phase migration path in the compat policy before merging.
