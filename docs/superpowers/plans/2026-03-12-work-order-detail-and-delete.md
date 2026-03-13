# Work Order Detail Page & Delete Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a work order detail page and hard-delete functionality with invoice guard.

**Architecture:** Backend gets a DELETE endpoint with cascade logic in a new service function. The existing GET endpoint's response schema is extended with `status_timestamps`. Frontend gets a new detail page at `/dashboard/work-orders/[id]` following the Projects detail page pattern, plus delete actions on both list and detail pages.

**Tech Stack:** FastAPI, SQLAlchemy (async), Pydantic, Next.js 15, React 19, Tailwind CSS 4

---

## Chunk 1: Backend — Schema Update & Delete Endpoint

### Task 1: Add `status_timestamps` to WorkOrderResponse schema

**Files:**
- Modify: `backend/app/schemas/work_orders.py:84-102`
- Modify: `backend/app/routers/work_orders.py:75-103`

- [ ] **Step 1: Add `status_timestamps` field to `WorkOrderResponse`**

In `backend/app/schemas/work_orders.py`, add `status_timestamps` to the `WorkOrderResponse` class:

```python
class WorkOrderResponse(BaseModel):
    id: uuid.UUID
    job_number: str
    job_type: JobType
    job_value: int
    priority: Priority
    date_in: datetime
    estimated_completion_date: datetime | None = None
    completion_date: datetime | None = None
    internal_notes: str | None = None
    checklist: list[ChecklistItem] | None = None
    status_timestamps: dict[str, str] | None = None  # ADD THIS LINE
    status: KanbanStageResponse | None = None
    vehicles: list[VehicleInWorkOrder] = []
    client_id: uuid.UUID | None = None
    client_name: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 2: Add `status_timestamps` to `_to_response` in the router**

In `backend/app/routers/work_orders.py`, update the `_to_response` function to include `status_timestamps`:

```python
def _to_response(wo) -> WorkOrderResponse:
    vehicles = [
        {
            "id": wov.vehicle.id,
            "make": wov.vehicle.make,
            "model": wov.vehicle.model,
            "year": wov.vehicle.year,
            "vin": wov.vehicle.vin,
        }
        for wov in (wo.work_order_vehicles or [])
    ]
    return WorkOrderResponse(
        id=wo.id,
        job_number=wo.job_number,
        job_type=wo.job_type,
        job_value=wo.job_value,
        priority=wo.priority,
        date_in=wo.date_in,
        estimated_completion_date=wo.estimated_completion_date,
        completion_date=wo.completion_date,
        internal_notes=wo.internal_notes,
        checklist=wo.checklist,
        status_timestamps=wo.status_timestamps,  # ADD THIS LINE
        status=wo.status,
        vehicles=vehicles,
        client_id=wo.client_id,
        client_name=wo.client.name if wo.client else None,
        created_at=wo.created_at,
        updated_at=wo.updated_at,
    )
```

- [ ] **Step 3: Run existing tests to verify no regressions**

Run: `make test`
Expected: All existing work order tests pass (the new field is optional so existing responses just gain a null field).

- [ ] **Step 4: Commit**

```bash
git add backend/app/schemas/work_orders.py backend/app/routers/work_orders.py
git commit -m "feat: add status_timestamps to WorkOrderResponse schema"
```

### Task 2: Add delete service function

**Files:**
- Modify: `backend/app/services/work_orders.py`

- [ ] **Step 1: Write the `delete_work_order` service function**

Add the following to `backend/app/services/work_orders.py`. **Keep all existing imports** (`uuid`, `datetime`, `func`, `or_`, `select`, `AsyncSession`, `selectinload`, `Client`, `WorkOrder`, `WorkOrderVehicle`). Merge the new imports with the existing ones at the top of the file:

```python
# --- ADD these new imports (merge with existing `from sqlalchemy import ...` line) ---
import logging

from sqlalchemy import delete as sa_delete  # add sa_delete to existing sqlalchemy import line
# e.g.: from sqlalchemy import delete as sa_delete, func, or_, select

from app.models.design_details import DesignDetails
from app.models.estimate import Estimate
from app.models.estimate_line_item import EstimateLineItem
from app.models.file_upload import FileUpload
from app.models.install_details import InstallDetails, InstallTimeLog
from app.models.invoice import Invoice
from app.models.production_details import ProductionDetails
from app.models.render import Render
from app.models.time_log import TimeLog
from app.models.wrap_details import WrapDetails
from app.services.r2 import delete_object, is_r2_configured

logger = logging.getLogger(__name__)


async def delete_work_order(session: AsyncSession, wo: WorkOrder) -> None:
    """Hard-delete a work order and all dependent records.

    Raises HTTPException(409) if invoices are linked.
    R2 cleanup is best-effort — failures are logged but do not block deletion.
    """
    from fastapi import HTTPException

    # Invoice guard
    invoice_count = await session.execute(
        select(func.count(Invoice.id)).where(Invoice.work_order_id == wo.id)
    )
    if invoice_count.scalar():
        raise HTTPException(
            status_code=409,
            detail="Cannot delete work order with linked invoices",
        )

    wo_id = wo.id

    # Best-effort R2 cleanup for file_uploads
    if is_r2_configured():
        file_result = await session.execute(
            select(FileUpload.r2_key).where(FileUpload.work_order_id == wo_id)
        )
        for (key,) in file_result.all():
            try:
                delete_object(key)
            except Exception:
                logger.warning("Failed to delete R2 object: %s", key)

        # Best-effort R2 cleanup for renders
        render_result = await session.execute(
            select(
                Render.vehicle_photo_key,
                Render.wrap_design_key,
                Render.result_image_key,
            ).where(Render.work_order_id == wo_id)
        )
        for row in render_result.all():
            for key in row:
                if key:
                    try:
                        delete_object(key)
                    except Exception:
                        logger.warning("Failed to delete R2 object: %s", key)

    # Cascade-delete dependent records in FK-safe order
    await session.execute(
        sa_delete(FileUpload).where(FileUpload.work_order_id == wo_id)
    )
    await session.execute(
        sa_delete(TimeLog).where(TimeLog.work_order_id == wo_id)
    )

    # EstimateLineItems → Estimates
    est_ids_result = await session.execute(
        select(Estimate.id).where(Estimate.work_order_id == wo_id)
    )
    est_ids = [row[0] for row in est_ids_result.all()]
    if est_ids:
        await session.execute(
            sa_delete(EstimateLineItem).where(
                EstimateLineItem.estimate_id.in_(est_ids)
            )
        )
    await session.execute(
        sa_delete(Estimate).where(Estimate.work_order_id == wo_id)
    )

    await session.execute(
        sa_delete(Render).where(Render.work_order_id == wo_id)
    )
    await session.execute(
        sa_delete(WrapDetails).where(WrapDetails.work_order_id == wo_id)
    )
    await session.execute(
        sa_delete(DesignDetails).where(DesignDetails.work_order_id == wo_id)
    )
    await session.execute(
        sa_delete(ProductionDetails).where(ProductionDetails.work_order_id == wo_id)
    )

    # InstallTimeLog → InstallDetails
    install_ids_result = await session.execute(
        select(InstallDetails.id).where(InstallDetails.work_order_id == wo_id)
    )
    install_ids = [row[0] for row in install_ids_result.all()]
    if install_ids:
        await session.execute(
            sa_delete(InstallTimeLog).where(
                InstallTimeLog.install_details_id.in_(install_ids)
            )
        )
    await session.execute(
        sa_delete(InstallDetails).where(InstallDetails.work_order_id == wo_id)
    )

    await session.execute(
        sa_delete(WorkOrderVehicle).where(WorkOrderVehicle.work_order_id == wo_id)
    )

    await session.delete(wo)
    await session.commit()
```

Note: The merged import section at the top of the file should look like:
```python
import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy import delete as sa_delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.client import Client
from app.models.design_details import DesignDetails
from app.models.estimate import Estimate
from app.models.estimate_line_item import EstimateLineItem
from app.models.file_upload import FileUpload
from app.models.install_details import InstallDetails, InstallTimeLog
from app.models.invoice import Invoice
from app.models.production_details import ProductionDetails
from app.models.render import Render
from app.models.time_log import TimeLog
from app.models.work_order import WorkOrder, WorkOrderVehicle
from app.models.wrap_details import WrapDetails
from app.services.r2 import delete_object, is_r2_configured

logger = logging.getLogger(__name__)
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/work_orders.py
git commit -m "feat: add delete_work_order service with cascade and invoice guard"
```

### Task 3: Add DELETE endpoint and tests

**Files:**
- Modify: `backend/app/routers/work_orders.py:1-27` (imports) and append endpoint
- Modify: `backend/tests/test_routers/test_work_orders.py`

- [ ] **Step 1: Write failing tests for the DELETE endpoint**

Add the following tests to `backend/tests/test_routers/test_work_orders.py`:

```python
async def test_delete_work_order(client, db_session):
    token = await _register_and_seed_stages(client, db_session)

    # Create a work order
    create_resp = await client.post(
        "/api/work-orders",
        json={"date_in": "2026-03-10T10:00:00Z"},
        headers={"Authorization": f"Bearer {token}"},
    )
    wo_id = create_resp.json()["id"]

    # Delete it
    resp = await client.delete(
        f"/api/work-orders/{wo_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 204

    # Verify it's gone
    get_resp = await client.get(
        f"/api/work-orders/{wo_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert get_resp.status_code == 404


async def test_delete_work_order_not_found(client, db_session):
    token = await _register_and_seed_stages(client, db_session)

    import uuid
    resp = await client.delete(
        f"/api/work-orders/{uuid.uuid4()}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


async def test_delete_work_order_with_invoice_blocked(client, db_session):
    """Work orders with linked invoices cannot be deleted."""
    from app.models.invoice import Invoice

    token = await _register_and_seed_stages(client, db_session)

    # Create a work order
    create_resp = await client.post(
        "/api/work-orders",
        json={"date_in": "2026-03-10T10:00:00Z"},
        headers={"Authorization": f"Bearer {token}"},
    )
    wo_data = create_resp.json()
    wo_id = wo_data["id"]

    # Manually insert an invoice linked to this work order
    from app.models.user import User
    from sqlalchemy import select

    user_result = await db_session.execute(select(User).limit(1))
    user = user_result.scalar_one()

    invoice = Invoice(
        organization_id=user.organization_id,
        work_order_id=wo_id,
        invoice_number="INV-0001",
        client_email="test@example.com",
        client_name="Test Client",
    )
    db_session.add(invoice)
    await db_session.commit()

    # Attempt delete — should be blocked
    resp = await client.delete(
        f"/api/work-orders/{wo_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 409
    assert "invoices" in resp.json()["detail"].lower()

    # Verify work order still exists
    get_resp = await client.get(
        f"/api/work-orders/{wo_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert get_resp.status_code == 200


async def test_delete_work_order_tenant_isolation(client, db_session):
    """Cannot delete a work order belonging to another organization."""
    token_a = await _register_and_seed_stages(client, db_session)

    # Register a second user/org
    resp = await client.post(
        "/api/auth/register",
        json={
            "email": "other@shop.com",
            "password": "TestPass123",
            "org_name": "Other Shop",
        },
    )
    token_b = resp.json()["access_token"]

    # Create a work order in org A
    create_resp = await client.post(
        "/api/work-orders",
        json={"date_in": "2026-03-10T10:00:00Z"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    wo_id = create_resp.json()["id"]

    # Attempt delete from org B — should be 404
    resp = await client.delete(
        f"/api/work-orders/{wo_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert resp.status_code == 404

    # Verify work order still exists in org A
    get_resp = await client.get(
        f"/api/work-orders/{wo_id}",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert get_resp.status_code == 200
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `make test`
Expected: The 4 new tests fail with 405 Method Not Allowed (endpoint doesn't exist yet).

- [ ] **Step 3: Add the DELETE endpoint to the router**

In `backend/app/routers/work_orders.py`, add the import and endpoint:

Add to imports at top:
```python
from app.services.work_orders import (
    create_work_order,
    delete_work_order,  # ADD THIS
    get_work_order,
    list_work_orders,
    update_status,
    update_work_order,
)
```

Add endpoint at the end of the file:
```python
@router.delete("/{work_order_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    work_order_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    wo = await get_work_order(session, work_order_id, user.organization_id)
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    await delete_work_order(session, wo)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `make test`
Expected: All 3 new tests pass, plus all existing tests.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/work_orders.py backend/tests/test_routers/test_work_orders.py
git commit -m "feat: add DELETE /api/work-orders/{id} endpoint with invoice guard"
```

## Chunk 2: Frontend — Work Order Detail Page

> **Dependency:** Chunk 2 depends on Chunk 1 being complete. The Timeline tab requires `status_timestamps` in the API response, which is added in Task 1.

### Task 4: Create the work order detail page

**Files:**
- Create: `frontend/src/app/dashboard/work-orders/[id]/page.tsx`

This is the largest task. The page follows the Projects detail page pattern (`frontend/src/app/dashboard/projects/[id]/page.tsx`) for layout, styling, and component structure.

- [ ] **Step 1: Create the detail page file**

Create `frontend/src/app/dashboard/work-orders/[id]/page.tsx` with:

```tsx
'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api-client';
import { formatCurrency } from '@/lib/format';

// --- API response types ---

interface KanbanStageResponse {
  id: string;
  name: string;
  color: string;
  system_status: string | null;
}

interface VehicleInWorkOrder {
  id: string;
  make: string | null;
  model: string | null;
  year: number | null;
  vin: string | null;
}

interface ChecklistItem {
  label: string;
  done: boolean;
}

interface WorkOrderDetail {
  id: string;
  job_number: string;
  job_type: 'commercial' | 'personal';
  job_value: number;
  priority: 'high' | 'medium' | 'low';
  date_in: string;
  estimated_completion_date: string | null;
  completion_date: string | null;
  internal_notes: string | null;
  checklist: ChecklistItem[] | null;
  status_timestamps: Record<string, string> | null;
  status: KanbanStageResponse | null;
  vehicles: VehicleInWorkOrder[];
  client_id: string | null;
  client_name: string | null;
  created_at: string;
  updated_at: string;
}

interface PhotoResponse {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  photo_type: string | null;
  caption: string | null;
  url: string;
  created_at: string;
}

// --- Styling maps ---

const priorityStyles: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'High' },
  medium: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Medium' },
  low: { bg: 'bg-green-500/10', text: 'text-green-400', label: 'Low' },
};

const jobTypeLabels: Record<string, string> = {
  commercial: 'Commercial',
  personal: 'Personal',
};

// --- Helpers ---

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// --- Reusable components ---

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
      <div className="border-b border-[var(--border)] px-5 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">{title}</h3>
      </div>
      <div className="px-5 py-4 space-y-3">{children}</div>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 font-mono text-[11px] uppercase tracking-wider text-[var(--text-muted)]">{label}</span>
      <span className="text-right text-sm text-[var(--text-primary)]">{value ?? '—'}</span>
    </div>
  );
}

// --- Delete confirmation modal ---

function DeleteModal({
  jobNumber,
  onConfirm,
  onCancel,
  loading,
}: {
  jobNumber: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface-card)] p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Delete Work Order</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Are you sure you want to delete <span className="font-mono font-medium text-[var(--text-primary)]">{jobNumber}</span>? This action cannot be undone.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-raised)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Loading skeleton ---

function LoadingSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="h-5 w-32 animate-pulse rounded bg-[var(--border)]" />
        <div className="mt-3 flex items-center gap-3">
          <div className="h-7 w-48 animate-pulse rounded bg-[var(--border)]" />
          <div className="h-5 w-20 animate-pulse rounded bg-[var(--surface-raised)]" />
        </div>
      </header>
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-3">
        <div className="flex gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-4 w-16 animate-pulse rounded bg-[var(--border)]" />
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto px-6 py-6 space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-xl bg-[var(--border)]" />
        ))}
      </div>
    </div>
  );
}

// --- Error state ---

function ErrorState({ message, onRetry, onBack }: { message: string; onRetry: () => void; onBack: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div className="rounded-full bg-red-500/10 p-3">
        <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <p className="text-lg font-semibold text-[var(--text-primary)]">Failed to load work order</p>
      <p className="text-sm text-[var(--text-secondary)]">{message}</p>
      <div className="flex gap-3">
        <button onClick={onBack} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-raised)]">
          Back to Work Orders
        </button>
        <button onClick={onRetry} className="rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-primary)]/90">
          Retry
        </button>
      </div>
    </div>
  );
}

// --- Tab content components ---

function OverviewTab({ wo }: { wo: WorkOrderDetail }) {
  return (
    <div className="space-y-6">
      <InfoCard title="Job Details">
        <FieldRow label="Job Number" value={<span className="font-mono">{wo.job_number}</span>} />
        <FieldRow label="Job Type" value={jobTypeLabels[wo.job_type] ?? wo.job_type} />
        <FieldRow label="Priority" value={
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${priorityStyles[wo.priority]?.bg} ${priorityStyles[wo.priority]?.text}`}>
            {priorityStyles[wo.priority]?.label ?? wo.priority}
          </span>
        } />
        <FieldRow label="Job Value" value={wo.job_value ? formatCurrency(wo.job_value) : '—'} />
      </InfoCard>

      <InfoCard title="Client & Vehicles">
        <FieldRow label="Client" value={wo.client_name} />
        {wo.vehicles.length > 0 ? (
          wo.vehicles.map((v) => (
            <FieldRow
              key={v.id}
              label="Vehicle"
              value={
                <div>
                  <span>{[v.year, v.make, v.model].filter(Boolean).join(' ') || 'Unknown'}</span>
                  {v.vin && <span className="ml-2 font-mono text-xs text-[var(--text-muted)]">{v.vin}</span>}
                </div>
              }
            />
          ))
        ) : (
          <FieldRow label="Vehicle" value="No vehicles assigned" />
        )}
      </InfoCard>

      <InfoCard title="Dates">
        <FieldRow label="Date In" value={formatDate(wo.date_in)} />
        <FieldRow label="Est. Completion" value={formatDate(wo.estimated_completion_date)} />
        <FieldRow label="Completed" value={formatDate(wo.completion_date)} />
      </InfoCard>

      {wo.internal_notes && (
        <InfoCard title="Internal Notes">
          <p className="whitespace-pre-wrap text-sm text-[var(--text-primary)]">{wo.internal_notes}</p>
        </InfoCard>
      )}
    </div>
  );
}

function ChecklistTab({ checklist }: { checklist: ChecklistItem[] | null }) {
  if (!checklist || checklist.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
        <p className="text-sm font-medium text-[var(--text-primary)]">No checklist items</p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">This work order has no checklist configured</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] divide-y divide-[var(--border)]">
      {checklist.map((item, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3">
          <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
            item.done
              ? 'border-green-500 bg-green-500/10 text-green-400'
              : 'border-[var(--border)] text-transparent'
          }`}>
            {item.done && (
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <span className={`text-sm ${item.done ? 'text-[var(--text-secondary)] line-through' : 'text-[var(--text-primary)]'}`}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function PhotosTab({ workOrderId }: { workOrderId: string }) {
  const [photos, setPhotos] = useState<PhotoResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPhotos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<{ photos: PhotoResponse[] }>(`/api/work-orders/${workOrderId}/photos`);
      setPhotos(data.photos);
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        setError('Photos are not available in this environment');
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to load photos');
      }
    } finally {
      setLoading(false);
    }
  }, [workOrderId]);

  useEffect(() => { fetchPhotos(); }, [fetchPhotos]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-square animate-pulse rounded-xl bg-[var(--border)]" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
        <p className="text-sm text-[var(--text-secondary)]">{error}</p>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
        <p className="text-sm font-medium text-[var(--text-primary)]">No photos</p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">No photos have been uploaded for this work order</p>
      </div>
    );
  }

  const beforePhotos = photos.filter((p) => p.photo_type === 'before');
  const afterPhotos = photos.filter((p) => p.photo_type === 'after');
  const otherPhotos = photos.filter((p) => p.photo_type !== 'before' && p.photo_type !== 'after');

  const renderGroup = (title: string, items: PhotoResponse[]) => {
    if (items.length === 0) return null;
    return (
      <div>
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">{title}</h4>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {items.map((photo) => (
            <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]">
              <img src={photo.url} alt={photo.caption || photo.filename} className="h-full w-full object-cover" />
              {photo.caption && (
                <div className="absolute inset-x-0 bottom-0 bg-black/60 px-3 py-2">
                  <p className="text-xs text-white truncate">{photo.caption}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {renderGroup('Before', beforePhotos)}
      {renderGroup('After', afterPhotos)}
      {renderGroup('Other', otherPhotos)}
    </div>
  );
}

function TimelineTab({ statusTimestamps, stages }: { statusTimestamps: Record<string, string> | null; stages: KanbanStageResponse[] }) {
  if (!statusTimestamps || Object.keys(statusTimestamps).length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
        <p className="text-sm font-medium text-[var(--text-primary)]">No timeline data</p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">Status changes will appear here as the work order progresses</p>
      </div>
    );
  }

  // Build timeline entries from status_timestamps (keyed by stage UUID)
  const stageMap = new Map(stages.map((s) => [s.id, s]));
  const entries = Object.entries(statusTimestamps)
    .map(([stageId, timestamp]) => ({
      stage: stageMap.get(stageId),
      stageId,
      timestamp,
    }))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] px-5 py-4">
      <div className="relative space-y-0">
        {entries.map((entry, i) => (
          <div key={entry.stageId} className="relative flex gap-4 pb-6 last:pb-0">
            {/* Vertical line */}
            {i < entries.length - 1 && (
              <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-[var(--border)]" />
            )}
            {/* Dot */}
            <div
              className="mt-1 h-6 w-6 shrink-0 rounded-full border-2"
              style={{
                borderColor: entry.stage?.color ?? 'var(--border)',
                backgroundColor: `${entry.stage?.color ?? 'var(--border)'}20`,
              }}
            />
            {/* Content */}
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {entry.stage?.name ?? 'Unknown Stage'}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                {formatTimestamp(entry.timestamp)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Main page ---

type Tab = 'overview' | 'checklist' | 'photos' | 'timeline';

export default function WorkOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [wo, setWo] = useState<WorkOrderDetail | null>(null);
  const [stages, setStages] = useState<KanbanStageResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchWorkOrder = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<WorkOrderDetail>(`/api/work-orders/${id}`);
      setWo(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load work order');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchStages = useCallback(async () => {
    try {
      const data = await api.get<KanbanStageResponse[]>('/api/kanban-stages');
      setStages(data);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => { fetchWorkOrder(); fetchStages(); }, [fetchWorkOrder, fetchStages]);

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/api/work-orders/${id}`);
      router.push('/dashboard/work-orders');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setDeleteError('Cannot delete — this work order has linked invoices');
      } else {
        setDeleteError(err instanceof ApiError ? err.message : 'Failed to delete work order');
      }
      setDeleting(false);
    }
  };

  if (loading) return <LoadingSkeleton />;
  if (error || !wo) return <ErrorState message={error ?? 'Work order not found'} onRetry={fetchWorkOrder} onBack={() => router.push('/dashboard/work-orders')} />;

  const pStyle = priorityStyles[wo.priority] ?? priorityStyles.medium;
  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'checklist', label: 'Checklist' },
    { key: 'photos', label: 'Photos' },
    { key: 'timeline', label: 'Timeline' },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <button
          onClick={() => router.push('/dashboard/work-orders')}
          className="mb-3 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          &larr; Work Orders
        </button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-[22px] font-[800] tracking-[-0.4px] font-mono text-[var(--text-primary)]">{wo.job_number}</h1>
            {wo.status && (
              <span
                className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{ backgroundColor: `${wo.status.color}20`, color: wo.status.color }}
              >
                {wo.status.name}
              </span>
            )}
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${pStyle.bg} ${pStyle.text}`}>
              {pStyle.label}
            </span>
          </div>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="rounded-lg border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
          >
            Delete
          </button>
        </div>
      </header>

      {/* Delete error toast */}
      {deleteError && (
        <div className="mx-6 mt-4 flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3">
          <span className="text-sm text-red-400">{deleteError}</span>
          <button onClick={() => setDeleteError(null)} className="text-sm font-medium text-red-400 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-6">
        {activeTab === 'overview' && <OverviewTab wo={wo} />}
        {activeTab === 'checklist' && <ChecklistTab checklist={wo.checklist} />}
        {activeTab === 'photos' && <PhotosTab workOrderId={wo.id} />}
        {activeTab === 'timeline' && <TimelineTab statusTimestamps={wo.status_timestamps} stages={stages} />}
      </div>

      {/* Delete modal */}
      {showDeleteModal && (
        <DeleteModal
          jobNumber={wo.job_number}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
          loading={deleting}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the page renders by navigating to it in the browser**

Run: `cd frontend && npm run dev` (or use Docker)
Navigate to: `http://localhost:3000/dashboard/work-orders/<any-work-order-id>`
Expected: Page loads with work order details displayed in the Overview tab.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/dashboard/work-orders/\[id\]/page.tsx
git commit -m "feat: add work order detail page with tabs and delete"
```

## Chunk 3: Frontend — List Page Updates

> **Note:** The spec calls for a "..." action menu; we use a direct trash icon instead for simplicity since delete is currently the only row action. This can be upgraded to a dropdown menu when more actions are needed.

### Task 5: Make list rows clickable and add delete action

**Files:**
- Modify: `frontend/src/app/dashboard/work-orders/page.tsx`

- [ ] **Step 1: Add Link import and delete state**

In `frontend/src/app/dashboard/work-orders/page.tsx`, the `Link` import already exists. Add delete-related state to the component:

After the existing state declarations (line ~112), add:

```tsx
const [showDeleteModal, setShowDeleteModal] = useState(false);
const [deleteTarget, setDeleteTarget] = useState<WorkOrder | null>(null);
const [deleting, setDeleting] = useState(false);
const [deleteError, setDeleteError] = useState<string | null>(null);
```

- [ ] **Step 2: Add the delete handler function**

After the `fetchWorkOrders` callback, add:

```tsx
const handleDelete = async () => {
  if (!deleteTarget) return;
  setDeleting(true);
  setDeleteError(null);
  try {
    await api.delete(`/api/work-orders/${deleteTarget.id}`);
    setShowDeleteModal(false);
    setDeleteTarget(null);
    fetchWorkOrders();
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      setDeleteError('Cannot delete — this work order has linked invoices');
    } else {
      setDeleteError(err instanceof ApiError ? err.message : 'Failed to delete');
    }
  } finally {
    setDeleting(false);
  }
};
```

- [ ] **Step 3: Add an Actions column header to the table**

After the "Due" column header (line ~257), add:

```tsx
<th className="px-4 py-3 text-right font-medium text-[var(--text-secondary)]">Actions</th>
```

- [ ] **Step 4: Make rows clickable and add actions column**

Replace the existing `<tr>` for each work order (line ~264) to wrap cells with a link and add the actions column.

Replace the row `<tr key={wo.id} className="border-b ...">` opening tag with:

```tsx
<tr key={wo.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-raised)] cursor-pointer" onClick={() => router.push(`/dashboard/work-orders/${wo.id}`)}>
```

Add `useRouter` import from `next/navigation` (already imported: `useSearchParams`). Add at top of component:
```tsx
const router = useRouter();
```

Add `useRouter` to the import on line 4:
```tsx
import { useSearchParams, useRouter } from 'next/navigation';
```

After the "Due" column `<td>` (line ~287), add the actions cell:

```tsx
<td className="px-4 py-3 text-right">
  <button
    onClick={(e) => {
      e.stopPropagation();
      setDeleteTarget(wo);
      setShowDeleteModal(true);
    }}
    className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-red-500/10 hover:text-red-400"
    title="Delete work order"
  >
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  </button>
</td>
```

- [ ] **Step 5: Add delete modal and error toast to the page**

After `<CreateWorkOrderModal />`, add the delete modal (errors are shown inline within the modal):

```tsx
{showDeleteModal && deleteTarget && (
  <div className="fixed inset-0 z-50 flex items-center justify-center">
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowDeleteModal(false); setDeleteTarget(null); setDeleteError(null); }} />
    <div className="relative w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface-card)] p-6 shadow-xl">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">Delete Work Order</h2>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        Are you sure you want to delete <span className="font-mono font-medium text-[var(--text-primary)]">{deleteTarget.job_number}</span>? This action cannot be undone.
      </p>
      {deleteError && (
        <p className="mt-3 text-sm text-red-400">{deleteError}</p>
      )}
      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={() => { setShowDeleteModal(false); setDeleteTarget(null); setDeleteError(null); }}
          disabled={deleting}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-raised)] disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
        >
          {deleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 6: Verify in browser**

Navigate to: `http://localhost:3000/dashboard/work-orders`
Expected:
- Clicking a row navigates to the detail page
- Trash icon appears in each row's Actions column
- Clicking trash opens a confirmation modal
- Confirming delete removes the work order (or shows 409 error for invoiced ones)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/dashboard/work-orders/page.tsx
git commit -m "feat: add row click navigation and delete action to work orders list"
```
