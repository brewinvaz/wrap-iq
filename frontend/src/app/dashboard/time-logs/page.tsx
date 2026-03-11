'use client';

const summaryStats = [
  { label: 'Total Hours (This Week)', value: '142.5', accent: false },
  { label: 'Pending Approval', value: '18.5 hrs', accent: true },
  { label: 'Approved', value: '124.0 hrs', accent: false },
  { label: 'Team Members Logged', value: '6 / 7', accent: false },
];

interface TimeLog {
  id: string;
  member: string;
  initials: string;
  color: string;
  project: string;
  task: string;
  hours: number;
  date: string;
  status: 'submitted' | 'approved';
}

const timeLogs: TimeLog[] = [
  { id: '1', member: 'Marcus Johnson', initials: 'MJ', color: 'bg-blue-500', project: 'Metro Plumbing Fleet #12', task: 'Installation', hours: 8.0, date: '2026-03-10', status: 'submitted' },
  { id: '2', member: 'Sarah Chen', initials: 'SC', color: 'bg-violet-500', project: 'FastFreight Box Truck', task: 'Design — Side Panels', hours: 4.5, date: '2026-03-10', status: 'submitted' },
  { id: '3', member: 'Alex Rivera', initials: 'AR', color: 'bg-emerald-500', project: 'CleanCo Sprinter', task: 'Print + Laminate', hours: 6.0, date: '2026-03-10', status: 'approved' },
  { id: '4', member: 'Jordan Lee', initials: 'JL', color: 'bg-amber-500', project: 'Elite Auto Sedan', task: 'Design — Revision 2', hours: 3.0, date: '2026-03-10', status: 'approved' },
  { id: '5', member: 'Taylor Wright', initials: 'TW', color: 'bg-rose-500', project: 'Skyline Trailer', task: 'Installation', hours: 8.0, date: '2026-03-09', status: 'approved' },
  { id: '6', member: 'Devon Patel', initials: 'DP', color: 'bg-teal-500', project: 'Skyline Trailer', task: 'Installation (assist)', hours: 8.0, date: '2026-03-09', status: 'approved' },
  { id: '7', member: 'Marcus Johnson', initials: 'MJ', color: 'bg-blue-500', project: 'Summit Electric Pickup', task: 'Installation', hours: 3.0, date: '2026-03-09', status: 'approved' },
  { id: '8', member: 'Sarah Chen', initials: 'SC', color: 'bg-violet-500', project: 'Greenfield SUV', task: 'Design — Initial', hours: 5.0, date: '2026-03-09', status: 'submitted' },
];

export default function TimeLogsPage() {
  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#18181b]">Time Logs</h1>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-[#60606a]">
              Week of Mar 9
            </span>
          </div>
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700">
            Export CSV
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-6 overflow-auto p-6">
        <div className="grid grid-cols-4 gap-4">
          {summaryStats.map((s) => (
            <div key={s.label} className="rounded-xl border border-[#e6e6eb] bg-white p-4">
              <p className="text-xs text-[#a8a8b4]">{s.label}</p>
              <p className={`mt-1 text-2xl font-bold ${s.accent ? 'text-amber-600' : 'text-[#18181b]'}`}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-[#e6e6eb] bg-white">
          <div className="border-b border-[#e6e6eb] px-5 py-3">
            <h2 className="text-sm font-semibold text-[#18181b]">All Time Entries</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e6e6eb] bg-[#f4f4f6]">
                <th className="px-4 py-3 text-left font-medium text-[#60606a]">Team Member</th>
                <th className="px-4 py-3 text-left font-medium text-[#60606a]">Project</th>
                <th className="px-4 py-3 text-left font-medium text-[#60606a]">Task</th>
                <th className="px-4 py-3 text-left font-medium text-[#60606a]">Hours</th>
                <th className="px-4 py-3 text-left font-medium text-[#60606a]">Date</th>
                <th className="px-4 py-3 text-left font-medium text-[#60606a]">Status</th>
                <th className="px-4 py-3 text-left font-medium text-[#60606a]">Action</th>
              </tr>
            </thead>
            <tbody>
              {timeLogs.map((log) => (
                <tr key={log.id} className="border-b border-[#e6e6eb] last:border-0 hover:bg-[#f4f4f6]/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white ${log.color}`}>
                        {log.initials}
                      </div>
                      <span className="font-medium text-[#18181b]">{log.member}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#60606a]">{log.project}</td>
                  <td className="px-4 py-3 text-[#60606a]">{log.task}</td>
                  <td className="px-4 py-3 font-medium text-[#18181b]">{log.hours}h</td>
                  <td className="px-4 py-3 text-[#60606a]">{log.date}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      log.status === 'approved'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}>
                      {log.status === 'approved' ? 'Approved' : 'Submitted'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {log.status === 'submitted' && (
                      <button className="text-xs font-medium text-emerald-600 hover:text-emerald-800">
                        Approve
                      </button>
                    )}
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
