# Jobs View Consolidation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the Job Board (`/dashboard`) and Jobs List (`/dashboard/work-orders`) into a single unified page at `/dashboard`, with the list view upgraded to include search, status tabs, pagination, CSV import modal, and delete.

**Architecture:** Enhance `/dashboard/page.tsx` in-place with dual data paths — kanban fetches all work orders client-side (`limit=100`), list fetches paginated server-side. Extract CSV import wizard into a modal component. Move detail page route from `/work-orders/[id]` to `/jobs/[id]`.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS 4, FastAPI backend (no backend changes)

**Spec:** `docs/superpowers/specs/2026-03-14-jobs-view-consolidation-design.md`

---

## File Structure

### New Files
- `frontend/src/components/work-orders/ImportCSVModal.tsx` — CSV import wizard as a modal overlay (extracted from import page)

### Modified Files
- `frontend/src/app/dashboard/page.tsx` — Add search, list-mode server-side fetch, status tabs, pagination, delete modal, import modal trigger, kanban search filtering
- `frontend/src/lib/roles.ts` — Consolidate nav entries (remove Jobs List, update Production href)

### Moved Files
- `frontend/src/app/dashboard/work-orders/[id]/page.tsx` → `frontend/src/app/dashboard/jobs/[id]/page.tsx` — Update internal links from `/dashboard/work-orders` to `/dashboard`

### Removed Files
- `frontend/src/app/dashboard/work-orders/page.tsx`
- `frontend/src/app/dashboard/work-orders/import/page.tsx`

---

## Chunk 1: ImportCSVModal and Route Cleanup

### Task 1: Create ImportCSVModal component

**Files:**
- Create: `frontend/src/components/work-orders/ImportCSVModal.tsx`
- Reference: `frontend/src/app/dashboard/work-orders/import/page.tsx` (source to extract from)

- [ ] **Step 1: Create ImportCSVModal.tsx**

Extract the import wizard from the page into a modal. The component wraps the existing 4-step flow (select → preview → uploading → done) in a fixed overlay. Key differences from the page version:
- Accepts `isOpen` and `onClose` props (same pattern as `CreateWorkOrderModal`)
- Renders as a fixed overlay with backdrop
- "Done" step replaces the "View Jobs" link with a "Close" button that calls `onClose`
- "Import Another File" resets to select step (existing behavior)
- Preserves "Download Template" button
- Carries over the `uploadFormData` helper, `API_BASE_URL`, and `getAccessToken` imports

```tsx
'use client';

import { useState, useCallback, useRef, type DragEvent, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { ApiError } from '@/lib/api-client';
import { API_BASE_URL } from '@/lib/config';
import { getAccessToken } from '@/lib/auth';
import { useModalAccessibility } from '@/hooks/useModalAccessibility';

// --- Types matching backend schemas ---

interface RowError {
  row: number;
  field: string;
  message: string;
}

interface PreviewResponse {
  headers: string[];
  sample_rows: Record<string, string>[];
  total_rows: number;
  validation_errors: RowError[];
}

interface UploadResult {
  total_rows: number;
  successful: number;
  failed: number;
  errors: RowError[];
  created_ids: string[];
}

type Step = 'select' | 'preview' | 'uploading' | 'done';

// --- Helpers ---

function buildFormData(file: File): FormData {
  const fd = new FormData();
  fd.append('file', file);
  return fd;
}

async function uploadFormData<T>(path: string, file: File): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const token = getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: buildFormData(file),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, res.statusText, body);
  }

  return res.json() as Promise<T>;
}

// --- Component ---

interface ImportCSVModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export default function ImportCSVModal({ isOpen, onClose, onImportComplete }: ImportCSVModalProps) {
  const modalRef = useModalAccessibility(isOpen, onClose);
  const [step, setStep] = useState<Step>('select');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (f: File) => {
    setError(null);
    if (!f.name.toLowerCase().endsWith('.csv')) {
      setError('Please select a CSV file.');
      return;
    }
    setFile(f);
    setStep('preview');
    try {
      const data = await uploadFormData<PreviewResponse>('/api/csv-upload/preview', f);
      setPreview(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to preview CSV');
      setStep('select');
      setFile(null);
    }
  }, []);

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );

  const onFileInput = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) handleFile(f);
      e.target.value = '';
    },
    [handleFile],
  );

  const handleUpload = useCallback(async () => {
    if (!file) return;
    setError(null);
    setStep('uploading');
    try {
      const data = await uploadFormData<UploadResult>('/api/csv-upload/upload', file);
      setResult(data);
      setStep('done');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed');
      setStep('preview');
    }
  }, [file]);

  const handleReset = useCallback(() => {
    setStep('select');
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    if (step === 'done') {
      onImportComplete();
    }
    handleReset();
    onClose();
  }, [step, onImportComplete, handleReset, onClose]);

  const handleDownloadTemplate = useCallback(async () => {
    try {
      const url = `${API_BASE_URL}/api/csv-upload/template`;
      const token = getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error('Failed to download template');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'work_orders_template.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      setError('Failed to download template');
    }
  }, []);

  const hasValidationErrors = (preview?.validation_errors.length ?? 0) > 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div ref={modalRef} className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-card)] p-6 shadow-xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Import CSV</h2>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3">
            <span className="text-sm text-red-400">{error}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setError(null)}
              className="ml-auto text-red-400 underline"
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* Step: Select file */}
        {step === 'select' && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-16 transition-colors ${
                dragOver
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                  : 'border-[var(--border)] bg-[var(--surface-app)] hover:border-[var(--accent-primary)]/50 hover:bg-[var(--accent-primary)]/5'
              }`}
            >
              <svg className="mb-3 h-10 w-10 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <p className="text-sm font-medium text-[var(--text-primary)]">Drag and drop your CSV file here</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">or click to browse files</p>
              <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={onFileInput} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-app)] px-4 py-3">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">Need the CSV template?</p>
                <p className="text-xs text-[var(--text-secondary)]">Download a pre-formatted template with the expected columns.</p>
              </div>
              <Button variant="secondary" onClick={handleDownloadTemplate}>Download Template</Button>
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && preview && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-app)] px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{file?.name}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{preview.total_rows} rows detected</p>
                </div>
              </div>
              <button onClick={handleReset} className="text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">
                Change file
              </button>
            </div>
            {hasValidationErrors && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3">
                <p className="text-sm font-medium text-amber-400">
                  {preview.validation_errors.length} validation {preview.validation_errors.length === 1 ? 'issue' : 'issues'} found
                </p>
                <ul className="mt-2 space-y-1">
                  {preview.validation_errors.slice(0, 10).map((ve, i) => (
                    <li key={i} className="text-xs text-amber-400">
                      Row {ve.row}{ve.field ? `, ${ve.field}` : ''}: {ve.message}
                    </li>
                  ))}
                  {preview.validation_errors.length > 10 && (
                    <li className="text-xs font-medium text-amber-400">... and {preview.validation_errors.length - 10} more</li>
                  )}
                </ul>
              </div>
            )}
            {preview.sample_rows.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-[var(--border)]">
                <div className="border-b border-[var(--border)] bg-[var(--surface-raised)] px-4 py-2">
                  <p className="text-xs font-medium text-[var(--text-secondary)]">
                    Preview (first {preview.sample_rows.length} of {preview.total_rows} rows)
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)]">
                        {preview.headers.map((h) => (
                          <th key={h} className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-[var(--text-secondary)]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.sample_rows.map((row, idx) => (
                        <tr key={idx} className="border-b border-[var(--border)] last:border-0">
                          {preview.headers.map((h) => (
                            <td key={h} className="whitespace-nowrap px-3 py-2 text-xs text-[var(--text-primary)]">{row[h] || ''}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Button size="lg" onClick={handleUpload}>Import {preview.total_rows} Jobs</Button>
              <Button variant="secondary" size="lg" onClick={handleReset}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Step: Uploading */}
        {step === 'uploading' && (
          <div className="flex flex-col items-center justify-center px-6 py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border)] border-t-[var(--accent-primary)]" />
            <p className="mt-4 text-sm font-medium text-[var(--text-primary)]">Importing jobs...</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">This may take a moment.</p>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && result && (
          <div className="space-y-4">
            <div className={`rounded-lg border px-4 py-4 ${result.failed === 0 ? 'border-green-500/20 bg-green-500/10' : 'border-amber-500/20 bg-amber-500/10'}`}>
              <p className={`text-sm font-medium ${result.failed === 0 ? 'text-green-400' : 'text-amber-400'}`}>
                {result.failed === 0
                  ? `Successfully imported all ${result.successful} jobs!`
                  : `Imported ${result.successful} of ${result.total_rows} jobs.`}
              </p>
              {result.failed > 0 && (
                <p className="mt-1 text-xs text-amber-400">{result.failed} row{result.failed === 1 ? '' : 's'} failed.</p>
              )}
            </div>
            {result.errors.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-[var(--border)]">
                <div className="border-b border-[var(--border)] bg-[var(--surface-raised)] px-4 py-2">
                  <p className="text-xs font-medium text-[var(--text-secondary)]">Errors</p>
                </div>
                <ul className="divide-y divide-[var(--border)]">
                  {result.errors.map((e, i) => (
                    <li key={i} className="px-4 py-2 text-xs text-[var(--text-primary)]">
                      <span className="font-medium">Row {e.row}</span>
                      {e.field ? <span className="text-[var(--text-secondary)]"> ({e.field})</span> : null}: {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Button size="lg" onClick={handleClose}>Close</Button>
              <Button variant="secondary" size="lg" onClick={handleReset}>Import Another File</Button>
            </div>
          </div>
        )}

        {/* Loading state for preview fetch */}
        {step === 'preview' && !preview && !error && (
          <div className="flex flex-col items-center justify-center px-6 py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border)] border-t-[var(--accent-primary)]" />
            <p className="mt-4 text-sm font-medium text-[var(--text-primary)]">Analyzing CSV...</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the component compiles**

Run: `cd frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `ImportCSVModal.tsx`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/work-orders/ImportCSVModal.tsx
git commit -m "feat: add ImportCSVModal component extracted from import page"
```

### Task 2: Move detail page route from work-orders/[id] to jobs/[id]

**Files:**
- Move: `frontend/src/app/dashboard/work-orders/[id]/page.tsx` → `frontend/src/app/dashboard/jobs/[id]/page.tsx`
- Modify: `frontend/src/app/dashboard/jobs/[id]/page.tsx` (update internal links)

- [ ] **Step 1: Create the jobs/[id] directory and move the file**

```bash
mkdir -p frontend/src/app/dashboard/jobs/\[id\]
cp frontend/src/app/dashboard/work-orders/\[id\]/page.tsx frontend/src/app/dashboard/jobs/\[id\]/page.tsx
```

- [ ] **Step 2: Update all `/dashboard/work-orders` references in the moved file**

In `frontend/src/app/dashboard/jobs/[id]/page.tsx`, replace all three occurrences of `router.push('/dashboard/work-orders')` with `router.push('/dashboard')`:
- Line 664: after successful delete
- Line 676: in error state "Go Back" handler
- Line 691: in breadcrumb/back button onClick

- [ ] **Step 3: Verify the moved page compiles**

Run: `cd frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `jobs/[id]/page.tsx`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/dashboard/jobs/
git commit -m "feat: move work order detail page to /dashboard/jobs/[id]"
```

### Task 3: Update navigation config in roles.ts

**Files:**
- Modify: `frontend/src/lib/roles.ts:45-46` (admin nav), `frontend/src/lib/roles.ts:193` (production nav)

- [ ] **Step 1: Update admin role nav**

In `frontend/src/lib/roles.ts`, in the admin `navGroups` Workspace section:
- Change `{ icon: 'ClipboardList', label: 'Jobs Board', href: '/dashboard', badgeKey: 'work_orders' }` → `{ icon: 'ClipboardList', label: 'Jobs', href: '/dashboard', badgeKey: 'work_orders' }`
- Remove the line `{ icon: 'Package', label: 'Jobs List', href: '/dashboard/work-orders' }`

- [ ] **Step 2: Update production role nav**

In `frontend/src/lib/roles.ts`, in the production `navGroups` Jobs section:
- Change `{ icon: 'ClipboardList', label: 'Assigned Jobs', href: '/dashboard/jobs' }` → `{ icon: 'ClipboardList', label: 'Assigned Jobs', href: '/dashboard' }`

- [ ] **Step 3: Verify compilation**

Run: `cd frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/roles.ts
git commit -m "feat: consolidate nav entries, remove Jobs List and fix production href"
```

### Task 4: Remove old work-orders routes

**Files:**
- Remove: `frontend/src/app/dashboard/work-orders/page.tsx`
- Remove: `frontend/src/app/dashboard/work-orders/import/page.tsx`
- Remove: `frontend/src/app/dashboard/work-orders/[id]/page.tsx`

- [ ] **Step 1: Delete the old route files**

```bash
rm frontend/src/app/dashboard/work-orders/page.tsx
rm frontend/src/app/dashboard/work-orders/import/page.tsx
rm -r frontend/src/app/dashboard/work-orders/\[id\]
rm -r frontend/src/app/dashboard/work-orders/import
```

Note: Only delete if the directory is empty after removing the page files. Check for any layout.tsx or other files first:
```bash
find frontend/src/app/dashboard/work-orders -type f
```

If only `page.tsx` files remain, delete the entire `work-orders` directory:
```bash
rm -r frontend/src/app/dashboard/work-orders
```

- [ ] **Step 2: Verify no broken imports**

Run: `cd frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors (these pages were standalone routes with no external importers)

- [ ] **Step 3: Commit**

```bash
git add -u frontend/src/app/dashboard/work-orders/
git commit -m "chore: remove old work-orders routes (consolidated into /dashboard)"
```

---

## Chunk 2: Upgrade Dashboard Page

### Task 5: Add estimated_hours to WorkOrderResponse and search state

**Files:**
- Modify: `frontend/src/app/dashboard/page.tsx:39-55` (WorkOrderResponse interface)
- Modify: `frontend/src/app/dashboard/page.tsx:336-345` (add search state)

- [ ] **Step 1: Add estimated_hours field to WorkOrderResponse**

In `frontend/src/app/dashboard/page.tsx`, add `estimated_hours` to the `WorkOrderResponse` interface (after line 55, before the closing `}`):

```typescript
  estimated_hours: number | null;
```

- [ ] **Step 2: Add search and import modal state**

In the `DashboardPage` component, after the existing state declarations (around line 348), add:

```typescript
  // Search state
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);
```

- [ ] **Step 3: Add search debounce effect**

After the existing `useEffect` for outside click (around line 382), add:

```typescript
  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);
```

- [ ] **Step 4: Verify compilation**

Run: `cd frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/dashboard/page.tsx
git commit -m "feat: add estimated_hours field, search state, and import modal state"
```

### Task 6: Add search input and Import CSV button to header

**Files:**
- Modify: `frontend/src/app/dashboard/page.tsx` (header JSX, around lines 609-748)

- [ ] **Step 1: Add search input and Import CSV button to the header**

In the header's right-side `<div className="flex items-center gap-3">` section, add the search input and Import CSV button before the Filter button. Add the `ImportCSVModal` import at the top of the file:

Add import:
```typescript
import ImportCSVModal from '@/components/work-orders/ImportCSVModal';
```

In the header bar, between the title area and the filter button, add:

```tsx
            <input
              type="text"
              placeholder="Search by job # or client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-56 rounded-lg border border-[var(--border)] bg-[var(--surface-app)] px-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent-primary)]/40 focus:bg-[var(--surface-card)] focus:ring-2 focus:ring-[var(--accent-primary)]/20"
            />
            <Button
              variant="secondary"
              onClick={() => setShowImportModal(true)}
            >
              Import CSV
            </Button>
```

- [ ] **Step 2: Add ImportCSVModal to the JSX**

After the existing `CreateWorkOrderModal` near the end of the component, add:

```tsx
      <ImportCSVModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={() => { fetchData(); }}
      />
```

- [ ] **Step 3: Add kanban search filtering**

Update the `matchesFilter` callback to also check the search term for kanban mode. Modify the function to include search matching:

```typescript
  const matchesFilter = useCallback(
    (wo: WorkOrderResponse): boolean => {
      // Search filter (client-side for kanban)
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        const matchesSearch =
          wo.job_number.toLowerCase().includes(q) ||
          (wo.client_name ?? '').toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }
      // Quick-filter toggles
      if (filter === 'urgent' && wo.priority !== 'high') return false;
      if (filter === 'my-jobs') {
        if (wo.job_type !== 'commercial') return false;
      }
      // Dropdown filters
      if (
        filterCriteria.priority.length > 0 &&
        !filterCriteria.priority.includes(wo.priority)
      )
        return false;
      if (
        filterCriteria.jobType.length > 0 &&
        !filterCriteria.jobType.includes(wo.job_type)
      )
        return false;
      return true;
    },
    [filter, filterCriteria, debouncedSearch]
  );
```

- [ ] **Step 4: Verify compilation**

Run: `cd frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/dashboard/page.tsx
git commit -m "feat: add search input, Import CSV button, and kanban search filtering"
```

### Task 7: Add list-mode server-side data fetching

**Files:**
- Modify: `frontend/src/app/dashboard/page.tsx` (add list data state and fetch)

- [ ] **Step 1: Add list-mode state**

After the existing kanban state declarations in `DashboardPage`, add:

```typescript
  // List-mode state (server-side paginated)
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [listPage, setListPage] = useState(0);
  const listLimit = 20;
  const [listWorkOrders, setListWorkOrders] = useState<WorkOrderResponse[]>([]);
  const [listTotal, setListTotal] = useState(0);
  const [listLoading, setListLoading] = useState(false);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WorkOrderResponse | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
```

- [ ] **Step 2: Add list-mode fetch function**

After `fetchData`, add:

```typescript
  const fetchListData = useCallback(async () => {
    setListLoading(true);
    try {
      const params = new URLSearchParams({
        skip: String(listPage * listLimit),
        limit: String(listLimit),
      });
      if (activeStage) params.set('status_id', activeStage);
      if (debouncedSearch) params.set('search', debouncedSearch);
      const data = await api.get<WorkOrderListResponse>(`/api/work-orders?${params}`);
      setListWorkOrders(data.items);
      setListTotal(data.total);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`Failed to load jobs list: ${err.message}`);
      } else {
        setError('Failed to load jobs list.');
      }
    } finally {
      setListLoading(false);
    }
  }, [listPage, activeStage, debouncedSearch]);
```

- [ ] **Step 3: Add effect to trigger list fetch when in list mode**

Note: `fetchListData` identity changes when `listPage`, `activeStage`, or `debouncedSearch` change, so this single effect handles all re-fetch triggers. The page reset in Step 5 uses a ref to avoid a double-fetch.

```typescript
  // Track whether page was auto-reset to avoid double-fetch
  const skipNextListFetch = useRef(false);

  useEffect(() => {
    if (viewMode === 'list') {
      if (skipNextListFetch.current) {
        skipNextListFetch.current = false;
        return;
      }
      fetchListData();
    }
  }, [viewMode, fetchListData]);
```

- [ ] **Step 4: Add delete handler**

```typescript
  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/api/work-orders/${deleteTarget.id}`);
      setShowDeleteModal(false);
      setDeleteTarget(null);
      fetchListData();
      fetchData(); // Refresh kanban data + KPIs too
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setDeleteError('Cannot delete — this job has linked invoices');
      } else {
        setDeleteError(err instanceof ApiError ? err.message : 'Failed to delete');
      }
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, fetchListData, fetchData]);
```

- [ ] **Step 5: Reset list page when search or stage changes**

When `activeStage` or `debouncedSearch` changes, reset page to 0. The ref skip prevents a double-fetch — the page reset triggers a `fetchListData` identity change, and the subsequent effect run handles the actual fetch.

```typescript
  // Reset list pagination when filters change
  useEffect(() => {
    setListPage((prev) => {
      if (prev !== 0) {
        skipNextListFetch.current = true; // page change will trigger fetchListData identity change
      }
      return 0;
    });
  }, [activeStage, debouncedSearch]);
```

- [ ] **Step 6: Verify compilation**

Run: `cd frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/dashboard/page.tsx
git commit -m "feat: add list-mode server-side fetch, delete handler, and pagination state"
```

### Task 8: Upgrade ListView with status tabs, richer columns, pagination, and delete

**Files:**
- Modify: `frontend/src/app/dashboard/page.tsx` (ListView component and page JSX)

- [ ] **Step 1: Add formatDate helper**

Near the top of the file with other helpers, add:

```typescript
function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
```

- [ ] **Step 2: Update listViewColumns to include all columns**

Replace the existing `listViewColumns` function with the expanded version:

```typescript
function listViewColumns(
  stages: KanbanStageResponse[],
  setDeleteTarget: (wo: WorkOrderResponse) => void,
  setShowDeleteModal: (show: boolean) => void,
): Column<WorkOrderResponse>[] {
  return [
    {
      key: 'job_number',
      header: 'Job #',
      className: 'font-mono font-medium text-[var(--text-primary)]',
      render: (wo) => wo.job_number,
    },
    {
      key: 'client',
      header: 'Client',
      className: 'text-[var(--text-secondary)]',
      render: (wo) => wo.client_name ?? '—',
    },
    {
      key: 'vehicle',
      header: 'Vehicle',
      className: 'max-w-[200px] truncate text-[var(--text-secondary)]',
      render: (wo) =>
        wo.vehicles.length > 0
          ? wo.vehicles.map((v) => [v.year, v.make, v.model].filter(Boolean).join(' ')).join(', ')
          : '—',
    },
    {
      key: 'type',
      header: 'Type',
      className: 'capitalize text-[var(--text-secondary)]',
      render: (wo) => wo.job_type,
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (wo) => (
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${PRIORITY_BADGE[wo.priority] ?? ''}`}>
          {wo.priority}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (wo) => {
        const stage = stages.find((s) => s.id === wo.status?.id);
        if (!stage) return <span className="text-[var(--text-muted)]">—</span>;
        return (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: stage.color + '22', color: stage.color }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: stage.color }} />
            {stage.name}
          </span>
        );
      },
    },
    {
      key: 'value',
      header: 'Value',
      className: 'font-mono font-medium text-[var(--text-primary)]',
      headerClassName: 'text-right',
      render: (wo) => <span className="block text-right">{wo.job_value ? formatCurrency(wo.job_value) : '—'}</span>,
    },
    {
      key: 'est_hours',
      header: 'Est. Hours',
      className: 'font-mono text-[var(--text-secondary)]',
      render: (wo) => (wo.estimated_hours != null ? `${wo.estimated_hours}h` : '—'),
    },
    {
      key: 'due',
      header: 'Due',
      className: 'text-[var(--text-secondary)]',
      render: (wo) => formatDate(wo.estimated_completion_date),
    },
    {
      key: 'actions',
      header: '',
      headerClassName: 'w-12',
      className: 'text-right',
      render: (wo) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setDeleteTarget(wo);
            setShowDeleteModal(true);
          }}
          className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-red-500/10 hover:text-red-400"
          title="Delete job"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      ),
    },
  ];
}
```

- [ ] **Step 3: Rewrite ListView component with status tabs, pagination, and row click**

Replace the existing `ListView` component:

```tsx
function ListView({
  workOrders,
  stages,
  loading,
  total,
  page,
  limit,
  activeStage,
  onStageChange,
  onPageChange,
  onRowClick,
  setDeleteTarget,
  setShowDeleteModal,
  filterCriteria,
}: {
  workOrders: WorkOrderResponse[];
  stages: KanbanStageResponse[];
  loading: boolean;
  total: number;
  page: number;
  limit: number;
  activeStage: string | null;
  onStageChange: (stageId: string | null) => void;
  onPageChange: (page: number) => void;
  onRowClick: (wo: WorkOrderResponse) => void;
  setDeleteTarget: (wo: WorkOrderResponse) => void;
  setShowDeleteModal: (show: boolean) => void;
  filterCriteria: FilterCriteria;
}) {
  const columns = useMemo(
    () => listViewColumns(stages, setDeleteTarget, setShowDeleteModal),
    [stages, setDeleteTarget, setShowDeleteModal]
  );

  // Client-side post-filter for priority and job type
  const filteredWorkOrders = useMemo(() => {
    let filtered = workOrders;
    if (filterCriteria.priority.length > 0) {
      filtered = filtered.filter((wo) => filterCriteria.priority.includes(wo.priority));
    }
    if (filterCriteria.jobType.length > 0) {
      filtered = filtered.filter((wo) => filterCriteria.jobType.includes(wo.job_type));
    }
    return filtered;
  }, [workOrders, filterCriteria]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      {/* Status tabs */}
      {stages.length > 0 && (
        <div className="mb-4 flex gap-1">
          <button
            onClick={() => onStageChange(null)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              activeStage === null
                ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]'
            }`}
          >
            All
          </button>
          {stages.map((stage) => (
            <button
              key={stage.id}
              onClick={() => onStageChange(stage.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                activeStage === stage.id
                  ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]'
              }`}
            >
              {stage.name}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border)] border-t-[var(--accent-primary)]" />
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={filteredWorkOrders}
            rowKey={(wo) => wo.id}
            onRowClick={onRowClick}
            stickyHeader
            emptyState={
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">No jobs found</p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">Try a different search or filter</p>
              </div>
            }
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-[var(--text-secondary)]">
                Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}
              </p>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => onPageChange(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => onPageChange(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Hide quick filters in list mode**

The quick filter buttons (All, My Jobs, Urgent) are kanban-specific. List mode has its own status tabs for filtering. Wrap the quick filters to only render in kanban mode. In the view toggle/filters bar, wrap the quick filter `<div>` with a condition:

```tsx
        {viewMode === 'kanban' && (
          <div className="flex items-center gap-2">
            {([
              { key: 'all', label: 'All' },
              { key: 'my-jobs', label: 'My Jobs' },
              { key: 'urgent', label: 'Urgent' },
            ] as const).map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter((prev) => prev === f.key ? 'all' : f.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  filter === f.key
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'bg-[var(--surface-card)] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--surface-raised)]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
```

- [ ] **Step 5: Update ListView usage in the page JSX**

Replace the existing list view rendering block:

```tsx
        {viewMode === 'list' && (
          <ListView
            workOrders={listWorkOrders}
            stages={stages}
            loading={listLoading}
            total={listTotal}
            page={listPage}
            limit={listLimit}
            activeStage={activeStage}
            onStageChange={setActiveStage}
            onPageChange={setListPage}
            onRowClick={(wo) => router.push(`/dashboard/jobs/${wo.id}`)}
            setDeleteTarget={setDeleteTarget}
            setShowDeleteModal={setShowDeleteModal}
            filterCriteria={filterCriteria}
          />
        )}
```

- [ ] **Step 6: Add delete confirmation modal JSX**

After the `ImportCSVModal`, add:

```tsx
      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowDeleteModal(false); setDeleteTarget(null); setDeleteError(null); }} />
          <div className="relative w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface-card)] p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Delete Job</h2>
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

- [ ] **Step 7: Verify compilation**

Run: `cd frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 8: Verify the dev server starts and renders**

Run: `cd frontend && npm run build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 9: Commit**

```bash
git add frontend/src/app/dashboard/page.tsx
git commit -m "feat: upgrade ListView with status tabs, pagination, delete, and row navigation"
```

---

## Chunk 3: Smoke Testing and Cleanup

### Task 9: Manual smoke test checklist

No code changes — this is a verification task.

- [ ] **Step 1: Start the dev environment**

Run: `make up` (or `cd frontend && npm run dev`)

- [ ] **Step 2: Verify kanban mode**

Navigate to `/dashboard`. Verify:
- Kanban board renders with drag-and-drop columns
- KPI metrics bar shows above the board
- Search input filters kanban cards by job # or client name
- Filter dropdown (priority, job type) still works
- Quick filters (All, My Jobs, Urgent) still work
- Apply a quick filter (e.g., Urgent) AND type a search term; verify results match both criteria (AND composition)
- "X total" badge in header shows unfiltered count even when search or filters are active
- "Import CSV" button opens the import modal
- "+ New Job" button opens the create modal

- [ ] **Step 3: Verify list mode**

Click "List" view tab. Verify:
- Quick filter buttons (All, My Jobs, Urgent) are hidden
- Status tabs appear (All + each kanban stage)
- Table shows all columns: Job #, Client, Vehicle, Type, Priority, Status, Value, Est. Hours, Due, Actions
- Clicking a status tab filters the table (server-side)
- Search filters the table (server-side, debounced)
- Filter dropdown (priority, job type) filters list results client-side
- Pagination shows when > 20 results
- Clicking a row navigates to `/dashboard/jobs/[id]`
- Delete button on row opens confirmation modal (does not navigate)
- Attempt to delete a job with linked invoices; verify error message "Cannot delete — this job has linked invoices" appears
- KPI metrics bar is visible above the list
- "X total" badge shows unfiltered count

- [ ] **Step 4: Verify CSV import modal**

Click "Import CSV". Verify:
- Modal opens with drag-drop zone
- "Download Template" button works
- Uploading a CSV shows preview → upload → done flow
- "Close" dismisses modal and refreshes data
- "Import Another File" resets to select step

- [ ] **Step 5: Verify detail page**

Navigate to `/dashboard/jobs/[id]`. Verify:
- Page loads correctly
- Back button/breadcrumb navigates to `/dashboard` (not `/dashboard/work-orders`)
- All tabs work (Overview, Checklist, Photos, Timeline)
- Delete a job from the detail page; verify redirect goes to `/dashboard` (not `/dashboard/work-orders`)

- [ ] **Step 6: Verify old routes are gone**

Navigate to `/dashboard/work-orders`. Verify: 404 page.
Navigate to `/dashboard/work-orders/import`. Verify: 404 page.

- [ ] **Step 7: Verify navigation**

Switch role to Admin: "Jobs" link goes to `/dashboard`, no "Jobs List" entry.
Switch role to Production: "Assigned Jobs" link goes to `/dashboard`.

### Task 10: Final commit and cleanup

- [ ] **Step 1: Check for any remaining references to old routes**

Run: `grep -r "/dashboard/work-orders" frontend/src/ --include="*.tsx" --include="*.ts" -l`
Expected: No results (all references should be updated or deleted)

Also check non-source files:
Run: `grep -r "/dashboard/work-orders" frontend/ --include="*.json" --include="*.config.*" -l`
Expected: No results

If any remain, update them.

- [ ] **Step 2: Verify clean build**

Run: `cd frontend && npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Final commit if any cleanup was needed**

```bash
git add -A frontend/src/
git commit -m "chore: clean up remaining work-orders route references"
```
