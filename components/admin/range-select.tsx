"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RANGE_OPTIONS, type RangeKey } from "@/lib/range-metrics";

type RangeSelectProps = {
  value: RangeKey;
  onValueChange: (value: RangeKey) => void;
  size?: "sm" | "default";
};

export default function RangeSelect({
  value,
  onValueChange,
  size = "sm",
}: RangeSelectProps) {
  return (
    <Select
      value={value}
      onValueChange={(next) => onValueChange(next as RangeKey)}
    >
      <SelectTrigger size={size} className="min-w-[7.5rem]">
        <SelectValue placeholder="Select range" />
      </SelectTrigger>
      <SelectContent align="end">
        {RANGE_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            Last {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
