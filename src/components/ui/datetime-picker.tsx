import * as React from "react";
import { ko } from "date-fns/locale";
import { Calendar as CalendarIcon, Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DateTimePickerProps {
  /** value in HTML datetime-local format: yyyy-MM-ddTHH:mm */
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minuteStep?: number;
}

const pad = (n: number) => String(n).padStart(2, "0");
const KOREA_UTC_OFFSET_HOURS = 9;
const WEEKDAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];
const dateTimeLocalPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

type DateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

const toValue = ({ year, month, day, hour, minute }: DateTimeParts) =>
  `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;

const parseValue = (s?: string): DateTimeParts | undefined => {
  if (!s) return undefined;
  const match = dateTimeLocalPattern.exec(s);
  if (!match) return undefined;
  const [, year, month, day, hour, minute] = match;
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
  };
};

const getKoreaNowParts = (): DateTimeParts => {
  const koreaNow = new Date(Date.now() + KOREA_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  return {
    year: koreaNow.getUTCFullYear(),
    month: koreaNow.getUTCMonth() + 1,
    day: koreaNow.getUTCDate(),
    hour: koreaNow.getUTCHours(),
    minute: koreaNow.getUTCMinutes(),
  };
};

export function DateTimePicker({
  value,
  onChange,
  placeholder = "날짜 · 시간 선택",
  className,
  minuteStep = 5,
}: DateTimePickerProps) {
  const date = parseValue(value);
  const selectedDate = date ? new Date(date.year, date.month - 1, date.day) : undefined;
  const [open, setOpen] = React.useState(false);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: Math.floor(60 / minuteStep) }, (_, i) => i * minuteStep);

  const update = (next: DateTimeParts) => {
    onChange(toValue(next));
  };

  const handleDate = (d?: Date) => {
    if (!d) return;
    const base = date ?? getKoreaNowParts();
    update({
      ...base,
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
    });
  };

  const handleHour = (h: number) => {
    const base = date ?? getKoreaNowParts();
    update({ ...base, hour: h });
  };

  const handleMinute = (m: number) => {
    const base = date ?? getKoreaNowParts();
    update({ ...base, minute: m });
  };

  const display = date
    ? `${date.year}.${pad(date.month)}.${pad(date.day)} (${WEEKDAYS_KO[new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay()]}) · ${pad(date.hour)}:${pad(date.minute)}`
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal h-10 px-3 border-input bg-background hover:bg-accent/40",
            !date && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
          <span className="truncate">{display}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="z-[100] w-auto p-0 border border-border/80 shadow-lg rounded-xl overflow-hidden bg-popover"
      >
        <div className="flex flex-col sm:flex-row">
          <div className="border-b sm:border-b-0 sm:border-r border-border/80">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDate}
              locale={ko}
              weekStartsOn={0}
              initialFocus
              className="p-3"
            />
          </div>
          <div className="flex">
            <TimeColumn
              label={<Clock className="h-3.5 w-3.5" />}
              items={hours}
              active={date?.hour}
              onSelect={handleHour}
              format={(n) => pad(n)}
            />
            <TimeColumn
              items={minutes}
              active={date ? Math.floor(date.minute / minuteStep) * minuteStep : undefined}
              onSelect={handleMinute}
              format={(n) => pad(n)}
            />
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-border/80 px-3 py-2 bg-muted/30">
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            초기화
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                update(getKoreaNowParts());
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              지금
            </button>
            <Button
              type="button"
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => setOpen(false)}
            >
              확인
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface TimeColumnProps {
  label?: React.ReactNode;
  items: number[];
  active?: number;
  onSelect: (n: number) => void;
  format: (n: number) => string;
}

const ITEM_HEIGHT = 36;
const VISIBLE_COUNT = 7; // odd to have a clear center

function TimeColumn({ label, items, active, onSelect, format }: TimeColumnProps) {
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const scrollTimer = React.useRef<number | null>(null);
  const isProgrammatic = React.useRef(false);
  const containerHeight = ITEM_HEIGHT * VISIBLE_COUNT;
  const padCount = Math.floor(VISIBLE_COUNT / 2);

  const activeIndex = React.useMemo(() => {
    if (active === undefined) return -1;
    return items.indexOf(active);
  }, [active, items]);

  // Sync scroll position to active value (without triggering selection)
  React.useEffect(() => {
    const el = scrollerRef.current;
    if (!el || activeIndex < 0) return;
    const target = activeIndex * ITEM_HEIGHT;
    if (Math.abs(el.scrollTop - target) < 1) return;
    isProgrammatic.current = true;
    el.scrollTo({ top: target, behavior: "smooth" });
    window.setTimeout(() => {
      isProgrammatic.current = false;
    }, 300);
  }, [activeIndex]);

  const handleScroll = () => {
    if (isProgrammatic.current) return;
    const el = scrollerRef.current;
    if (!el) return;
    if (scrollTimer.current) window.clearTimeout(scrollTimer.current);
    scrollTimer.current = window.setTimeout(() => {
      const idx = Math.round(el.scrollTop / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(items.length - 1, idx));
      const value = items[clamped];
      // Snap
      const target = clamped * ITEM_HEIGHT;
      if (Math.abs(el.scrollTop - target) > 1) {
        isProgrammatic.current = true;
        el.scrollTo({ top: target, behavior: "smooth" });
        window.setTimeout(() => {
          isProgrammatic.current = false;
        }, 200);
      }
      if (value !== active) onSelect(value);
    }, 120);
  };

  return (
    <div className="flex flex-col w-16 border-r border-border/80 last:border-r-0">
      <div className="h-7 flex items-center justify-center text-[10px] tracking-widest text-muted-foreground border-b border-border/80">
        {label ?? ""}
      </div>
      <div className="relative" style={{ height: containerHeight }}>
        {/* Center highlight */}
        <div
          className="pointer-events-none absolute left-1 right-1 rounded-md bg-accent/50"
          style={{ top: padCount * ITEM_HEIGHT, height: ITEM_HEIGHT }}
        />
        {/* Top/bottom fade */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-popover to-transparent z-10" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-popover to-transparent z-10" />
        <div
          ref={scrollerRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto scrollbar-none"
          style={{
            scrollSnapType: "y mandatory",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          <div style={{ height: padCount * ITEM_HEIGHT }} />
          {items.map((n) => {
            const selected = active === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => onSelect(n)}
                className={cn(
                  "w-full text-center text-sm tabular-nums transition-colors",
                  selected ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground",
                )}
                style={{ height: ITEM_HEIGHT, lineHeight: `${ITEM_HEIGHT}px`, scrollSnapAlign: "center" }}
              >
                {format(n)}
              </button>
            );
          })}
          <div style={{ height: padCount * ITEM_HEIGHT }} />
        </div>
      </div>
    </div>
  );
}
