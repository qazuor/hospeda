# Dependency Policy (Quick Reference)

> Concise version for AI agents. Full details: [docs/guides/dependency-policy.md](../../docs/guides/dependency-policy.md)

| Need | Use | NEVER |
|------|-----|-------|
| Icons | `@repo/icons` | phosphor-react direct, inline SVG |
| Validation | Zod via `@repo/schemas` | yup, joi, class-validator |
| UI (Admin) | Shadcn UI | MUI, Ant Design, Chakra |
| UI (Web) | Astro components, React islands | Full React pages |
| Forms (Admin) | React Hook Form + Zod | Formik, final-form |
| Forms (Web) | Native HTML forms | React form libraries |
| Tables | TanStack Table | ag-grid, react-table v7 |
| Data fetching (Admin) | TanStack Query | SWR, axios |
| Routing (Admin) | TanStack Router | react-router |
| Styling | Tailwind CSS v4 | CSS modules, styled-components |
| Testing | Vitest + testing-library | Jest, Mocha, Cypress (unit) |
| Lint/Format | Biome | ESLint, Prettier |
| Logging | `@repo/logger` | console.log in apps |
| i18n | `@repo/i18n` | i18next direct, hardcoded strings |
| Database | Drizzle via `@repo/db` | raw SQL, Prisma, Knex |
| Types/Schemas | `@repo/schemas` | standalone interfaces |
| Services | `BaseCrudService` from `@repo/service-core` | logic in routes |
| Auth | Better Auth via `@repo/auth-ui` | Clerk, custom auth |
| Money | integer (centavos) in DB | numeric(), float |
| HTTP client | native fetch | axios |
| State (Web) | Nano stores | Redux, Zustand |
| Package manager | pnpm 9.x | npm, yarn |
| Config | `@repo/config` | duplicate constants |
| Notifications | `@repo/notifications` | direct email/push |
| Email | `@repo/email` | nodemailer direct |

## Adding New Dependencies

1. Check this table for an approved alternative
2. Check if `@repo/*` already covers the need
3. If neither, propose in a PR with justification
4. Update `docs/guides/dependency-policy.md` after approval
