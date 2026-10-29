import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ils,
  STATUS_LABEL,
  useDeleteAppointment,
  useUpdateAppointment,
  type Appointment,
  type AppointmentStatus,
} from "@/lib/clinic";
import { fromMinutes, toMinutes } from "@/lib/scheduling";

/** View an appointment and move it through its status lifecycle. */
export function AppointmentDetails({
  appt,
  onClose,
}: {
  appt: Appointment | null;
  onClose: () => void;
}) {
  const update = useUpdateAppointment();
  const del = useDeleteAppointment();
  if (!appt) return null;
  const start = toMinutes(appt.start_time);
  const setStatus = async (status: AppointmentStatus) => {
    await update.mutateAsync({ id: appt.id, status });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{appt.client_name}</DialogTitle>
        </DialogHeader>
        <dl className="grid grid-cols-2 gap-y-3 text-sm">
          <dt className="text-muted-foreground">תאריך</dt>
          <dd>{new Date(appt.appt_date).toLocaleDateString("he-IL")}</dd>
          <dt className="text-muted-foreground">שעה</dt>
          <dd>
            {fromMinutes(start)}–{fromMinutes(start + appt.duration_minutes)}
          </dd>
          <dt className="text-muted-foreground">טיפול</dt>
          <dd>
            {appt.treatment_type} · {appt.duration_minutes} דק׳
          </dd>
          <dt className="text-muted-foreground">מחיר</dt>
          <dd className="font-semibold">{ils(Number(appt.price))}</dd>
          <dt className="text-muted-foreground">סטטוס</dt>
          <dd>
            <Badge variant="secondary">{STATUS_LABEL[appt.status as AppointmentStatus]}</Badge>
          </dd>
        </dl>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {appt.status !== "paid" && (
            <Button variant="success" className="col-span-2" onClick={() => setStatus("paid")}>
              סימון כשולם
            </Button>
          )}
          {appt.status === "scheduled" && (
            <Button variant="secondary" onClick={() => setStatus("completed")}>
              סימון כהושלם
            </Button>
          )}
          {appt.status !== "scheduled" && (
            <Button variant="secondary" onClick={() => setStatus("scheduled")}>
              החזרה למתוכנן
            </Button>
          )}
          {appt.status !== "cancelled" && (
            <Button variant="outline" onClick={() => setStatus("cancelled")}>
              ביטול תור
            </Button>
          )}
          <Button
            variant="ghost"
            className="col-span-2 text-destructive"
            onClick={async () => {
              await del.mutateAsync(appt.id);
              onClose();
            }}
          >
            מחיקה לצמיתות
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
