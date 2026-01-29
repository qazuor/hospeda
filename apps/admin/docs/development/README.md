# Development Documentation

Complete technical documentation for building features in the Hospeda Admin Dashboard.

---

## 📖 Overview

This section provides **comprehensive development guides** for engineers building the Hospeda Admin Dashboard. All guides use TanStack Start, React 19, and TypeScript with strict type safety.

**Who this is for:**

- **Frontend Developers** - Building admin UI features
- **Full-Stack Developers** - Integrating frontend with backend
- **New Team Members** - Learning the admin architecture
- **Contributors** - Understanding patterns and conventions

**Prerequisites:**

- TypeScript knowledge
- React 19 experience
- Basic understanding of server-side rendering (SSR)
- Familiarity with Node.js

---

## 🎯 Getting Started

### New to TanStack Start?

**Start here in order:**

1. **[Architecture Overview](../architecture.md)** - Understand TanStack Start (10 minutes)
2. **[Routing Guide](./routing.md)** - File-based routing system (15 minutes)
3. **[Creating Pages Tutorial](./creating-pages.md)** - Build your first admin page (30 minutes)
4. **[Data Fetching](./queries.md)** - TanStack Query patterns (20 minutes)

### Quick Navigation by Task

| Task | Guide | Time |
|------|-------|------|
| Create new admin page | [Creating Pages](./creating-pages.md) | 30 min |
| Add form to page | [Forms](./forms.md) | 20 min |
| Add data table | [Tables](./tables.md) | 25 min |
| Fetch data from API | [Queries](./queries.md) | 15 min |
| Protect route with auth | [Authentication](./authentication.md) | 10 min |
| Add UI component | [Components](./components.md) | 5 min |
| Use factory functions | [Factories](./factories.md) | 10 min |
| Debug SSR issues | [Debugging](./debugging.md) | Variable |

---

## 📚 Core Development Guides

### Routing & Pages

**[Routing Guide](./routing.md)**

- File-based routing with TanStack Router
- Dynamic routes with parameters
- Nested routes and layouts
- Route loaders for SSR
- Search params validation with Zod
- Navigation and redirects

**[Creating Pages Tutorial](./creating-pages.md)**

- Step-by-step: Build a complete CRUD page
- Project structure best practices
- Route file anatomy
- Loaders vs client-side fetching
- Error boundaries
- Complete working example

### Data Management

**[Data Fetching (TanStack Query)](./queries.md)**

- useQuery for data fetching
- useMutation for create/update/delete
- Query invalidation patterns
- Optimistic updates
- Error handling
- Caching strategies
- Server vs client state

**[Forms (TanStack Form)](./forms.md)**

- Form setup and validation with Zod
- Field-level validation
- Async validation
- Form submission handling
- Error display patterns
- Complex forms (arrays, nested objects)
- Form state management

**[Tables (TanStack Table)](./tables.md)**

- Table setup and configuration
- Sorting and filtering
- Pagination patterns
- Column definitions
- Custom cell renderers
- Row selection
- Server-side vs client-side tables

### Authentication & Security

**[Authentication Guide](./authentication.md)**

- Clerk integration
- Protected routes with beforeLoad
- Role-based access control (RBAC)
- Session management
- User context access
- Logout and session cleanup

**[Permissions System](./permissions.md)**

- RBAC implementation
- Permission checks in components
- Permission-based rendering
- API permission validation
- Role hierarchy (Admin > Manager > Editor > Viewer)

**[Protected Routes](./protected-routes.md)**

- Route protection patterns
- beforeLoad hook usage
- Redirect strategies
- Loading states during auth check
- Error handling for unauthorized access

### Factory Functions

**[Factory Functions Guide](./factories.md)**

- createEntityHooks - Query/mutation hook generation
- createEntityLayout - Layout with tab navigation
- createEntityRoutes - Route component generation
- createEntityListPage - List page configuration
- createEntityColumnsFactory - Table column definitions
- Base columns and utility factories

### UI Components

**[Component Library](./components.md)**

- Shadcn UI components overview
- Adding new components
- Customizing components
- Creating compound components
- Theming and styling
- Component patterns and conventions

### Tools & Debugging

**[Debugging Guide](./debugging.md)**

- React DevTools
- TanStack Router DevTools
- TanStack Query DevTools
- Chrome DevTools for SSR
- Common issues and solutions
- Debug SSR vs client-side code
- Performance profiling

**[Deployment Guide](./deployment.md)**

- Vercel deployment setup
- Environment variables
- Build configuration
- Preview deployments
- Production deployment
- Rollback procedures
- Monitoring and analytics

---

## 🗺️ Common Development Tasks

### Creating New Features

| Task | Steps | Guides |
|------|-------|--------|
| Add new CRUD page | 1. Create route file`<br>`2. Add loader`<br>`3. Create form`<br>`4. Add table`<br>`5. Wire mutations | [Creating Pages](./creating-pages.md)`<br>`[Forms](./forms.md)`<br>`[Tables](./tables.md) |
| Add dashboard widget | 1. Create component`<br>`2. Add query`<br>`3. Handle loading/error`<br>`4. Add to dashboard | [Queries](./queries.md)`<br>`[Components](./components.md) |
| Create protected admin page | 1. Create route`<br>`2. Add beforeLoad`<br>`3. Check permissions`<br>`4. Handle unauthorized | [Protected Routes](./protected-routes.md)`<br>`[Authentication](./authentication.md) |

### Working with Data

| Task | Guide | Section |
|------|-------|---------|
| Fetch list of items | [Queries](./queries.md) | useQuery patterns |
| Create new item | [Queries](./queries.md) | useMutation patterns |
| Update existing item | [Queries](./queries.md) | useMutation patterns |
| Delete item | [Queries](./queries.md) | useMutation patterns |
| Invalidate cache after mutation | [Queries](./queries.md) | Query invalidation |
| Handle loading states | [Queries](./queries.md) | Loading & error states |
| Handle errors | [Queries](./queries.md) | Error handling |

### Forms & Validation

| Task | Guide | Section |
|------|-------|---------|
| Create simple form | [Forms](./forms.md) | Basic form setup |
| Add field validation | [Forms](./forms.md) | Field validators |
| Handle form submission | [Forms](./forms.md) | Form submission |
| Display validation errors | [Forms](./forms.md) | Error display |
| Create multi-step form | [Forms](./forms.md) | Complex forms |
| Handle async validation | [Forms](./forms.md) | Async validation |

### Tables & Lists

| Task | Guide | Section |
|------|-------|---------|
| Display data in table | [Tables](./tables.md) | Table setup |
| Add sorting | [Tables](./tables.md) | Sorting |
| Add filtering | [Tables](./tables.md) | Filtering |
| Add pagination | [Tables](./tables.md) | Pagination |
| Add row actions | [Tables](./tables.md) | Custom cells |
| Select multiple rows | [Tables](./tables.md) | Row selection |
| Server-side pagination | [Tables](./tables.md) | Server-side tables |

---

## 🏗️ Architecture Patterns

### Tech Stack

**Frontend Framework:**

- TanStack Start (Full-stack React framework)
- React 19 (Latest features)
- TypeScript (Strict mode)
- Vite (Build tooling)

**State Management:**

- TanStack Query (Server state)
- TanStack Form (Form state)
- TanStack Table (Table state)
- React Context (UI state)

**UI & Styling:**

- Shadcn UI (Component library)
- Radix UI (Headless primitives)
- Tailwind CSS (Utility-first styling)
- CVA (Class Variance Authority)

**Authentication:**

- Clerk (Auth provider)
- Protected routes
- Role-based access control

### Project Structure

```text
apps/admin/
├── src/
│   ├── routes/              # File-based routing
│   │   ├── __root.tsx           # Root layout + providers
│   │   ├── index.tsx            # Dashboard home
│   │   ├── _authenticated/      # Protected routes group
│   │   ├── accommodations/      # Accommodation CRUD
│   │   │   ├── index.tsx            # List page
│   │   │   ├── $id.tsx              # Detail page
│   │   │   ├── $id.edit.tsx         # Edit page
│   │   │   └── new.tsx              # Create page
│   │   └── ...                  # Other routes
│   ├── features/            # Feature-specific code
│   │   ├── accommodations/
│   │   │   ├── components/      # Feature components
│   │   │   ├── hooks/           # Feature hooks
│   │   │   ├── queries.ts       # TanStack Query hooks
│   │   │   └── types.ts         # Feature types
│   │   └── ...
│   ├── components/          # Shared components
│   │   ├── ui/                  # Shadcn components
│   │   ├── forms/               # Form components
│   │   ├── tables/              # Table components
│   │   └── layouts/             # Layout components
│   ├── lib/                 # Shared utilities
│   │   ├── api.ts               # API client
│   │   ├── query.ts             # Query client config
│   │   └── utils.ts             # Helper functions
│   ├── hooks/               # Shared hooks
│   ├── contexts/            # React contexts
│   └── types/               # Shared types
├── test/                    # Tests mirror src/
└── public/                  # Static assets
```

### Key Concepts

#### File-Based Routing

- Files in `src/routes/` automatically become routes
- `index.tsx` → base route
- `$id.tsx` → dynamic route with parameter
- `_authenticated/` → route group with shared layout

**Example:**

```text
src/routes/accommodations/
├── index.tsx          → /accommodations
├── $id.tsx            → /accommodations/:id
├── $id.edit.tsx       → /accommodations/:id/edit
└── new.tsx            → /accommodations/new
```

#### Route Loaders

- Fetch data on the server before rendering
- Type-safe data access in components
- Automatic loading states
- Error boundaries

#### Server vs Client State

- **Server State**: Use TanStack Query (data from API)
- **Client State**: Use React state or Context (UI state)
- Never mix the two

#### Key Concepts Type Safety

- End-to-end type safety from database to UI
- Infer types from Zod schemas
- No `any` types allowed
- Type-safe route params and search params

---

## 💡 Development Best Practices

### Code Organization

- ✅ **Feature-first structure** - Group by feature in `src/features/`
- ✅ **Colocate related code** - Components, hooks, types together
- ✅ **Keep routes thin** - Move logic to features/
- ✅ **Use barrel files** - Export from `index.ts`
- ✅ **Extract reusable logic** - Create custom hooks
- ✅ **Name consistently** - Follow naming conventions

### Type Safety

- ✅ **Always type props** - No implicit any
- ✅ **Infer from schemas** - Use `z.infer<typeof schema>`
- ✅ **Type route params** - TanStack Router provides types
- ✅ **Type API responses** - Create type-safe API client
- ✅ **Use strict mode** - Enable in tsconfig.json
- ✅ **Avoid type assertions** - Use type guards instead

### Performance

- ✅ **Use loaders** - Fetch data on server when possible
- ✅ **Optimize queries** - Set appropriate `staleTime`
- ✅ **Lazy load heavy components** - Use `React.lazy()`
- ✅ **Debounce inputs** - For search and filters
- ✅ **Paginate large lists** - Don't load everything
- ✅ **Code split routes** - Automatic with TanStack Router

### Testing

- ✅ **Test business logic** - Pure functions first
- ✅ **Test components** - React Testing Library
- ✅ **Mock API calls** - Use MSW
- ✅ **Test user flows** - Integration tests
- ✅ **Test accessibility** - Use axe-core
- ✅ **Aim for 90% coverage** - Quality over quantity

### Security

- ✅ **Validate all inputs** - Client and server side
- ✅ **Protect routes** - Use beforeLoad hook
- ✅ **Check permissions** - On every protected action
- ✅ **Sanitize user content** - Prevent XSS
- ✅ **Never expose secrets** - Use environment variables
- ✅ **HTTPS only** - In production

---

## 🔧 Development Tools

### Required Tools

- **Node.js 18+** - Runtime
- **pnpm** - Package manager
- **VS Code** (recommended) - IDE
- **Git** - Version control

### Recommended VS Code Extensions

- **ESLint** - Linting
- **Prettier** - Code formatting
- **TypeScript** - Language support
- **Tailwind CSS IntelliSense** - Tailwind autocomplete
- **Error Lens** - Inline errors
- **Auto Rename Tag** - HTML/JSX tag renaming

### Browser DevTools

- **React DevTools** - Component inspection
- **TanStack Router DevTools** - Route debugging
- **TanStack Query DevTools** - Query state inspection
- **Chrome DevTools** - Standard debugging

---

## 🚀 Quick Start Checklist

Before starting development:

- [ ] Node.js 18+ installed
- [ ] pnpm installed
- [ ] Repository cloned
- [ ] Dependencies installed (`pnpm install`)
- [ ] Environment variables configured
- [ ] Database setup complete
- [ ] Admin dev server running (`cd apps/admin && pnpm dev`)
- [ ] Read [Architecture Overview](../architecture.md)
- [ ] Read [Routing Guide](./routing.md)
- [ ] Complete [Creating Pages Tutorial](./creating-pages.md)

---

## 📖 Additional Resources

### Official Documentation

- **[TanStack Start](https://tanstack.com/start)** - Framework docs
- **[TanStack Router](https://tanstack.com/router)** - Routing docs
- **[TanStack Query](https://tanstack.com/query)** - Data fetching docs
- **[TanStack Form](https://tanstack.com/form)** - Form docs
- **[TanStack Table](https://tanstack.com/table)** - Table docs
- **[React 19](https://react.dev)** - React docs
- **[Clerk](https://clerk.com/docs)** - Auth docs
- **[Shadcn UI](https://ui.shadcn.com/)** - Component docs
- **[Tailwind CSS](https://tailwindcss.com/)** - Styling docs

### Internal Resources

- **[Admin CLAUDE.md](../../CLAUDE.md)** - Admin-specific guidelines
- **[Project CLAUDE.md](../../../../CLAUDE.md)** - Project-wide standards
- **[API Documentation](../../../api/docs/README.md)** - Backend API
- **[Database Schema](../../../../packages/db/docs/README.md)** - Data models

### Community

- **[TanStack Discord](https://discord.com/invite/tanstack)** - Very active community
- **[GitHub Issues](https://github.com/hospeda/issues)** - Bug reports and features
- **Team Slack** - #dev-admin channel

---

## 🆘 Getting Help

### Common Issues

**Build errors:**

```bash
# Clear cache and rebuild
rm -rf dist .vinxi node_modules/.vite
pnpm install
pnpm dev
```

**Type errors:**

```bash
# Rebuild TypeScript project references
pnpm typecheck
```

**Hot reload not working:**

```bash
# Restart dev server
# Ctrl+C to stop, then:
pnpm dev
```

### Where to Ask

1. **Check documentation** - Read relevant guides first
2. **Search GitHub issues** - Someone may have asked before
3. **Ask in Slack** - #dev-admin channel
4. **TanStack Discord** - For framework-specific questions
5. **Create GitHub issue** - For bugs or feature requests

---

⬅️ Back to [Admin Documentation](../README.md)
