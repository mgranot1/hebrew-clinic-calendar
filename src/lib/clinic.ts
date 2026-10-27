/**
 * Data access for the clinic. Uses the browser client; RLS limits access to signed-in staff.
 */
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Client = Tables<"clients">;
export type Appointment = Tables<"appointments">;
export type PricingRule = Tables<"pricing_rules">;
export type WorkingHours = Tables<"working_hours">;
export type Break = Tables<"breaks">;
export type Transaction = Tables<"transactions">;
export type AppointmentStatus = "scheduled" | "completed" | "paid" | "cancelled";

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  scheduled: "מתוכנן",
  completed: "הושלם",
  paid: "שולם",
  cancelled: "בוטל",
};
export const TREATMENT_LABEL = { waxing: "שעווה", electrolysis: "אפילציה (חשמלית)" } as const;
export const DAY_LABEL = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
export const ils = (n: number) => `₪${Number(n).toLocaleString("he-IL", { maximumFractionDigits: 2 })}`;

async function unwrap<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

// ---------- queries ----------
export const clientsQuery = queryOptions({
  queryKey: ["clients"],
  queryFn: () => unwrap<Client[]>(supabase.from("clients").select("*").order("full_name")),
});
export const pricingQuery = queryOptions({
  queryKey: ["pricing"],
  queryFn: () =>
    unwrap<PricingRule[]>(supabase.from("pricing_rules").select("*").order("treatment_type").order("duration_minutes")),
});
export const hoursQuery = queryOptions({
  queryKey: ["hours"],
  queryFn: () => unwrap<WorkingHours[]>(supabase.from("working_hours").select("*").order("day_of_week")),
});
export const breaksQuery = queryOptions({
  queryKey: ["breaks"],
  queryFn: () => unwrap<Break[]>(supabase.from("breaks").select("*").order("start_time")),
});
export const appointmentsQuery = (from: string, to: string) =>
  queryOptions({
    queryKey: ["appointments", from, to],
    queryFn: () =>
      unwrap<Appointment[]>(
        supabase.from("appointments").select("*").gte("appt_date", from).lte("appt_date", to).order("start_time"),
      ),
  });
export const transactionsQuery = (from: string, to: string) =>
  queryOptions({
    queryKey: ["transactions", from, to],
    queryFn: () =>
      unwrap<Transaction[]>(
        supabase.from("transactions").select("*").gte("txn_date", from).lte("txn_date", to).order("txn_date", { ascending: false }),
      ),
  });

// ---------- mutations ----------
/** Generic mutation that refreshes the given cache keys and reports errors. */
function useClinicMutation<V>(fn: (v: V) => PromiseLike<{ error: { message: string } | null }>, keys: string[], ok?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: V) => {
      const { error } = await fn(v);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      if (ok) toast.success(ok);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export const useSaveClient = () =>
  useClinicMutation(
    (c: TablesInsert<"clients">) => (c.id ? supabase.from("clients").update(c).eq("id", c.id) : supabase.from("clients").insert(c)),
    ["clients"],
    "הלקוחה נשמרה",
  );
export const useDeleteClient = () =>
  useClinicMutation((id: string) => supabase.from("clients").delete().eq("id", id), ["clients"], "הלקוחה נמחקה");

export const useCreateAppointment = () =>
  useClinicMutation((a: TablesInsert<"appointments">) => supabase.from("appointments").insert(a), ["appointments"], "התור נקבע");
export const useUpdateAppointment = () =>
  useClinicMutation(
    ({ id, ...patch }: TablesUpdate<"appointments"> & { id: string }) => supabase.from("appointments").update(patch).eq("id", id),
    ["appointments", "transactions"],
    "התור עודכן",
  );
export const useDeleteAppointment = () =>
  useClinicMutation((id: string) => supabase.from("appointments").delete().eq("id", id), ["appointments", "transactions"], "התור נמחק");

export const useUpsertPricing = () =>
  useClinicMutation(
    (rows: TablesInsert<"pricing_rules">[]) => supabase.from("pricing_rules").upsert(rows, { onConflict: "treatment_type,duration_minutes" }),
    ["pricing"],
    "המחירון נשמר",
  );
export const useSaveHours = () =>
  useClinicMutation((rows: TablesInsert<"working_hours">[]) => supabase.from("working_hours").upsert(rows), ["hours"], "שעות הפעילות נשמרו");
export const useAddBreak = () =>
  useClinicMutation((b: TablesInsert<"breaks">) => supabase.from("breaks").insert(b), ["breaks"]);
export const useDeleteBreak = () => useClinicMutation((id: string) => supabase.from("breaks").delete().eq("id", id), ["breaks"]);

export const useAddTransaction = () =>
  useClinicMutation((t: TablesInsert<"transactions">) => supabase.from("transactions").insert(t), ["transactions"], "נרשם בהצלחה");
export const useDeleteTransaction = () =>
  useClinicMutation((id: string) => supabase.from("transactions").delete().eq("id", id), ["transactions"]);
