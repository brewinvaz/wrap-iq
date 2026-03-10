'use client';

import { BillingPaymentMethod } from '@/lib/types';

interface PaymentMethodCardProps {
  method: BillingPaymentMethod;
  onSetDefault: (id: string) => void;
  onRemove: (id: string) => void;
}

export default function PaymentMethodCard({
  method,
  onSetDefault,
  onRemove,
}: PaymentMethodCardProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[#e6e6eb] bg-white px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-14 items-center justify-center rounded-md bg-gray-100 text-xs font-semibold text-[#60606a]">
          {method.brand}
        </div>
        <div>
          <p className="text-sm font-medium text-[#18181b]">
            {method.brand} ending in {method.lastFour}
          </p>
          <p className="text-xs text-[#60606a]">
            Expires {String(method.expMonth).padStart(2, '0')}/{method.expYear}
          </p>
        </div>
        {method.isDefault && (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
            Default
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {!method.isDefault && (
          <button
            onClick={() => onSetDefault(method.id)}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-[#60606a] transition-colors hover:bg-gray-100"
          >
            Set Default
          </button>
        )}
        <button
          onClick={() => onRemove(method.id)}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
