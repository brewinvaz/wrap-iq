# Audit Logs Implementation Plan

**Goal:** Implement audit log tracking for all significant user and system actions within an organization. Provides searchable, filterable audit log API and activity feed support.

**Architecture:** Single `audit_logs` table, tenant-scoped via TenantMixin, with action enum and JSONB for flexible metadata storage.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 (async), Alembic, pytest

**Related Issue:** #23

---

### Task 1: Add AuditLog model with ActionType enum

**Files:**
- Create: `backend/app/models/audit_log.py`
- Create: `backend/tests/test_models/test_audit_log.py`
- Modify: `backend/app/models/__init__.py`

**Step 1: Write the failing test**

Create `backend/tests/test_models/test_audit_log.py`

**Step 2: Run test to verify it fails**

**Step 3: Write the AuditLog model**

Create `backend/app/models/audit_log.py`

**Step 4: Update models __init__.py**

**Step 5: Run test to verify it passes**

**Step 6: Commit**

```bash
git add backend/app/models/ backend/tests/
git commit -m "feat: add AuditLog model with ActionType enum"
```

---

### Task 2: Add AuditLog service

**Files:**
- Create: `backend/app/services/audit_log.py`
- Create: `backend/tests/test_services/test_audit_log.py`

**Step 1: Write the failing test**

**Step 2: Run test to verify it fails**

**Step 3: Write the AuditLog service**

**Step 4: Run test to verify it passes**

**Step 5: Commit**

```bash
git add backend/app/services/ backend/tests/
git commit -m "feat: add AuditLog service for creating and querying logs"
```

---

### Task 3: Add audit log API routes

**Files:**
- Create: `backend/app/schemas/audit_logs.py`
- Create: `backend/app/routers/audit_logs.py`
- Create: `backend/tests/test_routers/test_audit_logs.py`
- Modify: `backend/app/main.py`

**Step 1: Create Pydantic schemas**

**Step 2: Create router**

**Step 3: Register router in main.py**

**Step 4: Write API tests**

**Step 5: Run tests, commit**

```bash
git add backend/app/routers/ backend/app/schemas/ backend/app/main.py backend/tests/
git commit -m "feat: add audit log API routes with filtering and pagination"
```

---

### Task 4: Generate Alembic migration

**Step 1: Generate migration**

**Step 2: Review migration**

**Step 3: Commit**

```bash
git add backend/alembic/
git commit -m "feat: add migration for audit_logs table"
```

---

### Task 5: Run full test suite, lint, and verify

**Step 1:** Run all tests
**Step 2:** Lint
**Step 3:** Fix any issues
**Step 4:** Commit fixes
