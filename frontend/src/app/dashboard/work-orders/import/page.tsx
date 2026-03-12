'use client';

import { useState, useCallback, useRef, type DragEvent, type ChangeEvent } from 'react';
import Link from 'next/link';
import { ApiError } from '@/lib/api-client';
import { API_BASE_URL } from '@/lib/config';
import { getAccessToken } from '@/lib/auth';

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

export default function ImportWorkOrdersPage() {
  const [step, setStep] = useState<Step>('select');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // --- File selection ---

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
      // Reset input so re-selecting the same file triggers change
      e.target.value = '';
    },
    [handleFile],
  );

  // --- Upload ---

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

  // --- Reset ---

  const handleReset = useCallback(() => {
    setStep('select');
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
  }, []);

  // --- Download template ---

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

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/work-orders"
            className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            Work Orders
          </Link>
          <span className="text-sm text-[var(--text-muted)]">/</span>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Import CSV</h1>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="mx-6 mt-4 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <span className="text-sm text-red-700">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-sm font-medium text-red-700 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-3xl">
          {/* ---- Step: Select file ---- */}
          {step === 'select' && (
            <div className="space-y-4">
              {/* Drop zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-16 transition-colors ${
                  dragOver
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-[var(--border)] bg-[var(--surface-card)] hover:border-[var(--accent-primary)] hover:bg-blue-50/30'
                }`}
              >
                <svg
                  className="mb-3 h-10 w-10 text-[var(--text-muted)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                  />
                </svg>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Drag and drop your CSV file here
                </p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  or click to browse files
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={onFileInput}
                />
              </div>

              {/* Template download */}
              <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    Need the CSV template?
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Download a pre-formatted template with the expected columns.
                  </p>
                </div>
                <button
                  onClick={handleDownloadTemplate}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-overlay)]"
                >
                  Download Template
                </button>
              </div>
            </div>
          )}

          {/* ---- Step: Preview ---- */}
          {step === 'preview' && preview && (
            <div className="space-y-4">
              {/* File info */}
              <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[var(--accent-primary)]">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{file?.name}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{preview.total_rows} rows detected</p>
                  </div>
                </div>
                <button
                  onClick={handleReset}
                  className="text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                >
                  Change file
                </button>
              </div>

              {/* Validation errors */}
              {hasValidationErrors && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-sm font-medium text-amber-800">
                    {preview.validation_errors.length} validation{' '}
                    {preview.validation_errors.length === 1 ? 'issue' : 'issues'} found
                  </p>
                  <ul className="mt-2 space-y-1">
                    {preview.validation_errors.slice(0, 10).map((ve, i) => (
                      <li key={i} className="text-xs text-amber-700">
                        Row {ve.row}{ve.field ? `, ${ve.field}` : ''}: {ve.message}
                      </li>
                    ))}
                    {preview.validation_errors.length > 10 && (
                      <li className="text-xs font-medium text-amber-700">
                        ... and {preview.validation_errors.length - 10} more
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* Preview table */}
              {preview.sample_rows.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
                  <div className="border-b border-[var(--border)] bg-[var(--surface-app)] px-4 py-2">
                    <p className="text-xs font-medium text-[var(--text-secondary)]">
                      Preview (first {preview.sample_rows.length} of {preview.total_rows} rows)
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border)]">
                          {preview.headers.map((h) => (
                            <th
                              key={h}
                              className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-[var(--text-secondary)]"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.sample_rows.map((row, idx) => (
                          <tr key={idx} className="border-b border-[var(--border)] last:border-0">
                            {preview.headers.map((h) => (
                              <td
                                key={h}
                                className="whitespace-nowrap px-3 py-2 text-xs text-[var(--text-primary)]"
                              >
                                {row[h] || ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleUpload}
                  className="rounded-lg bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  Import {preview.total_rows} Work Orders
                </button>
                <button
                  onClick={handleReset}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-5 py-2.5 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-overlay)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ---- Step: Uploading ---- */}
          {step === 'uploading' && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-card)] px-6 py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
              <p className="mt-4 text-sm font-medium text-[var(--text-primary)]">Importing work orders...</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">This may take a moment.</p>
            </div>
          )}

          {/* ---- Step: Done ---- */}
          {step === 'done' && result && (
            <div className="space-y-4">
              {/* Summary */}
              <div
                className={`rounded-lg border px-4 py-4 ${
                  result.failed === 0
                    ? 'border-green-200 bg-green-50'
                    : 'border-amber-200 bg-amber-50'
                }`}
              >
                <p
                  className={`text-sm font-medium ${
                    result.failed === 0 ? 'text-green-800' : 'text-amber-800'
                  }`}
                >
                  {result.failed === 0
                    ? `Successfully imported all ${result.successful} work orders!`
                    : `Imported ${result.successful} of ${result.total_rows} work orders.`}
                </p>
                {result.failed > 0 && (
                  <p className="mt-1 text-xs text-amber-700">
                    {result.failed} row{result.failed === 1 ? '' : 's'} failed.
                  </p>
                )}
              </div>

              {/* Row errors */}
              {result.errors.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
                  <div className="border-b border-[var(--border)] bg-[var(--surface-app)] px-4 py-2">
                    <p className="text-xs font-medium text-[var(--text-secondary)]">Errors</p>
                  </div>
                  <ul className="divide-y divide-[var(--border)]">
                    {result.errors.map((e, i) => (
                      <li key={i} className="px-4 py-2 text-xs text-[var(--text-primary)]">
                        <span className="font-medium">Row {e.row}</span>
                        {e.field ? <span className="text-[var(--text-secondary)]"> ({e.field})</span> : null}
                        : {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3">
                <Link
                  href="/dashboard/work-orders"
                  className="rounded-lg bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  View Work Orders
                </Link>
                <button
                  onClick={handleReset}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-5 py-2.5 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-overlay)]"
                >
                  Import Another File
                </button>
              </div>
            </div>
          )}

          {/* Loading state for preview fetch */}
          {step === 'preview' && !preview && !error && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-card)] px-6 py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
              <p className="mt-4 text-sm font-medium text-[var(--text-primary)]">Analyzing CSV...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
