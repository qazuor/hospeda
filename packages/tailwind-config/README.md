# @repo/tailwind-config

Shared Tailwind CSS configuration and PostCSS setup for the Hospeda monorepo. Provides consistent styling foundation, custom design tokens, and optimized build configuration using Tailwind CSS v4.

## Features

- **Tailwind CSS v4**: Latest version with CSS-first configuration
- **Custom Theme Colors**: Brand-specific color palette
- **Shared Styles**: Centralized CSS imported across apps
- **PostCSS Integration**: Pre-configured PostCSS setup
- **Zero Config**: Import and use, no additional setup needed
- **Type Safety**: Works seamlessly with TypeScript

## Installation

This package is internal to the Hospeda monorepo and automatically available to all apps.

```bash
# Install dependencies (from project root)
pnpm install
```

## Package Exports

### 1. Shared Styles (`@repo/tailwind-config`)

Main CSS file with Tailwind imports and custom theme:

```css
/* packages/tailwind-config/shared-styles.css */
@import "tailwindcss";

@theme {
  --blue-1000: #2a8af6;
  --purple-1000: #a853ba;
  --red-1000: #e92a67;
}
```

**Import in your app:**

```typescript
// apps/web/src/main.ts or apps/admin/src/main.tsx
import '@repo/tailwind-config';
```

### 2. PostCSS Config (`@repo/tailwind-config/postcss`)

Pre-configured PostCSS setup with Tailwind plugin:

```javascript
// packages/tailwind-config/postcss.config.js
export const postcssConfig = {
  plugins: {
    '@tailwindcss/postcss': {}
  }
};
```

**Import in your app:**

```javascript
// apps/web/postcss.config.js
import { postcssConfig } from '@repo/tailwind-config/postcss';

export default postcssConfig;
```

## Usage

### In Astro (Web App)

**1. Import shared styles:**

```typescript
// apps/web/src/pages/_app.astro or layout
import '@repo/tailwind-config';
```

**2. Configure PostCSS:**

```javascript
// apps/web/postcss.config.js
import { postcssConfig } from '@repo/tailwind-config/postcss';

export default postcssConfig;
```

**3. Use in components:**

```astro
---
// apps/web/src/components/Hero.astro
---

<section class="bg-blue-1000 text-white p-8">
  <h1 class="text-4xl font-bold">Welcome to Hospeda</h1>
  <p class="text-lg">Find your perfect accommodation</p>
</section>
```

### In TanStack Start (Admin App)

**1. Import shared styles:**

```typescript
// apps/admin/src/main.tsx
import '@repo/tailwind-config';
```

**2. Configure PostCSS:**

```javascript
// apps/admin/postcss.config.js
import { postcssConfig } from '@repo/tailwind-config/postcss';

export default postcssConfig;
```

**3. Use in components:**

```tsx
// apps/admin/src/components/Dashboard.tsx
export function Dashboard() {
  return (
    <div className="bg-purple-1000 text-white rounded-lg p-6">
      <h2 className="text-2xl font-semibold">Admin Dashboard</h2>
    </div>
  );
}
```

## Custom Theme Colors

### Brand Colors

```css
@theme {
  --blue-1000: #2a8af6;    /* Primary blue */
  --purple-1000: #a853ba;  /* Accent purple */
  --red-1000: #e92a67;     /* Alert/Error red */
}
```

### Usage in CSS

```css
.custom-button {
  background-color: var(--blue-1000);
  color: white;
}

.accent-card {
  border-color: var(--purple-1000);
}

.error-message {
  color: var(--red-1000);
}
```

### Usage with Tailwind Classes

```tsx
// Blue (Primary)
<button className="bg-blue-1000 hover:bg-blue-900">
  Click Me
</button>

// Purple (Accent)
<div className="border-purple-1000 text-purple-1000">
  Accent Content
</div>

// Red (Error)
<p className="text-red-1000 font-semibold">
  Error: Something went wrong
</p>
```

## Tailwind CSS v4 Features

### CSS-First Configuration

Tailwind v4 uses CSS variables and `@theme` instead of JavaScript config:

**Old (v3):**

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: '#2a8af6'
      }
    }
  }
};
```

**New (v4):**

```css
/* shared-styles.css */
@theme {
  --color-brand: #2a8af6;
}
```

### Benefits

- **Faster Builds**: No JavaScript config parsing
- **Better IDE Support**: CSS variables work in all editors
- **Runtime Flexibility**: Can be changed with JavaScript
- **Type Safety**: Full IntelliSense support

## Configuration Examples

### Extending Theme Colors

Add more colors in your app:

```css
/* apps/web/src/styles/global.css */
@import '@repo/tailwind-config';

@theme {
  --green-1000: #22c55e;
  --yellow-1000: #f59e0b;
}
```

### Custom Utilities

Add custom utility classes:

```css
/* apps/web/src/styles/utilities.css */
@import '@repo/tailwind-config';

@layer utilities {
  .text-balance {
    text-wrap: balance;
  }

  .scrollbar-hide {
    scrollbar-width: none;
  }
}
```

### Custom Components

Create reusable component styles:

```css
/* apps/web/src/styles/components.css */
@import '@repo/tailwind-config';

@layer components {
  .btn-primary {
    @apply bg-blue-1000 text-white px-4 py-2 rounded-lg;
    @apply hover:bg-blue-900 transition-colors;
  }

  .card {
    @apply bg-white shadow-lg rounded-lg p-6;
    @apply border border-gray-200;
  }
}
```

## PostCSS Configuration

### Basic Setup

```javascript
// postcss.config.js
import { postcssConfig } from '@repo/tailwind-config/postcss';

export default postcssConfig;
```

### Extended Setup

Add additional PostCSS plugins:

```javascript
// postcss.config.js
import { postcssConfig } from '@repo/tailwind-config/postcss';

export default {
  ...postcssConfig,
  plugins: {
    ...postcssConfig.plugins,
    'autoprefixer': {},
    'cssnano': process.env.NODE_ENV === 'production' ? {} : false
  }
};
```

## Best Practices

### 1. Import Shared Styles Early

```typescript
// ✅ Good: Import in main entry point
// apps/web/src/main.ts
import '@repo/tailwind-config';
import './app.css';

// ❌ Bad: Import in individual components
// apps/web/src/components/Button.tsx
import '@repo/tailwind-config'; // Duplicates styles!
```

### 2. Use Custom Colors Consistently

```tsx
// ✅ Good: Use custom brand colors
<button className="bg-blue-1000 text-white">
  Primary Action
</button>

// ❌ Bad: Hardcode colors
<button style={{ backgroundColor: '#2a8af6' }}>
  Primary Action
</button>
```

### 3. Layer Your Styles

```css
/* ✅ Good: Use proper layers */
@layer components {
  .btn {
    @apply px-4 py-2 rounded;
  }
}

@layer utilities {
  .text-balance {
    text-wrap: balance;
  }
}

/* ❌ Bad: No layers */
.btn {
  padding: 0.5rem 1rem;
  border-radius: 0.25rem;
}
```

### 4. Avoid Inline Styles

```tsx
// ✅ Good: Use Tailwind classes
<div className="bg-blue-1000 p-4 rounded-lg">
  Content
</div>

// ❌ Bad: Inline styles
<div style={{
  backgroundColor: 'var(--blue-1000)',
  padding: '1rem',
  borderRadius: '0.5rem'
}}>
  Content
</div>
```

### 5. Organize Custom Styles

```
apps/web/src/styles/
├── global.css        # Global styles + theme extensions
├── components.css    # Component classes
├── utilities.css     # Utility classes
└── vendor.css        # Third-party overrides
```

## Examples

### Button Component

```tsx
// apps/web/src/components/Button.tsx
import type { ReactNode } from 'react';

interface ButtonProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
}

export function Button({ children, variant = 'primary' }: ButtonProps) {
  const variants = {
    primary: 'bg-blue-1000 hover:bg-blue-900',
    secondary: 'bg-purple-1000 hover:bg-purple-900',
    danger: 'bg-red-1000 hover:bg-red-900'
  };

  return (
    <button className={`
      ${variants[variant]}
      text-white font-semibold
      px-6 py-3 rounded-lg
      transition-colors duration-200
      focus:outline-none focus:ring-2 focus:ring-offset-2
    `}>
      {children}
    </button>
  );
}
```

### Card Component

```tsx
// apps/admin/src/components/Card.tsx
import type { ReactNode } from 'react';

interface CardProps {
  title: string;
  children: ReactNode;
  accent?: 'blue' | 'purple' | 'red';
}

export function Card({ title, children, accent = 'blue' }: CardProps) {
  const accents = {
    blue: 'border-l-4 border-blue-1000',
    purple: 'border-l-4 border-purple-1000',
    red: 'border-l-4 border-red-1000'
  };

  return (
    <div className={`
      ${accents[accent]}
      bg-white rounded-lg shadow-md p-6
    `}>
      <h3 className="text-xl font-bold mb-4">{title}</h3>
      {children}
    </div>
  );
}
```

### Alert Component

```tsx
// apps/web/src/components/Alert.tsx
import type { ReactNode } from 'react';

interface AlertProps {
  children: ReactNode;
  type?: 'info' | 'success' | 'warning' | 'error';
}

export function Alert({ children, type = 'info' }: AlertProps) {
  const types = {
    info: 'bg-blue-100 border-blue-1000 text-blue-900',
    success: 'bg-green-100 border-green-600 text-green-900',
    warning: 'bg-yellow-100 border-yellow-600 text-yellow-900',
    error: 'bg-red-100 border-red-1000 text-red-900'
  };

  return (
    <div className={`
      ${types[type]}
      border-l-4 p-4 rounded
    `}>
      {children}
    </div>
  );
}
```

## Customization

### Adding New Theme Colors

Edit `packages/tailwind-config/shared-styles.css`:

```css
@import "tailwindcss";

@theme {
  /* Existing colors */
  --blue-1000: #2a8af6;
  --purple-1000: #a853ba;
  --red-1000: #e92a67;

  /* New colors */
  --green-1000: #22c55e;
  --orange-1000: #f97316;
}
```

### Creating Color Scales

```css
@theme {
  /* Blue scale */
  --blue-50: #eff6ff;
  --blue-100: #dbeafe;
  --blue-500: #3b82f6;
  --blue-900: #1e3a8a;
  --blue-1000: #2a8af6;

  /* Purple scale */
  --purple-50: #faf5ff;
  --purple-100: #f3e8ff;
  --purple-500: #a855f7;
  --purple-900: #581c87;
  --purple-1000: #a853ba;
}
```

### Custom Font Families

```css
@import "tailwindcss";

@theme {
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-serif: 'Merriweather', serif;
  --font-mono: 'Fira Code', monospace;
}
```

### Custom Breakpoints

```css
@theme {
  --breakpoint-xs: 480px;
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
  --breakpoint-2xl: 1536px;
}
```

## Troubleshooting

### Issue: "Tailwind classes not working"

**Solution:**

Ensure shared styles are imported:

```typescript
// apps/web/src/main.ts
import '@repo/tailwind-config'; // Must be imported!
```

### Issue: "Custom colors not available"

**Solution:**

Check that `@theme` block is in your CSS:

```css
/* shared-styles.css */
@import "tailwindcss";

@theme {
  --blue-1000: #2a8af6;
}
```

### Issue: "PostCSS errors"

**Solution:**

Verify PostCSS config:

```javascript
// postcss.config.js
import { postcssConfig } from '@repo/tailwind-config/postcss';

export default postcssConfig;
```

### Issue: "Styles not applying in production"

**Solution:**

Ensure CSS is properly imported in build:

```typescript
// Vite/Astro config
export default {
  css: {
    postcss: './postcss.config.js'
  }
};
```

## Migration from Tailwind v3

### Before (v3)

```javascript
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{astro,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: '#2a8af6'
      }
    }
  }
};
```

### After (v4)

```css
/* shared-styles.css */
@import "tailwindcss";

@theme {
  --brand: #2a8af6;
}
```

**Steps:**

1. Remove `tailwind.config.js`
2. Move theme to CSS `@theme` block
3. Import `@repo/tailwind-config`
4. Update PostCSS config

## Integration with Build Tools

### Vite

```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  css: {
    postcss: './postcss.config.js'
  }
});
```

### Astro

```typescript
// astro.config.mjs
export default {
  vite: {
    css: {
      postcss: './postcss.config.js'
    }
  }
};
```

### TanStack Start

```typescript
// app.config.ts
export default {
  vite: {
    css: {
      postcss: './postcss.config.js'
    }
  }
};
```

## Related Packages

- `@repo/ui` - Shared React components (uses this config)
- `@repo/biome-config` - Linting configuration (sorts Tailwind classes)
- `@repo/typescript-config` - TypeScript configuration

## Resources

- [Tailwind CSS v4 Documentation](https://tailwindcss.com/docs)
- [Tailwind CSS v4 Migration Guide](https://tailwindcss.com/docs/upgrade-guide)
- [PostCSS Documentation](https://postcss.org/)
- [CSS @theme Directive](https://tailwindcss.com/docs/theme)

## Contributing

### Adding New Colors

1. Edit `packages/tailwind-config/shared-styles.css`
2. Add color to `@theme` block
3. Document in this README
4. Test in both apps (web + admin)
5. Commit changes

### Proposing Theme Changes

1. Create example component using new theme
2. Show before/after comparisons
3. Discuss with team
4. Update shared styles
5. Update documentation

## Performance Tips

### 1. Import Only Once

```typescript
// ✅ Good: Import in root
import '@repo/tailwind-config';

// ❌ Bad: Import in multiple files
// Increases bundle size!
```

### 2. Use PurgeCSS (Automatic)

Tailwind v4 automatically removes unused styles in production.

### 3. Minimize Custom CSS

```css
/* ✅ Good: Use Tailwind utilities */
<div className="flex items-center gap-4">

/* ❌ Bad: Custom CSS for common patterns */
.flex-center {
  display: flex;
  align-items: center;
  gap: 1rem;
}
```

## License

Private - Hospeda Project
