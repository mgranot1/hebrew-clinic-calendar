// `redirect` דרוש כשמחזירים את האימות המקורי (ראו beforeLoad למטה).
import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Users, Settings, Wallet, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  // --- אימות מושבת זמנית: הגישה ליומן פתוחה לכל מי שיש לו את הקישור. ---
  // כדי להחזיר את ההזדהות, מחקו את ה-beforeLoad הזמני שלמטה ובטלו את ההערה מהגרסה המקורית.
  beforeLoad: async () => {
    // משתמש דמה כדי שה-layout (user.email וכו') ימשיך לעבוד ללא אימות אמיתי.
    return { user: { email: "" } as { email: string } };
  },
  // --- הגרסה המקורית עם אימות (לשחזור בעתיד): ---
  // beforeLoad: async () => {
  //   const { data } = await supabase.auth.getUser();
  //   if (!data.user) throw redirect({ to: "/auth" });
  //   return { user: data.user };
  // },
  component: AppLayout,
});

const NAV = [
  { to: "/dashboard", label: "יומן", icon: CalendarDays },
  { to: "/clients", label: "לקוחות", icon: Users },
  { to: "/finance", label: "הכנסות והוצאות", icon: Wallet },
  { to: "/settings", label: "הגדרות", icon: Settings },
] as const;

/** Desktop-first shell: fixed side rail, collapses to a top bar on small screens. */
function AppLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <aside className="flex shrink-0 flex-row items-center gap-2 bg-sidebar p-3 text-sidebar-foreground md:sticky md:top-0 md:h-screen md:w-60 md:flex-col md:items-stretch md:p-5">
        <Logo className="hidden py-4 md:flex" />
        <nav className="flex flex-1 gap-1 overflow-x-auto md:mt-8 md:flex-col">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-sidebar-accent"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-primary font-semibold" }}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="md:border-t md:border-sidebar-border md:pt-4">
          <p className="hidden truncate text-xs opacity-70 md:block" dir="ltr">
            {user.email}
          </p>
          <button
            onClick={signOut}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-sidebar-accent md:mt-2"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden md:inline">יציאה</span>
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
