import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { DURATION_STEP, formatDuration, isValidDuration } from "@/lib/scheduling";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  breaksQuery,
  DAY_LABEL,
  hoursQuery,
  pricingQuery,
  treatmentTypesQuery,
  useAddBreak,
  useAddTreatmentType,
  useDeleteBreak,
  useDeleteTreatmentType,
  useUpdateTreatmentType,
  useSaveHours,
  useSaveTypePricing,
  type PricingRule,
  type TreatmentType,
  type WorkingHours,
  TYPE_COLORS,
  typeColor,
} from "@/lib/clinic";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "הגדרות – Etti" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">הגדרות</h1>
      <Tabs defaultValue="hours" dir="rtl">
        <TabsList>
          <TabsTrigger value="hours">שעות פעילות והפסקות</TabsTrigger>
          <TabsTrigger value="pricing">מחירון טיפולים</TabsTrigger>
        </TabsList>
        <TabsContent value="hours">
          <HoursEditor />
        </TabsContent>
        <TabsContent value="pricing">
          <PricingEditor />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const hhmm = (t: string) => t.slice(0, 5);

function HoursEditor() {
  const { data = [] } = useQuery(hoursQuery);
  const { data: breaks = [] } = useQuery(breaksQuery);
  const [rows, setRows] = useState<WorkingHours[]>([]);
  const [editing, setEditing] = useState(false);
  const save = useSaveHours();
  const addBreak = useAddBreak();
  const delBreak = useDeleteBreak();
  // Sync from the DB only outside edit mode, so a refetch can't wipe unsaved edits.
  useEffect(() => {
    if (!editing) setRows(data);
  }, [data, editing]);
  const patch = (dow: number, p: Partial<WorkingHours>) =>
    setRows((r) => r.map((x) => (x.day_of_week === dow ? { ...x, ...p } : x)));

  async function saveHours() {
    try {
      await save.mutateAsync(rows);
      setEditing(false);
    } catch {
      // The mutation already shows the error; stay in edit mode so nothing is lost.
    }
  }

  if (!editing)
    return (
      <div className="space-y-3 rounded-2xl border bg-card p-6 shadow-soft">
        {rows.map((r) => (
          <div
            key={r.day_of_week}
            className="flex flex-wrap items-center gap-4 border-b pb-3 last:border-0"
          >
            <span className="w-16 font-medium">{DAY_LABEL[r.day_of_week]}</span>
            {r.is_open ? (
              <>
                <span dir="ltr">
                  {hhmm(r.start_time)}–{hhmm(r.end_time)}
                </span>
                {breaks
                  .filter((b) => b.day_of_week === r.day_of_week)
                  .map((b) => (
                    <span key={b.id} className="rounded-full bg-secondary px-3 py-1 text-xs">
                      הפסקה {hhmm(b.start_time)}–{hhmm(b.end_time)}
                    </span>
                  ))}
              </>
            ) : (
              <span className="text-sm text-muted-foreground">סגור</span>
            )}
          </div>
        ))}
        <Button variant="outline" onClick={() => setEditing(true)}>
          <Pencil className="h-4 w-4" /> עריכה
        </Button>
      </div>
    );

  return (
    <div className="space-y-3 rounded-2xl border border-primary bg-card p-6 shadow-soft">
      {rows.map((r) => (
        <div
          key={r.day_of_week}
          className="flex flex-wrap items-center gap-4 border-b pb-3 last:border-0"
        >
          <span className="w-16 font-medium">{DAY_LABEL[r.day_of_week]}</span>
          <Switch
            checked={r.is_open}
            onCheckedChange={(v) => patch(r.day_of_week, { is_open: v })}
          />
          {r.is_open ? (
            <>
              <Input
                type="time"
                step={900}
                className="w-32"
                value={hhmm(r.start_time)}
                onChange={(e) => patch(r.day_of_week, { start_time: e.target.value })}
              />
              <span>עד</span>
              <Input
                type="time"
                step={900}
                className="w-32"
                value={hhmm(r.end_time)}
                onChange={(e) => patch(r.day_of_week, { end_time: e.target.value })}
              />
              <div className="flex flex-wrap items-center gap-2">
                {breaks
                  .filter((b) => b.day_of_week === r.day_of_week)
                  .map((b) => (
                    <span
                      key={b.id}
                      className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs"
                    >
                      הפסקה {hhmm(b.start_time)}–{hhmm(b.end_time)}
                      <button onClick={() => delBreak.mutate(b.id)} aria-label="הסרת הפסקה">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                <BreakAdder
                  onAdd={(s, e) =>
                    addBreak.mutate({ day_of_week: r.day_of_week, start_time: s, end_time: e })
                  }
                />
              </div>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">סגור</span>
          )}
        </div>
      ))}
      <div className="flex gap-2">
        <Button variant="hero" onClick={saveHours} disabled={save.isPending}>
          שמירת שעות
        </Button>
        <Button variant="ghost" onClick={() => setEditing(false)} disabled={save.isPending}>
          ביטול
        </Button>
      </div>
    </div>
  );
}

function BreakAdder({ onAdd }: { onAdd: (start: string, end: string) => void }) {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState("13:00");
  const [e, setE] = useState("13:30");
  if (!open)
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <Plus /> הפסקה
      </Button>
    );
  return (
    <span className="flex items-center gap-1">
      <Input type="time" className="h-8 w-28" value={s} onChange={(x) => setS(x.target.value)} />
      <Input type="time" className="h-8 w-28" value={e} onChange={(x) => setE(x.target.value)} />
      <Button
        size="sm"
        onClick={() => {
          if (s < e) {
            onAdd(s, e);
            setOpen(false);
          }
        }}
      >
        הוספה
      </Button>
    </span>
  );
}

function PricingEditor() {
  const { data: types = [] } = useQuery(treatmentTypesQuery);
  const { data: pricing = [] } = useQuery(pricingQuery);
  const addType = useAddTreatmentType();

  return (
    <div className="space-y-4">
      {types.map((t) => (
        <TypeCard key={t.id} type={t} rules={pricing.filter((p) => p.treatment_type === t.name)} />
      ))}
      {types.length === 0 && (
        <p className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground shadow-soft">
          עדיין אין סוגי טיפול. הוסיפי סוג חדש כדי להתחיל.
        </p>
      )}
      <AddTypeForm
        onAdd={(name) =>
          addType.mutate({
            name,
            sort_order: types.length,
            color: TYPE_COLORS[types.length % TYPE_COLORS.length].key,
          })
        }
        pending={addType.isPending}
      />
    </div>
  );
}

// Each row: a duration in minutes and its price, both edited as strings.
type PriceRow = { duration: string; price: string };
const toRows = (rules: PricingRule[]): PriceRow[] =>
  [...rules]
    .sort((a, b) => a.duration_minutes - b.duration_minutes)
    .map((r) => ({ duration: String(r.duration_minutes), price: String(r.price) }));

/** One treatment type: read-only until "edit" is pressed; save and delete ask for confirmation. */
function TypeCard({ type, rules }: { type: TreatmentType; rules: PricingRule[] }) {
  const savePricing = useSaveTypePricing();
  const rename = useUpdateTreatmentType();
  const del = useDeleteTreatmentType();

  const [editing, setEditing] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState(type.name);
  const [color, setColor] = useState(type.color);
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [newDuration, setNewDuration] = useState("");

  // Sync from the DB only outside edit mode, so a refetch can't wipe unsaved edits.
  useEffect(() => {
    if (editing) return;
    setName(type.name);
    setColor(type.color);
    setRows(toRows(rules));
    setNewDuration("");
  }, [editing, type.name, type.color, rules]);

  const nameChanged = name.trim() !== type.name;
  const typeChanged = nameChanged || color !== type.color;
  const pricesChanged = JSON.stringify(rows) !== JSON.stringify(toRows(rules));
  const busy = savePricing.isPending || rename.isPending || del.isPending;

  function addDuration() {
    const d = Number(newDuration);
    if (!isValidDuration(d)) {
      toast.error(`משך הטיפול חייב להיות בקפיצות של ${DURATION_STEP} דקות (5, 10, 15...)`);
      return;
    }
    if (rows.some((r) => Number(r.duration) === d)) return;
    setRows((r) =>
      [...r, { duration: String(d), price: "0" }].sort(
        (a, b) => Number(a.duration) - Number(b.duration),
      ),
    );
    setNewDuration("");
  }

  function requestSave() {
    if (!name.trim()) {
      toast.error("יש להזין שם לסוג הטיפול");
      return;
    }
    if (!typeChanged && !pricesChanged) {
      setEditing(false);
      return;
    }
    setConfirmSave(true);
  }

  async function save() {
    const newName = name.trim();
    try {
      // Rename first: it moves the existing price rows onto the new name.
      if (typeChanged)
        await rename.mutateAsync({ id: type.id, oldName: type.name, name: newName, color });
      if (pricesChanged) {
        const payload = rows
          .filter((r) => isValidDuration(Number(r.duration)))
          .map((r) => ({
            treatment_type: newName,
            duration_minutes: Number(r.duration),
            price: Number(r.price || 0),
          }));
        await savePricing.mutateAsync({ treatment_type: newName, rows: payload });
      }
      setEditing(false);
    } catch {
      // The mutation already shows the error; stay in edit mode so nothing is lost.
    }
  }

  if (!editing)
    return (
      <div className="space-y-4 rounded-2xl border bg-card p-6 shadow-soft">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="h-4 w-4 rounded-full"
            style={{ backgroundColor: typeColor(type.color) }}
            aria-hidden
          />
          <h2 className="font-display text-lg">{type.name}</h2>
          <Button variant="outline" size="sm" className="mr-auto" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" /> עריכה
          </Button>
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">עדיין לא הוגדרו משכים ומחירים.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {rows.map((r) => (
              <div key={r.duration} className="space-y-1 rounded-xl border p-3">
                <span className="text-xs text-muted-foreground">
                  {formatDuration(Number(r.duration))}
                </span>
                <p className="font-medium">₪{r.price}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );

  return (
    <div className="space-y-4 rounded-2xl border border-primary bg-card p-6 shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="h-9 max-w-xs font-display text-lg"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="שם סוג הטיפול"
        />
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          onClick={() => setConfirmDelete(true)}
          disabled={busy}
        >
          <Trash2 className="h-4 w-4" /> מחיקת סוג
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="צבע ביומן">
        <span className="text-sm text-muted-foreground">צבע ביומן:</span>
        {TYPE_COLORS.map((c) => (
          <button
            key={c.key}
            type="button"
            role="radio"
            aria-checked={color === c.key}
            aria-label={c.label}
            title={c.label}
            onClick={() => setColor(c.key)}
            className={cn(
              "h-7 w-7 rounded-full border-2 border-transparent transition-transform hover:scale-110",
              color === c.key && "border-foreground ring-2 ring-background ring-inset",
            )}
            style={{ backgroundColor: typeColor(c.key) }}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {rows.map((r, i) => (
          <div key={r.duration} className="space-y-1 rounded-xl border p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{r.duration} דקות</span>
              <button
                onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                aria-label="הסרת משך"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <div className="flex items-center gap-1">
              <span>₪</span>
              <Input
                type="number"
                min={0}
                className="h-8"
                value={r.price}
                onChange={(e) =>
                  setRows((rs) => rs.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))
                }
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="number"
          min={DURATION_STEP}
          step={DURATION_STEP}
          className="h-9 w-32"
          placeholder="משך בדקות"
          value={newDuration}
          onChange={(e) => setNewDuration(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addDuration()}
        />
        <Button variant="outline" size="sm" onClick={addDuration}>
          <Plus /> הוספת משך
        </Button>
        <div className="mr-auto flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={busy}>
            ביטול
          </Button>
          <Button variant="hero" size="sm" onClick={requestSave} disabled={busy}>
            שמירה
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmSave}
        onOpenChange={setConfirmSave}
        title="לשמור את השינויים?"
        description={`השינויים ב"${type.name}" יישמרו ויחולו על תורים חדשים. תורים שכבר נקבעו נשארים עם המחיר הקודם.`}
        confirmLabel="כן, לשמור"
        onConfirm={save}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`למחוק את "${type.name}"?`}
        description="סוג הטיפול וכל המחירים שלו יימחקו. תורים שכבר נקבעו לא ייפגעו."
        confirmLabel="כן, למחוק"
        destructive
        onConfirm={() => del.mutate({ id: type.id, name: type.name })}
      />
    </div>
  );
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader className="text-right sm:text-right">
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:justify-start sm:space-x-0">
          <AlertDialogAction
            className={destructive ? buttonVariants({ variant: "destructive" }) : undefined}
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
          <AlertDialogCancel className="mt-0">ביטול</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function AddTypeForm({ onAdd, pending }: { onAdd: (name: string) => void; pending: boolean }) {
  const [name, setName] = useState("");
  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setName("");
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed bg-card p-4 shadow-soft">
      <Input
        className="h-9 max-w-xs"
        placeholder="שם סוג טיפול חדש"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      <Button variant="hero" size="sm" onClick={submit} disabled={pending || !name.trim()}>
        <Plus /> הוספת סוג טיפול
      </Button>
    </div>
  );
}
