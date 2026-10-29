import { useEffect, useMemo, useState } from "react";
import { UserPlus, X } from "lucide-react";
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
  isValidPhone,
  findClientByPhone,
  normalizePhone,
  useCreateAppointment,
  type Client,
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
  const [search, setSearch] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  // Name of the picked client, or of the new client being added.
  const [clientName, setClientName] = useState("");
  const [adding, setAdding] = useState(false);
  const [phone, setPhone] = useState("");
  const [type, setType] = useState<string>("");
  const [duration, setDuration] = useState(0);
  const [slot, setSlot] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setDate(clampToToday(initialDate));
      setSearch("");
      setListOpen(false);
      setClientId(null);
      setClientName("");
      setAdding(false);
      setPhone("");
      setSlot(null);
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

  const term = search.trim();
  const termDigits = normalizePhone(term);
  const matches = term
    ? clients.filter(
        (c) =>
          c.full_name.includes(term) ||
          (termDigits.length >= 3 && !!c.phone && normalizePhone(c.phone).includes(termDigits)),
      )
    : clients;

  function pickClient(c: Client) {
    setClientId(c.id);
    setClientName(c.full_name);
    setSearch(c.full_name);
    setListOpen(false);
    setAdding(false);
    setPhone("");
  }

  function startAdding() {
    // Prefill whichever field the manager was typing into the search box.
    const looksLikePhone = /^[\d\s\-+]+$/.test(term);
    setClientName(looksLikePhone ? "" : term);
    setPhone(looksLikePhone ? term : "");
    setAdding(true);
    setListOpen(false);
  }

  function cancelAdding() {
    setAdding(false);
    setClientName("");
    setPhone("");
  }

  function changeType(t: string) {
    setType(t);
    setSlot(null);
  }

  const phoneOwner =
    adding && isValidPhone(phone) ? findClientByPhone(clients, phone) : undefined;
  const clientOk = clientId
    ? true
    : adding && !!clientName.trim() && isValidPhone(phone) && !phoneOwner;

  async function submit() {
    if (slot == null || !clientOk || !type || !duration || isPastDay(date, today)) return;
    await create.mutateAsync({
      appt_date: date,
      start_time: fromMinutes(slot),
      duration_minutes: duration,
      client_id: clientId,
      client_name: clientName.trim(),
      treatment_type: type,
      price: Number(price),
      ...(adding && { newClient: { full_name: clientName.trim(), phone: phone.trim() } }),
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
          {adding ? (
            <div className="space-y-1.5 md:col-span-2">
              <div className="flex items-center justify-between">
                <Label>לקוחה חדשה – תישמר ברשימת הלקוחות</Label>
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={cancelAdding}
                >
                  <X className="h-3 w-3" /> חזרה לחיפוש
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  aria-label="שם מלא"
                  placeholder="שם מלא *"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  autoFocus={!clientName}
                />
                <Input
                  aria-label="טלפון"
                  type="tel"
                  dir="ltr"
                  className="text-right"
                  placeholder="טלפון *"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  aria-invalid={!!phone && (!isValidPhone(phone) || !!phoneOwner)}
                  autoFocus={!!clientName}
                />
              </div>
              {phoneOwner ? (
                <p className="text-xs text-destructive">
                  המספר כבר שייך ללקוחה קיימת: {phoneOwner.full_name}.{" "}
                  <button
                    type="button"
                    className="font-semibold underline"
                    onClick={() => pickClient(phoneOwner)}
                  >
                    לבחור בה
                  </button>
                </p>
              ) : (
                phone &&
                !isValidPhone(phone) && (
                  <p className="text-xs text-destructive">מספר טלפון לא תקין</p>
                )
              )}
            </div>
          ) : (
            <div className="relative space-y-1.5">
              <Label htmlFor="client-search">לקוחה *</Label>
              <Input
                id="client-search"
                autoComplete="off"
                placeholder="חיפוש לפי שם או טלפון"
                value={search}
                onFocus={() => !clientId && setListOpen(true)}
                onBlur={() => setListOpen(false)}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setClientId(null);
                  setClientName("");
                  setListOpen(true);
                }}
                className={cn(clientId && "border-success")}
              />
              {listOpen && !clientId && (matches.length > 0 || term) && (
                <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border bg-popover shadow-soft">
                  {matches.slice(0, 8).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="flex w-full justify-between px-3 py-2 text-sm hover:bg-accent"
                      // Keep input focus so blur doesn't close the list before the click lands.
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickClient(c)}
                    >
                      <span>{c.full_name}</span>
                      <span dir="ltr" className="text-muted-foreground">
                        {c.phone}
                      </span>
                    </button>
                  ))}
                  {term && matches.length === 0 && (
                    <p className="px-3 py-2 text-sm text-muted-foreground">לא נמצאה לקוחה מתאימה</p>
                  )}
                  {term && (
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 border-t px-3 py-2 text-sm font-medium text-primary hover:bg-accent"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={startAdding}
                    >
                      <UserPlus className="h-4 w-4" /> הוספת לקוחה חדשה
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
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
              !clientOk ||
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
