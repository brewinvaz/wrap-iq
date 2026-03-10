# Superadmin Role & Admin Panel Design

## Overview

Platform-level superadmin role for WrapFlow.io operators. Superadmins can manage all organizations, users, and plans, impersonate tenant admins for debugging/support, and view platform-wide metrics.

**Related issues:** #36 (Superadmin role and admin panel), #23 (Audit logs)

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Superadmin creation | First via CLI seed, subsequent via API | Most secure — no API exposure for bootstrapping |
| Impersonation | Token swap | Explicit, auditable, self-contained — no header management |
| Org management scope | Full CRUD + users + metrics | Platform operators need full visibility |
| New tables | None | Existing User.is_superadmin + audit_logs sufficient |

## Authentication & Authorization

### require_superadmin dependency
- New dependency: checks `user.is_superadmin is True`, returns 403 otherwise
- All `/api/superadmin/*` routes use this dependency

### JWT changes
- Add `is_superadmin: bool` claim to access tokens
- Add `impersonating: bool` claim (default false)
- When impersonating: token has target org's `organization_id`, `impersonating: true`, `real_user_id` claim

### Permission fixes
- Fix `require_org_member()` to bypass for superadmins (currently raises 403 for users with no org)

### Superadmin seeding
- CLI command: `uv run python -m app.cli.seed_superadmin`
- Reads `SUPERADMIN_EMAIL` and `SUPERADMIN_PASSWORD` from env (or prompts)
- Creates User with `is_superadmin=True`, `organization_id=None`, `role=Role.ADMIN`
- Idempotent — skips if email already exists

## Impersonation

### Start impersonation
`POST /api/superadmin/impersonate/{org_id}`
- Validates org exists and `is_active`
- Creates short-lived access token (1 hour) with:
  - `sub`: superadmin's user_id
  - `org`: target org_id
  - `role`: "admin"
  - `is_superadmin`: true
  - `impersonating`: true
  - `real_user_id`: superadmin's user_id
- Logs `IMPERSONATION_STARTED` audit event on target org
- Returns new access token (no refresh token — must re-impersonate after expiry)

### Stop impersonation
`POST /api/superadmin/stop-impersonation`
- Returns fresh normal superadmin access token (no org, not impersonating)
- Logs `IMPERSONATION_STOPPED` audit event

### Behavior while impersonating
- All tenant-scoped routes work as if superadmin is that org's admin
- `get_current_user` returns the superadmin User object but with org context from token
- Impersonation is visible in audit logs via `real_user_id` in details

## API Routes

### Org management (`/api/superadmin/orgs`)

```
GET    /api/superadmin/orgs              # List all orgs (paginated, search by name)
GET    /api/superadmin/orgs/{id}         # Org detail + stats (user_count, work_order_count)
POST   /api/superadmin/orgs              # Create org manually
PATCH  /api/superadmin/orgs/{id}         # Update (name, plan_id, is_active)
```

### User management (`/api/superadmin/users`)

```
GET    /api/superadmin/users             # List users across all orgs (filter by org, role, active)
GET    /api/superadmin/users/{id}        # User detail
PATCH  /api/superadmin/users/{id}        # Update (role, is_active, is_superadmin)
POST   /api/superadmin/users             # Create superadmin user (no org)
```

### Platform metrics

```
GET    /api/superadmin/metrics           # Platform stats
```

Response:
```json
{
  "total_organizations": 42,
  "total_users": 156,
  "total_work_orders": 1230,
  "orgs_by_plan": [{"plan_name": "Free", "count": 30}, ...],
  "recent_signups": [{"org_name": "...", "created_at": "..."}]
}
```

### Audit logs

```
GET    /api/superadmin/audit-logs        # Cross-org audit logs (filter by org_id, action, user_id)
```

### Impersonation

```
POST   /api/superadmin/impersonate/{org_id}    # Start impersonation
POST   /api/superadmin/stop-impersonation      # Stop impersonation
```

## Audit Logging

### New ActionType values
- `IMPERSONATION_STARTED`
- `IMPERSONATION_STOPPED`
- `SUPERADMIN_ACTION`

### Audit log service changes
- Add `list_all_logs()` method — no org filter, supports org_id as optional filter param
- All superadmin write operations log with `action=SUPERADMIN_ACTION`, resource details in JSONB

### Impersonation audit format
```json
{
  "organization_id": "<target_org_id>",
  "user_id": "<superadmin_user_id>",
  "action": "IMPERSONATION_STARTED",
  "resource_type": "organization",
  "resource_id": "<target_org_id>",
  "details": {"real_user_id": "<superadmin_user_id>"}
}
```

## Security

- All superadmin endpoints require `require_superadmin` dependency
- Impersonation tokens are short-lived (1 hour, no refresh)
- All impersonation sessions are logged
- `is_superadmin` cannot be set via normal registration — only via CLI seed or existing superadmin
