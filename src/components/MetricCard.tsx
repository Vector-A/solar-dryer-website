import ThermometerIcon from "./icons/ThermometerIcon";

interface MetricCardProps {
  value: string;
  label: string;
}

export default function MetricCard({ value, label }: MetricCardProps) {
  return (
    <div className="glass-card flex flex-col items-center gap-4 rounded-2xl px-6 py-8 text-center shadow-xl">
      <ThermometerIcon className="h-10 w-10 text-ember" />
      <div className="text-5xl font-semibold text-gray-200">{value}</div>
      <div className="text-sm text-gray-300">{label}</div>
    </div>
  );
}
