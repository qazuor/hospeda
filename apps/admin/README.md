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
- **Authentication**: Clerk with RBAC
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
- 🔐 **RBAC**: Role-based access control with Clerk
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

# Clerk Authentication
VITE_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# App Configuration
VITE_APP_NAME=Hospeda Admin
```

## Documentation

📚 **Complete documentation available in [apps/admin/docs/README.md](./docs/README.md)** *(to be created in Phase 2)*

Topics covered in detailed docs:

- **Architecture**: TanStack Start, file-based routing, SSR
- **Development**: Creating pages, components, forms
- **Routing**: File-based routing, protected routes, layouts
- **Data Fetching**: TanStack Query patterns, optimistic updates
- **Tables**: TanStack Table with sorting, filtering, pagination
- **Forms**: TanStack Form with validation and error handling
- **Authentication**: Clerk integration, protected routes, RBAC
- **UI Components**: Shadcn components, custom variants

For shared packages, see:

- **Service Layer**: [packages/service-core/docs/](../../packages/service-core/docs/)
- **Database**: [packages/db/docs/](../../packages/db/docs/)
- **Schemas**: [packages/schemas/docs/](../../packages/schemas/docs/)

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

**Need help?** Check the [complete documentation](./docs/README.md) or contact the development team.
