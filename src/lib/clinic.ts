/**
 * Data access for the clinic. Uses the browser client; RLS limits access to signed-in staff.
 */
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Client = Tables<"clients">;
export type TreatmentType = Tables<"treatment_types">;
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
export const DAY_LABEL = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

/** Calendar colors a treatment type may use: theme variables from styles.css (keep in sync with the DB CHECK). */
export const TYPE_COLORS = [
  { key: "chart-1", label: "ברונזה" },
  { key: "chart-3", label: "טרקוטה" },
  { key: "chart-4", label: "זהב" },
  { key: "chart-5", label: "חום" },
] as const;
export const typeColor = (key: string) => `var(--${key})`;
/** Soft tint of a type color, readable behind dark text. */
export const typeTint = (key: string) =>
  `color-mix(in oklab, ${typeColor(key)} 30%, var(--card))`;
export const ils = (n: number) =>
  `₪${Number(n).toLocaleString("he-IL", { maximumFractionDigits: 2 })}`;
export const normalizePhone = (p: string) => p.replace(/[^\d+]/g, "");
export const isValidPhone = (p: string) => /^\+?\d{9,12}$/.test(normalizePhone(p));
/** The client (other than `exceptId`) that already has this phone, if any. */
export const findClientByPhone = (clients: Client[], phone: string, exceptId?: string) =>
  clients.find(
    (c) => c.id !== exceptId && !!c.phone && normalizePhone(c.phone) === normalizePhone(phone),
  );

async function unwrap<T>(
  p: PromiseLike<{ data: T | null; error: { message: string } | null }>,
): Promise<T> {
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
    unwrap<PricingRule[]>(
      supabase.from("pricing_rules").select("*").order("treatment_type").order("duration_minutes"),
    ),
});
export const treatmentTypesQuery = queryOptions({
  queryKey: ["treatment_types"],
  queryFn: () =>
    unwrap<TreatmentType[]>(
      supabase.from("treatment_types").select("*").order("sort_order").order("name"),
    ),
});
export const hoursQuery = queryOptions({
  queryKey: ["hours"],
  queryFn: () =>
    unwrap<WorkingHours[]>(supabase.from("working_hours").select("*").order("day_of_week")),
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
        supabase
          .from("appointments")
          .select("*")
          .gte("appt_date", from)
          .lte("appt_date", to)
          .order("start_time"),
      ),
  });
export const transactionsQuery = (from: string, to: string) =>
  queryOptions({
    queryKey: ["transactions", from, to],
    queryFn: () =>
      unwrap<Transaction[]>(
        supabase
          .from("transactions")
          .select("*")
          .gte("txn_date", from)
          .lte("txn_date", to)
          .order("txn_date", { ascending: false }),
      ),
  });

// ---------- mutations ----------
/** Generic mutation that refreshes the given cache keys and reports errors. */
function useClinicMutation<V>(
  fn: (v: V) => PromiseLike<{ error: { message: string } | null }>,
  keys: string[],
  ok?: string,
) {
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
    (c: TablesInsert<"clients">) =>
      c.id ? supabase.from("clients").update(c).eq("id", c.id) : supabase.from("clients").insert(c),
    ["clients"],
    "הלקוחה נשמרה",
  );
export const useDeleteClient = () =>
  useClinicMutation(
    (id: string) => supabase.from("clients").delete().eq("id", id),
    ["clients"],
    "הלקוחה נמחקה",
  );

export const useCreateAppointment = () =>
  useClinicMutation(
    // A client not yet in the list is saved first, so the appointment links to her record.
    async ({
      newClient,
      ...a
    }: TablesInsert<"appointments"> & {
      newClient?: { full_name: string; phone: string } | undefined;
    }) => {
      if (newClient) {
        const c = await supabase.from("clients").insert(newClient).select("id").single();
        if (c.error) return c;
        a.client_id = c.data.id;
      }
      return supabase.from("appointments").insert(a);
    },
    ["appointments", "clients"],
    "התור נקבע",
  );
export const useUpdateAppointment = () =>
  useClinicMutation(
    ({ id, ...patch }: TablesUpdate<"appointments"> & { id: string }) =>
      supabase.from("appointments").update(patch).eq("id", id),
    ["appointments", "transactions"],
    "התור עודכן",
  );
export const useDeleteAppointment = () =>
  useClinicMutation(
    (id: string) => supabase.from("appointments").delete().eq("id", id),
    ["appointments", "transactions"],
    "התור נמחק",
  );

export const useUpsertPricing = () =>
  useClinicMutation(
    (rows: TablesInsert<"pricing_rules">[]) =>
      supabase
        .from("pricing_rules")
        .upsert(rows, { onConflict: "treatment_type,duration_minutes" }),
    ["pricing"],
  );
/**
 * Save the full pricing set for one treatment type: delete its existing rows,
 * then insert the current list. This also drops durations the manager removed.
 */
export const useSaveTypePricing = () =>
  useClinicMutation(
    async ({
      treatment_type,
      rows,
    }: {
      treatment_type: string;
      rows: TablesInsert<"pricing_rules">[];
    }) => {
      const del = await supabase
        .from("pricing_rules")
        .delete()
        .eq("treatment_type", treatment_type);
      if (del.error || rows.length === 0) return del;
      return supabase.from("pricing_rules").insert(rows);
    },
    ["pricing"],
    "המחירון נשמר",
  );

export const useAddTreatmentType = () =>
  useClinicMutation(
    (t: TablesInsert<"treatment_types">) => supabase.from("treatment_types").insert(t),
    ["treatment_types"],
    "סוג הטיפול נוסף",
  );
export const useUpdateTreatmentType = () =>
  useClinicMutation(
    // Price rows are joined by name, so a rename carries the new name onto them.
    async ({ id, oldName, name, color }: { id: string; oldName: string; name: string; color: string }) => {
      const t = await supabase.from("treatment_types").update({ name, color }).eq("id", id);
      if (t.error || name === oldName) return t;
      return supabase
        .from("pricing_rules")
        .update({ treatment_type: name })
        .eq("treatment_type", oldName);
    },
    ["treatment_types", "pricing"],
    "סוג הטיפול עודכן",
  );
export const useDeleteTreatmentType = () =>
  useClinicMutation(
    // Removing a type also removes its pricing rows. Past appointments keep their copied text.
    async ({ id, name }: { id: string; name: string }) => {
      const p = await supabase.from("pricing_rules").delete().eq("treatment_type", name);
      if (p.error) return p;
      return supabase.from("treatment_types").delete().eq("id", id);
    },
    ["treatment_types", "pricing"],
    "סוג הטיפול נמחק",
  );
export const useSaveHours = () =>
  useClinicMutation(
    (rows: TablesInsert<"working_hours">[]) => supabase.from("working_hours").upsert(rows),
    ["hours"],
    "שעות הפעילות נשמרו",
  );
export const useAddBreak = () =>
  useClinicMutation((b: TablesInsert<"breaks">) => supabase.from("breaks").insert(b), ["breaks"]);
export const useDeleteBreak = () =>
  useClinicMutation((id: string) => supabase.from("breaks").delete().eq("id", id), ["breaks"]);

export const useAddTransaction = () =>
  useClinicMutation(
    (t: TablesInsert<"transactions">) => supabase.from("transactions").insert(t),
    ["transactions"],
    "נרשם בהצלחה",
  );
export const useDeleteTransaction = () =>
  useClinicMutation(
    (id: string) => supabase.from("transactions").delete().eq("id", id),
    ["transactions"],
  );
