# @repo/db

**Database Layer for Monorepo — Powered by Drizzle ORM & PostgreSQL**

This package provides a fully-typed, modular, and extensible database layer for your monorepo, built on top of [Drizzle ORM](https://orm.drizzle.team/) and PostgreSQL. It includes ready-to-use models, schemas, utilities, and helpers for all main business domains, following best practices for type safety, maintainability, and testability.

---

## Features

- **Type-safe models** for all main entities (Accommodation, User, Post, Event, Tag, Destination, etc.)
- **Drizzle ORM** integration with explicit schemas and relations
- **Reusable BaseModel** with standardized CRUD, soft/hard delete, restore, and relation methods
- **Comprehensive utilities** for error handling, logging, enum management, and query building
- **Barrel exports** for easy import of all models, helpers, and schemas
- **Test utilities** for mocking Drizzle relations
- **Migration and seeding scripts** for robust DB lifecycle management
- **Strict TypeScript** and JSDoc documentation throughout

---

## Installation

This package is designed for use within the monorepo. It depends on other internal packages (`@repo/types`, `@repo/schemas`, etc.) and expects a PostgreSQL database.

```sh
pnpm install @repo/db
# or
yarn add @repo/db
```

---

## Usage

### 1. Initialize the Database Connection

You must initialize the Drizzle client with a PostgreSQL connection pool before using any models:

```ts
import { Pool } from 'pg';
import { initializeDb } from '@repo/db';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

initializeDb(pool);
```

### 2. Using Models

All models are exported from the package root. Example: fetching a user by ID.

```ts
import { UserModel } from '@repo/db';

const userModel = new UserModel();
const user = await userModel.findById('user-uuid');
```

#### Example: Creating a Post

```ts
import { PostModel } from '@repo/db';

const postModel = new PostModel();
const newPost = await postModel.create({
    title: 'Hello World',
    content: 'This is a new post',
    // ...other required fields
});
```

#### Example: Query with Relations

```ts
const postWithRelations = await postModel.findWithRelations(
    { id: 'post-uuid' },
    { author: true, tags: true }
);
```

### 3. Using Utilities

#### Enum Utilities

```ts
import { getEnumValues } from '@repo/db';

const statusValues = getEnumValues('LifecycleStatusEnum');
```

#### Error Handling

All errors are wrapped in custom `DbError` for consistent error management.

---

## Domain-Specific Examples

### Accommodation: Find All with Filters

```ts
import { AccommodationModel } from '@repo/db';

const accommodationModel = new AccommodationModel();
const accommodations = await accommodationModel.findAll({ city: 'Barcelona', isActive: true });
```

### User: Soft Delete and Restore

```ts
import { UserModel } from '@repo/db';

const userModel = new UserModel();
await userModel.softDelete({ id: 'user-uuid' });
await userModel.restore({ id: 'user-uuid' });
```

### Post: Count Posts by Author

```ts
const count = await postModel.count({ authorId: 'author-uuid' });
```

### Event: Find with Organizer and Location

```ts
import { EventModel } from '@repo/db';

const eventModel = new EventModel();
const event = await eventModel.findWithRelations(
    { id: 'event-uuid' },
    { organizer: true, location: true }
);
```

### Tag: Assign Tag to Entity

```ts
import { REntityTagModel } from '@repo/db';

const rEntityTagModel = new REntityTagModel();
await rEntityTagModel.create({
    entityId: 'entity-uuid',
    tagId: 'tag-uuid',
    entityType: 'post'
});
```

---

## Advanced Usage

### Custom Query with Raw SQL

```ts
import { getDb } from '@repo/db';
import { sql } from 'drizzle-orm';

const db = getDb();
const result = await db.execute(sql`SELECT COUNT(*) FROM users WHERE is_active = true`);
```

### Extending BaseModel for Custom Logic

```ts
import { BaseModel } from '@repo/db';
import { myTable } from '@repo/db/schemas';

type MyType = { id: string; name: string };

class MyModel extends BaseModel<MyType> {
    protected table = myTable;
    protected entityName = 'myEntity';

    async findByName(name: string): Promise<MyType | null> {
        return this.findOne({ name });
    }
}
```

### Transactional Operations

```ts
import { getDb } from '@repo/db';

const db = getDb();
await db.transaction(async (trx) => {
    // Use trx for all operations in this transaction
    await trx.insert(...);
    await trx.update(...);
});
```

### Enum Consistency Test

This package includes a test to ensure all TypeScript enums are in sync with the database enums. See `test/enum-consistency.test.ts` for details.

---

## Migrations & Seeds

### Migrations

- **Generate migration:**
  ```sh
  pnpm db:generate
  ```
- **Apply migrations:**
  ```sh
  pnpm db:migrate
  ```
- **Open Drizzle Studio:**
  ```sh
  pnpm db:studio
  ```

### Seeding

- **Seed required data:**
  ```sh
  pnpm db:seed:required
  ```
- **Seed example data:**
  ```sh
  pnpm db:seed:example
  ```
- **Full regeneration (migrate + seed):**
  ```sh
  pnpm db:regenerate
  ```

Seed scripts are located in `src/seeds/`. You can customize or extend them for your own data.

---

## Exports

### Models

- `AccommodationModel`, `UserModel`, `PostModel`, `EventModel`, `TagModel`, `DestinationModel`, etc.
- All relation models (e.g., `RAccommodationAmenityModel`, `REntityTagModel`, etc.)
- Submodels for domain-specific logic

### Utilities

- `getDb`, `initializeDb` — Drizzle client management
- `buildWhereClause` — Dynamic query builder
- `getEnumValues`, `enumToArray` — Enum helpers
- `DbError` — Custom error class
- Logging utilities

### Schemas

- All Drizzle schemas for each entity and relation
- Enum schemas

### Base Classes

- `BaseModel<T>` — Extend for custom models

---

## Project Structure

```
src/
  models/         # All entity and relation models
  schemas/        # Drizzle schemas for all tables/enums
  base/           # BaseModel and shared abstractions
  utils/          # Utilities (error, enums, logging, query helpers)
  client.ts       # Drizzle client initialization and access
  index.ts        # Barrel export for all public API
  seeds/          # Seed scripts (see below)
```

---

## Conventions & Best Practices

- **Type safety**: All models, functions, and utilities are fully typed.
- **RO-RO pattern**: All functions receive and return objects.
- **Named exports only**: No default exports.
- **JSDoc everywhere**: All public APIs are documented.
- **Strict error handling**: All DB errors are wrapped and logged.

---

## Requirements

- Node.js 18+
- PostgreSQL 13+
- Internal packages: `@repo/types`, `@repo/schemas`, `@repo/utils`, etc.
