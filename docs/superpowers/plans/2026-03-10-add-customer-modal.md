# Add Customer Modal Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the existing `CreateClientModal` with predefined tags and a referral source dropdown, then wire it into the Customers page.

**Architecture:** The existing `CreateClientModal.tsx` already has the modal structure, form fields, API call, and error handling. We add a tags multi-select and convert the referral source to a dropdown. Then integrate into `ClientsPage` with an "Add Customer" button.

**Tech Stack:** React 19, Next.js 15, Tailwind CSS, existing `api-client.ts`

---

## File Map

- **Modify:** `frontend/src/components/clients/CreateClientModal.tsx` — add tags checkboxes, referral dropdown with "Other" option
- **Modify:** `frontend/src/components/clients/ClientsPage.tsx` — add "Add Customer" button, import and render modal
- **Modify:** `frontend/src/components/clients/ClientList.tsx` — add "+" button in sidebar header

---

## Chunk 1: Enhance CreateClientModal

### Task 1: Add predefined tags multi-select

**Files:**
- Modify: `frontend/src/components/clients/CreateClientModal.tsx`

- [ ] **Step 1: Add tags state and constants**

Add after the existing state declarations (line ~23):

```tsx
const PREDEFINED_TAGS = ['VIP', 'Repeat', 'Fleet', 'New'] as const;
```

Add state:

```tsx
const [tags, setTags] = useState<string[]>([]);
```

Add to `resetForm()`:

```tsx
setTags([]);
```

- [ ] **Step 2: Add tags toggle handler**

```tsx
function toggleTag(tag: string) {
  setTags((prev) =>
    prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
  );
}
```

- [ ] **Step 3: Add tags UI between address and referral source fields**

Insert after the address `<div>` (after line ~196) and before the referral source `<div>`:

```tsx
<div>
  <label className="mb-1.5 block text-sm font-medium text-[#18181b]">
    Tags
  </label>
  <div className="flex flex-wrap gap-2">
    {PREDEFINED_TAGS.map((tag) => {
      const selected = tags.includes(tag);
      return (
        <button
          key={tag}
          type="button"
          onClick={() => toggleTag(tag)}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            selected
              ? 'border-blue-300 bg-blue-50 text-blue-700'
              : 'border-[#e6e6eb] bg-white text-[#60606a] hover:bg-gray-50'
          }`}
        >
          {tag}
        </button>
      );
    })}
  </div>
</div>
```

- [ ] **Step 4: Include tags in API payload**

In `handleSubmit`, add `tags` to the `api.post` body:

```tsx
tags: tags.length > 0 ? tags : undefined,
```

- [ ] **Step 5: Verify modal renders correctly**

Run: `cd frontend && npm run build`
Expected: Build succeeds with no type errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/clients/CreateClientModal.tsx
git commit -m "feat: add predefined tags multi-select to CreateClientModal"
```

---

### Task 2: Convert referral source to dropdown with "Other"

**Files:**
- Modify: `frontend/src/components/clients/CreateClientModal.tsx`

- [ ] **Step 1: Add referral source constants and custom state**

Add constant near `PREDEFINED_TAGS`:

```tsx
const REFERRAL_SOURCES = [
  { value: '', label: 'Select a source...' },
  { value: 'Google', label: 'Google' },
  { value: 'Word of Mouth', label: 'Word of Mouth' },
  { value: 'Social Media', label: 'Social Media' },
  { value: 'Referral', label: 'Referral' },
  { value: 'other', label: 'Other' },
] as const;
```

Add state for custom referral text:

```tsx
const [customReferral, setCustomReferral] = useState('');
```

Add to `resetForm()`:

```tsx
setCustomReferral('');
```

- [ ] **Step 2: Replace referral source free-text input with dropdown**

Replace the current referral source `<div>` (lines ~198-213) with:

```tsx
<div>
  <label
    htmlFor="client-referral"
    className="mb-1.5 block text-sm font-medium text-[#18181b]"
  >
    Referral Source
  </label>
  <select
    id="client-referral"
    value={referralSource}
    onChange={(e) => setReferralSource(e.target.value)}
    className="w-full rounded-lg border border-[#e6e6eb] px-3.5 py-2.5 text-sm text-[#18181b] transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
  >
    {REFERRAL_SOURCES.map((src) => (
      <option key={src.value} value={src.value}>
        {src.label}
      </option>
    ))}
  </select>
  {referralSource === 'other' && (
    <input
      type="text"
      value={customReferral}
      onChange={(e) => setCustomReferral(e.target.value)}
      placeholder="Please specify..."
      className="mt-2 w-full rounded-lg border border-[#e6e6eb] px-3.5 py-2.5 text-sm text-[#18181b] placeholder-[#a8a8b4] transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
    />
  )}
</div>
```

- [ ] **Step 3: Update API payload to use correct referral value**

In `handleSubmit`, change the referral_source line to:

```tsx
referral_source:
  referralSource === 'other'
    ? customReferral.trim() || undefined
    : referralSource || undefined,
```

- [ ] **Step 4: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds with no type errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/clients/CreateClientModal.tsx
git commit -m "feat: convert referral source to dropdown with Other option"
```

---

## Chunk 2: Wire Modal into ClientsPage

### Task 3: Add "Add Customer" button and modal to ClientsPage

**Files:**
- Modify: `frontend/src/components/clients/ClientsPage.tsx`
- Modify: `frontend/src/components/clients/ClientList.tsx`

- [ ] **Step 1: Add "+" button to ClientList header**

In `ClientList.tsx`, add an `onAddClick` prop:

```tsx
interface ClientListProps {
  clients: Client[];
  selectedId: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelect: (client: Client) => void;
  onAddClick: () => void;
}
```

Update function signature to accept `onAddClick`. Add a button in the sidebar header, between the search input and the count text (after the `</div>` closing the relative search wrapper, before the `<p>` count):

```tsx
<div className="mt-2 flex items-center justify-between">
  <p className="font-[family-name:var(--font-dm-mono)] text-xs text-gray-400">
    {filtered.length} client{filtered.length !== 1 ? 's' : ''}
  </p>
  <button
    onClick={onAddClick}
    className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700"
  >
    + Add
  </button>
</div>
```

Remove the standalone `<p>` tag that was there before (line ~62-64).

- [ ] **Step 2: Import modal and add state in ClientsPage**

In `ClientsPage.tsx`, add import:

```tsx
import CreateClientModal from './CreateClientModal';
```

Add state:

```tsx
const [isAddModalOpen, setIsAddModalOpen] = useState(false);
```

- [ ] **Step 3: Pass onAddClick to ClientList**

Update the `<ClientList>` usage:

```tsx
<ClientList
  clients={clients}
  selectedId={selectedClient?.id ?? null}
  searchQuery={searchQuery}
  onSearchChange={setSearchQuery}
  onSelect={setSelectedClient}
  onAddClick={() => setIsAddModalOpen(true)}
/>
```

- [ ] **Step 4: Render modal in ClientsPage**

Add the modal at the end of the return JSX, just before the closing `</div>`:

```tsx
<CreateClientModal
  isOpen={isAddModalOpen}
  onClose={() => setIsAddModalOpen(false)}
  onCreate={() => {
    fetchClients();
    setIsAddModalOpen(false);
  }}
/>
```

- [ ] **Step 5: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds with no type errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/clients/ClientsPage.tsx frontend/src/components/clients/ClientList.tsx
git commit -m "feat: wire Add Customer modal into Customers page"
```
