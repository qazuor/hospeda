/**
 * SPEC-169 Task 1 (T-001) — Pass A: Role × Permission READ audit.
 *
 * One-off audit script. READ-ONLY. Does NOT modify any seed/schema/service.
 *
 * Parses the live role->permissions map (`ROLE_PERMISSIONS`) directly from the
 * source of truth `packages/seed/src/required/rolePermissions.seed.ts` and
 * emits — for every role — every permission whose name ends in `_VIEW_ALL`,
 * `_READ_ALL`, or `_VIEW_PRIVATE`, grouped by role and marked with a coarse
 * category (the entity prefix).
 *
 * It parses the file textually (rather than importing it) so it can run with a
 * plain TS-strip-types runner without resolving the `@repo/db` / `@repo/schemas`
 * workspace imports that the seed module pulls in at load time.
 *
 * Run (Node >= 22):
 *   node --experimental-strip-types scripts/audit-role-permissions.ts
 * or with tsx if available:
 *   tsx scripts/audit-role-permissions.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = resolve(__dirname, '../src/required/rolePermissions.seed.ts');

const BROAD_SUFFIXES = ['_VIEW_ALL', '_READ_ALL', '_VIEW_PRIVATE'] as const;
const STAFF_ROLES = new Set<string>(['ADMIN', 'SUPER_ADMIN']);

function isBroadGrant(permission: string): boolean {
    return BROAD_SUFFIXES.some((suffix) => permission.endsWith(suffix));
}

function suffixOf(permission: string): string {
    return BROAD_SUFFIXES.find((s) => permission.endsWith(s)) ?? '';
}

function categoryOf(permission: string): string {
    const suffix = suffixOf(permission);
    return suffix
        ? permission.slice(0, permission.length - suffix.length).replace(/_$/, '')
        : permission;
}

/**
 * Parse ROLE_PERMISSIONS from the seed source.
 * Each role block is delimited by `[RoleEnum.<ROLE>]: [ ... ],`.
 * Permission tokens are `PermissionEnum.<NAME>`.
 */
function parseRolePermissions(src: string): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    const roleHeaderRe = /\[RoleEnum\.(\w+)\]\s*:\s*\[/g;
    const headers: { role: string; start: number }[] = [];
    for (let match = roleHeaderRe.exec(src); match !== null; match = roleHeaderRe.exec(src)) {
        headers.push({ role: match[1], start: match.index + match[0].length });
    }
    for (let i = 0; i < headers.length; i++) {
        const { role, start } = headers[i];
        // Block ends at the next role header start, or end of object.
        const end = i + 1 < headers.length ? headers[i + 1].start : src.length;
        const block = src.slice(start, end);
        const permRe = /PermissionEnum\.(\w+)/g;
        const perms: string[] = [];
        for (let pm = permRe.exec(block); pm !== null; pm = permRe.exec(block)) {
            perms.push(pm[1]);
        }
        result[role] = perms;
    }
    return result;
}

const src = readFileSync(SEED_PATH, 'utf8');
const ROLE_PERMISSIONS = parseRolePermissions(src);

type Row = { role: string; permission: string; category: string; suffix: string };
const rows: Row[] = [];
for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
    for (const permission of permissions) {
        if (isBroadGrant(permission)) {
            rows.push({
                role,
                permission,
                category: categoryOf(permission),
                suffix: suffixOf(permission)
            });
        }
    }
}

function printGroup(title: string, roleNames: string[]) {
    console.log(`\n## ${title}\n`);
    console.log('| Role | Permission | Category | Suffix |');
    console.log('|------|------------|----------|--------|');
    for (const roleName of roleNames) {
        const roleRows = rows
            .filter((r) => r.role === roleName)
            .sort((a, b) => a.permission.localeCompare(b.permission));
        if (roleRows.length === 0) {
            console.log(`| ${roleName} | _(none)_ | — | — |`);
            continue;
        }
        for (const r of roleRows) {
            console.log(`| ${r.role} | ${r.permission} | ${r.category} | ${r.suffix} |`);
        }
    }
}

const allRoles = Object.keys(ROLE_PERMISSIONS);
const staffRoles = allRoles.filter((r) => STAFF_ROLES.has(r));
const nonStaffRoles = allRoles.filter((r) => !STAFF_ROLES.has(r));

console.log('# SPEC-169 PASS A — Role × Broad-Grant (_VIEW_ALL / _READ_ALL / _VIEW_PRIVATE)');
console.log(`\nSource: ${SEED_PATH}`);
console.log(`Roles parsed: ${allRoles.join(', ')}`);
console.log('Per-role total permission counts:');
for (const role of allRoles) {
    console.log(`  ${role}: ${ROLE_PERMISSIONS[role].length} total`);
}
console.log(`\nTotal broad-grant rows: ${rows.length}`);

printGroup('STAFF roles (ADMIN, SUPER_ADMIN)', staffRoles);
printGroup('NON-STAFF roles', nonStaffRoles);

console.log('\n## NON-STAFF broad grants (compact, for spec §3 cross-check)\n');
for (const roleName of nonStaffRoles) {
    const perms = rows
        .filter((r) => r.role === roleName)
        .map((r) => r.permission)
        .sort();
    console.log(`- ${roleName}: ${perms.length ? perms.join(', ') : '(none)'}`);
}
