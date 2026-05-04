export interface Condition {
  id: string;
  label: string;
}

export const CONDITIONS: Condition[] = [
  { id: "condition-1", label: "Condition 1" },
  { id: "condition-2", label: "Condition 2" },
  { id: "condition-3", label: "Condition 3" },
  { id: "condition-4", label: "Condition 4" },
];

interface Props {
  onSelect: (condition: Condition) => void;
  onCancel: () => void;
}

export default function ConditionPicker({ onSelect, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="glass-card w-full max-w-sm rounded-2xl p-6 shadow-xl">
        <h2 className="mb-1 text-lg font-semibold text-gray-100">Select Condition</h2>
        <p className="mb-5 text-xs text-gray-400">
          Choose the condition for this reading session. The microcontroller will use this to adjust its behaviour.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {CONDITIONS.map((condition) => (
            <button
              key={condition.id}
              type="button"
              onClick={() => onSelect(condition)}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-sm font-semibold text-gray-100 transition hover:border-ember hover:bg-ember/10 hover:text-ember active:scale-95"
            >
              {condition.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="mt-4 w-full rounded-lg py-2 text-xs text-gray-500 transition hover:text-gray-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
