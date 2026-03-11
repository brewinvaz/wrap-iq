'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { useModalAccessibility } from '@/hooks/useModalAccessibility';

interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: () => void;
}

export default function CreateInvoiceModal({
  isOpen,
  onClose,
  onCreate,
}: CreateInvoiceModalProps) {
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [taxRate, setTaxRate] = useState('0');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useModalAccessibility(isOpen, onClose);

  if (!isOpen) return null;

  function resetForm() {
    setClientName('');
    setClientEmail('');
    setAmount('');
    setTaxRate('0');
    setDueDate('');
    setNotes('');
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientName.trim() || !clientEmail.trim() || !amount) return;

    const subtotalCents = Math.round(parseFloat(amount) * 100);
    if (isNaN(subtotalCents) || subtotalCents <= 0) {
      setError('Please enter a valid amount greater than zero.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await api.post('/api/invoices', {
        client_name: clientName.trim(),
        client_email: clientEmail.trim(),
        subtotal: subtotalCents,
        tax_rate: taxRate || '0',
        due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
        notes: notes.trim() || undefined,
      });
      resetForm();
      onCreate();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-invoice-title"
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="mb-6 flex items-center justify-between">
          <h3 id="create-invoice-title" className="text-lg font-semibold text-[#18181b]">
            Create New Invoice
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[#a8a8b4] transition-colors hover:bg-gray-100 hover:text-[#18181b]"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="invoice-client-name"
              className="mb-1.5 block text-sm font-medium text-[#18181b]"
            >
              Client Name
            </label>
            <input
              id="invoice-client-name"
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g., John Smith"
              required
              className="w-full rounded-lg border border-[#e6e6eb] px-3.5 py-2.5 text-sm text-[#18181b] placeholder-[#a8a8b4] transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="invoice-client-email"
              className="mb-1.5 block text-sm font-medium text-[#18181b]"
            >
              Client Email
            </label>
            <input
              id="invoice-client-email"
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="john@example.com"
              required
              className="w-full rounded-lg border border-[#e6e6eb] px-3.5 py-2.5 text-sm text-[#18181b] placeholder-[#a8a8b4] transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="invoice-amount"
                className="mb-1.5 block text-sm font-medium text-[#18181b]"
              >
                Amount ($)
              </label>
              <input
                id="invoice-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
                className="w-full rounded-lg border border-[#e6e6eb] px-3.5 py-2.5 text-sm text-[#18181b] placeholder-[#a8a8b4] transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label
                htmlFor="invoice-tax-rate"
                className="mb-1.5 block text-sm font-medium text-[#18181b]"
              >
                Tax Rate (%)
              </label>
              <input
                id="invoice-tax-rate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-[#e6e6eb] px-3.5 py-2.5 text-sm text-[#18181b] placeholder-[#a8a8b4] transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="invoice-due-date"
              className="mb-1.5 block text-sm font-medium text-[#18181b]"
            >
              Due Date
            </label>
            <input
              id="invoice-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-[#e6e6eb] px-3.5 py-2.5 text-sm text-[#18181b] placeholder-[#a8a8b4] transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="invoice-notes"
              className="mb-1.5 block text-sm font-medium text-[#18181b]"
            >
              Description / Notes
            </label>
            <textarea
              id="invoice-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Invoice description or additional notes..."
              rows={3}
              className="w-full rounded-lg border border-[#e6e6eb] px-3.5 py-2.5 text-sm text-[#18181b] placeholder-[#a8a8b4] transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-[#e6e6eb] px-4 py-2.5 text-sm font-medium text-[#60606a] transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
