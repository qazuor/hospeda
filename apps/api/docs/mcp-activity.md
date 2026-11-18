# Assistant activity (MCP audit rows)

The read side of the `mcp.tool.call` audit rows described in
[MCP server → Audit events](mcp-server.md#audit-events): how long they live, the
one reader both screens share, and the admin log (spec HOS-2335 §5.6, §6.10).

**Retention (D-13).** `mcp.tool.call` rows are kept 12 months
(`MCP_AUDIT_RETENTION_MONTHS`). The `mcp-audit-retention` cron deletes older ones
and nothing else: `mcp.connection.revoked` and every admin and security row are
untouched. The job hands its abort signal and deadline to the batch loop, which
stops between statements (`stoppedEarly`); the rows left go on the next run.

**Reader (D-14).** `McpActivityService.list` in service-core is the one reader
of these rows, shared by the owner's history (HOS-2348) and the admin log
(HOS-2349). The route injects the scope: `own` forces the session actor and
refuses a user filter; `all` needs the all-scope permission. Tool, outcome,
client and access (read/write) filter over the `data` jsonb (D-16). Items carry
no content: the client's registered name and, while the row's actor still owns
it, the listing name and portal link. A bare `toDate` (`2026-11-18`) covers that
whole day in UTC. A row whose `data` does not parse is left out of `items` but
stays in `total`; the output's `skipped` counts those rows for the page.

**Admin log (HOS-2349).** `GET /api/v1/admin/mcp-activity`
(`routes/mcp-activity/admin/list.ts`) calls the reader with `scope: { kind: 'all' }`.
It is gated by `MCP_ACTIVITY_VIEW` (`'mcpActivity.view'`, D-15), granted to
SUPER_ADMIN only: ADMIN answers 403, even holding `AUDIT_LOG_VIEW`. The all-scope
permission of the reader (`MCP_ACTIVITY_ALL_SCOPE_PERMISSION`) is the same value.
Filters: `userId`, `tool` (an enum of `MCP_TOOL_NAMES` in `@repo/schemas`, kept
equal to the registry by `test/mcp/tool-names-registry.guard.test.ts`; a typo is a
400), `outcome`, `access` (`read | write`, absent = both), `clientId`, `fromDate`,
`toDate`; `sort` is `loggedAt:desc` (default) or `loggedAt:asc`; `page` + `pageSize`.
Unknown params are a 400. Rows add the user's display name and email while the
account is live (`all` scope only; the owner's history never reads `users`), and
the raw `errorCode`. Items carry no portal link: those are owner links. The admin
screen is `apps/admin/src/routes/_authed/platform/ops/mcp-activity.tsx`, and its
header says which calls leave no row (R-16). Its tool filter is a select over
`MCP_TOOL_NAMES`; its user filter sends `userId` only once it is a complete UUID;
its date range is in UTC days.

## Related

- [MCP server](mcp-server.md)
- [Route architecture](route-architecture.md)
- Spec: `.specs/HOS-2335-mcp-phase-c/spec.md`
