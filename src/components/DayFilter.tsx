import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { istTodayString, addDays } from "@/lib/datetime";

/**
 * Shared date filter: Today / Yesterday quick buttons + a single-date picker.
 * `date` is an IST calendar date string ("YYYY-MM-DD"); convert to a UTC range with
 * `istDayRange(date)` before calling the API.
 */
export function DayFilter({
  date,
  onChange,
  label = "Date",
}: {
  date: string;
  onChange: (date: string) => void;
  label?: string;
}) {
  const today = istTodayString();
  const yesterday = addDays(today, -1);
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex gap-2">
        <Button variant={date === today ? "default" : "outline"} onClick={() => onChange(today)}>
          Today
        </Button>
        <Button variant={date === yesterday ? "default" : "outline"} onClick={() => onChange(yesterday)}>
          Yesterday
        </Button>
      </div>
      <div>
        <Label htmlFor="day-filter">{label}</Label>
        <Input
          id="day-filter"
          type="date"
          max={today}
          value={date}
          onChange={(e) => onChange(e.target.value)}
          className="w-44"
        />
      </div>
    </div>
  );
}
