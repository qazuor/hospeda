# Hospeda - Modern Tourist Accommodation Platform

Hospeda is a comprehensive web platform for discovering and managing tourist accommodations in Concepción del Uruguay and the Litoral region of Argentina. Built with modern technologies in a monorepo architecture.

## Project Overview

This project is organized as a monorepo using TurboRepo for optimized builds and dependency management. The platform includes both frontend applications and backend services, all sharing common packages for types, utilities, database access, and more.

### Key Features

- Discover accommodations, destinations, events, and more
- Browse comprehensive destination information
- Read and write reviews for accommodations and destinations
- View upcoming events in the region
- Admin interfaces for managing all platform content
- Multi-user roles and permissions system
- Responsive design for all devices

## Repository Structure

```
hospeda/
├── apps/                  # Applications
│   ├── api/               # Backend API service
│   ├── web/               # Frontend web application
│   └── admin/             # Admin dashboard
├── packages/              # Shared packages
│   ├── config/            # Configuration utilities
│   ├── db/                # Database access layer
│   ├── logger/            # Centralized logging
│   ├── schemas/           # Validation schemas
│   ├── types/             # TypeScript type definitions
│   ├── utils/             # Shared utility functions
│   └── typescript-config/ # TypeScript configurations
└── turbo.json             # TurboRepo configuration
```

## Technologies

- **Frontend**: Astro, React, TanStack Router, Tailwind CSS
- **Backend**: Node.js, Hono
- **Database**: PostgreSQL with Drizzle ORM
- **Validation**: Zod
- **Building/Bundling**: Turbo, Vite
- **Package Management**: PNPM

## Packages

### @repo/api

The backend API server that provides endpoints for accessing and managing all platform data.

- [View API Documentation](./apps/api/README.md)

### @repo/db

Database layer using Drizzle ORM and PostgreSQL. Provides models, types, and services for data access.

Key features:

- Strongly typed database schema
- SQL migrations
- Repository pattern with model and service layers
- Soft delete functionality
- Comprehensive logging
- Audit fields tracking

- [View DB Documentation](./packages/db/README.md)

### @repo/logger

A centralized logging package that provides consistent logs across all applications and services.

- [View Logger Documentation](./packages/logger/README.md)

### @repo/schemas

Zod validation schemas for all entities and data structures in the platform.

- [View Schemas Documentation](./packages/schemas/README.md)

### @repo/types

TypeScript type definitions for all entities, providing type safety across the entire platform.

- [View Types Documentation](./packages/types/README.md)

### @repo/utils

Shared utility functions for common tasks like string manipulation, date formatting, array operations, and more.

Key utilities:

- String formatting and manipulation
- Date parsing and formatting
- Array and object operations
- Validation helpers
- Currency formatting
- Type guards and assertions

- [View Utils Documentation](./packages/utils/README.md)

## Getting Started

### Prerequisites

- Node.js 18+
- PNPM 8.15.6+
- PostgreSQL 15+

### Installation

```bash
# Clone the repository
git clone https://github.com/qazuor/hospeda.git
cd hospeda

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Set up database
pnpm db:setup

# Start development server
pnpm dev
```

### Development Workflow

```bash
# Run all packages and apps in development mode
pnpm dev

# Run a specific app or package
pnpm dev --filter=api
pnpm dev --filter=web

# Build all packages and apps
pnpm build

# Run tests
pnpm test

# Lint code
pnpm lint

# Format code
pnpm format

# Check types
pnpm check-types
```

## Available Scripts

- `pnpm build`: Build all packages and applications
- `pnpm dev`: Start the development environment
- `pnpm lint`: Run linters across the codebase
- `pnpm format`: Format code using Biome
- `pnpm check`: Run Biome checks and auto-fix
- `pnpm clean`: Clean all build artifacts
- `pnpm check-types`: Verify TypeScript types
- `pnpm test`: Run all tests

## Database Management

The database layer is managed through Drizzle ORM with the following commands:

- `pnpm db:migrate`: Apply pending migrations
- `pnpm db:generate`: Generate new migration files
- `pnpm db:studio`: Open Drizzle Studio for database visualization
- `pnpm db:regenerate`: Completely recreate the database and apply all migrations
- `pnpm db:seed`: Seed the database with initial data

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

Please make sure to follow our coding standards and run tests before submitting a PR.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
