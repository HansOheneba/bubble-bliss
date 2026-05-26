"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { ChevronDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ghanaToday } from "@/lib/range-metrics";

type DateSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
};

export default function DateSelect({ value, onValueChange }: DateSelectProps) {
  const [open, setOpen] = React.useState(false);

  const selected = parseISO(value);
  const today = parseISO(ghanaToday());

  function handleSelect(day: Date | undefined) {
    if (!day) return;
    const pad = (n: number) => n.toString().padStart(2, "0");
    const key = `${day.getUTCFullYear()}-${pad(day.getUTCMonth() + 1)}-${pad(day.getUTCDate())}`;
    onValueChange(key);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-8 justify-between gap-2 px-3 text-sm font-normal"
        >
          {format(selected, "MMM d, yyyy")}
          <ChevronDownIcon className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={handleSelect}
          defaultMonth={selected}
          disabled={(day) => day > today}
        />
      </PopoverContent>
    </Popover>
  );
}
