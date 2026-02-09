import DropletIcon from "./icons/DropletIcon";

interface HumidityPillProps {
  value: string;
}

export default function HumidityPill({ value }: HumidityPillProps) {
  return (
    <div className="mx-auto mt-8 flex w-full max-w-md items-center justify-center gap-3 rounded-full border border-white/10 bg-[#2a1c18] px-6 py-3 text-lg text-gray-100">
      <DropletIcon className="h-5 w-5 text-ember" />
      <span>Humidity</span>
      <span className="font-semibold text-gray-100">{value}</span>
    </div>
  );
}
