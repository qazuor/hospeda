# 🎛️ Hospeda Admin

Admin dashboard built with TanStack Start, React 19, and Shadcn UI for managing the Hospeda platform.

## Overview

Full-featured admin dashboard for managing accommodations, destinations, events, blog posts, and users. Features include CRUD operations, data tables with sorting/filtering, forms with validation, role-based access control, and real-time updates.

**Tech Stack:**

- **Framework**: TanStack Start (SSR React framework)
- **Router**: TanStack Router (file-based routing)
- **Data**: TanStack Query (server state), TanStack Table (data grids)
- **Forms**: TanStack Form with Zod validation
- **UI**: React 19, Tailwind CSS, Shadcn/Radix UI
- **Authentication**: Better Auth with RBAC
- **Deployment**: Vercel

## Quick Start

```bash
# Install dependencies (from project root)
pnpm install

# Start development server
cd apps/admin && pnpm dev

# Run tests
cd apps/admin && pnpm test

# Type check
cd apps/admin && pnpm typecheck
```

The admin dashboard will be available at `http://localhost:3000`

## Key Features

- 🎨 **Modern UI**: Shadcn components with Radix UI primitives
- 📊 **Data Tables**: Sortable, filterable tables with TanStack Table
- 📝 **Smart Forms**: TanStack Form with Zod validation
- 🔐 **RBAC**: Role-based access control with Better Auth
- ⚡ **Fast**: SSR with React Server Components
- 🔄 **Real-time**: Optimistic updates with TanStack Query
- 🧪 **Tested**: Comprehensive test coverage

## Available Routes

```text
/                          # Dashboard overview
/accommodations            # Accommodation management
/accommodations/new        # Create accommodation
/accommodations/:id        # View accommodation
/accommodations/:id/edit   # Edit accommodation
/destinations              # Destination management
/destinations/new          # Create destination
/destinations/:id          # View destination
/destinations/:id/edit     # Edit destination
/events                    # Event management
/posts                     # Blog post management
/users                     # User management
/settings                  # Admin settings
```

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server with hot reload |
| `pnpm dev:clean` | Clear cache and start development server |
| `pnpm build` | Build for production |
| `pnpm serve` | Preview production build |
| `pnpm start` | Start production server |
| `pnpm test` | Run all tests |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:coverage` | Run tests with coverage report |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm lint` | Lint code with Biome |
| `pnpm format` | Format code with Biome |
| `pnpm clean` | Remove build artifacts |

## Configuration

Copy `.env.example` to `.env` and configure:

```env
# API Configuration
VITE_API_URL=http://localhost:3001

# Better Auth Authentication
VITE_BETTER_AUTH_URL=http://localhost:3001/api/auth
HOSPEDA_BETTER_AUTH_SECRET=your-secret-key

# App Configuration
VITE_APP_NAME=Hospeda Admin
```

## Documentation

📚 **Complete documentation available in [apps/admin/docs/](./docs/)**

Topics covered in detailed docs:

- **[Overview](./docs/README.md)**: Architecture, features, and getting started
- **[Setup Guide](./docs/development/setup.md)**: Environment and configuration
- **[Architecture](./docs/development/architecture.md)**: TanStack Start and SSR patterns
- **[Routing](./docs/development/routing.md)**: File-based routing and protected routes
- **[Components](./docs/development/components.md)**: Creating and styling components
- **[Data Fetching](./docs/development/data-fetching.md)**: TanStack Query patterns
- **[Forms](./docs/development/forms.md)**: TanStack Form with validation
- **[Tables](./docs/development/tables.md)**: TanStack Table implementation
- **[Authentication](./docs/AUTH_SYSTEM.md)**: Better Auth integration and RBAC
- **[Deployment](./docs/development/deployment.md)**: Vercel deployment guide

For cross-app documentation:

- **[Getting Started](../../docs/getting-started/)**: Project setup and onboarding
- **[Architecture](../../docs/architecture/)**: System design and patterns
- **[Deployment](../../docs/deployment/)**: Deployment guides

For shared packages:

- **[Service Layer](../../packages/service-core/docs/)**: Business logic services
- **[Database](../../packages/db/docs/)**: Models and database operations
- **[Schemas](../../packages/schemas/docs/)**: Validation schemas

## Project Structure

```text
src/
├── routes/            # File-based routing (TanStack Router)
│   ├── __root.tsx         # Root layout
│   ├── index.tsx          # Dashboard home
│   ├── accommodations/    # Accommodation routes
│   ├── destinations/      # Destination routes
│   ├── events/            # Event routes
│   ├── posts/             # Post routes
│   └── users/             # User routes
├── features/          # Feature-specific modules
├── components/        # Reusable components
│   └── ui/                # Shadcn UI components
├── lib/               # Utilities (API client, query config)
├── hooks/             # Custom React hooks
└── contexts/          # React contexts
```

---

## Related Documentation

- [Adding Admin Pages Guide](../../docs/guides/adding-admin-pages.md)

---

**Need help?** Check the [complete documentation](./docs/README.md) or contact the development team.
