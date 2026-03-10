'use client';

const weeklyStats = [
  { label: 'Total Hours', value: '186.5', sub: 'This week' },
  { label: 'Avg per Person', value: '31.1', sub: '6 team members' },
  { label: 'Billable', value: '82%', sub: '153.0 hrs' },
  { label: 'Overtime', value: '12.5 hrs', sub: '3 members' },
];

interface TimeEntry {
  id: string;
  member: string;
  initials: string;
  color: string;
  project: string;
  task: string;
  hours: number;
  date: string;
  billable: boolean;
}

const entries: TimeEntry[] = [
  { id: '1', member: 'Marcus Johnson', initials: 'MJ', color: 'bg-blue-500', project: 'Metro Plumbing Fleet #12', task: 'Installation', hours: 6.5, date: '2026-03-10', billable: true },
  { id: '2', member: 'Sarah Chen', initials: 'SC', color: 'bg-violet-500', project: 'FastFreight Box Truck', task: 'Design', hours: 4.0, date: '2026-03-10', billable: true },
  { id: '3', member: 'Alex Rivera', initials: 'AR', color: 'bg-emerald-500', project: 'CleanCo Sprinter', task: 'Printing', hours: 3.5, date: '2026-03-10', billable: true },
  { id: '4', member: 'Jordan Lee', initials: 'JL', color: 'bg-amber-500', project: 'Elite Auto Sedan', task: 'Design Revision', hours: 2.0, date: '2026-03-10', billable: true },
  { id: '5', member: 'Marcus Johnson', initials: 'MJ', color: 'bg-blue-500', project: 'Skyline Trailer', task: 'Installation', hours: 8.0, date: '2026-03-09', billable: true },
  { id: '6', member: 'Taylor Wright', initials: 'TW', color: 'bg-rose-500', project: 'Internal', task: 'Equipment Maintenance', hours: 2.0, date: '2026-03-09', billable: false },
  { id: '7', member: 'Sarah Chen', initials: 'SC', color: 'bg-violet-500', project: 'Greenfield SUV', task: 'Design', hours: 5.0, date: '2026-03-09', billable: true },
  { id: '8', member: 'Casey Morgan', initials: 'CM', color: 'bg-pink-500', project: 'Summit Electric Pickup', task: 'Lamination', hours: 1.5, date: '2026-03-09', billable: true },
];

export default function TimeTrackingPage() {
  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#18181b]">Time Tracking</h1>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-[#60606a]">
              Week of Mar 9
            </span>
          </div>
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700">
            + Log Time
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-6 overflow-auto p-6">
        <div className="grid grid-cols-4 gap-4">
          {weeklyStats.map((s) => (
            <div key={s.label} className="rounded-xl border border-[#e6e6eb] bg-white p-4">
              <p className="text-xs text-[#a8a8b4]">{s.label}</p>
              <p className="mt-1 text-2xl font-bold text-[#18181b]">{s.value}</p>
              <p className="mt-1 text-xs text-[#60606a]">{s.sub}</p>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-[#e6e6eb] bg-white">
          <div className="border-b border-[#e6e6eb] px-5 py-3">
            <h2 className="text-sm font-semibold text-[#18181b]">Time Entries</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e6e6eb] bg-[#f4f4f6]">
                <th className="px-4 py-3 text-left font-medium text-[#60606a]">Team Member</th>
                <th className="px-4 py-3 text-left font-medium text-[#60606a]">Project</th>
                <th className="px-4 py-3 text-left font-medium text-[#60606a]">Task</th>
                <th className="px-4 py-3 text-left font-medium text-[#60606a]">Hours</th>
                <th className="px-4 py-3 text-left font-medium text-[#60606a]">Date</th>
                <th className="px-4 py-3 text-left font-medium text-[#60606a]">Type</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-[#e6e6eb] last:border-0 hover:bg-[#f4f4f6]/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white ${e.color}`}>
                        {e.initials}
                      </div>
                      <span className="font-medium text-[#18181b]">{e.member}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#60606a]">{e.project}</td>
                  <td className="px-4 py-3 text-[#60606a]">{e.task}</td>
                  <td className="px-4 py-3 font-medium text-[#18181b]">{e.hours}h</td>
                  <td className="px-4 py-3 text-[#60606a]">{e.date}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${e.billable ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                      {e.billable ? 'Billable' : 'Internal'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
