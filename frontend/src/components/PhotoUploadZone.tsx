'use client';

import { useCallback, useRef, useState } from 'react';
import { api } from '@/lib/api-client';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;

interface UploadingFile {
  file: File;
  progress: number;
  status: 'uploading' | 'registering' | 'done' | 'error';
  error?: string;
}

interface PhotoUploadZoneProps {
  workOrderId: string;
  onUploadComplete: () => void;
}

export default function PhotoUploadZone({ workOrderId, onUploadComplete }: PhotoUploadZoneProps) {
  const [uploading, setUploading] = useState<UploadingFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFiles = (files: File[]): { valid: File[]; errors: string[] } => {
    const errors: string[] = [];
    const valid: File[] = [];

    if (files.length > MAX_FILES) {
      errors.push(`Maximum ${MAX_FILES} files per upload`);
      return { valid: [], errors };
    }

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push(`${file.name}: Only PNG, JPG, and WebP files are allowed`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: File exceeds 10MB limit`);
        continue;
      }
      valid.push(file);
    }

    return { valid, errors };
  };

  const uploadFile = async (
    file: File,
    index: number,
    updateProgress: (index: number, updates: Partial<UploadingFile>) => void,
  ): Promise<{ r2_key: string; filename: string; content_type: string; size_bytes: number } | null> => {
    try {
      const { upload_url, r2_key } = await api.post<{ upload_url: string; r2_key: string }>(
        `/api/work-orders/${workOrderId}/photos/upload-url`,
        { filename: file.name, content_type: file.type },
      );

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            updateProgress(index, { progress: Math.round((e.loaded / e.total) * 100) });
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed: ${xhr.statusText}`));
          }
        };
        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.open('PUT', upload_url);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      return { r2_key, filename: file.name, content_type: file.type, size_bytes: file.size };
    } catch (err) {
      updateProgress(index, {
        status: 'error',
        error: err instanceof Error ? err.message : 'Upload failed',
      });
      return null;
    }
  };

  const handleFiles = useCallback(async (files: File[]) => {
    const { valid, errors } = validateFiles(files);

    if (errors.length > 0) {
      alert(errors[0]);
    }

    if (valid.length === 0) return;

    const uploadStates: UploadingFile[] = valid.map((file) => ({
      file,
      progress: 0,
      status: 'uploading',
    }));
    setUploading(uploadStates);

    const updateProgress = (index: number, updates: Partial<UploadingFile>) => {
      setUploading((prev) => prev.map((item, i) => (i === index ? { ...item, ...updates } : item)));
    };

    const results = await Promise.all(
      valid.map((file, index) => uploadFile(file, index, updateProgress)),
    );

    const successful = results.filter(Boolean) as {
      r2_key: string;
      filename: string;
      content_type: string;
      size_bytes: number;
    }[];

    if (successful.length > 0) {
      try {
        setUploading((prev) => prev.map((item) =>
          item.status === 'uploading' ? { ...item, status: 'registering', progress: 100 } : item,
        ));

        await api.post(`/api/work-orders/${workOrderId}/photos`, { files: successful });

        setUploading((prev) => prev.map((item) =>
          item.status === 'registering' ? { ...item, status: 'done' } : item,
        ));

        setTimeout(() => {
          setUploading([]);
          onUploadComplete();
        }, 1000);
      } catch {
        setUploading((prev) => prev.map((item) =>
          item.status === 'registering'
            ? { ...item, status: 'error', error: 'Failed to register photos' }
            : item,
        ));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workOrderId, onUploadComplete]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleClick = () => fileInputRef.current?.click();

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const isUploading = uploading.some((f) => f.status === 'uploading' || f.status === 'registering');

  return (
    <div>
      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
          isDragOver
            ? 'border-blue-400 bg-blue-50/50'
            : 'border-[#e6e6eb] bg-white hover:border-blue-300 hover:bg-blue-50/30'
        } ${isUploading ? 'pointer-events-none opacity-50' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileInput}
          className="hidden"
        />
        <svg
          className="mx-auto mb-3 h-10 w-10 text-[#a8a8b4]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
          />
        </svg>
        <p className="text-sm font-medium text-[#60606a]">
          Drop photos here or click to upload
        </p>
        <p className="mt-1 text-xs text-[#a8a8b4]">
          PNG, JPG, WebP up to 10MB
        </p>
      </div>

      {uploading.length > 0 && (
        <div className="mt-4 space-y-2">
          {uploading.map((item, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg bg-white p-3 text-sm">
              <span className="flex-1 truncate text-[#60606a]">{item.file.name}</span>
              {item.status === 'error' ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-500">{item.error}</span>
                  <button
                    onClick={() => handleFiles([item.file])}
                    className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-600 hover:bg-red-100"
                  >
                    Retry
                  </button>
                </div>
              ) : item.status === 'done' ? (
                <span className="text-xs text-green-600">Done</span>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-24 rounded-full bg-[#e6e6eb]">
                    <div
                      className="h-1.5 rounded-full bg-blue-500 transition-all"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs text-[#a8a8b4]">{item.progress}%</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
