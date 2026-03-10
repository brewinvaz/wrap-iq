'use client';

import { Permission } from '@/lib/types';
import { roleLabels } from '@/lib/mock-team-data';

interface PermissionsMatrixProps {
  permissions: Permission[];
}

function AccessIndicator({ access }: { access: 'full' | 'read' | 'none' }) {
  if (access === 'full') {
    return (
      <div className="flex items-center justify-center" title="Full access">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100">
          <svg
            className="h-3.5 w-3.5 text-emerald-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 12.75l6 6 9-13.5"
            />
          </svg>
        </span>
      </div>
    );
  }

  if (access === 'read') {
    return (
      <div className="flex items-center justify-center" title="Read only">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100">
          <svg
            className="h-3.5 w-3.5 text-amber-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center" title="No access">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100">
        <svg
          className="h-3.5 w-3.5 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
          />
        </svg>
      </span>
    </div>
  );
}

export default function PermissionsMatrix({
  permissions,
}: PermissionsMatrixProps) {
  const roles = permissions[0]?.roles.map((r) => r.role) ?? [];

  return (
    <div className="rounded-xl border border-[#e6e6eb] bg-white">
      <div className="border-b border-[#e6e6eb] px-6 py-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-[#18181b]">
            Permissions Matrix
          </h2>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-[#60606a]">
            Read-only
          </span>
        </div>
        <p className="mt-1 text-sm text-[#a8a8b4]">
          Overview of what each role can access across the platform.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#e6e6eb]">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#a8a8b4]">
                Feature
              </th>
              {roles.map((role) => (
                <th
                  key={role}
                  className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-[#a8a8b4]"
                >
                  {roleLabels[role] || role}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e6e6eb]">
            {permissions.map((perm) => (
              <tr
                key={perm.feature}
                className="transition-colors hover:bg-gray-50"
              >
                <td className="px-6 py-3 text-sm font-medium text-[#18181b]">
                  {perm.feature}
                </td>
                {perm.roles.map((r) => (
                  <td key={r.role} className="px-4 py-3">
                    <AccessIndicator access={r.access} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-6 border-t border-[#e6e6eb] px-6 py-3">
        <div className="flex items-center gap-2 text-xs text-[#60606a]">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100">
            <svg
              className="h-2.5 w-2.5 text-emerald-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12.75l6 6 9-13.5"
              />
            </svg>
          </span>
          Full access
        </div>
        <div className="flex items-center gap-2 text-xs text-[#60606a]">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-100">
            <svg
              className="h-2.5 w-2.5 text-amber-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </span>
          Read only
        </div>
        <div className="flex items-center gap-2 text-xs text-[#60606a]">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gray-100">
            <svg
              className="h-2.5 w-2.5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
          </span>
          No access
        </div>
      </div>
    </div>
  );
}
