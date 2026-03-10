'use client';

import { APIKeyScope } from '@/lib/types';

interface ScopeSelectorProps {
  availableScopes: APIKeyScope[];
  selectedScopes: string[];
  onChange: (scopes: string[]) => void;
}

export default function ScopeSelector({
  availableScopes,
  selectedScopes,
  onChange,
}: ScopeSelectorProps) {
  function toggleScope(scope: string) {
    if (selectedScopes.includes(scope)) {
      onChange(selectedScopes.filter((s) => s !== scope));
    } else {
      onChange([...selectedScopes, scope]);
    }
  }

  // Group scopes by resource
  const groups: Record<string, APIKeyScope[]> = {};
  for (const scope of availableScopes) {
    const resource = scope.scope.split(':')[0];
    if (!groups[resource]) groups[resource] = [];
    groups[resource].push(scope);
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-[#18181b]">
        Permissions
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Object.entries(groups).map(([resource, scopes]) => (
          <div
            key={resource}
            className="rounded-lg border border-[#e6e6eb] p-3"
          >
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#60606a]">
              {resource}
            </p>
            {scopes.map((scope) => (
              <label
                key={scope.scope}
                className="flex cursor-pointer items-start gap-2 py-1"
              >
                <input
                  type="checkbox"
                  checked={selectedScopes.includes(scope.scope)}
                  onChange={() => toggleScope(scope.scope)}
                  className="mt-0.5 h-4 w-4 rounded border-[#e6e6eb] text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <p className="text-sm font-medium text-[#18181b]">
                    {scope.scope}
                  </p>
                  <p className="text-xs text-[#60606a]">{scope.description}</p>
                </div>
              </label>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
