# Client Lookup Dropdown Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the empty client dropdown in the work order creation form by adding a lightweight lookup endpoint and a searchable combobox component.

**Architecture:** New `GET /api/clients/lookup` endpoint returns only `id` and `name` for active clients with server-side ILIKE search. Frontend replaces the static `Select` with a new `Combobox` component that debounces search input and fetches results on demand.

**Tech Stack:** FastAPI, SQLAlchemy (async), React 19, TypeScript, Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-03-13-client-lookup-dropdown-design.md`
**Issue:** #497

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/app/schemas/clients.py` | Modify | Add `ClientLookupItem` and `ClientLookupResponse` schemas |
| `backend/app/services/clients.py` | Modify | Add `lookup()` method — lightweight query, no joins |
| `backend/app/routers/clients.py` | Modify | Add `GET /api/clients/lookup` route (before `/{client_id}`) |
| `backend/tests/test_services/test_clients.py` | Modify | Add tests for `ClientService.lookup()` |
| `backend/tests/test_routers/test_clients.py` | Modify | Add tests for `GET /api/clients/lookup` |
| `frontend/src/components/ui/Combobox.tsx` | Create | Searchable async combobox component |
| `frontend/src/components/work-orders/wizard/JobPricingTab.tsx` | Modify | Replace `Select` with `Combobox` |

---

## Chunk 1: Backend — Schema, Service, and Tests

### Task 1: Add Lookup Schemas

**Files:**
- Modify: `backend/app/schemas/clients.py` (append after `ClientAggregateReport`)

- [ ] **Step 1: Add `ClientLookupItem` and `ClientLookupResponse` schemas**

Add at the end of `backend/app/schemas/clients.py`:

```python
class ClientLookupItem(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str


class ClientLookupResponse(BaseModel):
    items: list[ClientLookupItem]
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/schemas/clients.py
git commit -m "feat(#497): add ClientLookupItem and ClientLookupResponse schemas"
```

---

### Task 2: Add Service `lookup()` Method with Tests (TDD)

**Files:**
- Test: `backend/tests/test_services/test_clients.py`
- Modify: `backend/app/services/clients.py`

- [ ] **Step 1: Write failing tests for `lookup()`**

Append to `backend/tests/test_services/test_clients.py`:

```python
async def test_lookup_returns_active_clients(db_session):
    org = await _seed(db_session)
    service = ClientService(db_session)

    await service.create(org.id, ClientCreate(name="Alpha Corp"))
    await service.create(org.id, ClientCreate(name="Beta LLC"))

    items = await service.lookup(org.id)
    assert len(items) == 2
    # Ordered alphabetically by name
    assert items[0].name == "Alpha Corp"
    assert items[1].name == "Beta LLC"


async def test_lookup_excludes_inactive_clients(db_session):
    org = await _seed(db_session)
    service = ClientService(db_session)

    c = await service.create(org.id, ClientCreate(name="Inactive Co"))
    await service.update(c.id, org.id, ClientUpdate(is_active=False))
    await service.create(org.id, ClientCreate(name="Active Co"))

    items = await service.lookup(org.id)
    assert len(items) == 1
    assert items[0].name == "Active Co"


async def test_lookup_filters_by_search_term(db_session):
    org = await _seed(db_session)
    service = ClientService(db_session)

    await service.create(org.id, ClientCreate(name="Alpha Corp"))
    await service.create(org.id, ClientCreate(name="Beta LLC"))
    await service.create(org.id, ClientCreate(name="Gamma Alpha Inc"))

    items = await service.lookup(org.id, search="alpha")
    assert len(items) == 2
    names = {i.name for i in items}
    assert names == {"Alpha Corp", "Gamma Alpha Inc"}


async def test_lookup_search_is_case_insensitive(db_session):
    org = await _seed(db_session)
    service = ClientService(db_session)

    await service.create(org.id, ClientCreate(name="UPPER CASE"))

    items = await service.lookup(org.id, search="upper")
    assert len(items) == 1
    assert items[0].name == "UPPER CASE"


async def test_lookup_escapes_ilike_wildcards(db_session):
    org = await _seed(db_session)
    service = ClientService(db_session)

    await service.create(org.id, ClientCreate(name="100% Wraps"))
    await service.create(org.id, ClientCreate(name="Normal Client"))

    items = await service.lookup(org.id, search="100%")
    assert len(items) == 1
    assert items[0].name == "100% Wraps"


async def test_lookup_respects_limit(db_session):
    org = await _seed(db_session)
    service = ClientService(db_session)

    for i in range(5):
        await service.create(org.id, ClientCreate(name=f"Client {i:02d}"))

    items = await service.lookup(org.id, limit=3)
    assert len(items) == 3


async def test_lookup_treats_whitespace_search_as_empty(db_session):
    org = await _seed(db_session)
    service = ClientService(db_session)

    await service.create(org.id, ClientCreate(name="Any Client"))

    items = await service.lookup(org.id, search="   ")
    assert len(items) == 1


async def test_lookup_scoped_to_organization(db_session):
    org = await _seed(db_session)
    service = ClientService(db_session)

    await service.create(org.id, ClientCreate(name="My Client"))

    other_org_id = uuid.uuid4()
    items = await service.lookup(other_org_id)
    assert len(items) == 0
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `make test` (or `docker compose exec backend pytest tests/test_services/test_clients.py -v`)
Expected: FAIL — `AttributeError: 'ClientService' object has no attribute 'lookup'`

- [ ] **Step 3: Implement `lookup()` method**

Add to `backend/app/services/clients.py`, after the `list()` method:

```python
    async def lookup(
        self,
        org_id: uuid.UUID,
        search: str | None = None,
        limit: int = 25,
    ) -> list[Client]:
        query = select(Client).where(
            Client.organization_id == org_id,
            Client.is_active.is_(True),
        )

        if search and search.strip():
            escaped = search.strip().replace("%", r"\%").replace("_", r"\_")
            query = query.where(Client.name.ilike(f"%{escaped}%"))

        query = query.order_by(Client.name.asc()).limit(limit)
        result = await self.session.execute(query)
        return list(result.scalars().all())
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `make test` (or `docker compose exec backend pytest tests/test_services/test_clients.py -v`)
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/clients.py backend/tests/test_services/test_clients.py
git commit -m "feat(#497): add ClientService.lookup() with search, active filter, org scope"
```

---

### Task 3: Add Router Endpoint with Tests (TDD)

**Files:**
- Test: `backend/tests/test_routers/test_clients.py`
- Modify: `backend/app/routers/clients.py`

- [ ] **Step 1: Write failing tests for `GET /api/clients/lookup`**

Append to `backend/tests/test_routers/test_clients.py`:

```python
async def test_lookup_clients_endpoint(client, db_session):
    token = await _register_and_get_token(client)

    await client.post(
        "/api/clients",
        json={"name": "Alpha Corp"},
        headers={"Authorization": f"Bearer {token}"},
    )
    await client.post(
        "/api/clients",
        json={"name": "Beta LLC"},
        headers={"Authorization": f"Bearer {token}"},
    )

    resp = await client.get(
        "/api/clients/lookup",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 2
    # Only id and name fields
    assert set(data["items"][0].keys()) == {"id", "name"}
    # Ordered alphabetically
    assert data["items"][0]["name"] == "Alpha Corp"
    assert data["items"][1]["name"] == "Beta LLC"


async def test_lookup_with_search(client, db_session):
    token = await _register_and_get_token(client)

    await client.post(
        "/api/clients",
        json={"name": "Alpha Corp"},
        headers={"Authorization": f"Bearer {token}"},
    )
    await client.post(
        "/api/clients",
        json={"name": "Beta LLC"},
        headers={"Authorization": f"Bearer {token}"},
    )

    resp = await client.get(
        "/api/clients/lookup?search=alpha",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 1
    assert data["items"][0]["name"] == "Alpha Corp"


async def test_lookup_excludes_inactive(client, db_session):
    token = await _register_and_get_token(client)

    create_resp = await client.post(
        "/api/clients",
        json={"name": "Deactivated Co"},
        headers={"Authorization": f"Bearer {token}"},
    )
    client_id = create_resp.json()["id"]

    # Deactivate
    await client.patch(
        f"/api/clients/{client_id}",
        json={"is_active": False},
        headers={"Authorization": f"Bearer {token}"},
    )

    resp = await client.get(
        "/api/clients/lookup",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert len(resp.json()["items"]) == 0


async def test_lookup_unauthorized_returns_401(client, db_session):
    resp = await client.get("/api/clients/lookup")
    assert resp.status_code == 401
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `make test` (or `docker compose exec backend pytest tests/test_routers/test_clients.py -v`)
Expected: FAIL — 404 or 422 (route doesn't exist yet)

- [ ] **Step 3: Add the lookup endpoint to the router**

In `backend/app/routers/clients.py`:

1. Add imports at the top (update the existing import block):

```python
from app.schemas.clients import (
    ClientAggregateReport,
    ClientCreate,
    ClientDetailResponse,
    ClientListItemResponse,
    ClientListResponse,
    ClientLookupResponse,
    ClientResponse,
    ClientUpdate,
)
```

2. Add the lookup endpoint **between** the `list_clients` endpoint (line 67) and the `get_client` endpoint (line 70) — this is critical to avoid route conflicts with `/{client_id}`:

```python
@router.get("/lookup", response_model=ClientLookupResponse)
async def lookup_clients(
    search: str | None = Query(None, max_length=100),
    limit: int = Query(25, ge=1, le=50),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    service = ClientService(session)
    items = await service.lookup(user.organization_id, search, limit)
    return ClientLookupResponse(items=items)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `make test` (or `docker compose exec backend pytest tests/test_routers/test_clients.py -v`)
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/clients.py backend/tests/test_routers/test_clients.py
git commit -m "feat(#497): add GET /api/clients/lookup endpoint"
```

---

## Chunk 2: Frontend — Combobox Component and Integration

### Task 4: Create Combobox Component

**Files:**
- Create: `frontend/src/components/ui/Combobox.tsx`

Reference the existing `Select` component at `frontend/src/components/ui/Select.tsx` for visual style and portal pattern.

- [ ] **Step 1: Create the Combobox component**

Create `frontend/src/components/ui/Combobox.tsx`:

```tsx
'use client';

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useId,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Loader2 } from 'lucide-react';
import type { SelectOption } from './Select';

export type { SelectOption };

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: (query: string) => Promise<SelectOption[]>;
  placeholder?: string;
  id?: string;
  className?: string;
  error?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md';
  debounceMs?: number;
  selectedLabel?: string;
}

export default function Combobox({
  value,
  onChange,
  onSearch,
  placeholder,
  id,
  className = '',
  error = false,
  disabled = false,
  size = 'md',
  debounceMs = 300,
  selectedLabel,
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const listboxId = useId();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const requestIdRef = useRef(0);

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  // Derive display label from options or selectedLabel prop
  const displayLabel =
    options.find((o) => o.value === value)?.label ??
    selectedLabel ??
    '';

  const doSearch = useCallback(
    (searchQuery: string) => {
      const requestId = ++requestIdRef.current;
      setIsLoading(true);
      setErrorMsg('');
      onSearch(searchQuery)
        .then((results) => {
          if (requestId !== requestIdRef.current) return;
          setOptions(results);
          setActiveIndex(results.length > 0 ? 0 : -1);
        })
        .catch(() => {
          if (requestId !== requestIdRef.current) return;
          setErrorMsg('Failed to load');
          setOptions([]);
        })
        .finally(() => {
          if (requestId !== requestIdRef.current) return;
          setIsLoading(false);
        });
    },
    [onSearch],
  );

  // Panel positioning (same as Select)
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  const updatePosition = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openAbove = spaceBelow < 240 && rect.top > spaceBelow;
    setPanelStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      ...(openAbove
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        inputRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      )
        return;
      setIsOpen(false);
      // Reset query to show selected label
      setQuery('');
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen]);

  // Reposition on scroll/resize
  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, updatePosition]);

  // Scroll active option into view
  useEffect(() => {
    if (isOpen && activeIndex >= 0) {
      optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [isOpen, activeIndex]);

  function open() {
    if (disabled) return;
    updatePosition();
    setIsOpen(true);
    setQuery('');
    doSearch('');
  }

  function close() {
    setIsOpen(false);
    setQuery('');
    inputRef.current?.blur();
  }

  function selectOption(opt: SelectOption) {
    onChange(opt.value);
    close();
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    if (!isOpen) {
      updatePosition();
      setIsOpen(true);
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), debounceMs);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          open();
        } else if (options.length > 0) {
          setActiveIndex((i) => (i + 1) % options.length);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (options.length > 0) {
          setActiveIndex((i) => (i - 1 + options.length) % options.length);
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (isOpen && activeIndex >= 0 && options[activeIndex]) {
          selectOption(options[activeIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'Tab':
        close();
        break;
    }
  }

  const sizeClasses =
    size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-3.5 py-2.5 text-sm';

  const borderClasses = error
    ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500'
    : 'border-[var(--border)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]';

  const activeOptionId =
    activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;

  const inputValue = isOpen ? query : (value ? displayLabel : '');

  return (
    <>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          id={id}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls={isOpen ? listboxId : undefined}
          aria-activedescendant={activeOptionId}
          aria-autocomplete="list"
          disabled={disabled}
          value={inputValue}
          placeholder={placeholder}
          onChange={handleInputChange}
          onFocus={() => { if (!isOpen) open(); }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          className={`w-full rounded-lg border bg-[var(--surface-raised)] ${sizeClasses} ${borderClasses} pr-10 transition-colors outline-none ${
            disabled ? 'cursor-not-allowed opacity-50' : ''
          } ${!isOpen && !value && placeholder ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)]'} ${className}`}
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-[var(--text-tertiary)]" />
          ) : (
            <ChevronDown
              className={`h-4 w-4 text-[var(--text-tertiary)] transition-transform duration-150 ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          )}
        </div>
      </div>

      {isOpen &&
        isClient &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            id={listboxId}
            tabIndex={-1}
            style={panelStyle}
            className="z-50 max-h-60 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface-overlay)] shadow-lg outline-none animate-select-in"
          >
            {isLoading && options.length === 0 && (
              <div className="px-3.5 py-2 text-sm text-[var(--text-muted)]">
                Searching...
              </div>
            )}
            {errorMsg && (
              <div className="px-3.5 py-2 text-sm text-red-400">
                {errorMsg}
              </div>
            )}
            {!isLoading && !errorMsg && options.length === 0 && (
              <div className="px-3.5 py-2 text-sm text-[var(--text-muted)]">
                No results found
              </div>
            )}
            {options.map((option, index) => {
              const isSelected = option.value === value;
              const isActive = index === activeIndex;
              return (
                <div
                  key={option.value}
                  ref={(el) => {
                    optionRefs.current[index] = el;
                  }}
                  role="option"
                  id={`${listboxId}-option-${index}`}
                  aria-selected={isSelected}
                  onClick={() => selectOption(option)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex cursor-pointer items-center justify-between ${
                    size === 'sm' ? 'px-3 py-1.5' : 'px-3.5 py-2'
                  } text-sm ${
                    isActive ? 'bg-[var(--accent-primary)]/10' : ''
                  } ${
                    isSelected
                      ? 'text-[var(--accent-primary)]'
                      : 'text-[var(--text-primary)]'
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && <Check className="ml-2 h-4 w-4 shrink-0" />}
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ui/Combobox.tsx
git commit -m "feat(#497): add searchable Combobox component"
```

---

### Task 5: Replace Select with Combobox in JobPricingTab

**Files:**
- Modify: `frontend/src/components/work-orders/wizard/JobPricingTab.tsx`

- [ ] **Step 1: Update imports**

Replace:
```tsx
import Select from '@/components/ui/Select';
```

With:
```tsx
import Combobox from '@/components/ui/Combobox';
import type { SelectOption } from '@/components/ui/Select';
```

- [ ] **Step 2: Replace the client fetch logic and state**

Replace lines 9-49 (the `Client` interface, state, and `useEffect`) with:

```tsx
async function searchClients(query: string): Promise<SelectOption[]> {
  const params = new URLSearchParams({ limit: '25' });
  if (query) params.set('search', query);
  const res = await api.get<{ items: { id: string; name: string }[] }>(
    `/api/clients/lookup?${params}`,
  );
  return res.items.map((c) => ({ value: c.id, label: c.name }));
}

export default function JobPricingTab({ data, onChange }: Props) {
  function update(patch: Partial<JobPricingState>) {
    onChange({ ...data, ...patch });
  }
```

Note: Remove the `Client` interface, `useState<Client[]>`, `isLoadingClients` state, and the entire `useEffect` block.

- [ ] **Step 3: Replace the Select component in the JSX**

Replace the Client section (the `<Select>` at approximately lines 154-169) with:

```tsx
      {/* Client */}
      <div>
        <label htmlFor="client-id" className={labelClass}>
          Client
        </label>
        <Combobox
          id="client-id"
          value={data.clientId}
          onChange={(v) => update({ clientId: v })}
          onSearch={searchClients}
          placeholder="Search for a client (optional)"
        />
      </div>
```

- [ ] **Step 4: Remove unused imports**

Remove `useState, useEffect` from the React import if no longer used. Keep `useState` (used for `selectedClientName`). Remove `useEffect`. Remove the `Select` import.

Final imports should be:
```tsx
'use client';

import { api } from '@/lib/api-client';
import Combobox from '@/components/ui/Combobox';
import type { SelectOption } from '@/components/ui/Combobox';
import DatePicker from '@/components/ui/DatePicker';
import type { JobPricingState } from './types';
```

- [ ] **Step 5: Verify frontend compiles**

Run: `cd frontend && npm run build` (or `npx next build`)
Expected: Build succeeds with no errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/work-orders/wizard/JobPricingTab.tsx
git commit -m "feat(#497): replace static Select with searchable Combobox for client dropdown"
```

---

### Task 6: Manual Verification

- [ ] **Step 1: Run full backend test suite**

Run: `make test`
Expected: ALL PASS

- [ ] **Step 2: Start the app and test manually**

Run: `make up`

1. Log in with test account (`tester@testwraps.com` / `TestPass123!`)
2. Navigate to Work Orders → click "+ New Work Order"
3. Go to the "Job & Pricing" tab
4. Verify the Client dropdown shows initial clients on focus
5. Type a search term — verify results filter
6. Select a client — verify the name displays in the input
7. Clear and re-open — verify initial results load again

- [ ] **Step 3: Final commit if any fixes needed**

Only if manual testing reveals issues that need fixing.
