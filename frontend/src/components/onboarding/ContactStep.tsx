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
      <h2 className="mb-1 text-[16px] font-semibold text-[#18181b]">Contact Information</h2>
      <p className="mb-5 text-[13px] text-[#60606a]">Tell us how to reach you.</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[13px] font-medium text-[#18181b]">
            First name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={data.first_name}
            onChange={(e) => update('first_name', e.target.value)}
            className="w-full rounded-lg border border-[#e6e6eb] px-3 py-2 text-[14px] text-[#18181b] placeholder-[#a8a8b4] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder="Jane"
          />
        </div>
        <div>
          <label className="mb-1 block text-[13px] font-medium text-[#18181b]">
            Last name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={data.last_name}
            onChange={(e) => update('last_name', e.target.value)}
            className="w-full rounded-lg border border-[#e6e6eb] px-3 py-2 text-[14px] text-[#18181b] placeholder-[#a8a8b4] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder="Doe"
          />
        </div>
      </div>

      <div className="mt-4">
        <label className="mb-1 block text-[13px] font-medium text-[#18181b]">Phone</label>
        <input
          type="tel"
          value={data.phone}
          onChange={(e) => update('phone', e.target.value)}
          className="w-full rounded-lg border border-[#e6e6eb] px-3 py-2 text-[14px] text-[#18181b] placeholder-[#a8a8b4] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          placeholder="(555) 123-4567"
        />
      </div>

      <div className="mt-4">
        <label className="mb-1 block text-[13px] font-medium text-[#18181b]">Company name</label>
        <input
          type="text"
          value={data.company_name}
          onChange={(e) => update('company_name', e.target.value)}
          className="w-full rounded-lg border border-[#e6e6eb] px-3 py-2 text-[14px] text-[#18181b] placeholder-[#a8a8b4] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          placeholder="Doe Fleet Services"
        />
      </div>

      <div className="mt-4">
        <label className="mb-1 block text-[13px] font-medium text-[#18181b]">Address</label>
        <textarea
          value={data.address}
          onChange={(e) => update('address', e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-[#e6e6eb] px-3 py-2 text-[14px] text-[#18181b] placeholder-[#a8a8b4] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          placeholder="123 Main St, City, State 12345"
        />
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={!isValid}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </form>
  );
}
