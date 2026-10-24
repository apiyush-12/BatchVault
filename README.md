# BatchVault

> **A private digital home for every college batch.**

BatchVault is a privacy-first platform for college students and alumni to preserve photos, videos, stories, events, and memories inside a private, invite-only batch space.

Instead of leaving college memories scattered across WhatsApp groups, phones, social media, and cloud drives, BatchVault gives every batch a shared archive designed to last.

**Private by default. Invite-only. Built for memories, not followers.**

---

## Live Demo

**Production:** https://batch-vault.vercel.app

> Batch content is private and accessible only to authenticated batch members.

---

## Features

### Authentication & Profiles

- Email/password authentication
- Email verification
- Password reset
- Profile onboarding
- Profile editing
- Avatar upload
- Secure session handling with Supabase Auth

### Private Batch Spaces

- Create private batch spaces
- Invite-only membership
- Owner, Admin, Moderator, and Member roles
- Approve or reject membership requests
- Remove members
- Change member roles
- Transfer batch ownership
- Manage batch settings

### Secure Invitations

- Shareable invite links
- Hashed invite tokens
- Invite expiration
- Usage limits
- Rate limiting
- Approval-based joining

Raw invite tokens are never stored in the database.

### Photo Uploads

- Private media storage
- JPEG validation
- File size validation
- EXIF/GPS metadata removal
- Two-phase upload/finalization
- Signed media access

### Video Uploads

- MP4 support
- File size restrictions
- Optional poster frame
- Reliable upload lifecycle
- Cleanup of rejected/orphaned media

### Gallery

- Private batch gallery
- Incremental pagination
- Photo and video memories
- Memory detail pages
- Captions
- Events
- Memory dates

### Timeline

Browse batch memories chronologically and explore memories grouped by year and event.

### Comments & Reactions

Members can interact with memories using:

- Comments
- Comment editing
- 👍 Like
- ❤️ Love
- 😂 Laugh
- 😮 Wow
- 😢 Sad

### Reporting & Moderation

- Report inappropriate content
- Moderation queue
- Remove reported content
- Dismiss reports
- Audit logs
- Operator-level moderation tools

### Batch Lifecycle

- Owner-only batch deletion
- Typed confirmation for destructive actions
- Immediate hiding after deletion
- 30-day restore period
- Permanent cleanup after the retention period

### Account Deletion

Users can permanently delete their accounts.

Shared memories and comments may remain as part of the batch archive and appear as content from a **Former member**.

Users must transfer ownership of active batches before deleting their account.

---

## Privacy & Security

BatchVault is designed around privacy at the database and storage level.

### PostgreSQL Row Level Security

All application tables use PostgreSQL Row Level Security.

```text
ENABLE ROW LEVEL SECURITY
FORCE ROW LEVEL SECURITY
```

Private batch content cannot be accessed simply by bypassing the frontend.

### Private Storage

Media is stored in private Supabase Storage buckets.

There are no public media buckets for batch memories.

Authorized users receive time-limited access to private media.

### Privileged Database Functions

Sensitive operations are handled through controlled PostgreSQL RPC functions, including:

- Batch creation
- Invitation creation
- Invitation redemption
- Membership approval
- Membership removal
- Role changes
- Ownership transfer
- Media preallocation
- Media finalization
- Reporting
- Moderation
- Batch deletion
- Batch restoration

### Server-Only Credentials

The Supabase service-role key is restricted to server-side code.

It is never exposed through `NEXT_PUBLIC_*` environment variables.

### EXIF/GPS Protection

JPEG metadata is sanitized before finalization to prevent embedded GPS information from being preserved accidentally.

---

## Tech Stack

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- shadcn/ui
- Framer Motion
- Lucide React

### Validation & Forms

- Zod
- React Hook Form

### Backend

- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Storage
- PostgreSQL RLS
- PostgreSQL RPC functions

### Testing

- Vitest
- Playwright

### Deployment

- Vercel
- Supabase Cloud

### Development

- pnpm
- Git
- GitHub

---

## Architecture

BatchVault follows a feature-oriented architecture.

```text
app/
├── (auth)/
├── (onboarding)/
├── (app)/
│   ├── home/
│   ├── settings/
│   └── batches/
├── api/
└── page.tsx

features/
├── authentication/
├── profiles/
├── batches/
├── memberships/
├── invitations/
├── media/
├── memories/
├── comments/
├── reactions/
└── moderation/

components/
├── ui/
└── motion/

lib/
├── auth/
├── authz/
├── env/
├── logging/
└── supabase/

supabase/
└── migrations/

tests/
├── unit/
├── db/
├── artifacts/
└── e2e/
```

Each feature owns its own:

```text
actions
queries
schemas
types
permissions
components
```

---

## Main User Flow

```text
Sign Up
   ↓
Verify Email
   ↓
Complete Profile
   ↓
Create or Join Batch
   ↓
Invite Classmates
   ↓
Upload Photos & Videos
   ↓
Browse Gallery & Timeline
   ↓
Comment & React
   ↓
Preserve Memories Together
```

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/apiyush-12/BatchVault.git
cd BatchVault
```

### 2. Install dependencies

```bash
corepack pnpm install
```

### 3. Configure environment variables

Copy:

```text
.env.example
```

to:

```text
.env.local
```

Configure:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000

SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
CRON_SECRET=
```

Never commit `.env.local`.

### 4. Apply database migrations

```bash
corepack pnpm dlx supabase@latest db push
```

Or use a direct database connection:

```bash
corepack pnpm dlx supabase@latest db push --db-url "<DATABASE_URL>"
```

### 5. Start the development server

```bash
corepack pnpm dev
```

Open:

```text
http://localhost:3000
```

---

## Windows Certificate Note

On some Windows or corporate environments, Node.js may not automatically use certificates from the Windows system certificate store.

If requests fail with:

```text
UNABLE_TO_VERIFY_LEAF_SIGNATURE
```

run:

```powershell
$env:NODE_OPTIONS="--use-system-ca"
corepack pnpm dev
```

Do not disable TLS certificate verification.

---

## Environment Variables

| Variable | Type | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client-safe | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client-safe | Supabase anonymous/publishable key |
| `NEXT_PUBLIC_SITE_URL` | Client-safe | Application base URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only | Privileged Supabase operations |
| `DATABASE_URL` | Server/tooling | PostgreSQL connection |
| `CRON_SECRET` | Server-only | Protects scheduled cleanup routes |

---

## Database

Main MVP tables include:

```text
profiles
batches
batch_members
batch_invites
memories
media_assets
comments
reactions
reports
audit_logs
```

Key database rules:

- RLS protects private batch data
- One active owner per batch
- Invite tokens are stored only as hashes
- One reaction per member per memory
- Comments are flat in the MVP
- Media uses a two-phase lifecycle
- Sensitive mutations use privileged RPCs
- Preservation-sensitive data uses soft deletion where appropriate

---

## Scheduled Maintenance

BatchVault includes scheduled cleanup jobs for:

- Rejected and abandoned media uploads
- Permanently deleting batches after the 30-day grace period

Cron routes are protected using `CRON_SECRET`.

Configuration is stored in:

```text
vercel.json
```

---

## Testing

### Lint

```bash
corepack pnpm lint
```

### Type Check

```bash
corepack pnpm typecheck
```

### Unit Tests

```bash
corepack pnpm test:unit
```

### Database & Security Tests

```bash
corepack pnpm test:db
```

### End-to-End Tests

```bash
corepack pnpm test:e2e
```

### Production Build

```bash
corepack pnpm build
```

---

## Deployment

### Supabase

Use separate Supabase projects for development and production.

Apply all migrations before deploying the production application.

### Vercel

Configure these production environment variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SITE_URL
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
CRON_SECRET
```

Preview deployments should not use the production Supabase database.

### Supabase Auth

Configure:

```text
Authentication → URL Configuration
```

Example:

```text
Site URL:
https://batch-vault.vercel.app
```

Allowed redirect:

```text
https://batch-vault.vercel.app/**
```

Custom SMTP is recommended for production email delivery.

---

## Roles

```text
Owner
  ↓
Admin
  ↓
Moderator
  ↓
Member
```

Database authorization remains the final source of truth for role permissions.

---

## MVP Status

- ✅ Authentication
- ✅ Profiles
- ✅ Private batch spaces
- ✅ Invitations
- ✅ Membership approval
- ✅ Role management
- ✅ Ownership transfer
- ✅ Photo uploads
- ✅ Video uploads
- ✅ Private media access
- ✅ Gallery
- ✅ Memory detail pages
- ✅ Timeline
- ✅ Comments
- ✅ Reactions
- ✅ Reporting
- ✅ Moderation
- ✅ Audit logging
- ✅ Batch deletion and restoration
- ✅ Account deletion
- ✅ Scheduled cleanup
- ✅ Production-ready Supabase migrations
- ✅ Vercel deployment support

---

## Post-MVP Ideas

The following features are intentionally deferred:

- Albums
- Time capsules
- Digital yearbooks
- Notifications
- Data export
- Advanced search
- On This Day memories
- AI-assisted organization
- Rich media transcoding
- Public showcase with explicit opt-in
- Storage quotas
- Advanced operator dashboard
- MFA/re-authentication for destructive actions

---

## Project Vision

BatchVault is built around one question:

> **Where will your college memories live ten years from now?**

The goal is to give every college batch a private digital space where its shared history can survive beyond phones, temporary group chats, and social media accounts.

---

## Repository

https://github.com/apiyush-12/BatchVault

---

<p align="center">
  <strong>BatchVault</strong><br/>
  Preserve the batch. Keep the memories.
</p>
