# External Links

Curated collection of official documentation and learning resources for all technologies used in the Hospeda project.

## Table of Contents

- [Official Documentation](#official-documentation)
- [Learning Resources](#learning-resources)
- Tools & Utilities
- [Community](#community)
- [Reference](#reference)

---

## Official Documentation

### Core Technologies

#### Core Technologies Astro

- **URL**: <https://docs.astro.build/>
- **Description**: Official Astro documentation covering islands architecture, SSR/SSG, and React integration.
- **Relevance**: Used for Hospeda's public-facing web app with partial hydration for optimal performance.

#### React

- **URL**: <https://react.dev/>
- **Description**: Official React 19 documentation with hooks, components, and server components.
- **Relevance**: Used in both Astro islands (web) and TanStack Start (admin) for interactive UI components.

#### Core Technologies Hono

- **URL**: <https://hono.dev/>
- **Description**: Fast, lightweight web framework for the edge with TypeScript support.
- **Relevance**: Powers Hospeda's API layer with middleware, routing, and request handling.

### Database & ORM

#### Drizzle ORM

- **URL**: <https://orm.drizzle.team/>
- **Description**: TypeScript ORM with type-safe queries, schema definition, and migrations.
- **Relevance**: Used for all database operations in Hospeda with PostgreSQL.

**Key Sections**:

- [Schema Definition](https://orm.drizzle.team/docs/sql-schema-declaration)
- [Queries](https://orm.drizzle.team/docs/select)
- [Migrations](https://orm.drizzle.team/docs/migrations)
- [Relations](https://orm.drizzle.team/docs/rqb)

#### PostgreSQL

- **URL**: <https://www.postgresql.org/docs/>
- **Description**: Comprehensive PostgreSQL documentation for SQL, indexes, and optimization.
- **Relevance**: Primary database for Hospeda, used via Drizzle ORM and direct SQL when needed.

**Key Sections**:

- [SQL Commands](https://www.postgresql.org/docs/current/sql-commands.html)
- [Indexes](https://www.postgresql.org/docs/current/indexes.html)
- [Functions](https://www.postgresql.org/docs/current/functions.html)

#### Neon

- **URL**: <https://neon.tech/docs>
- **Description**: Serverless PostgreSQL platform with auto-scaling and branching.
- **Relevance**: Hosting provider for Hospeda's PostgreSQL database with connection pooling.

### Frontend Frameworks

#### TanStack Query

- **URL**: <https://tanstack.com/query/latest>
- **Description**: Powerful data synchronization and caching library for React.
- **Relevance**: Used in both web and admin apps for API calls, caching, and optimistic updates.

**Key Sections**:

- [Queries](https://tanstack.com/query/latest/docs/react/guides/queries)
- [Mutations](https://tanstack.com/query/latest/docs/react/guides/mutations)
- [Caching](https://tanstack.com/query/latest/docs/react/guides/caching)

#### TanStack Router

- **URL**: <https://tanstack.com/router/latest>
- **Description**: Type-safe routing for React applications with built-in code splitting.
- **Relevance**: Used in TanStack Start (admin dashboard) for file-based routing.

#### TanStack Form

- **URL**: <https://tanstack.com/form/latest>
- **Description**: Headless, type-safe form library with validation support.
- **Relevance**: Used for complex forms in admin dashboard with Zod validation.

#### TanStack Start

- **URL**: <https://tanstack.com/start/latest>
- **Description**: Full-stack React framework with server functions and RSC support.
- **Relevance**: Powers Hospeda's admin dashboard with server-side rendering.

### Validation & Types

#### Zod

- **URL**: <https://zod.dev/>
- **Description**: TypeScript-first schema validation with static type inference.
- **Relevance**: Single source of truth for validation and types throughout Hospeda.

**Key Sections**:

- [Primitives](https://zod.dev/?id=primitives)
- [Objects](https://zod.dev/?id=objects)
- [Refinements](https://zod.dev/?id=refine)
- [Type Inference](https://zod.dev/?id=type-inference)

#### Validation & TypeScript

- **URL**: <https://www.typescriptlang.org/docs/>
- **Description**: Official TypeScript documentation and handbook.
- **Relevance**: All Hospeda code is written in TypeScript for type safety.

**Key Sections**:

- [Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Everyday Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html)
- [Utility Types](https://www.typescriptlang.org/docs/handbook/utility-types.html)

### Authentication

#### Better Auth

- **URL**: <https://www.better-auth.com/docs>
- **Description**: Self-hosted authentication library for TypeScript applications with plugin-based architecture.
- **Relevance**: Handles all user authentication in Hospeda (web, admin, and API) with database-backed sessions.

**Key Sections**:

- [Getting Started](https://www.better-auth.com/docs/introduction)
- [Basic Usage](https://www.better-auth.com/docs/basic-usage)
- [Plugins](https://www.better-auth.com/docs/plugins)

### Styling

#### Tailwind CSS

- **URL**: <https://tailwindcss.com/docs>
- **Description**: Utility-first CSS framework for rapid UI development.
- **Relevance**: Used for all styling in Hospeda web and admin apps.

**Key Sections**:

- [Utility Classes](https://tailwindcss.com/docs/utility-first)
- [Responsive Design](https://tailwindcss.com/docs/responsive-design)
- [Customization](https://tailwindcss.com/docs/configuration)

#### Shadcn UI

- **URL**: <https://ui.shadcn.com/>
- **Description**: Re-usable components built with Radix UI and Tailwind CSS.
- **Relevance**: Component library used in admin dashboard for consistent UI.

**Key Sections**:

- [Installation](https://ui.shadcn.com/docs/installation)
- [Components](https://ui.shadcn.com/docs/components)
- [Theming](https://ui.shadcn.com/docs/theming)

### DevOps

#### Vercel

- **URL**: <https://vercel.com/docs>
- **Description**: Deployment platform for frontend frameworks and serverless functions.
- **Relevance**: Hosts all Hospeda applications (web, admin, API) with automatic deployments.

**Key Sections**:

- [Deployments](https://vercel.com/docs/deployments/overview)
- [Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [Build Configuration](https://vercel.com/docs/build-step)

#### TurboRepo

- **URL**: <https://turbo.build/repo/docs>
- **Description**: High-performance build system for monorepos.
- **Relevance**: Manages builds, caching, and task orchestration for Hospeda monorepo.

**Key Sections**:

- [Configuration](https://turbo.build/repo/docs/core-concepts/monorepos/configuring-workspaces)
- [Caching](https://turbo.build/repo/docs/core-concepts/caching)
- [Pipelines](https://turbo.build/repo/docs/core-concepts/monorepos/running-tasks)

#### PNPM

- **URL**: <https://pnpm.io/>
- **Description**: Fast, disk-efficient package manager for Node.js.
- **Relevance**: Package manager for Hospeda monorepo with workspace support.

**Key Sections**:

- [Workspaces](https://pnpm.io/workspaces)
- [Configuration](https://pnpm.io/npmrc)
- [CLI](https://pnpm.io/cli/install)

### Testing

#### Vitest

- **URL**: <https://vitest.dev/>
- **Description**: Fast unit testing framework powered by Vite.
- **Relevance**: Used for all unit and integration tests in Hospeda.

**Key Sections**:

- [Getting Started](https://vitest.dev/guide/)
- [API](https://vitest.dev/api/)
- [Coverage](https://vitest.dev/guide/coverage.html)

#### Playwright

- **URL**: <https://playwright.dev/>
- **Description**: End-to-end testing framework for web applications.
- **Relevance**: Used for E2E tests in Hospeda web and admin apps.

**Key Sections**:

- [Writing Tests](https://playwright.dev/docs/writing-tests)
- [Assertions](https://playwright.dev/docs/test-assertions)
- [Best Practices](https://playwright.dev/docs/best-practices)

### Payments

#### Mercado Pago

- **URL**: <https://www.mercadopago.com.ar/developers/es/docs>
- **Description**: Latin American payment platform API documentation.
- **Relevance**: Payment processor for Hospeda bookings and subscriptions.

**Key Sections**:

- [API Reference](https://www.mercadopago.com.ar/developers/es/reference)
- [Checkout Pro](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/landing)
- [Webhooks](https://www.mercadopago.com.ar/developers/es/docs/checkout-api/webhooks)

---

## Learning Resources

### TypeScript

#### TypeScript Deep Dive

- **URL**: <https://basarat.gitbook.io/typescript/>
- **Description**: Comprehensive guide to TypeScript concepts and patterns.
- **Use for**: Learning advanced TypeScript features used in Hospeda.

#### TypeScript Exercises

- **URL**: <https://typescript-exercises.github.io/>
- **Description**: Interactive exercises to practice TypeScript.
- **Use for**: Improving TypeScript skills through hands-on practice.

### Testing

#### Testing JavaScript

- **URL**: <https://testingjavascript.com/>
- **Description**: Kent C. Dodds' comprehensive testing course.
- **Use for**: Learning testing best practices and test-informed development methodology.

#### Vitest Best Practices

- **URL**: <https://github.com/goldbergyoni/javascript-testing-best-practices>
- **Description**: Comprehensive guide to JavaScript testing best practices.
- **Use for**: Understanding testing patterns used in Hospeda.

### Monorepo

#### Monorepo Tools

- **URL**: <https://monorepo.tools/>
- **Description**: Comparison and guide to monorepo tools and practices.
- **Use for**: Understanding why Hospeda uses TurboRepo and PNPM workspaces.

#### TurboRepo Handbook

- **URL**: <https://turbo.build/repo/docs/handbook>
- **Description**: Best practices for monorepo development with TurboRepo.
- **Use for**: Optimizing build times and understanding caching strategies.

### React & Server Components

#### React Server Components

- **URL**: <https://react.dev/blog/2023/03/22/react-labs-what-we-have-been-working-on-march-2023#react-server-components>
- **Description**: Official blog post explaining React Server Components.
- **Use for**: Understanding RSC used in TanStack Start admin dashboard.

#### Next.js App Router

- **URL**: <https://nextjs.org/docs/app>
- **Description**: Similar patterns to TanStack Start, good learning resource.
- **Use for**: Understanding server/client component patterns.

### Database

#### PostgreSQL Tutorial

- **URL**: <https://www.postgresqltutorial.com/>
- **Description**: Comprehensive PostgreSQL tutorials and examples.
- **Use for**: Learning SQL and PostgreSQL-specific features.

#### Drizzle ORM Examples

- **URL**: <https://github.com/drizzle-team/drizzle-orm/tree/main/examples>
- **Description**: Official examples for various Drizzle ORM patterns.
- **Use for**: Learning advanced Drizzle patterns used in Hospeda.

---

## Tools & Utilities

### Database Tools

#### Drizzle Studio

- **URL**: <https://orm.drizzle.team/drizzle-studio/overview>
- **Description**: Visual database browser for Drizzle ORM.
- **Usage**: `pnpm db:studio` - Runs on `http://localhost:4983`

#### pgAdmin

- **URL**: <https://www.pgadmin.org/>
- **Description**: Open-source PostgreSQL administration tool.
- **Use for**: Advanced database management and query optimization.

#### Postico

- **URL**: <https://eggerapps.at/postico/>
- **Description**: Modern PostgreSQL client for macOS.
- **Use for**: Database browsing and queries on macOS.

#### TablePlus

- **URL**: <https://tableplus.com/>
- **Description**: Modern database management tool (cross-platform).
- **Use for**: Visual database management across all platforms.

### Development Tools

#### VS Code Extensions

**Essential for Hospeda Development**:

- [Astro](https://marketplace.visualstudio.com/items?itemName=astro-build.astro-vscode) - Astro language support
- [Biome](https://marketplace.visualstudio.com/items?itemName=biomejs.biome) - Linting and formatting
- [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss) - Tailwind autocomplete
- [Error Lens](https://marketplace.visualstudio.com/items?itemName=usernamehw.errorlens) - Inline error messages
- [Pretty TypeScript Errors](https://marketplace.visualstudio.com/items?itemName=yoavbls.pretty-ts-errors) - Better TS errors
- [Thunder Client](https://marketplace.visualstudio.com/items?itemName=rangav.vscode-thunder-client) - API testing

### Browser DevTools

#### React DevTools

- **Chrome**: <https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi>
- **Firefox**: <https://addons.mozilla.org/en-US/firefox/addon/react-devtools/>
- **Description**: Inspect React component trees and props.
- **Use for**: Debugging React components in web and admin apps.

#### Redux DevTools

- **Chrome**: <https://chrome.google.com/webstore/detail/redux-devtools/lmhkpmbekcpmknklioeibfkpmmfibljd>
- **Description**: State debugging for Redux/TanStack Query.
- **Use for**: Debugging TanStack Query cache and state.

### API Testing

#### Postman

- **URL**: <https://www.postman.com/>
- **Description**: API testing platform with collections and environments.
- **Use for**: Testing Hospeda API endpoints during development.

#### Insomnia

- **URL**: <https://insomnia.rest/>
- **Description**: Open-source API testing tool.
- **Use for**: Alternative to Postman for API testing.

#### HTTPie

- **URL**: <https://httpie.io/>
- **Description**: User-friendly command-line HTTP client.
- **Use for**: Quick API testing from terminal.

**Example**:

```bash
http POST localhost:3000/api/accommodations \
  title="Beach House" \
  city="Concepción" \
  Authorization:"Bearer TOKEN"
```

---

## Community

### Stack Overflow

**Relevant Tags**:

- [TypeScript](https://stackoverflow.com/questions/tagged/typescript) - TypeScript questions
- [React](https://stackoverflow.com/questions/tagged/reactjs) - React questions
- [Astro](https://stackoverflow.com/questions/tagged/astro) - Astro framework
- [Drizzle ORM](https://stackoverflow.com/questions/tagged/drizzle) - Database ORM
- [PostgreSQL](https://stackoverflow.com/questions/tagged/postgresql) - Database
- [Hono](https://stackoverflow.com/questions/tagged/hono) - Web framework
- [TanStack Query](https://stackoverflow.com/questions/tagged/react-query) - Data fetching
- [Tailwind CSS](https://stackoverflow.com/questions/tagged/tailwind-css) - Styling

### Discord Servers

#### Discord Servers Astro

- **Invite**: <https://astro.build/chat>
- **Description**: Official Astro Discord community.
- **Use for**: Astro-specific questions and help.

#### TanStack

- **Invite**: <https://tlinz.com/discord>
- **Description**: Official TanStack (Query, Router, Form, Start) community.
- **Use for**: TanStack library questions and updates.

#### Discord Servers Hono

- **Invite**: <https://discord.gg/KMh2eNSdxV>
- **Description**: Official Hono framework community.
- **Use for**: Hono API framework questions.

### GitHub Discussions

- [Astro Discussions](https://github.com/withastro/astro/discussions) - Astro community
- [Drizzle Discussions](https://github.com/drizzle-team/drizzle-orm/discussions) - Drizzle ORM
- [TanStack Discussions](https://github.com/TanStack/query/discussions) - TanStack libraries

### Reddit

- [r/typescript](https://www.reddit.com/r/typescript/) - TypeScript community
- [r/reactjs](https://www.reddit.com/r/reactjs/) - React community
- [r/webdev](https://www.reddit.com/r/webdev/) - General web development

---

## Reference

### HTTP Status Codes

- **URL**: <https://httpstatuses.com/>
- **Description**: Complete reference of HTTP status codes.
- **Use for**: Understanding API response codes in Hospeda.

**Common Codes**:

- `200 OK` - Successful request
- `201 Created` - Resource created
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - No permission
- `404 Not Found` - Resource doesn't exist
- `500 Internal Server Error` - Server error

### Regular Expressions

#### Regex101

- **URL**: <https://regex101.com/>
- **Description**: Interactive regex tester and debugger.
- **Use for**: Testing regex patterns for validation in Hospeda.

#### RegExr

- **URL**: <https://regexr.com/>
- **Description**: Learn, build, and test Regular Expressions.
- **Use for**: Learning regex for form validation.

### Conventional Commits

- **URL**: <https://www.conventionalcommits.org/>
- **Description**: Specification for commit message format.
- **Use for**: Writing proper commit messages in Hospeda.

**Format**: `<type>(<scope>): <description>`

**Types**:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `refactor:` - Code refactoring
- `test:` - Tests
- `chore:` - Maintenance

**Example**: `feat(accommodation): add search by city filter`

### Semantic Versioning

- **URL**: <https://semver.org/>
- **Description**: Versioning specification (MAJOR.MINOR.PATCH).
- **Use for**: Understanding package versions in Hospeda.

### JavaScript Date Formats

#### date-fns

- **URL**: <https://date-fns.org/>
- **Description**: Modern JavaScript date utility library.
- **Use for**: Date formatting and manipulation in Hospeda.

#### Temporal API

- **URL**: <https://tc39.es/proposal-temporal/docs/>
- **Description**: Modern date/time API proposal for JavaScript.
- **Use for**: Future-proofing date handling (when widely available).

### Web APIs

#### MDN Web Docs

- **URL**: <https://developer.mozilla.org/en-US/docs/Web/API>
- **Description**: Comprehensive web platform API reference.
- **Use for**: Understanding browser APIs used in Hospeda.

**Key APIs**:

- [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData)
- [Web Storage](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API)

---

## Stay Updated

### Newsletters

- [TypeScript Weekly](https://typescript-weekly.com/) - TypeScript news
- [React Newsletter](https://reactnewsletter.com/) - React updates
- [JavaScript Weekly](https://javascriptweekly.com/) - JavaScript news
- [Postgres Weekly](https://postgresweekly.com/) - PostgreSQL news

### Blogs

- [Astro Blog](https://astro.build/blog/) - Astro updates and tutorials
- [Vercel Blog](https://vercel.com/blog) - Deployment and performance
- [TanStack Blog](https://tanstack.com/blog) - TanStack library updates
- [Drizzle Blog](https://orm.drizzle.team/blog) - Drizzle ORM news

### YouTube Channels

- [Theo - t3.gg](https://www.youtube.com/@t3dotgg) - Full-stack TypeScript
- [Fireship](https://www.youtube.com/@Fireship) - Quick tech overviews
- [Web Dev Simplified](https://www.youtube.com/@WebDevSimplified) - Web fundamentals
- [Jack Herrington](https://www.youtube.com/@jherr) - TypeScript and React

---

## Contributing

Found a useful resource? Add it to this list!

1. Ensure it's official or highly trusted
2. Add under the appropriate category
3. Include URL, description, and relevance to Hospeda
4. Test the link works
5. Commit with: `docs(external-links): add resource for X`

---

Last updated: 2025-11-06
