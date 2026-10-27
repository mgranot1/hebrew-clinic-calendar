import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  appointmentsQuery, breaksQuery, clientsQuery, hoursQuery, pricingQuery, ils,
  TREATMENT_LABEL, useCreateAppointment,
} from "@/lib/clinic";
import { allowedDurations, availableSlots, fromMinutes, type TreatmentType } from "@/lib/scheduling";
import { daySchedule, iso } from "@/lib/day-schedule";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialDate: Date;
}

/** Create-appointment form: client, treatment, duration, auto price and valid slots only. */
export function AppointmentDialog({ open, onOpenChange, initialDate }: Props) {
  const [date, setDate] = useState(iso(initialDate));
  const [clientName, setClientName] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [type, setType] = useState<TreatmentType>("waxing");
  const [duration, setDuration] = useState(15);
  const [slot, setSlot] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setDate(iso(initialDate));
      setClientName("");
      setClientId(null);
      setSlot(null);
    }
  }, [open, initialDate]);

  const { data: clients = [] } = useQuery(clientsQuery);
  const { data: pricing = [] } = useQuery(pricingQuery);
  const { data: hours = [] } = useQuery(hoursQuery);
  const { data: breaks = [] } = useQuery(breaksQuery);
  const { data: appts = [] } = useQuery({ ...appointmentsQuery(date, date), enabled: open });
  const create = useCreateAppointment();

  const price = pricing.find((p) => p.treatment_type === type && p.duration_minutes === duration)?.price ?? 0;
  const slots = useMemo(() => {
    const s = daySchedule(new Date(date + "T00:00"), hours, breaks, appts);
    return availableSlots(s.open, s.breaks, s.booked, duration);
  }, [date, hours, breaks, appts, duration]);

  const suggestions = clientName && !clientId
    ? clients.filter((c) => c.full_name.includes(clientName) || c.phone?.includes(clientName)).slice(0, 5)
    : [];

  function changeType(t: TreatmentType) {
    setType(t);
    setDuration(allowedDurations(t)[t === "waxing" ? 0 : 2] ?? 15);
    setSlot(null);
  }

  async function submit() {
    if (slot == null || !clientName.trim()) return;
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
            <Input
              placeholder="בחרו לקוחה או הקלידו שם"
              value={clientName}
              onChange={(e) => { setClientName(e.target.value); setClientId(null); }}
            />
            {clientId && <p className="text-xs text-success">לקוחה קיימת ✓</p>}
            {suggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border bg-popover shadow-soft">
                {suggestions.map((c) => (
                  <button
                    key={c.id}
                    className="flex w-full justify-between px-3 py-2 text-sm hover:bg-accent"
                    onClick={() => { setClientName(c.full_name); setClientId(c.id); }}
                  >
                    <span>{c.full_name}</span>
                    <span dir="ltr" className="text-muted-foreground">{c.phone}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>תאריך</Label>
            <Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setSlot(null); }} />
          </div>
          <div className="space-y-1.5">
            <Label>סוג טיפול</Label>
            <Select value={type} onValueChange={(v) => changeType(v as TreatmentType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="waxing">{TREATMENT_LABEL.waxing}</SelectItem>
                <SelectItem value="electrolysis">{TREATMENT_LABEL.electrolysis}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>משך</Label>
            <Select value={String(duration)} onValueChange={(v) => { setDuration(Number(v)); setSlot(null); }} disabled={type === "waxing"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {allowedDurations(type).map((d) => <SelectItem key={d} value={String(d)}>{d} דקות</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>שעות פנויות</Label>
          {slots.length === 0 ? (
            <p className="mt-2 rounded-lg bg-muted p-4 text-center text-sm text-muted-foreground">אין שעות פנויות ביום זה</p>
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
          <div className="text-lg">מחיר: <span className="font-semibold text-primary">{ils(Number(price))}</span></div>
          <Button variant="hero" onClick={submit} disabled={slot == null || !clientName.trim() || create.isPending}>
            קביעת תור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
