# @repo/db

This package contains the database layer of the application using **Drizzle ORM** and **PostgreSQL**.

## Structure

- `schema/`: Table definitions and relations
- `migrations/`: Generated migration files
- `seeds/`: Initial and example seed data
- `client.ts`: Drizzle client setup
- `index.ts`: Export point for db access

## Scripts

- `pnpm run db:migrate` – apply latest schema to the database
- `pnpm run db:seed:required` – insert required initial records
- `pnpm run db:seed:example` – insert mock/example data
- `pnpm run lint` – lint with Biome
- `pnpm run format` – format with Biome
