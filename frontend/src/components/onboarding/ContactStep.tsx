'use client';

import type { ContactData } from '@/app/onboarding/[token]/page';

interface Props {
  data: ContactData;
  onChange: (data: ContactData) => void;
  onNext: () => void;
}

export function ContactStep({ data, onChange, onNext }: Props) {
  const update = (field: keyof ContactData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  const isValid = data.first_name.trim() && data.last_name.trim();

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="mb-1 text-[16px] font-semibold text-[var(--text-primary)]">Contact Information</h2>
      <p className="mb-5 text-[13px] text-[var(--text-secondary)]">Tell us how to reach you.</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[13px] font-medium text-[var(--text-primary)]">
            First name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={data.first_name}
            onChange={(e) => update('first_name', e.target.value)}
            className="w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] px-[10px] py-[10px] text-[14px] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]"
            placeholder="Jane"
          />
        </div>
        <div>
          <label className="mb-1 block text-[13px] font-medium text-[var(--text-primary)]">
            Last name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={data.last_name}
            onChange={(e) => update('last_name', e.target.value)}
            className="w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] px-[10px] py-[10px] text-[14px] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]"
            placeholder="Doe"
          />
        </div>
      </div>

      <div className="mt-4">
        <label className="mb-1 block text-[13px] font-medium text-[var(--text-primary)]">Phone</label>
        <input
          type="tel"
          value={data.phone}
          onChange={(e) => update('phone', e.target.value)}
          className="w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] px-[10px] py-[10px] text-[14px] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]"
          placeholder="(555) 123-4567"
        />
      </div>

      <div className="mt-4">
        <label className="mb-1 block text-[13px] font-medium text-[var(--text-primary)]">Company name</label>
        <input
          type="text"
          value={data.company_name}
          onChange={(e) => update('company_name', e.target.value)}
          className="w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] px-[10px] py-[10px] text-[14px] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]"
          placeholder="Doe Fleet Services"
        />
      </div>

      <div className="mt-4">
        <label className="mb-1 block text-[13px] font-medium text-[var(--text-primary)]">Address</label>
        <textarea
          value={data.address}
          onChange={(e) => update('address', e.target.value)}
          rows={2}
          className="w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] px-[10px] py-[10px] text-[14px] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]"
          placeholder="123 Main St, City, State 12345"
        />
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={!isValid}
          className="rounded-[10px] bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] px-5 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </form>
  );
}
