'use client';

import { BillingPaymentMethod } from '@/lib/types';
import { Button } from '@/components/ui/Button';

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
    <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-14 items-center justify-center rounded-md bg-[var(--surface-raised)] text-xs font-semibold text-[var(--text-secondary)]">
          {method.brand}
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)]">
            {method.brand} ending in {method.lastFour}
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            Expires {String(method.expMonth).padStart(2, '0')}/{method.expYear}
          </p>
        </div>
        {method.isDefault && (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            Default
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {!method.isDefault && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSetDefault(method.id)}
          >
            Set Default
          </Button>
        )}
        <Button
          variant="danger"
          size="sm"
          onClick={() => onRemove(method.id)}
        >
          Remove
        </Button>
      </div>
    </div>
  );
}
