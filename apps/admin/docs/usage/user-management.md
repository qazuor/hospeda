# User Management Guide

Complete guide to managing users, roles, and permissions in the Hospeda Admin Dashboard.

---

## Overview

User management is a core responsibility for platform administrators. This guide covers everything you need to know about managing users, from creating accounts to handling permissions and monitoring activity.

**What you will learn:**

- Viewing and searching users
- Creating and editing user accounts
- Managing roles and permissions
- User status management (active, suspended, deleted)
- Activity logs and audit trails
- Bulk user operations

**Prerequisites:**

- Admin or Manager role required
- Viewers cannot manage users

---

## Viewing Users

### Users List

**Access:** Sidebar - Users

**The users list shows:**

```text

  Users                                  [+ New User]

  [Search users...]
  [Filters]  [Export]

  Name          Email              Role      Status

  John Doe      john@example.com   Admin     Active
  Jane Smith    jane@example.com   Editor    Active
  Bob Wilson    bob@example.com    Viewer    Suspended

```

**Columns:**

- **Name** - Full name with avatar/initials
- **Email** - Primary email address
- **Role** - Admin, Manager, Editor, or Viewer
- **Status** - Active, Suspended, or Pending
- **Actions** - Quick actions menu

### Search Users

**Search by:**

- Name (first or last name)
- Email address
- Role
- Phone number

**Examples:**

```text
john                    - Finds "John Doe", "Johnny Smith", etc.
@example.com            - Finds all users with example.com email
admin                   - Finds users with "admin" role
+54                     - Finds users with Argentina phone numbers
```

### Filter Users

**Filter by:**

- **Role** - Admin, Manager, Editor, Viewer
- **Status** - Active, Suspended, Pending
- **Registration Date** - Last 7 days, 30 days, custom range
- **Last Activity** - Active today, this week, inactive 30+ days
- **Subscription** - Free, Pro, Enterprise (if applicable)

**Save custom filters:**

1. Apply desired filters
2. Click **Save Filter**
3. Name your filter (e.g., "Inactive Users")
4. Access from Filters dropdown

---

## Creating Users

### Add New User

**Access:** Users - New User button

**Required information:**

#### Basic Information

- **Full Name*** - User's complete name
- **Email Address*** - Must be unique, used for login
- **Phone Number** - With country code (optional)
- **Role*** - Select appropriate role

#### Optional Information

- **Company** - Organization name
- **Job Title** - User's position
- **Profile Picture** - Upload avatar
- **Notes** - Internal notes (not visible to user)

**\* Required fields**

### Step-by-Step: Creating a User

#### Step 1: Open Form

1. Go to Users list
2. Click **New User** button
3. Form opens in modal or new page

#### Step 2: Fill Basic Info

```text
Full Name: John Doe
Email: john.doe@example.com
Phone: +54 9 11 1234-5678
```

#### Step 3: Assign Role

- Select from dropdown: Admin, Manager, Editor, or Viewer
- See Roles section for details

#### Step 4: Set Password

**Two options:**

- **Auto-generate** - System creates secure password
- **Manual** - Set custom password (min 8 characters)

**Recommended:** Auto-generate and send via email

#### Step 5: Send Welcome Email

**Options:**

- **Send welcome email** - User receives credentials
- **Skip email** - For manual delivery

**Welcome email includes:**

- Login URL
- Username (email)
- Temporary password (if auto-generated)
- Instructions for first login

#### Step 6: Save

- Click **Create User**
- Confirmation message appears
- User appears in list immediately

### Bulk User Import

**For creating multiple users:**

**Access:** Users - Import - Upload CSV

**CSV format:**

```csv
name,email,role,phone,company
John Doe,john@example.com,editor,+54911123456,Acme Corp
Jane Smith,jane@example.com,viewer,+54911654321,Beta Inc
```

**Steps:**

1. Download CSV template
2. Fill in user data
3. Upload file
4. Review preview
5. Confirm import

**Validation:**

- Valid emails required
- Roles must match exactly (admin, manager, editor, viewer)
- Duplicate emails rejected
- Invalid rows skipped with error report

---

## Editing Users

### Update User Information

**Access:** Users - Click user - Edit button

**Or:** Quick action menu - Edit

**Editable fields:**

- Full name
- Email address
- Phone number
- Role (requires Admin permission)
- Company and job title
- Profile picture
- Status (Active/Suspended)

**Cannot edit:**

- User ID
- Registration date
- Auth provider ID (external auth ID)

### Step-by-Step: Editing a User

#### Step 1: Open User Details

1. Find user in list
2. Click on user row or name
3. User details page opens

#### Step 2: Click Edit

- Click **Edit** button (top right)
- Form becomes editable

#### Step 3: Make Changes

- Update desired fields
- Changes are tracked for audit

#### Step 4: Save Changes

- Click **Save**
- Changes are logged in activity
- User receives email if email changed

### Quick Edit

**For simple changes:**

1. Hover over user in list
2. Click quick edit icon
3. Edit inline (role, status)
4. Press Enter to save

---

## Roles and Permissions

### Role Hierarchy

**From most to least privileged:**

```text
Admin > Manager > Editor > Viewer
```

### Admin Role

#### Full platform access

**Permissions:**

- **User Management** - Create, edit, delete users
- **Role Management** - Assign any role
- **Content Management** - Full CRUD on all content
- **Publishing** - Publish/unpublish content
- **Settings** - Modify platform settings
- **Analytics** - View all analytics
- **Billing** - Access billing and payments
- **System** - Access system logs and config

**Use cases:**

- Platform owners
- Technical administrators
- Senior management

### Manager Role

#### Content and operations management

**Permissions:**

- **Content Management** - Full CRUD on content
- **Publishing** - Publish/unpublish content
- **Analytics** - View analytics and reports
- **User Viewing** - View user list and details
- Cannot create/edit/delete users
- Cannot modify settings
- Cannot access billing

**Use cases:**

- Content team leads
- Operations managers
- Marketing managers

### Editor Role

#### Content creation and editing

**Permissions:**

- **Content Creation** - Create new content
- **Content Editing** - Edit own content
- **Draft Management** - Save drafts
- **Submit for Review** - Request publication
- Cannot publish content
- Cannot delete (can archive own)
- Cannot manage users
- Cannot modify settings

**Use cases:**

- Content writers
- Junior content team
- Freelance contributors

### Viewer Role

#### Read-only access

**Permissions:**

- **View Content** - See all published content
- **View Analytics** - Basic analytics access
- **Export Data** - Export lists and reports
- Cannot modify content
- Cannot manage users
- Cannot modify settings

**Use cases:**

- Stakeholders
- Report viewers
- External consultants
- Support team (read-only)

### Changing User Roles

**Access:** User details - Edit - Role dropdown

**Steps:**

1. Open user for editing
2. Select new role from dropdown
3. Confirm role change
4. Save changes

**Security notes:**

- Only Admins can change roles
- Cannot demote yourself (prevent lockout)
- Role changes logged in audit trail
- User notified via email of role change

---

## User Status Management

### User Statuses

#### Active

**Meaning:** User can log in and use the platform

**Indicates:**

- Account is active
- Can log in
- Full permissions based on role

#### Suspended

**Meaning:** User cannot log in, account temporarily disabled

**Use cases:**

- Policy violations
- Payment issues
- Security concerns
- Temporary suspension

**Effects:**

- Cannot log in
- Existing sessions terminated
- Data preserved
- Can be reactivated

#### Pending

**Meaning:** Account created but not yet activated

**Use cases:**

- Email verification pending
- Manual approval required
- Payment pending

**Effects:**

- Cannot log in until activated
- Will receive activation email

### Suspending a User

**When to suspend:**

- Policy violations
- Suspicious activity
- Payment issues
- User request

**Steps:**

1. Open user details
2. Click **Suspend** button
3. Select reason from dropdown
4. Add notes (required)
5. Choose notification option:
   - Notify user via email
   - Suspend without notification
6. Confirm suspension

**Example suspension note:**

```text
Reason: Policy Violation
Details: User posted inappropriate content.
Suspended pending investigation.
Review date: 2024-02-15
Contact: support@hospeda.com.ar
```

### Reactivating a User

**Steps:**

1. Find suspended user
2. Open user details
3. Click **Reactivate** button
4. Add reactivation notes (optional)
5. Choose notification:
   - Notify user of reactivation
   - Reactivate silently
6. Confirm reactivation

**User receives:**

- Email notification (if selected)
- Can log in immediately
- Access restored based on role

---

## Deleting Users

### Soft Delete vs Hard Delete

#### Soft Delete (Archive)

**Recommended for most cases.**

**Effects:**

- User cannot log in
- Data preserved in database
- Content remains (attributed to "Deleted User")
- Can be restored if needed
- Audit trail maintained

**Use cases:**

- User accounts no longer needed
- Compliance with data retention
- Preserve historical data

#### Hard Delete (Permanent)

**Use with extreme caution.**

**Effects:**

- User completely removed
- All personal data deleted
- Cannot be restored
- Content orphaned or anonymized
- May affect relational data

**Use cases:**

- GDPR "right to be forgotten" requests
- Legal requirements
- Security incidents
- Duplicate accounts

### Step-by-Step: Deleting a User

#### Step 1: Choose Delete Type

- User details - Actions - Delete
- Select: Soft Delete or Hard Delete

#### Step 2: Confirm Deletion

**Dialog appears:**

```text
Delete User?

This will delete john@example.com

Soft Delete (recommended)
- Account archived
- Data preserved
- Can be restored

[Cancel]  [Soft Delete]  [Hard Delete]
```

#### Step 3: Add Reason

- Required for audit trail
- Explain why deleting

#### Step 4: Handle Content

**Options:**

- Keep content (attribute to "Deleted User")
- Reassign content to another user
- Delete content with user

#### Step 5: Confirm

- Type user email to confirm
- Click final confirmation
- Deletion processed immediately

---

## Activity Logs

### User Activity

**Access:** User details - Activity tab

**Shows:**

- Login history
- Actions performed
- Content created/edited
- Permission changes
- Status changes

**Example log:**

```text
Recent Activity for john@example.com

2024-01-15 10:30 - Logged in from 192.168.1.1
2024-01-15 10:35 - Created accommodation "Hotel Central"
2024-01-15 11:00 - Published event "Wine Festival"
2024-01-15 11:30 - Edited destination "Buenos Aires"
2024-01-15 12:00 - Logged out
```

**Filters:**

- Date range
- Action type (login, create, edit, delete, publish)
- Content type
- IP address

### Audit Trail

**Access:** User details - Audit tab

**Shows changes to user account:**

```text
Audit Trail for john@example.com

2024-01-10 - Account created by admin@hospeda.com
           Role: Editor
           Status: Active

2024-01-12 - Role changed by admin@hospeda.com
           From: Editor
           To: Manager
           Reason: Promotion

2024-01-15 - Status changed by admin@hospeda.com
           From: Active
           To: Suspended
           Reason: Policy violation
           Note: Inappropriate content posted
```

**Audit log includes:**

- Who made the change
- What was changed
- When it was changed
- Why (if reason provided)
- Before/after values

---

## Bulk Operations

### Bulk User Actions

**Access:** Users list - Select users - Actions menu

**Available actions:**

- **Change Status** - Activate/suspend multiple users
- **Change Role** - Assign new role to multiple users
- **Delete** - Delete multiple users
- **Export** - Export selected users
- **Send Email** - Send message to selected users

### Step-by-Step: Bulk Status Change

#### Step 1: Select Users

- Check boxes next to users
- Or: Select All checkbox

#### Step 2: Choose Action

- Actions menu appears
- Select **Change Status**

#### Step 3: Select New Status

- Active, Suspended, or Pending
- Add reason/notes (required)

#### Step 4: Preview

```text
Change Status for 15 users?

From: Mixed
To: Active

Users:
- john@example.com
- jane@example.com
- bob@example.com
... (12 more)

[Cancel]  [Confirm]
```

#### Step 5: Confirm

- Review user list
- Click Confirm
- Changes applied immediately

### Bulk Role Assignment

**Use case:** Upgrading multiple Editors to Managers

**Steps:**

1. Select target users
2. Actions - Change Role
3. Select new role: Manager
4. Add reason: "Team promotion Q1 2024"
5. Confirm changes

**Safety notes:**

- Cannot bulk-assign Admin role (security)
- Requires Admin permission
- All changes logged in audit trail
- Users notified via email

### Bulk Export

**Export user data to CSV/Excel:**

**Steps:**

1. Apply filters (optional)
2. Select users or Select All
3. Actions - Export
4. Choose format: CSV or Excel
5. Choose fields to include
6. Download file

**Exported fields:**

- User ID
- Name
- Email
- Role
- Status
- Registration date
- Last login
- Custom fields

---

## Advanced Search

### Search Operators

**Combine criteria for precise results:**

```text
role:admin status:active           - Active admins only
email:*@example.com created:2024  - Users from example.com created in 2024
inactive:30d role:editor           - Editors inactive 30+ days
```

**Operators:**

- `role:` - Filter by role
- `status:` - Filter by status
- `email:` - Search email (supports wildcards *)
- `created:` - Filter by creation date
- `login:` - Filter by last login
- `inactive:` - Days since last activity

### Saved Searches

**Save frequently used searches:**

**Example saved searches:**

- "New Users This Week"
- "Inactive Admins"
- "Suspended Accounts"
- "Pending Verification"

**To save:**

1. Apply search/filters
2. Click **Save Search**
3. Name your search
4. Access from Searches dropdown

---

## Best Practices

### Security

- **Principle of least privilege** - Give minimum required role
- **Regular audits** - Review user list monthly
- **Remove inactive users** - Suspend accounts after 90 days inactivity
- **Document changes** - Always add notes when suspending/deleting
- **Monitor admin accounts** - Extra scrutiny for high-privilege users
- **Strong passwords** - Enforce password complexity

### User Management

- **Standardize naming** - Use "First Last" format consistently
- **Verify emails** - Confirm email before creating account
- **Use bulk operations** - For efficiency with multiple users
- **Keep records** - Export user lists for backups
- **Communicate changes** - Notify users of role/status changes
- **Use soft delete** - Preserve data when possible

### Common Workflows

**Onboarding new team member:**

1. Create user account
2. Assign Editor role initially
3. Send welcome email with resources
4. Monitor first week activity
5. Promote to Manager if needed

**Offboarding team member:**

1. Suspend account immediately
2. Review and reassign their content
3. Document reason for departure
4. Archive (soft delete) after 30 days
5. Hard delete after retention period (if required)

---

## Troubleshooting

### Common Issues

#### User Can't Log In

**Check:**

- Account status (must be Active)
- Email is correct
- No typos in email
- Check spam folder for welcome email
- Try password reset

#### User Doesn't Have Expected Permissions

**Check:**

- User role (Admin, Manager, Editor, Viewer)
- Role matches expected permissions
- User has logged out and back in (permissions cached)

#### Can't Delete User

**Possible reasons:**

- User is last Admin (would lock you out)
- User has active bookings/reservations
- User has pending transactions
- Try soft delete instead
- Resolve dependencies first

#### Bulk Operation Failed

**Check:**

- All selected users meet criteria
- You have Admin permission
- No users in the selection are system accounts
- Try smaller batches

---

## Related Documentation

**Learn more:**

- **[Dashboard Overview](./dashboard.md)** - Platform interface
- **[Content Management](./content-management.md)** - Managing content
- **[Back to Usage Docs](./README.md)** - All usage guides

**For developers:**

- **[Authentication](../AUTH_SYSTEM.md)** - Auth integration
- **[Architecture](../architecture.md)** - System design

---

Back to [Usage Documentation](./README.md)
