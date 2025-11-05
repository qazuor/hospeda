# Usage Documentation

Complete guide for using the Hospeda Admin Dashboard to manage the platform.

---

## 📖 Overview

This section provides **step-by-step guides** for administrators and content managers using the Hospeda Admin Dashboard. Whether you're managing accommodations, users, or content, you'll find clear instructions and best practices here.

**Who this is for:**

- **Platform Administrators** - Managing users, roles, and permissions
- **Content Managers** - Creating and publishing accommodations, destinations, events
- **Marketing Team** - Managing promotions, analytics, and SEO
- **Support Team** - Viewing user activity, handling inquiries

---

## 🎯 Getting Started

### First Time Using the Admin Dashboard?

Follow these steps to get oriented:

1. **[Dashboard Overview](./dashboard.md)** - Understand the interface (5 minutes)
2. **[User Management](./user-management.md)** - Learn user operations (10 minutes)
3. **[Content Management](./content-management.md)** - Master content workflows (15 minutes)

### Quick Access by Role

| Role | Primary Tasks | Start Here |
|------|---------------|------------|
| **Admin** | User management, permissions | [User Management](./user-management.md) |
| **Content Manager** | Create/edit content | [Content Management](./content-management.md) |
| **Marketing** | Analytics, promotions | [Dashboard Overview](./dashboard.md) |
| **Support** | View activity, assist users | [User Management](./user-management.md) |

---

## 📚 Usage Guides

### Dashboard & Interface

**[Dashboard Overview](./dashboard.md)**

- Understanding the dashboard layout
- Analytics and metrics overview
- Quick actions and shortcuts
- Notifications and alerts
- Customizing your workspace

### User Management

**[User Management Guide](./user-management.md)**

- Viewing and searching users
- Creating new user accounts
- Editing user information
- Managing roles and permissions
- Suspending and deleting users
- Activity logs and audit trail
- Bulk operations

### Content Management

**[Content Management Guide](./content-management.md)**

- Creating accommodations
- Managing destinations
- Publishing events
- Content workflow and approval
- Draft and scheduling
- SEO metadata
- Image management
- Bulk import/export

---

## 🗺️ Common Tasks

Quick links to frequently performed operations:

### Daily Operations

| Task | Guide | Section |
|------|-------|---------|
| View platform statistics | [Dashboard](./dashboard.md) | Analytics |
| Add new accommodation | [Content Management](./content-management.md) | Accommodations |
| Edit accommodation details | [Content Management](./content-management.md) | Editing Content |
| Publish/unpublish content | [Content Management](./content-management.md) | Publishing |
| View recent user activity | [User Management](./user-management.md) | Activity Logs |

### User Operations

| Task | Guide | Section |
|------|-------|---------|
| Create new admin user | [User Management](./user-management.md) | Creating Users |
| Change user role | [User Management](./user-management.md) | Roles & Permissions |
| Reset user password | [User Management](./user-management.md) | Password Management |
| View user's booking history | [User Management](./user-management.md) | User Details |
| Suspend problematic user | [User Management](./user-management.md) | User Status |

### Content Operations

| Task | Guide | Section |
|------|-------|---------|
| Add destination | [Content Management](./content-management.md) | Destinations |
| Create event | [Content Management](./content-management.md) | Events |
| Upload images | [Content Management](./content-management.md) | Media |
| Schedule content | [Content Management](./content-management.md) | Scheduling |
| Bulk import accommodations | [Content Management](./content-management.md) | Bulk Operations |

---

## 🔑 Key Concepts

### User Roles

The admin dashboard uses four role levels:

- **Admin**: Full access to all features including user management
- **Manager**: Can manage content and view analytics, cannot manage users
- **Editor**: Can create and edit content, cannot publish or delete
- **Viewer**: Read-only access for reporting and analytics

**Learn more:** [User Management - Roles](./user-management.md#roles-and-permissions)

### Content Status

Content items can have different statuses:

- **Draft**: Work in progress, not visible to public
- **Pending Review**: Submitted for approval
- **Scheduled**: Approved, will publish at specific time
- **Published**: Live and visible to public
- **Archived**: No longer active but preserved

**Learn more:** [Content Management - Status Workflow](./content-management.md#content-status-workflow)

### Publishing Workflow

Standard content workflow:

1. **Create** - Editor creates draft content
2. **Review** - Manager reviews and provides feedback
3. **Approve** - Manager approves for publishing
4. **Schedule** - Set publish date/time (optional)
5. **Publish** - Content goes live
6. **Monitor** - Track performance and engagement

**Learn more:** [Content Management - Publishing](./content-management.md#publishing-workflow)

---

## 💡 Best Practices

### Content Quality

- ✅ Always add descriptive titles and complete descriptions
- ✅ Include high-quality images (minimum 1200x800px)
- ✅ Fill in all SEO fields (meta description, keywords)
- ✅ Verify contact information and links
- ✅ Preview content before publishing
- ✅ Use consistent formatting and style

### User Administration

- ✅ Use least privilege principle for roles
- ✅ Review user activity logs regularly
- ✅ Document reason when suspending users
- ✅ Keep user information up to date
- ✅ Enforce strong password policies
- ✅ Regular audits of admin users

### Safety Guidelines

- ⚠️ **Always preview** before publishing
- ⚠️ **Double-check** bulk operations
- ⚠️ **Verify** before deleting (cannot undo)
- ⚠️ **Schedule** major content updates during low-traffic hours
- ⚠️ **Backup** important data before bulk changes
- ⚠️ **Test** new features in preview mode first

---

## 🆘 Getting Help

### Common Questions

#### "I can't publish content"

→ Check your role permissions. Only Managers and Admins can publish.

→ See: [User Management - Roles](./user-management.md#roles-and-permissions)

#### "Where do I upload images?"

→ Images are uploaded within each content form.

→ See: [Content Management - Images](./content-management.md#image-management)

#### "How do I schedule content?"

→ Use the Schedule section when creating/editing content.

→ See: [Content Management - Scheduling](./content-management.md#scheduling-content)

#### "I made a mistake, can I undo?"

→ Most edits can be reverted through version history.

→ Deletions cannot be undone - contact tech support.

→ See: [Content Management - Version History](./content-management.md#version-history)

#### "How do I export data?"

→ Use the Export button in list views.

→ See: [Content Management - Export](./content-management.md#exporting-data)

### Need More Help?

If you can't find what you need:

1. **Search this documentation** - Use Ctrl/Cmd + F
2. **Check [Dashboard](./dashboard.md)** - Interface and features overview
3. **Ask your manager** - They may have team-specific workflows
4. **Contact IT support** - For technical issues or bugs
5. **Request feature** - Submit enhancement requests to product team

---

## 📖 Additional Resources

### For Developers

If you're building features or integrating with the admin:

- **[Development Documentation](../development/README.md)** - Technical guides
- **[Architecture Overview](../architecture.md)** - System design
- **[API Documentation](../../../api/docs/README.md)** - Backend API

### Platform Documentation

- **[Web App Documentation](../../../web/docs/README.md)** - Public website
- **[Database Schema](../../../../packages/db/docs/README.md)** - Data structure
- **[Project Guidelines](../../../../CLAUDE.md)** - Development standards

---

⬅️ Back to [Admin Documentation](../README.md)
