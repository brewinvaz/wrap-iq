'use client';

import { useRef, useState } from 'react';
import type { ProjectData, UploadedFile } from '@/app/onboarding/[token]/page';
import { API_BASE_URL } from '@/lib/config';
import { Button } from '@/components/ui/Button';

const API_BASE = API_BASE_URL;

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;

const JOB_TYPES = [
  { value: 'personal', label: 'Personal' },
  { value: 'commercial', label: 'Commercial' },
];

interface FileWithProgress {
  file: File;
  progress: number; // 0-100
  status: 'uploading' | 'done' | 'error';
  error?: string;
  uploaded?: UploadedFile;
}

interface Props {
  data: ProjectData;
  onChange: (data: ProjectData) => void;
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  token: string;
  onBack: () => void;
  onNext: () => void;
}

export function FilesStep({ data, onChange, files, onFilesChange, token, onBack, onNext }: Props) {
  const [uploading, setUploading] = useState<FileWithProgress[]>([]);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateProject = (field: keyof ProjectData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected) return;

    setUploadError('');

    const totalFiles = files.length + selected.length;
    if (totalFiles > MAX_FILES) {
      setUploadError(`Maximum ${MAX_FILES} files allowed. You have ${files.length} already.`);
      return;
    }

    const toUpload: FileWithProgress[] = [];

    for (const file of Array.from(selected)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setUploadError(`${file.name}: Unsupported type. Use JPEG, PNG, WebP, or PDF.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        setUploadError(`${file.name}: File too large. Maximum 10MB.`);
        continue;
      }
      toUpload.push({ file, progress: 0, status: 'uploading' });
    }

    if (toUpload.length === 0) return;

    setUploading((prev) => [...prev, ...toUpload]);

    const newUploaded: UploadedFile[] = [];

    for (const item of toUpload) {
      try {
        // Get presigned URL
        const urlRes = await fetch(`${API_BASE}/api/portal/onboarding/${token}/upload-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: item.file.name, content_type: item.file.type }),
        });

        if (!urlRes.ok) {
          throw new Error('Failed to get upload URL');
        }

        const { upload_url, r2_key } = await urlRes.json();

        // Upload to R2
        const uploadRes = await fetch(upload_url, {
          method: 'PUT',
          headers: { 'Content-Type': item.file.type },
          body: item.file,
        });

        if (!uploadRes.ok) {
          throw new Error('Upload failed');
        }

        const uploaded: UploadedFile = {
          r2_key,
          filename: item.file.name,
          content_type: item.file.type,
          size_bytes: item.file.size,
        };

        newUploaded.push(uploaded);

        setUploading((prev) =>
          prev.map((u) =>
            u.file === item.file ? { ...u, progress: 100, status: 'done', uploaded } : u
          )
        );
      } catch {
        setUploading((prev) =>
          prev.map((u) =>
            u.file === item.file ? { ...u, status: 'error', error: 'Upload failed' } : u
          )
        );
      }
    }

    if (newUploaded.length > 0) {
      onFilesChange([...files, ...newUploaded]);
    }

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    const removedFile = files[index];
    onFilesChange(files.filter((_, i) => i !== index));
    setUploading((prev) => prev.filter((u) => u.status !== 'done' || u.uploaded?.r2_key !== removedFile.r2_key));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  const activeUploads = uploading.filter((u) => u.status === 'uploading');

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="mb-1 text-[16px] font-semibold text-[var(--text-primary)]">Project Details & Files</h2>
      <p className="mb-5 text-[13px] text-[var(--text-secondary)]">
        Tell us about your project and upload any reference files.
      </p>

      {/* Job type */}
      <div>
        <label className="mb-1 block text-[13px] font-medium text-[var(--text-primary)]">Job type</label>
        <div className="flex gap-3">
          {JOB_TYPES.map((jt) => (
            <button
              key={jt.value}
              type="button"
              onClick={() => updateProject('job_type', jt.value)}
              className={`rounded-[10px] border px-4 py-2 text-[13px] font-medium transition-colors ${
                data.job_type === jt.value
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                  : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]'
              }`}
            >
              {jt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div className="mt-4">
        <label className="mb-1 block text-[13px] font-medium text-[var(--text-primary)]">
          Project description
        </label>
        <textarea
          value={data.project_description}
          onChange={(e) => updateProject('project_description', e.target.value)}
          rows={3}
          className="w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] px-[10px] py-[10px] text-[14px] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]"
          placeholder="Describe your wrap project — full wrap, partial, color change, etc."
        />
      </div>

      {/* Referral */}
      <div className="mt-4">
        <label className="mb-1 block text-[13px] font-medium text-[var(--text-primary)]">
          How did you hear about us?
        </label>
        <input
          type="text"
          value={data.referral_source}
          onChange={(e) => updateProject('referral_source', e.target.value)}
          className="w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] px-[10px] py-[10px] text-[14px] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]"
          placeholder="Google, referral, Instagram, etc."
        />
      </div>

      {/* File upload */}
      <div className="mt-6">
        <label className="mb-1 block text-[13px] font-medium text-[var(--text-primary)]">
          Reference files
        </label>
        <p className="mb-3 text-[12px] text-[var(--text-muted)]">
          Upload design files, inspiration photos, or logos. Max 5 files, 10MB each.
          JPEG, PNG, WebP, or PDF.
        </p>

        {/* Drop zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="cursor-pointer rounded-[10px] border-2 border-dashed border-[var(--border)] p-6 text-center transition-colors hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/5"
        >
          <svg className="mx-auto mb-2 h-8 w-8 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
          </svg>
          <p className="text-[13px] text-[var(--text-secondary)]">
            Click to upload or drag files here
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {uploadError && (
          <p className="mt-2 text-[12px] text-red-400">{uploadError}</p>
        )}

        {/* Active uploads */}
        {activeUploads.length > 0 && (
          <div className="mt-3 space-y-2">
            {activeUploads.map((u, i) => (
              <div key={i} className="flex items-center gap-3 rounded-[10px] border border-[var(--border)] px-3 py-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent-primary)]" />
                <span className="flex-1 truncate text-[13px] text-[var(--text-secondary)]">{u.file.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Uploaded files */}
        {files.length > 0 && (
          <div className="mt-3 space-y-2">
            {files.map((f, i) => (
              <div key={f.r2_key} className="flex items-center gap-3 rounded-[10px] border border-[var(--border)] px-3 py-2">
                <svg className="h-4 w-4 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span className="flex-1 truncate text-[13px] text-[var(--text-primary)]">{f.filename}</span>
                <span className="text-[11px] text-[var(--text-muted)]">
                  {(f.size_bytes / 1024 / 1024).toFixed(1)} MB
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="text-[var(--text-muted)] transition-colors hover:text-red-500"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-between">
        <Button
          type="button"
          onClick={onBack}
          variant="secondary"
          size="lg"
        >
          Back
        </Button>
        <Button
          type="submit"
          disabled={activeUploads.length > 0}
          size="lg"
        >
          Next
        </Button>
      </div>
    </form>
  );
}
