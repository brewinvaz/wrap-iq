# Add Customer Modal — Design Spec

## Overview

Add an "Add Customer" modal to the Customers page (`/dashboard/customers`) that allows users to create new clients via the existing `POST /api/clients` endpoint.

## Approach

Single-step scrollable modal, consistent with the existing `CreateKeyModal` pattern. All fields presented in one form, grouped into sections.

## Component: `AddClientModal`

**File:** `frontend/src/components/clients/AddClientModal.tsx`

**Props:**

- `isOpen: boolean`
- `onClose: () => void`
- `onCreated: (client: Client) => void` — callback after successful creation

**Layout:** Centered modal with backdrop blur overlay, matching `CreateKeyModal` styling (`bg-black/40 backdrop-blur-sm`). Max width `max-w-lg`, scrollable via `max-h-[90vh] overflow-y-auto`.

### Form Sections

**1. Basic Info**

- `name` — text input, required
- `client_type` — radio/toggle: Personal | Business (default: Personal)

**2. Contact**

- `email` — email input, optional
- `phone` — tel input, optional
- `address` — textarea, optional

**3. Details**

- `tags` — predefined multi-select checkboxes: VIP, Repeat, Fleet, New
- `referral_source` — dropdown: Google, Word of Mouth, Social Media, Referral, Other. When "Other" is selected, show a free-text input
- `notes` — textarea, optional

### Actions

- Cancel button (secondary style)
- "Add Customer" submit button (primary blue style)

### Behavior

- On submit: `POST /api/clients` via `api.post()` with snake_case payload
- Loading state on submit button during request
- On success: call `onCreated(transformedClient)`, close modal, reset form
- On error: show inline error message above action buttons
- Form resets when modal closes

## Integration: `ClientsPage`

- Add "+ Add Customer" button near the search area in the list sidebar
- Manage `isAddModalOpen` state
- On `onCreated`: re-fetch client list via existing `fetchClients()`, select the newly created client

## API Payload

```json
{
  "name": "string (required)",
  "client_type": "personal | business",
  "email": "string | null",
  "phone": "string | null",
  "address": "string | null",
  "tags": ["string"],
  "referral_source": "string | null",
  "notes": "string | null"
}
```

## Styling

All styling follows existing conventions from `CreateKeyModal`:

- Input: `rounded-lg border border-[#e6e6eb] px-3.5 py-2.5 text-sm`
- Labels: `text-sm font-medium text-[#18181b]`
- Primary button: `bg-blue-600 text-white hover:bg-blue-700`
- Secondary button: `border border-[#e6e6eb] text-[#60606a] hover:bg-gray-50`
