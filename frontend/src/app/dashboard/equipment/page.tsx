'use client';

const STATUS_STYLES: Record<string, string> = {
  Available: 'bg-emerald-100 text-emerald-700',
  'In Use': 'bg-blue-100 text-blue-700',
  Maintenance: 'bg-amber-100 text-amber-700',
};

const STATUS_DOT: Record<string, string> = {
  Available: 'bg-emerald-500',
  'In Use': 'bg-blue-500',
  Maintenance: 'bg-amber-500',
};

const equipment = [
  { id: '1', name: 'Roland TrueVIS VG3-640', category: 'Printer', status: 'In Use', lastService: '2026-02-15', assignedTo: 'Bay 1', notes: 'Currently printing MTA bus fleet panels. Estimated completion 4:00 PM.' },
  { id: '2', name: 'HP Latex 800W', category: 'Printer', status: 'Available', lastService: '2026-03-01', assignedTo: 'Bay 2', notes: 'Ink levels at 78%. Ready for next job.' },
  { id: '3', name: 'GBC Falcon 60', category: 'Laminator', status: 'Available', lastService: '2026-02-28', assignedTo: 'Finishing Station', notes: 'Cold and hot lamination capable. New roll installed.' },
  { id: '4', name: 'Summa S2 D160', category: 'Cutter', status: 'In Use', lastService: '2026-02-20', assignedTo: 'Cut Station', notes: 'Running contour cuts for Summit Electric fleet. Blade replaced last week.' },
  { id: '5', name: 'Steinel HG 2620 E', category: 'Heat Gun', status: 'Available', lastService: '2026-01-10', assignedTo: 'Install Bay A', notes: 'Professional grade, variable temperature. Good condition.' },
  { id: '6', name: 'Wagner Furno 750', category: 'Heat Gun', status: 'Maintenance', lastService: '2026-03-08', assignedTo: 'Install Bay B', notes: 'Temperature sensor intermittent. Sent for repair — expected back 03/14.' },
  { id: '7', name: 'Knifeless Tape System', category: 'Cutting Tool', status: 'Available', lastService: 'N/A', assignedTo: 'Mobile Kit', notes: '3 rolls remaining in stock. Reorder when down to 1.' },
  { id: '8', name: 'Yellotools BodyGuardKnife', category: 'Cutting Tool', status: 'In Use', lastService: 'N/A', assignedTo: 'Install Bay A', notes: 'Assigned to installer Mike R. for current job.' },
];

const statusCounts = equipment.reduce<Record<string, number>>((acc, e) => {
  acc[e.status] = (acc[e.status] ?? 0) + 1;
  return acc;
}, {});

export default function EquipmentPage() {
  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#18181b]">My Equipment</h1>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-[#60606a]">
              {equipment.length} items
            </span>
          </div>
        </div>
      </header>

      {/* Status summary */}
      <div className="shrink-0 flex gap-4 border-b border-[#e6e6eb] bg-white px-6 py-3">
        {Object.entries(statusCounts).map(([status, count]) => (
          <div key={status} className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status] ?? 'bg-gray-400'}`} />
            <span className="text-sm text-[#60606a]">
              {count} {status}
            </span>
          </div>
        ))}
      </div>

      {/* Equipment Cards */}
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {equipment.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-[#e6e6eb] bg-white p-5 transition-shadow hover:shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-[#18181b]">{item.name}</p>
                  <p className="mt-0.5 text-xs text-[#a8a8b4]">{item.category}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[item.status] ?? 'bg-gray-100 text-gray-600'}`}
                >
                  {item.status}
                </span>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex justify-between">
                  <span className="font-mono text-[9.5px] uppercase tracking-wider text-[#a8a8b4]">
                    Location
                  </span>
                  <span className="text-xs text-[#60606a]">{item.assignedTo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-mono text-[9.5px] uppercase tracking-wider text-[#a8a8b4]">
                    Last Service
                  </span>
                  <span className="font-mono text-xs text-[#60606a]">{item.lastService}</span>
                </div>
              </div>

              <div className="mt-3 border-t border-[#e6e6eb] pt-3">
                <p className="text-xs leading-relaxed text-[#60606a]">{item.notes}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
