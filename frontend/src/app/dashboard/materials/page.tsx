'use client';

interface Material {
  id: string;
  name: string;
  type: string;
  quantity: number;
  unit: string;
  reorderAt: number;
  supplier: string;
  cost: string;
}

function stockLevel(quantity: number, reorderAt: number): { label: string; color: string; barColor: string; pct: number } {
  const max = reorderAt * 4;
  const pct = Math.min((quantity / max) * 100, 100);
  if (quantity <= reorderAt) return { label: 'Low Stock', color: 'text-red-600', barColor: 'bg-red-500', pct };
  if (quantity <= reorderAt * 2) return { label: 'Adequate', color: 'text-amber-600', barColor: 'bg-amber-400', pct };
  return { label: 'In Stock', color: 'text-emerald-600', barColor: 'bg-emerald-500', pct };
}

export default function MaterialsPage() {
  // TODO: Replace with API call once backend materials endpoint exists
  const materials: Material[] = [];
  const lowStockCount = materials.filter((m) => m.quantity <= m.reorderAt).length;

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[#e6e6eb] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#18181b]">Materials Inventory</h1>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-[#60606a]">
              {materials.length} items
            </span>
            {lowStockCount > 0 && (
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                {lowStockCount} low stock
              </span>
            )}
          </div>
          <button
            disabled
            title="Coming soon — backend integration required"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Add Material
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="rounded-lg border border-[#e6e6eb] bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e6e6eb]">
                <th className="px-4 py-3 text-left font-mono text-[9.5px] uppercase tracking-wider text-[#a8a8b4]">Material</th>
                <th className="px-4 py-3 text-left font-mono text-[9.5px] uppercase tracking-wider text-[#a8a8b4]">Type</th>
                <th className="px-4 py-3 text-left font-mono text-[9.5px] uppercase tracking-wider text-[#a8a8b4]">Stock Level</th>
                <th className="px-4 py-3 text-center font-mono text-[9.5px] uppercase tracking-wider text-[#a8a8b4]">Qty</th>
                <th className="px-4 py-3 text-center font-mono text-[9.5px] uppercase tracking-wider text-[#a8a8b4]">Reorder At</th>
                <th className="px-4 py-3 text-left font-mono text-[9.5px] uppercase tracking-wider text-[#a8a8b4]">Supplier</th>
                <th className="px-4 py-3 text-right font-mono text-[9.5px] uppercase tracking-wider text-[#a8a8b4]">Unit Cost</th>
              </tr>
            </thead>
            <tbody>
              {materials.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <p className="text-sm text-[#60606a]">
                      No materials tracked yet. Add materials to manage your vinyl and supply inventory.
                    </p>
                  </td>
                </tr>
              ) : (
                materials.map((mat) => {
                  const stock = stockLevel(mat.quantity, mat.reorderAt);
                  return (
                    <tr key={mat.id} className="border-b border-[#e6e6eb] last:border-b-0 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-[#18181b]">{mat.name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-[#60606a]">
                          {mat.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 rounded-full bg-gray-100">
                            <div
                              className={`h-1.5 rounded-full ${stock.barColor}`}
                              style={{ width: `${stock.pct}%` }}
                            />
                          </div>
                          <span className={`text-xs font-medium ${stock.color}`}>{stock.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-sm font-semibold text-[#18181b]">
                        {mat.quantity} <span className="text-[#a8a8b4] font-normal">{mat.unit}</span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-sm text-[#60606a]">
                        {mat.reorderAt}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#60606a]">{mat.supplier}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-[#60606a]">{mat.cost}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
