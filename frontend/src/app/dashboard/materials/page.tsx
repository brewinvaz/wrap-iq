'use client';

const materials = [
  { id: '1', name: '3M IJ180Cv3', type: 'Cast Vinyl', quantity: 12, unit: 'rolls', reorderAt: 5, supplier: '3M Authorized', cost: '$385/roll' },
  { id: '2', name: '3M 8518 Gloss Overlaminate', type: 'Laminate', quantity: 8, unit: 'rolls', reorderAt: 4, supplier: '3M Authorized', cost: '$210/roll' },
  { id: '3', name: 'Avery Dennison SW900', type: 'Color Change Vinyl', quantity: 3, unit: 'rolls', reorderAt: 3, supplier: 'Avery Dennison', cost: '$520/roll' },
  { id: '4', name: '3M 1080 Matte Black', type: 'Color Change Vinyl', quantity: 6, unit: 'rolls', reorderAt: 4, supplier: '3M Authorized', cost: '$440/roll' },
  { id: '5', name: 'Oracal 3951RA', type: 'Reflective Vinyl', quantity: 2, unit: 'rolls', reorderAt: 3, supplier: 'Orafol', cost: '$675/roll' },
  { id: '6', name: '3M 8914 Matte Overlaminate', type: 'Laminate', quantity: 10, unit: 'rolls', reorderAt: 4, supplier: '3M Authorized', cost: '$195/roll' },
  { id: '7', name: 'Knifeless Finish Line Tape', type: 'Application Tool', quantity: 15, unit: 'rolls', reorderAt: 5, supplier: '3M Authorized', cost: '$28/roll' },
  { id: '8', name: 'Application Fluid (Rapid Tac)', type: 'Application Tool', quantity: 4, unit: 'gallons', reorderAt: 2, supplier: 'Rapid Tac Inc.', cost: '$42/gal' },
  { id: '9', name: 'HP 831 Latex Ink - Cyan', type: 'Ink', quantity: 1, unit: 'cartridges', reorderAt: 2, supplier: 'HP Direct', cost: '$185/cart' },
  { id: '10', name: 'HP 831 Latex Ink - Magenta', type: 'Ink', quantity: 3, unit: 'cartridges', reorderAt: 2, supplier: 'HP Direct', cost: '$185/cart' },
  { id: '11', name: 'HP 831 Latex Ink - Yellow', type: 'Ink', quantity: 2, unit: 'cartridges', reorderAt: 2, supplier: 'HP Direct', cost: '$185/cart' },
  { id: '12', name: 'HP 831 Latex Ink - Black', type: 'Ink', quantity: 4, unit: 'cartridges', reorderAt: 2, supplier: 'HP Direct', cost: '$185/cart' },
];

function stockLevel(quantity: number, reorderAt: number): { label: string; color: string; barColor: string; pct: number } {
  const max = reorderAt * 4;
  const pct = Math.min((quantity / max) * 100, 100);
  if (quantity <= reorderAt) return { label: 'Low Stock', color: 'text-red-600', barColor: 'bg-red-500', pct };
  if (quantity <= reorderAt * 2) return { label: 'Adequate', color: 'text-amber-600', barColor: 'bg-amber-400', pct };
  return { label: 'In Stock', color: 'text-emerald-600', barColor: 'bg-emerald-500', pct };
}

export default function MaterialsPage() {
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
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700">
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
              {materials.map((mat) => {
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
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
