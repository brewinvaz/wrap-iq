'use client';

import { useState } from 'react';

interface BrandFile {
  id: string;
  name: string;
  client: string;
  type: string;
  size: string;
  modified: string;
}

const FILE_TYPE_COLORS: Record<string, string> = {
  AI: 'bg-orange-100 text-orange-700',
  PSD: 'bg-blue-100 text-blue-700',
  PDF: 'bg-red-100 text-red-700',
  PNG: 'bg-emerald-100 text-emerald-700',
  SVG: 'bg-violet-100 text-violet-700',
  TIFF: 'bg-amber-100 text-amber-700',
};

export default function BrandFilesPage() {
  const [brandFiles] = useState<BrandFile[]>([]);

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#18181b]">Brand Files</h1>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-[#60606a]">
              {brandFiles.length} files
            </span>
          </div>
          <button
            disabled
            className="cursor-not-allowed rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white opacity-50"
          >
            + Upload File
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {brandFiles.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-center">
            <svg
              width="48"
              height="48"
              fill="none"
              viewBox="0 0 24 24"
              className="mb-4 text-[#d4d4d8]"
            >
              <path
                d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M14 2v6h6M12 18v-6M9 15h6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="text-sm text-[#a8a8b4]">
              No brand files yet. Upload brand assets to share with your team.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {(() => {
              const clientGroups = brandFiles.reduce<Record<string, BrandFile[]>>((acc, file) => {
                if (!acc[file.client]) acc[file.client] = [];
                acc[file.client].push(file);
                return acc;
              }, {});

              return Object.entries(clientGroups).map(([client, files]) => (
                <section key={client}>
                  <h2 className="mb-3 font-mono text-[10px] uppercase tracking-wider text-[#a8a8b4]">
                    {client}
                  </h2>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {files.map((file) => (
                      <div
                        key={file.id}
                        className="group cursor-pointer rounded-lg border border-[#e6e6eb] bg-white transition-shadow hover:shadow-md"
                      >
                        <div className="flex h-32 items-center justify-center rounded-t-lg bg-gray-50">
                          <svg
                            width="32"
                            height="32"
                            fill="none"
                            viewBox="0 0 24 24"
                            className="text-gray-400"
                          >
                            <path
                              d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                        <div className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium leading-tight text-[#18181b]">
                              {file.name}
                            </p>
                            <span
                              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${FILE_TYPE_COLORS[file.type] ?? 'bg-gray-100 text-gray-600'}`}
                            >
                              {file.type}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <span className="font-mono text-[11px] text-[#a8a8b4]">{file.size}</span>
                            <span className="font-mono text-[11px] text-[#a8a8b4]">{file.modified}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ));
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
