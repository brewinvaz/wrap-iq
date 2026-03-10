'use client';

import { useRef, useState } from 'react';
import type { ProjectData, UploadedFile } from '@/app/onboarding/[token]/page';
import { API_BASE_URL } from '@/lib/config';

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
      <h2 className="mb-1 text-[16px] font-semibold text-[#18181b]">Project Details & Files</h2>
      <p className="mb-5 text-[13px] text-[#60606a]">
        Tell us about your project and upload any reference files.
      </p>

      {/* Job type */}
      <div>
        <label className="mb-1 block text-[13px] font-medium text-[#18181b]">Job type</label>
        <div className="flex gap-3">
          {JOB_TYPES.map((jt) => (
            <button
              key={jt.value}
              type="button"
              onClick={() => updateProject('job_type', jt.value)}
              className={`rounded-lg border px-4 py-2 text-[13px] font-medium transition-colors ${
                data.job_type === jt.value
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-[#e6e6eb] text-[#60606a] hover:bg-[#f8f8fa]'
              }`}
            >
              {jt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div className="mt-4">
        <label className="mb-1 block text-[13px] font-medium text-[#18181b]">
          Project description
        </label>
        <textarea
          value={data.project_description}
          onChange={(e) => updateProject('project_description', e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-[#e6e6eb] px-3 py-2 text-[14px] text-[#18181b] placeholder-[#a8a8b4] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          placeholder="Describe your wrap project — full wrap, partial, color change, etc."
        />
      </div>

      {/* Referral */}
      <div className="mt-4">
        <label className="mb-1 block text-[13px] font-medium text-[#18181b]">
          How did you hear about us?
        </label>
        <input
          type="text"
          value={data.referral_source}
          onChange={(e) => updateProject('referral_source', e.target.value)}
          className="w-full rounded-lg border border-[#e6e6eb] px-3 py-2 text-[14px] text-[#18181b] placeholder-[#a8a8b4] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          placeholder="Google, referral, Instagram, etc."
        />
      </div>

      {/* File upload */}
      <div className="mt-6">
        <label className="mb-1 block text-[13px] font-medium text-[#18181b]">
          Reference files
        </label>
        <p className="mb-3 text-[12px] text-[#a8a8b4]">
          Upload design files, inspiration photos, or logos. Max 5 files, 10MB each.
          JPEG, PNG, WebP, or PDF.
        </p>

        {/* Drop zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="cursor-pointer rounded-lg border-2 border-dashed border-[#e6e6eb] p-6 text-center transition-colors hover:border-blue-400 hover:bg-blue-50/30"
        >
          <svg className="mx-auto mb-2 h-8 w-8 text-[#a8a8b4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
          </svg>
          <p className="text-[13px] text-[#60606a]">
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
          <p className="mt-2 text-[12px] text-red-600">{uploadError}</p>
        )}

        {/* Active uploads */}
        {activeUploads.length > 0 && (
          <div className="mt-3 space-y-2">
            {activeUploads.map((u, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-[#e6e6eb] px-3 py-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#e6e6eb] border-t-blue-600" />
                <span className="flex-1 truncate text-[13px] text-[#60606a]">{u.file.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Uploaded files */}
        {files.length > 0 && (
          <div className="mt-3 space-y-2">
            {files.map((f, i) => (
              <div key={f.r2_key} className="flex items-center gap-3 rounded-lg border border-[#e6e6eb] px-3 py-2">
                <svg className="h-4 w-4 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span className="flex-1 truncate text-[13px] text-[#18181b]">{f.filename}</span>
                <span className="text-[11px] text-[#a8a8b4]">
                  {(f.size_bytes / 1024 / 1024).toFixed(1)} MB
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="text-[#a8a8b4] transition-colors hover:text-red-500"
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
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-[#e6e6eb] px-5 py-2.5 text-[13px] font-medium text-[#18181b] transition-colors hover:bg-[#f8f8fa]"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={activeUploads.length > 0}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </form>
  );
}
