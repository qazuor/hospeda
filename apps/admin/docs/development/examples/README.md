# Working Examples

This directory contains complete, working example files that demonstrate real-world patterns used in the Hospeda Admin Dashboard.

All examples are **copy-paste ready** and follow the project's coding standards and architecture patterns.

## 📁 Examples

### 1. [crud-page.tsx](./crud-page.tsx) - Complete CRUD Page

**Lines:** 868 | **Size:** 26KB

A fully functional products management page demonstrating:

- **List view** with TanStack Table (sorting, filtering, pagination)
- **Create/Edit forms** with TanStack Form + Zod validation
- **Delete** with confirmation dialog
- **TanStack Query** for data fetching and mutations
- **Optimistic updates**
- **Error handling** and loading states
- **Protected route** with authentication
- **Permission checks** (role-based)
- **Toast notifications** on success/error

**Key patterns:**

- Complete CRUD operations in one page
- Dialog-based forms for create/edit
- Server-side pagination with URL search params
- Inline table actions
- Type-safe API functions

### 2. [dashboard-page.tsx](./dashboard-page.tsx) - Dashboard with Widgets

**Lines:** 677 | **Size:** 18KB

A comprehensive dashboard showing:

- **Multiple data sources** with parallel queries
- **Summary cards** (KPIs) with trend indicators
- **Charts/graphs** visualization (simple bar charts)
- **Recent activity** list with real-time updates
- **Quick actions** grid
- **Real-time data** with auto-refetch
- **Loading skeletons** for all widgets
- **Error boundaries** with fallbacks
- **Responsive grid layout**

**Key patterns:**

- Parallel data fetching with multiple queries
- Auto-refreshing data (configurable intervals)
- Modular widget components
- Custom loading skeletons
- Time-relative formatting (e.g., "5m ago")

### 3. [form-example.tsx](./form-example.tsx) - Complex Form

**Lines:** 1384 | **Size:** 42KB

An advanced multi-step form wizard demonstrating:

- **Multi-step wizard** form (6 steps)
- **Array fields** (dynamic add/remove contacts, social media)
- **Nested object fields** (address, coordinates)
- **Dependent fields** (show/hide based on other fields)
- **Async validation** with debouncing (check name availability)
- **File upload** fields (logo, images)
- **Custom field components** (TagInput, AddressFields, ImageUpload)
- **Field-level error** messages
- **Form-level validation**
- **Progress indicator** and step navigation
- **Submit with loading** state

**Key patterns:**

- Multi-step form with progress tracking
- Complex nested data structures
- Async validation with debouncing
- Custom reusable field components
- Dynamic array fields with add/remove
- File upload with preview
- Tag/multi-select inputs
- Conditional field rendering

### 4. [table-example.tsx](./table-example.tsx) - Advanced Table

**Lines:** 1010 | **Size:** 28KB

A sophisticated table with all features:

- **Server-side** sorting and filtering
- **Column visibility** toggle
- **Resizable columns**
- **Row selection** with bulk actions
- **Expandable rows** (show order items)
- **Custom cell renderers** (status badges, formatted dates)
- **Column filters** (text, select, date range)
- **Export to CSV** (selected or all rows)
- **Virtualization** ready for large datasets
- **Sticky header**
- **Loading states** and error handling
- **Global search** across all columns
- **Pagination** with row count

**Key patterns:**

- Server-side table operations
- Row expansion for nested data
- Bulk actions with selection
- Column filtering with popovers
- CSV export functionality
- Custom cell renderers
- Sticky header for scrolling
- Empty and error states

## 🚀 Usage

### Copy-Paste Ready

All examples are designed to be copy-pasted directly into your project:

1. Copy the entire file
2. Adjust the route path and imports
3. Update API endpoints and types to match your data
4. Customize styling and behavior as needed

### Learning Path

**Recommended order:**

1. **Start with `crud-page.tsx`** - Learn basic CRUD patterns
2. **Study `dashboard-page.tsx`** - Understand parallel queries and widgets
3. **Explore `form-example.tsx`** - Master complex forms
4. **Review `table-example.tsx`** - Learn advanced table features

### Integration

All examples follow the Hospeda Admin patterns:

- **Routes**: Use `createFileRoute` from TanStack Router
- **Forms**: Use TanStack Form + Zod validation
- **Data**: Use TanStack Query for server state
- **UI**: Use Shadcn UI components
- **Types**: Full TypeScript type safety
- **Styling**: Tailwind CSS utility classes

## 📚 Related Documentation

- [Creating Pages Tutorial](../creating-pages.md) - Step-by-step CRUD tutorial
- [Forms Guide](../forms.md) - Complete form patterns
- [Tables Guide](../tables.md) - Table features and patterns
- [Queries Guide](../queries.md) - Data fetching best practices
- [Architecture Overview](../../architecture.md) - Admin app structure

## 💡 Tips

### Customization

**API Endpoints:**

All examples use placeholder API endpoints like `/api/v1/products`. Update these to match your actual API:

```tsx
// Before
const response = await fetch('/api/v1/products', {
  credentials: 'include',
});

// After (your API)
const response = await fetch(`${process.env.API_URL}/api/v1/products`, {
  credentials: 'include',
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
```

**Types:**

Examples define local types for demonstration. In your app, import from shared packages:

```tsx
// Before (example)
type Product = {
  id: string;
  name: string;
  // ...
};

// After (your app)
import type { Product } from '@repo/types';
```

**Validation:**

Examples use inline Zod schemas. In your app, import from schemas package:

```tsx
// Before (example)
const productSchema = z.object({
  name: z.string().min(2),
  // ...
});

// After (your app)
import { createProductSchema } from '@repo/schemas';
```

### Performance

- Use **server-side pagination** for large datasets (see `table-example.tsx`)
- Implement **virtualization** for tables with 1000+ rows
- Use **optimistic updates** for better UX (see `crud-page.tsx`)
- Enable **auto-refetch** judiciously (see `dashboard-page.tsx`)

### Accessibility

All examples include basic accessibility features:

- Proper label associations
- Keyboard navigation support
- ARIA attributes where needed
- Focus management in dialogs

Enhance as needed for WCAG compliance.

## 🔍 Pattern Highlights

### CRUD Operations

```tsx
// Create
const mutation = useMutation({
  mutationFn: createProduct,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['products'] });
  },
});

// Read
const { data } = useQuery({
  queryKey: ['products', id],
  queryFn: () => getProduct(id),
});

// Update
const mutation = useMutation({
  mutationFn: (data) => updateProduct(id, data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['products'] });
  },
});

// Delete
const mutation = useMutation({
  mutationFn: () => deleteProduct(id),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['products'] });
  },
});
```

### Form Patterns

```tsx
// Multi-step form
const [step, setStep] = useState(1);

const nextStep = () => {
  if (currentStep < totalSteps) {
    setCurrentStep(currentStep + 1);
  }
};

// Array fields
<form.Field name="contacts" mode="array">
  {(field) => (
    <div>
      {field.state.value.map((_, index) => (
        <form.Field name={`contacts[${index}].name`}>
          {(subField) => <input {...subField} />}
        </form.Field>
      ))}
    </div>
  )}
</form.Field>
```

### Table Patterns

```tsx
// Server-side sorting
const { data } = useQuery({
  queryKey: ['orders', { sortBy, sortOrder }],
  queryFn: () => getOrders({ sortBy, sortOrder }),
});

// Row selection
const [rowSelection, setRowSelection] = useState({});

const table = useReactTable({
  state: { rowSelection },
  onRowSelectionChange: setRowSelection,
  enableRowSelection: true,
});

// Bulk actions
const selectedRows = table.getSelectedRowModel().rows;
```

## 📄 License

These examples are part of the Hospeda project and follow the same license.

---

⬅️ Back to [Development Documentation](../README.md)
