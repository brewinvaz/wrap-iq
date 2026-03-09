# WrapFlow.io Foundation Design

## Overview

Foundational architecture for WrapFlow.io: multi-tenant SaaS project management for vehicle wrap shops. This design covers the core infrastructure that all features build on — multi-tenancy, authentication, authorization, and the initial data models.

**Related issues:** #32 (Multi-tenant architecture), #10 (RBAC), #35 (Plans), #36 (Superadmin)

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Multi-tenancy | Shared DB, `organization_id` column | Simple migrations, easy cross-org analytics, sufficient isolation for this domain |
| Auth | Self-managed JWT + magic links | No external dependency, full control, free |
| Password hashing | bcrypt | Industry standard, built-in salt |
| Email | Resend (console fallback in dev) | 3k emails/month free, simple API |
| Tenant isolation | FastAPI dependency injection | Auto-filters queries by org_id, prevents cross-tenant leaks |

## Data Models

### Organization

```
Organization
├── id: UUID (PK)
├── name: str
├── slug: str (unique, URL-friendly)
├── plan_id: UUID (FK → Plan)
├── is_active: bool (default true)
├── created_at: datetime
└── updated_at: datetime
```

### Plan

```
Plan
├── id: UUID (PK)
├── name: str (e.g., "Free", "Pro", "Enterprise")
├── features: JSONB (feature flags and limits)
├── price_cents: int (0 for free)
├── is_default: bool (one plan marked as default)
├── created_at: datetime
└── updated_at: datetime
```

The default free plan is seeded in the first migration.

### User

```
User
├── id: UUID (PK)
├── organization_id: UUID (FK → Organization, nullable for superadmins)
├── email: str (unique)
├── password_hash: str (nullable — magic-link-only users)
├── role: RoleEnum
├── is_active: bool (default true)
├── is_superadmin: bool (default false)
├── created_at: datetime
└── updated_at: datetime
```

### RoleEnum

```
Admin | ProjectManager | Installer | Designer | Production | Client
```

- `Admin` is assigned on self-service signup (one per org initially)
- Other roles are assigned by the Admin when inviting team members
- `Client` role is for client portal access (magic link only)
- `is_superadmin` is orthogonal to role — superadmins are platform operators, not tenant users

### MagicLink

```
MagicLink
├── id: UUID (PK)
├── user_id: UUID (FK → User)
├── token: str (unique, URL-safe random)
├── expires_at: datetime (default: 15 minutes)
├── used_at: datetime (nullable)
└── created_at: datetime
```

### RefreshToken

```
RefreshToken
├── id: UUID (PK)
├── user_id: UUID (FK → User)
├── token: str (unique, URL-safe random)
├── expires_at: datetime (default: 30 days)
├── revoked_at: datetime (nullable)
└── created_at: datetime
```

## Auth Flows

### Self-Service Signup

```
Client → POST /api/auth/register { name, email, password, org_name }
  1. Create Organization (with default free plan)
  2. Create User (role=Admin, org_id=new org)
  3. Return access_token + refresh_token
```

### Email/Password Login

```
Client → POST /api/auth/login { email, password }
  1. Verify credentials
  2. Return access_token + refresh_token
```

### Magic Link

```
Client → POST /api/auth/magic-link/request { email }
  1. Find user by email
  2. Generate token, store MagicLink record
  3. Send email via Resend (or log to console in dev)

Client → POST /api/auth/magic-link/verify { token }
  1. Look up MagicLink, check not expired/used
  2. Mark as used
  3. Return access_token + refresh_token
```

### Token Refresh

```
Client → POST /api/auth/token/refresh { refresh_token }
  1. Validate refresh token (not expired, not revoked)
  2. Return new access_token
```

### Logout

```
Client → POST /api/auth/logout { refresh_token }
  1. Revoke refresh token
```

## API Routes

```
POST   /api/auth/register              # Create org + admin user
POST   /api/auth/login                 # Email/password → tokens
POST   /api/auth/magic-link/request    # Send magic link email
POST   /api/auth/magic-link/verify     # Magic link token → tokens
POST   /api/auth/token/refresh         # Refresh → new access token
POST   /api/auth/logout                # Revoke refresh token
GET    /api/users/me                   # Current user profile
```

## Tenant Isolation

All tenant-scoped queries go through a `TenantSession` that auto-filters by `organization_id`:

```python
# FastAPI dependency
async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    """Decode JWT, load user from DB."""

async def get_tenant_session(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AsyncSession:
    """Return session pre-filtered to user's organization."""
```

Every model that inherits from `TenantMixin` gets an `organization_id` column. The tenant session ensures queries only return rows matching the current user's org.

Superadmins bypass tenant filtering and can optionally impersonate a specific org via an `X-Org-Id` header.

## Superadmin

- `is_superadmin` flag on User model
- Not scoped to any org (`organization_id` is nullable)
- Can impersonate tenant admins via `X-Org-Id` header
- Can manage plans, orgs, and users across all tenants
- All superadmin actions are audit-logged
- Superadmin routes are under `/api/admin/` with additional auth checks

## New Dependencies

### Backend (pyproject.toml)
- `PyJWT` — JWT encoding/decoding
- `bcrypt` — password hashing
- `resend` — magic link emails

## File Structure (new files)

```
backend/app/
├── auth/
│   ├── __init__.py
│   ├── dependencies.py    # get_current_user, get_tenant_session
│   ├── jwt.py             # Token creation/verification
│   ├── passwords.py       # Hashing/verification
│   └── magic_links.py     # Magic link generation/verification
├── models/
│   ├── base.py            # Base model, TenantMixin
│   ├── organization.py
│   ├── user.py
│   ├── plan.py
│   ├── magic_link.py
│   └── refresh_token.py
├── routers/
│   ├── auth.py            # Auth endpoints
│   └── users.py           # User profile endpoints
├── schemas/
│   ├── auth.py            # Register, Login, Token schemas
│   └── users.py           # User response schemas
├── services/
│   ├── auth.py            # Auth business logic
│   ├── email.py           # Resend integration
│   └── users.py           # User CRUD
└── alembic/               # Migrations directory
    ├── alembic.ini
    ├── env.py
    └── versions/
        └── 001_initial.py  # Org, User, Plan, MagicLink, RefreshToken
```
