import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  appointmentsQuery,
  breaksQuery,
  clientsQuery,
  hoursQuery,
  pricingQuery,
  treatmentTypesQuery,
  ils,
  useCreateAppointment,
} from "@/lib/clinic";
import { availableSlots, formatDuration, fromMinutes, isPastDay } from "@/lib/scheduling";
import { daySchedule, iso } from "@/lib/day-schedule";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialDate: Date;
}

/** Create-appointment form: client, treatment, duration, auto price and valid slots only. */
export function AppointmentDialog({ open, onOpenChange, initialDate }: Props) {
  const today = iso(new Date());
  /** Dates that already passed can't be booked, so the form never starts on one. */
  const clampToToday = (d: Date) => (isPastDay(iso(d), today) ? today : iso(d));
  const [date, setDate] = useState(() => clampToToday(initialDate));
  const [clientName, setClientName] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [type, setType] = useState<string>("");
  const [duration, setDuration] = useState(0);
  const [slot, setSlot] = useState<number | null>(null);
  const [showList, setShowList] = useState(false);

  useEffect(() => {
    if (open) {
      setDate(clampToToday(initialDate));
      setClientName("");
      setClientId(null);
      setSlot(null);
      setShowList(false);
    }
  }, [open, initialDate]);

  const { data: clients = [] } = useQuery(clientsQuery);
  const { data: pricing = [] } = useQuery(pricingQuery);
  const { data: types = [] } = useQuery(treatmentTypesQuery);
  const { data: hours = [] } = useQuery(hoursQuery);
  const { data: breaks = [] } = useQuery(breaksQuery);
  const { data: appts = [] } = useQuery({ ...appointmentsQuery(date, date), enabled: open });
  const create = useCreateAppointment();

  // Durations the manager priced for the selected type, ascending.
  const durations = useMemo(
    () =>
      pricing
        .filter((p) => p.treatment_type === type)
        .map((p) => p.duration_minutes)
        .sort((a, b) => a - b),
    [pricing, type],
  );

  // Default the type to the first available, and keep duration valid for the type.
  useEffect(() => {
    if (!types.some((t) => t.name === type)) setType(types[0]?.name ?? "");
  }, [types, type]);
  useEffect(() => {
    if (!durations.includes(duration)) {
      setDuration(durations[0] ?? 0);
      setSlot(null);
    }
  }, [durations, duration]);

  const price =
    pricing.find((p) => p.treatment_type === type && p.duration_minutes === duration)?.price ?? 0;
  const slots = useMemo(() => {
    if (isPastDay(date, today)) return [];
    const s = daySchedule(new Date(date + "T00:00"), hours, breaks, appts);
    return availableSlots(s.open, s.breaks, s.booked, duration);
  }, [date, hours, breaks, appts, duration, today]);

  const suggestions =
    showList && !clientId
      ? clients
      : clientName && !clientId
        ? clients
            .filter((c) => c.full_name.includes(clientName) || c.phone?.includes(clientName))
            .slice(0, 5)
        : [];

  function changeType(t: string) {
    setType(t);
    setSlot(null);
  }

  async function submit() {
    if (slot == null || !clientName.trim() || !type || !duration || isPastDay(date, today)) return;
    await create.mutateAsync({
      appt_date: date,
      start_time: fromMinutes(slot),
      duration_minutes: duration,
      client_id: clientId,
      client_name: clientName.trim(),
      treatment_type: type,
      price: Number(price),
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">תור חדש</DialogTitle>
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="relative space-y-1.5">
            <Label>לקוחה</Label>
            <div className="flex gap-2">
              <Input
                className="flex-1"
                placeholder="בחרו לקוחה או הקלידו שם"
                value={clientName}
                onChange={(e) => {
                  setClientName(e.target.value);
                  setClientId(null);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="רשימת לקוחות"
                onClick={() => {
                  setShowList((s) => !s);
                  setClientId(null);
                }}
              >
                <ChevronDown className={cn("transition-transform", showList && "rotate-180")} />
              </Button>
            </div>
            {clientId && <p className="text-xs text-success">לקוחה קיימת ✓</p>}
            {suggestions.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border bg-popover shadow-soft">
                {suggestions.map((c) => (
                  <button
                    key={c.id}
                    className="flex w-full justify-between px-3 py-2 text-sm hover:bg-accent"
                    onClick={() => {
                      setClientName(c.full_name);
                      setClientId(c.id);
                      setShowList(false);
                    }}
                  >
                    <span>{c.full_name}</span>
                    <span dir="ltr" className="text-muted-foreground">
                      {c.phone}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>תאריך</Label>
            <Input
              type="date"
              min={today}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setSlot(null);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>סוג טיפול</Label>
            <Select value={type} onValueChange={changeType} disabled={types.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder="בחרו סוג טיפול" />
              </SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t.id} value={t.name}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>משך</Label>
            <Select
              value={duration ? String(duration) : ""}
              onValueChange={(v) => {
                setDuration(Number(v));
                setSlot(null);
              }}
              disabled={durations.length <= 1}
            >
              <SelectTrigger>
                <SelectValue placeholder="בחרו משך" />
              </SelectTrigger>
              <SelectContent>
                {durations.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {formatDuration(d)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>שעות פנויות</Label>
          {isPastDay(date, today) ? (
            <p className="mt-2 rounded-lg bg-muted p-4 text-center text-sm text-muted-foreground">
              אי אפשר לקבוע תור לתאריך שכבר עבר. בחרו היום או מחר.
            </p>
          ) : slots.length === 0 ? (
            <p className="mt-2 rounded-lg bg-muted p-4 text-center text-sm text-muted-foreground">
              אין שעות פנויות ביום זה
            </p>
          ) : (
            <div className="mt-2 grid max-h-48 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
              {slots.map((s) => (
                <button
                  key={s}
                  onClick={() => setSlot(s)}
                  className={cn(
                    "rounded-lg border py-2 text-sm transition-all hover:border-primary",
                    slot === s && "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  {fromMinutes(s)}
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="items-center gap-3 sm:justify-between">
          <div className="text-lg">
            מחיר: <span className="font-semibold text-primary">{ils(Number(price))}</span>
          </div>
          <Button
            variant="hero"
            onClick={submit}
            disabled={
              slot == null ||
              !clientName.trim() ||
              !type ||
              !duration ||
              create.isPending ||
              isPastDay(date, today)
            }
          >
            קביעת תור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
