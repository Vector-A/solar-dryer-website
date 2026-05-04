import ThermometerIcon from "./icons/ThermometerIcon";

interface MetricCardProps {
  value: string;
  label: string;
}

export default function MetricCard({ value, label }: MetricCardProps) {
  return (
    <div className="glass-card flex w-full max-w-[270px] flex-col items-center gap-4 rounded-2xl px-6 py-8 text-center shadow-xl sm:max-w-[300px]">
      <ThermometerIcon className="h-12 w-12 text-ember" />
      <div className="text-5xl font-semibold text-gray-100">{value}</div>
      <div className="text-sm text-gray-300">{label}</div>
    </div>
  );
}
