import { useState } from 'react';
import { useHitzones } from '../../../../hooks/useHitzones';
import { useUpdateHitzones } from '../../../../hooks/useUpdateHitzones';
import { useAuth } from '../../../../context/AuthContext';
import { Spinner } from '../../../ui/Spinner';
import { Button } from '../../../ui/Button';
import { cn } from '../../../../lib/utils';
import type { Hitzone } from '../../../../lib/types';

type HitzoneRow = Omit<Hitzone, 'id'>;

const DAMAGE_COLS: (keyof Omit<HitzoneRow, 'part'>)[] = [
  'cut', 'blunt', 'bullet', 'fire', 'water', 'thunder', 'ice', 'dragon',
];

const COL_LABELS: Record<string, string> = {
  cut: 'Cut', blunt: 'Blunt', bullet: 'Bullet',
  fire: 'Fire', water: 'Water', thunder: 'Thunder', ice: 'Ice', dragon: 'Dragon',
};

function valueColor(v: number): string {
  if (v >= 45) return 'text-green-400';
  if (v >= 25) return 'text-amber-400';
  return 'text-stone-500';
}

function blankRow(): HitzoneRow {
  return { part: '', cut: 50, blunt: 50, bullet: 50, fire: 0, water: 0, thunder: 0, ice: 0, dragon: 0 };
}

export function HitzonesTab({ monsterId }: { monsterId: string }) {
  const { data: hitzones, isLoading } = useHitzones(monsterId);
  const updateHitzones = useUpdateHitzones(monsterId);
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<HitzoneRow[]>([]);

  function enterEdit() {
    setRows(
      (hitzones ?? []).map(({ part, cut, blunt, bullet, fire, water, thunder, ice, dragon }) => ({
        part, cut, blunt, bullet, fire, water, thunder, ice, dragon,
      })),
    );
    setEditing(true);
  }

  function handleCancel() {
    setEditing(false);
  }

  function updateRow(index: number, field: keyof HitzoneRow, value: string | number) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function deleteRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function addRow() {
    setRows((prev) => [...prev, blankRow()]);
  }

  async function handleSave() {
    const filtered = rows.filter((r) => r.part.trim() !== '');
    try {
      await updateHitzones.mutateAsync(filtered);
      setEditing(false);
    } catch {
      // updateHitzones.error is available for display
    }
  }

  if (isLoading) {
    return <div className="flex justify-center py-8"><Spinner /></div>;
  }

  if (editing) {
    return (
      <div className="space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-stone-800 rounded">
            <thead>
              <tr className="bg-stone-900">
                <th className="text-left px-3 py-2 text-stone-400 font-normal border-b border-stone-800 whitespace-nowrap">
                  Part
                </th>
                {DAMAGE_COLS.map((col) => (
                  <th
                    key={col}
                    className="px-3 py-2 text-stone-400 font-normal border-b border-stone-800 text-center whitespace-nowrap"
                  >
                    {COL_LABELS[col]}
                  </th>
                ))}
                <th className="px-3 py-2 border-b border-stone-800" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-stone-800/50 last:border-0">
                  <td className="px-2 py-1">
                    <input
                      type="text"
                      value={row.part}
                      onChange={(e) => updateRow(i, 'part', e.target.value)}
                      placeholder="Part name"
                      className="bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-50 w-28 focus:outline-none focus:border-stone-500 text-sm"
                    />
                  </td>
                  {DAMAGE_COLS.map((col) => (
                    <td key={col} className="px-2 py-1 text-center">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={row[col] as number}
                        onChange={(e) => updateRow(i, col, Math.min(100, Math.max(0, Number(e.target.value))))}
                        className="bg-stone-800 border border-stone-700 rounded px-1 py-1 text-stone-50 w-14 text-center focus:outline-none focus:border-stone-500 text-sm"
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1 text-center">
                    <button
                      type="button"
                      onClick={() => deleteRow(i)}
                      className="text-stone-500 hover:text-red-400 transition-colors text-base leading-none"
                      aria-label="Delete row"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={addRow} disabled={updateHitzones.isPending}>
            + Add part
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={updateHitzones.isPending}
          >
            {updateHitzones.isPending ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleCancel} disabled={updateHitzones.isPending}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={enterEdit}>
            Edit hitzones
          </Button>
        </div>
      )}
      {!hitzones?.length ? (
        <p className="text-stone-400 text-sm">No hitzone data available.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-stone-800 rounded">
              <thead>
                <tr className="bg-stone-900">
                  <th className="text-left px-3 py-2 text-stone-400 font-normal border-b border-stone-800 whitespace-nowrap">
                    Part
                  </th>
                  {DAMAGE_COLS.map((col) => (
                    <th
                      key={col}
                      className="px-3 py-2 text-stone-400 font-normal border-b border-stone-800 text-center whitespace-nowrap"
                    >
                      {COL_LABELS[col]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hitzones.map((hz) => (
                  <tr key={hz.id} className="border-b border-stone-800/50 last:border-0 hover:bg-stone-900/50">
                    <td className="px-3 py-2 text-stone-50 font-medium">{hz.part}</td>
                    {DAMAGE_COLS.map((col) => (
                      <td key={col} className="px-3 py-2 text-center">
                        <span className={cn('font-mono', valueColor(hz[col] as number))}>
                          {hz[col]}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-stone-600 text-xs">Values ≥ 45 are effective. All values are placeholder until updated.</p>
        </>
      )}
    </div>
  );
}
