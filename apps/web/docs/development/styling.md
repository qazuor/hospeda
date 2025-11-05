# Styling Guide

Complete guide to styling with Tailwind CSS and Shadcn UI.

---

## 📖 Overview

Hospeda Web App uses **Tailwind CSS** for utility-first styling and **Shadcn UI** for pre-built components.

**Key Concepts**:

- Utility-first CSS with Tailwind
- Component library with Shadcn
- Scoped styles in Astro components
- Mobile-first responsive design

---

## 🎨 Tailwind CSS Basics

### Utility Classes

Tailwind provides low-level utility classes for styling:

```astro
<!-- Text -->
<h1 class="text-4xl font-bold text-gray-900">Title</h1>
<p class="text-base text-gray-600">Description</p>

<!-- Layout -->
<div class="container mx-auto px-4">
  <div class="flex items-center justify-between">
    <span>Left</span>
    <span>Right</span>
  </div>
</div>

<!-- Spacing -->
<div class="mt-4 mb-8 px-6 py-3">
  Content with margin and padding
</div>

<!-- Colors -->
<button class="bg-primary text-white hover:bg-primary-dark">
  Click me
</button>
```

### Common Patterns

**Card Layout**:

```astro
<div class="rounded-lg shadow-md p-6 bg-white">
  <h3 class="text-xl font-semibold mb-2">Card Title</h3>
  <p class="text-gray-600">Card content</p>
</div>
```

**Grid Layout**:

```astro
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</div>
```

**Flexbox**:

```astro
<div class="flex flex-col md:flex-row gap-4 items-center justify-between">
  <div>Left content</div>
  <div>Right content</div>
</div>
```

---

## 📱 Responsive Design

### Breakpoints

Tailwind uses mobile-first breakpoints:

```text
sm:  640px  (small)
md:  768px  (medium)
lg:  1024px (large)
xl:  1280px (extra large)
2xl: 1536px (2x extra large)
```

### Responsive Classes

```astro
<!-- Mobile: 1 column, Tablet: 2 columns, Desktop: 3 columns -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <!-- Grid items -->
</div>

<!-- Hide on mobile, show on desktop -->
<div class="hidden lg:block">
  Desktop only content
</div>

<!-- Show on mobile, hide on desktop -->
<div class="block lg:hidden">
  Mobile only content
</div>

<!-- Responsive text sizes -->
<h1 class="text-2xl md:text-3xl lg:text-4xl">
  Responsive Heading
</h1>

<!-- Responsive padding -->
<div class="px-4 md:px-6 lg:px-8">
  Responsive padding
</div>
```

---

## 🎨 Color System

### Brand Colors

```typescript
// tailwind.config.mjs
export default {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#your-primary-color',
          dark: '#darker-shade',
          light: '#lighter-shade'
        },
        secondary: '#your-secondary-color',
        accent: '#your-accent-color'
      }
    }
  }
};
```

### Using Colors

```astro
<!-- Background -->
<div class="bg-primary">Primary background</div>

<!-- Text -->
<p class="text-primary">Primary text</p>

<!-- Border -->
<div class="border-2 border-primary">Primary border</div>

<!-- Hover states -->
<button class="bg-primary hover:bg-primary-dark">
  Hover me
</button>
```

### Grayscale

```astro
<p class="text-gray-900">Darkest gray</p>
<p class="text-gray-600">Medium gray</p>
<p class="text-gray-400">Light gray</p>
<p class="text-gray-200">Very light gray</p>
```

---

## 🧩 Shadcn UI Integration

### Using Shadcn Components

```tsx
// Import from Shadcn
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export function SearchForm() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Search Accommodations</CardTitle>
      </CardHeader>
      <CardContent>
        <Input placeholder="Enter location..." />
        <Button className="mt-4">Search</Button>
      </CardContent>
    </Card>
  );
}
```

### Available Components

Common Shadcn components:

- **Button** - Various button styles
- **Card** - Card containers
- **Input** - Form inputs
- **Select** - Dropdown selects
- **Dialog** - Modal dialogs
- **Tabs** - Tab navigation
- **Accordion** - Collapsible sections

### Customizing Shadcn

```tsx
// Add custom className to Shadcn components
<Button className="w-full mt-4 bg-primary hover:bg-primary-dark">
  Custom styled button
</Button>

<Card className="border-primary shadow-lg">
  <CardContent className="p-6">
    Custom card
  </CardContent>
</Card>
```

---

## 🎨 Scoped Styles (Astro)

### Basic Scoped Styles

```astro
<div class="custom-card">
  <h3>Title</h3>
  <p>Content</p>
</div>

<style>
  .custom-card {
    @apply rounded-lg shadow-md p-6;
    background: linear-gradient(to bottom, #fff, #f9f9f9);
  }

  .custom-card h3 {
    @apply text-xl font-bold mb-2;
  }

  .custom-card p {
    @apply text-gray-600;
  }
</style>
```

### Using @apply

```astro
<style>
  .btn {
    @apply px-4 py-2 rounded-lg font-medium transition;
  }

  .btn-primary {
    @apply bg-primary text-white hover:bg-primary-dark;
  }

  .btn-secondary {
    @apply bg-gray-200 text-gray-800 hover:bg-gray-300;
  }
</style>
```

### Scoped vs Global

**Scoped** (default in Astro):

```astro
<style>
  /* Only applies to this component */
  .card {
    @apply rounded-lg;
  }
</style>
```

**Global**:

```astro
<style is:global>
  /* Applies globally */
  .global-utility {
    @apply rounded-lg;
  }
</style>
```

---

## 🎯 Common Styling Patterns

### Button Variants

```astro
<!-- Primary button -->
<button class="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition">
  Primary Button
</button>

<!-- Secondary button -->
<button class="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition">
  Secondary Button
</button>

<!-- Outline button -->
<button class="px-6 py-3 border-2 border-primary text-primary rounded-lg hover:bg-primary hover:text-white transition">
  Outline Button
</button>
```

### Card Styles

```astro
<!-- Basic card -->
<div class="bg-white rounded-lg shadow-md p-6">
  <h3 class="text-xl font-semibold mb-2">Card Title</h3>
  <p class="text-gray-600">Card content</p>
</div>

<!-- Elevated card -->
<div class="bg-white rounded-lg shadow-lg hover:shadow-xl transition p-6">
  Hover me for elevation
</div>

<!-- Card with border -->
<div class="bg-white rounded-lg border-2 border-gray-200 p-6">
  Bordered card
</div>
```

### Form Styling

```astro
<!-- Form group -->
<div class="mb-4">
  <label class="block text-sm font-medium text-gray-700 mb-2">
    Label
  </label>
  <input
    type="text"
    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
    placeholder="Enter text..."
  />
</div>

<!-- Form with error -->
<div class="mb-4">
  <label class="block text-sm font-medium text-gray-700 mb-2">
    Email
  </label>
  <input
    type="email"
    class="w-full px-4 py-2 border border-red-500 rounded-lg focus:ring-2 focus:ring-red-500"
    placeholder="email@example.com"
  />
  <p class="text-red-500 text-sm mt-1">Invalid email address</p>
</div>
```

---

## 🌙 Dark Mode

### System-Based Dark Mode

```astro
<!-- Light/dark variants -->
<div class="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
  Content that adapts to dark mode
</div>

<button class="bg-primary dark:bg-primary-light text-white">
  Button with dark mode
</button>
```

### Toggling Dark Mode

```tsx
// src/components/DarkModeToggle.tsx
import { useEffect, useState } from 'react';

export function DarkModeToggle() {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <button onClick={() => setDarkMode(!darkMode)}>
      {darkMode ? '☀️' : '🌙'}
    </button>
  );
}
```

---

## ⚡ Performance Best Practices

### Avoid Inline Styles

```astro
<!-- ❌ Avoid: Inline styles -->
<div style="background-color: red; padding: 1rem;">
  Content
</div>

<!-- ✅ Better: Tailwind utilities -->
<div class="bg-red-500 p-4">
  Content
</div>
```

### Reuse Styles with @apply

```astro
<!-- ❌ Avoid: Repeating utilities -->
<button class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition">Button 1</button>
<button class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition">Button 2</button>

<!-- ✅ Better: Extract with @apply -->
<button class="btn-primary">Button 1</button>
<button class="btn-primary">Button 2</button>

<style>
  .btn-primary {
    @apply px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition;
  }
</style>
```

### Optimize for Production

Tailwind automatically purges unused styles in production:

```javascript
// tailwind.config.mjs
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  // Tailwind will scan these files and only include used utilities
};
```

---

## 🎨 Animation & Transitions

### Hover Effects

```astro
<div class="transition-all duration-300 hover:scale-105 hover:shadow-lg">
  Hover to scale and add shadow
</div>

<button class="bg-primary text-white transition-colors duration-200 hover:bg-primary-dark">
  Smooth color transition
</button>
```

### Custom Transitions

```astro
<style>
  .fade-in {
    opacity: 0;
    animation: fadeIn 0.5s ease-in forwards;
  }

  @keyframes fadeIn {
    to {
      opacity: 1;
    }
  }
</style>
```

---

## ✅ Styling Checklist

Before finalizing styles:

- [ ] Mobile-first responsive design
- [ ] Consistent spacing (use Tailwind's scale)
- [ ] Accessible color contrast
- [ ] Hover/focus states for interactive elements
- [ ] Loading and error states styled
- [ ] Dark mode support (if applicable)
- [ ] Animations are performant
- [ ] No unused CSS in production

---

## 📖 Quick Reference

### Spacing Scale

```text
0   → 0px
1   → 0.25rem (4px)
2   → 0.5rem (8px)
3   → 0.75rem (12px)
4   → 1rem (16px)
6   → 1.5rem (24px)
8   → 2rem (32px)
12  → 3rem (48px)
16  → 4rem (64px)
```

### Font Sizes

```text
xs   → 0.75rem (12px)
sm   → 0.875rem (14px)
base → 1rem (16px)
lg   → 1.125rem (18px)
xl   → 1.25rem (20px)
2xl  → 1.5rem (24px)
4xl  → 2.25rem (36px)
```

---

## 📚 Additional Resources

### Internal Documentation

- **[Component Organization](components.md)** - Component structure
- **[Islands Architecture](islands.md)** - Component types

### External Resources

- **[Tailwind CSS Docs](https://tailwindcss.com/docs)** - Official Tailwind documentation
- **[Shadcn UI](https://ui.shadcn.com)** - Component library documentation
- **[Tailwind Cheat Sheet](https://nerdcave.com/tailwind-cheat-sheet)** - Quick reference

---

⬅️ Back to [Development Guide](README.md)
