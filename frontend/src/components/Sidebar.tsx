'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { useRole } from '@/lib/role-context';
import { ROLES, type RoleKey } from '@/lib/roles';

const INTERNAL_ROLES: RoleKey[] = ['admin', 'pm', 'installer', 'designer', 'production'];
const CLIENT_ROLES: RoleKey[] = ['client'];

export default function Sidebar() {
  const pathname = usePathname();
  const { currentRole, setRole, roleConfig } = useRole();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  // Hide sidebar for client role
  if (currentRole === 'client') {
    return null;
  }

  return (
    <aside className="flex h-screen w-[220px] shrink-0 flex-col border-r border-[#e6e6eb] bg-white">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#18181b]">
          <span className="font-mono text-[11px] font-bold text-white">WF</span>
        </div>
        <span className="text-[15px] font-bold text-[#18181b]">
          Wrap<span className="text-blue-600">Flow</span>
        </span>
      </div>

      {/* Role Switcher */}
      <div className="relative px-3 pb-2" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex w-full items-center gap-2 rounded-lg border border-[#e6e6eb] bg-[#f4f4f6] px-2.5 py-2 text-left transition-colors hover:bg-[#ebebef]"
        >
          <div
            className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ${roleConfig.avatarBg}`}
          >
            {roleConfig.avatarText}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-medium text-[#18181b]">{roleConfig.name}</p>
            <p className="truncate text-[10.5px] text-[#a8a8b4]">{roleConfig.title}</p>
          </div>
          <svg className="h-3.5 w-3.5 shrink-0 text-[#a8a8b4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
          </svg>
        </button>

        {dropdownOpen && (
          <div className="absolute left-3 right-3 top-full z-50 mt-1 rounded-lg border border-[#e6e6eb] bg-white py-1 shadow-lg">
            <div className="px-2.5 py-1.5">
              <span className="font-mono text-[9.5px] uppercase tracking-wider text-[#a8a8b4]">Internal</span>
            </div>
            {INTERNAL_ROLES.map((roleKey) => {
              const role = ROLES[roleKey];
              return (
                <button
                  key={roleKey}
                  onClick={() => {
                    setRole(roleKey);
                    setDropdownOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-[#f4f4f6]"
                >
                  <div
                    className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white ${role.avatarBg}`}
                  >
                    {role.avatarText}
                  </div>
                  <span className="flex-1 text-[12.5px] text-[#18181b]">{role.name}</span>
                  {currentRole === roleKey && (
                    <svg className="h-3.5 w-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </button>
              );
            })}
            <div className="mx-2.5 my-1 border-t border-[#e6e6eb]" />
            <div className="px-2.5 py-1.5">
              <span className="font-mono text-[9.5px] uppercase tracking-wider text-[#a8a8b4]">Client Portal</span>
            </div>
            {CLIENT_ROLES.map((roleKey) => {
              const role = ROLES[roleKey];
              return (
                <button
                  key={roleKey}
                  onClick={() => {
                    setRole(roleKey);
                    setDropdownOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-[#f4f4f6]"
                >
                  <div
                    className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white ${role.avatarBg}`}
                  >
                    {role.avatarText}
                  </div>
                  <span className="flex-1 text-[12.5px] text-[#18181b]">{role.name}</span>
                  {currentRole === roleKey && (
                    <svg className="h-3.5 w-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 pt-1 pb-2">
        {roleConfig.navGroups.map((group) => (
          <div key={group.label} className="mb-3">
            <h3 className="mb-1 px-2.5 font-mono text-[9.5px] uppercase tracking-wider text-[#a8a8b4]">
              {group.label}
            </h3>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href));
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13.5px] transition-colors ${
                        isActive
                          ? 'bg-blue-50/80 font-medium text-blue-600'
                          : 'text-[#60606a] hover:bg-[#f4f4f6]'
                      }`}
                    >
                      <span className="text-[14px] leading-none">{item.icon}</span>
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge !== undefined && (
                        <span
                          className={`inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 font-mono text-[10px] font-medium ${
                            item.badgeVariant === 'amber'
                              ? 'bg-amber-100 text-amber-600'
                              : isActive
                                ? 'bg-blue-600 text-white'
                                : 'bg-[#e6e6eb] text-[#60606a]'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Phase Key */}
      {roleConfig.showPhaseKey && (
        <div className="border-t border-[#e6e6eb] px-3 py-3">
          <div className="rounded-lg bg-[#f4f4f6] px-3 py-2.5">
            <h4 className="mb-2 font-mono text-[9.5px] uppercase tracking-wider text-[#a8a8b4]">
              Phase Key
            </h4>
            <div className="space-y-1.5">
              {[
                { label: 'Work Order', color: 'bg-blue-500' },
                { label: 'Design', color: 'bg-violet-500' },
                { label: 'Production', color: 'bg-amber-500' },
                { label: 'Install', color: 'bg-emerald-500' },
              ].map((phase) => (
                <div key={phase.label} className="flex items-center gap-2">
                  <span className={`h-[7px] w-[7px] rounded-full ${phase.color}`} />
                  <span className="text-[11px] text-[#60606a]">{phase.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
