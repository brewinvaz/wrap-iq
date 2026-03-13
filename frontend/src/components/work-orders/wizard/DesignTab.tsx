'use client';

import { useRef, useState, useCallback } from 'react';
import type { DesignState } from './types';

interface Props {
  data: DesignState;
  onChange: (data: DesignState) => void;
}

/* ---------- icons ---------- */

function PaletteIcon() {
  return (
    <svg
      className="h-5 w-5 text-[var(--text-muted)]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.1 0 2-.9 2-2 0-.53-.21-1.01-.55-1.36-.34-.36-.55-.84-.55-1.37 0-1.1.9-2 2-2h2.35C19.86 15.27 22 13.13 22 10.5 22 5.81 17.52 2 12 2z" />
      <circle cx="6.5" cy="11.5" r="1.5" fill="currentColor" />
      <circle cx="9.5" cy="7.5" r="1.5" fill="currentColor" />
      <circle cx="14.5" cy="7.5" r="1.5" fill="currentColor" />
      <circle cx="17.5" cy="11.5" r="1.5" fill="currentColor" />
    </svg>
  );
}

function UserGroupIcon() {
  return (
    <svg
      className="h-5 w-5 text-[var(--text-muted)]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      className="mx-auto h-8 w-8 text-[var(--text-muted)]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
      <path d="M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      className="h-8 w-8 text-[var(--text-muted)]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      className="h-4 w-4 text-[var(--text-muted)]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

/* ---------- component ---------- */

export default function DesignTab({ data, onChange }: Props) {
  const versions = data.proofingData.versions;
  const nextVersion = versions.length + 1;
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const [urlInputVisible, setUrlInputVisible] = useState<Record<number, boolean>>({});
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  function addVersion() {
    const newVersions = [
      ...versions,
      { name: `v${nextVersion}`, status: 'draft' },
    ];
    onChange({
      ...data,
      proofingData: { ...data.proofingData, versions: newVersions },
    });
  }

  function updateVersion(idx: number, patch: Partial<(typeof versions)[number]>) {
    const newVersions = versions.map((v, i) => (i === idx ? { ...v, ...patch } : v));
    onChange({
      ...data,
      proofingData: { ...data.proofingData, versions: newVersions },
    });
  }

  function handleFiles(idx: number, fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const existing = versions[idx].localFiles || [];
    const newFiles = [...existing, ...Array.from(fileList)];
    updateVersion(idx, { localFiles: newFiles });
  }

  function removeFile(versionIdx: number, fileIdx: number) {
    const existing = versions[versionIdx].localFiles || [];
    const newFiles = existing.filter((_, i) => i !== fileIdx);
    updateVersion(versionIdx, { localFiles: newFiles.length > 0 ? newFiles : undefined });
  }

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIdx(idx);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIdx(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIdx(null);
    handleFiles(idx, e.dataTransfer.files);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versions]);

  return (
    <div className="space-y-5">
      {/* -- Design Team -- */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-card)] p-4">
        <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-[var(--text-primary)]">
          <PaletteIcon />
          Design Team
        </h3>

        <p className="mb-2 text-sm text-[var(--text-secondary)]">
          Assigned Designers ({data.designerIds.length}/3)
        </p>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
              <SearchIcon />
            </span>
            <input
              type="text"
              placeholder="Search designers..."
              className="w-full rounded-lg border border-[var(--border)] bg-transparent py-2 pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
              readOnly
            />
          </div>
          <button
            type="button"
            className="rounded-lg border border-[var(--border)] p-2 text-[var(--text-muted)] hover:bg-[var(--surface-raised)] transition-colors"
            aria-label="Browse designers"
          >
            <UserGroupIcon />
          </button>
        </div>

        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Select designers for this work order
        </p>
      </div>

      {/* -- Design Management -- */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">
            Design Management
          </h3>
          <span className="text-sm text-[var(--text-muted)]">
            {versions.length} version{versions.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Existing version cards */}
          {versions.map((version, idx) => (
            <div
              key={version.name}
              className="relative rounded-lg border border-[var(--border)] bg-[var(--surface-card)] p-3"
            >
              {/* Hidden file input */}
              <input
                ref={(el) => { fileInputRefs.current[idx] = el; }}
                type="file"
                accept="image/*,.pdf"
                multiple
                className="hidden"
                onChange={(e) => {
                  handleFiles(idx, e.target.files);
                  e.target.value = '';
                }}
              />

              {/* Top badges */}
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded bg-green-600 px-2 py-0.5 text-xs text-white">
                  {version.name}
                </span>
                <span className="rounded bg-[var(--surface-raised)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
                  {version.status}
                </span>
              </div>

              {/* Upload drop zone */}
              <div
                onClick={() => fileInputRefs.current[idx]?.click()}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, idx)}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors ${
                  dragOverIdx === idx
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                    : 'border-[var(--border)] hover:border-[var(--text-muted)]'
                }`}
              >
                <UploadIcon />
                <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">
                  Version {idx + 1}
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  Drop files or click to upload
                </p>
              </div>

              {/* Local files list */}
              {version.localFiles && version.localFiles.length > 0 && (
                <div className="mt-2 space-y-1">
                  {version.localFiles.map((file, fIdx) => (
                    <div
                      key={`${file.name}-${fIdx}`}
                      className="flex items-center justify-between rounded bg-[var(--surface-raised)] px-2 py-1 text-xs text-[var(--text-secondary)]"
                    >
                      <span className="truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(idx, fIdx)}
                        className="ml-2 flex-shrink-0 text-[var(--text-muted)] hover:text-red-400 transition-colors"
                        aria-label={`Remove ${file.name}`}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                          <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Design URL display */}
              {version.designUrl && !urlInputVisible[idx] && (
                <div className="mt-2 flex items-center gap-1.5 rounded bg-[var(--surface-raised)] px-2 py-1 text-xs">
                  <a
                    href={version.designUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-blue-400 hover:text-blue-300"
                  >
                    {version.designUrl}
                  </a>
                  <button
                    type="button"
                    onClick={() => updateVersion(idx, { designUrl: undefined })}
                    className="flex-shrink-0 text-[var(--text-muted)] hover:text-red-400 transition-colors"
                    aria-label="Remove URL"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                      <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Action links */}
              <div className="mt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRefs.current[idx]?.click()}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Upload
                </button>
                <button
                  type="button"
                  onClick={() => setUrlInputVisible((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  URL
                </button>
              </div>

              {/* Inline URL input */}
              {urlInputVisible[idx] && (
                <div className="mt-2">
                  <input
                    type="url"
                    placeholder="Paste design URL and press Enter..."
                    defaultValue={version.designUrl || ''}
                    className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const value = (e.target as HTMLInputElement).value.trim();
                        if (value) {
                          updateVersion(idx, { designUrl: value });
                        }
                        setUrlInputVisible((prev) => ({ ...prev, [idx]: false }));
                      }
                    }}
                    onBlur={(e) => {
                      const value = e.target.value.trim();
                      if (value) {
                        updateVersion(idx, { designUrl: value });
                      }
                      setUrlInputVisible((prev) => ({ ...prev, [idx]: false }));
                    }}
                    autoFocus
                  />
                </div>
              )}
            </div>
          ))}

          {/* Add version card */}
          <button
            type="button"
            onClick={addVersion}
            className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--border)] bg-transparent px-4 py-12 text-center transition-colors hover:bg-[var(--surface-raised)]"
          >
            <PlusIcon />
            <span className="text-sm text-[var(--text-muted)]">
              Add Version v{nextVersion}
            </span>
          </button>
        </div>
      </div>

      {/* -- Info box -- */}
      <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-4">
        <h4 className="mb-2 text-sm font-semibold text-blue-400">
          How Design Versions Work
        </h4>
        <ul className="space-y-1.5 text-sm text-blue-300/90">
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-400" />
            Each square represents a design version (v1, v2, v3, etc.)
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-400" />
            Upload new images to automatically create the next revision (v1.1
            &rarr; v1.2)
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-400" />
            Use the + square to create a completely new design direction
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-400" />
            Click images to view in fullscreen with zoom capability
          </li>
        </ul>
      </div>
    </div>
  );
}
