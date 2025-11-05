# Admin Documentation

Complete documentation for the Hospeda Admin Dashboard built with TanStack Start.

---

## 📖 Welcome

Welcome to the **Hospeda Admin Dashboard** documentation! This admin application provides a powerful interface for managing accommodations, destinations, events, users, and all content on the Hospeda platform.

**Built with:**

- ⚛️ **TanStack Start** - Full-stack React framework with SSR
- 🗂️ **TanStack Router** - File-based routing with type safety
- 🔄 **TanStack Query** - Powerful server state management
- 📝 **TanStack Form** - Type-safe form handling
- 📊 **TanStack Table** - Feature-rich data tables
- 🎨 **Shadcn UI** - Beautiful, accessible components
- 🔐 **Clerk** - Complete authentication solution
- 🎯 **TypeScript** - End-to-end type safety

---

## 🚀 Quick Start

**New to the admin dashboard?**

1. **[Setup Guide](./setup.md)** - Get your local environment running (5 minutes)
2. **[Architecture Overview](./architecture.md)** - Understand TanStack Start (10 minutes)
3. **[Usage Guides](./usage/)** - Learn how to use admin features (15 minutes)

**For developers:**

1. Complete the setup above
2. Read **[Development Guides](./development/)** - Build new features
3. Check **[Examples](./examples/)** - Copy-paste working code

---

## 📚 Documentation Sections

### 🏠 Getting Started

- **[Setup Guide](./setup.md)** - Local development setup
- **[Architecture](./architecture.md)** - TanStack Start architecture explained
- **[Project Structure](./architecture.md#project-structure)** - File organization

### 👤 Usage Documentation

For administrators and content managers:

- **[Dashboard Overview](./usage/dashboard.md)** - Admin dashboard features
- **[User Management](./usage/user-management.md)** - Managing users and roles
- **[Content Management](./usage/content-management.md)** - Managing content workflows

### 💻 Development Documentation

For developers building features:

- **[Routing](./development/routing.md)** - TanStack Router & file-based routes
- **[Creating Pages](./development/creating-pages.md)** - Step-by-step tutorial
- **[Forms](./development/forms.md)** - TanStack Form patterns
- **[Tables](./development/tables.md)** - TanStack Table patterns
- **[Data Fetching](./development/queries.md)** - TanStack Query (React Query)
- **[Authentication](./development/authentication.md)** - Clerk integration
- **[UI Components](./development/components.md)** - Shadcn UI & custom components
- **[State Management](./development/state-management.md)** - Client & server state
- **[Testing](./development/testing.md)** - Unit, integration, e2e tests

### 📝 Examples

Working code examples you can copy:

- **[CRUD Page Example](./examples/crud-page.tsx)** - Complete CRUD implementation
- **[Form Example](./examples/form-component.tsx)** - Complex form with validation
- **[Table Example](./examples/table-component.tsx)** - Sortable, filterable table
- **[Protected Route](./examples/protected-route.tsx)** - Auth-protected page

---

## 🗺️ Common Tasks

### First Time Setup

```bash
# Clone and install
git clone <repo>
cd hospeda
pnpm install

# Setup database
pnpm db:fresh

# Start admin dev server
cd apps/admin
pnpm dev
```

Visit: <http://localhost:3000>

### Daily Development

```bash
# Start admin server
pnpm dev

# Run tests
pnpm test

# Type check
pnpm typecheck

# Lint & format
pnpm lint
pnpm format
```

### Common Operations

| Task | Command | Guide |
|------|---------|-------|
| Add new page | Create file in `src/routes/` | [Creating Pages](./development/creating-pages.md) |
| Add UI component | `pnpx shadcn@latest add <component>` | [UI Components](./development/components.md) |
| Create form | Use `@tanstack/react-form` | [Forms](./development/forms.md) |
| Add table | Use `@tanstack/react-table` | [Tables](./development/tables.md) |
| Fetch data | Use `useQuery` hook | [Data Fetching](./development/queries.md) |
| Protect route | Add `beforeLoad` check | [Authentication](./development/authentication.md) |

---

## 🏗️ Architecture Overview

### Tech Stack

**Framework:**

- **TanStack Start**: Full-stack React framework with SSR, SSG, and streaming
- **Vite**: Fast build tooling and HMR
- **React 19**: Latest React features

**Routing & Navigation:**

- **TanStack Router**: Type-safe file-based routing
- File in `src/routes/foo.tsx` → route `/foo`
- Automatic code splitting per route

**Data Management:**

- **TanStack Query**: Server state, caching, mutations
- **TanStack Form**: Form state, validation
- **TanStack Table**: Table state, sorting, filtering
- **React Context**: UI state (theme, sidebar, etc.)

**UI & Styling:**

- **Shadcn UI**: Radix UI + Tailwind CSS components
- **Tailwind CSS**: Utility-first styling
- **CVA**: Class variance authority for variants

**Authentication:**

- **Clerk**: User authentication, session management
- Role-based access control
- Protected routes

### File Structure

```text
apps/admin/
├── src/
│   ├── routes/              # File-based routing
│   │   ├── __root.tsx           # Root layout
│   │   ├── index.tsx            # Dashboard home
│   │   ├── accommodations/      # Accommodation CRUD
│   │   ├── destinations/        # Destination CRUD
│   │   ├── events/              # Event CRUD
│   │   └── users/               # User management
│   ├── features/            # Feature modules (domain logic)
│   ├── components/          # Reusable components
│   │   ├── ui/                  # Shadcn components
│   │   ├── forms/               # Form components
│   │   └── tables/              # Table components
│   ├── lib/                 # Utilities
│   ├── hooks/               # Custom hooks
│   └── contexts/            # React contexts
└── docs/                    # This documentation
```

**More details:** [Architecture Guide](./architecture.md)

---

## 🎯 Key Features

### Dashboard

- 📊 **Analytics**: Real-time platform statistics
- 📈 **Charts**: Visualize accommodation bookings, revenue
- 🔔 **Notifications**: System alerts and user actions
- 🔍 **Quick Actions**: Common tasks accessible from dashboard

### Content Management

- 🏨 **Accommodations**: Full CRUD with images, amenities, pricing
- 🗺️ **Destinations**: Manage cities and regions
- 🎉 **Events**: Tourism events and festivals
- 📰 **Posts**: Blog posts and news

### User Management

- 👥 **Users**: View and manage platform users
- 🛡️ **Roles**: Admin, Manager, Editor, Viewer
- 🔐 **Permissions**: Fine-grained access control
- 📊 **Activity Logs**: Track user actions

### System

- ⚙️ **Settings**: Platform configuration
- 🌐 **i18n**: Multi-language content
- 📧 **Email Templates**: Customize notifications
- 🔄 **Integrations**: Payment gateways, analytics

---

## 🧪 Testing

### Test Commands

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage

# UI mode
pnpm test:ui
```

### Test Structure

```text
test/
├── components/           # Component tests
├── routes/              # Route/page tests
├── hooks/               # Hook tests
└── lib/                 # Utility tests
```

**Guide:** [Testing Documentation](./development/testing.md)

---

## 🔧 Configuration

### Environment Variables

```env
# Clerk Authentication
VITE_CLERK_PUBLISHABLE_KEY=pk_...

# API Configuration
VITE_API_URL=http://localhost:3001

# App Configuration
VITE_APP_NAME=Hospeda Admin
```

**Full guide:** [Setup Documentation](./setup.md#environment-variables)

### Customization

- **Theme**: Edit `tailwind.config.ts`
- **Components**: Customize in `src/components/ui/`
- **Routes**: Add files to `src/routes/`

---

## 📖 Learning Resources

### TanStack Ecosystem

- **[TanStack Start Docs](https://tanstack.com/start)** - Framework fundamentals
- **[TanStack Router Docs](https://tanstack.com/router)** - File-based routing
- **[TanStack Query Docs](https://tanstack.com/query)** - Data fetching
- **[TanStack Table Docs](https://tanstack.com/table)** - Tables
- **[TanStack Form Docs](https://tanstack.com/form)** - Forms

### Related Technologies

- **[React 19 Docs](https://react.dev)** - React fundamentals
- **[Clerk Docs](https://clerk.com/docs)** - Authentication
- **[Shadcn UI](https://ui.shadcn.com/)** - UI components
- **[Tailwind CSS](https://tailwindcss.com/)** - Styling

### Internal Resources

- **[Project CLAUDE.md](../CLAUDE.md)** - App-specific guidelines
- **[Root CLAUDE.md](../../../CLAUDE.md)** - Project-wide standards
- **[API Documentation](../../api/docs/)** - Backend API reference
- **[Database Schema](../../../packages/db/docs/)** - Database structure

---

## 💡 Best Practices

### Development

1. **Use file-based routing** - Place routes in `src/routes/`
2. **Leverage type safety** - TanStack Router provides full TypeScript support
3. **Use loaders for data** - Fetch data in route loaders for SSR
4. **Validate search params** - Use Zod schemas for query string validation
5. **Protect routes properly** - Use `beforeLoad` for auth checks

### Code Organization

1. **Feature-first structure** - Group by feature in `src/features/`
2. **Colocate tests** - Keep tests near implementation
3. **Extract reusable logic** - Create custom hooks
4. **Use shared services** - Import from `@repo/service-core`
5. **Follow naming conventions** - See [Code Standards](../../../.claude/docs/standards/code-standards.md)

### Performance

1. **Code split routes** - Automatic with TanStack Router
2. **Optimize queries** - Use appropriate `staleTime` and `cacheTime`
3. **Lazy load components** - Use `React.lazy()` for heavy components
4. **Debounce inputs** - For search and filters
5. **Paginate tables** - Don't load all data at once

### Security

1. **Never expose secrets** - Use env variables
2. **Validate all inputs** - Client and server-side
3. **Use Clerk hooks** - For auth checks
4. **Sanitize user content** - Prevent XSS
5. **HTTPS only** - In production

---

## 🐛 Troubleshooting

### Common Issues

**Port already in use:**

```bash
# Find and kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 pnpm dev
```

**Type errors:**

```bash
# Rebuild TypeScript types
pnpm typecheck

# Clear cache and restart
pnpm dev:clean
```

**Clerk auth not working:**

```bash
# Verify environment variables
cat .env | grep CLERK

# Check Clerk dashboard for correct keys
```

**Build fails:**

```bash
# Clear build cache
rm -rf dist .vinxi

# Rebuild
pnpm build
```

---

## 🆘 Getting Help

### Resources

1. **Check [Troubleshooting Guide](./development/troubleshooting.md)** first
2. **Search [TanStack Discord](https://discord.com/invite/tanstack)** - Very active community
3. **Review [GitHub Issues](https://github.com/hospeda/issues)** - Known issues
4. **Ask team** in Slack #dev-admin channel

### Reporting Issues

Include:

- Clear description of problem
- Steps to reproduce
- Expected vs actual behavior
- Environment info (`node -v`, `pnpm -v`)
- Error messages and stack traces
- Screenshots if UI-related

---

## 🤝 Contributing

See main project [Contributing Guide](../../../CONTRIBUTING.md) for:

- Development workflow
- Code standards
- Pull request process
- Testing requirements

---

## 📄 License

See root [LICENSE](../../../LICENSE) file.

---

⬅️ Back to [Project Root](../../../README.md)
