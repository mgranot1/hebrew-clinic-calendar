import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Etti – מערכת ניהול הקליניקה" },
      {
        name: "description",
        content: "יומן תורים, לקוחות, מחירון והכנסות לקליניקת Etti לאסתטיקה מתקדמת.",
      },
      { property: "og:title", content: "Etti – מערכת ניהול הקליניקה" },
      { property: "og:description", content: "יומן תורים, לקוחות, מחירון והכנסות לקליניקת Etti." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md rounded-3xl border bg-card p-10 text-center shadow-soft">
        <Logo />
        <p className="mt-6 text-sm text-muted-foreground">אפילציה | שעוות פנים וגוף | עיצוב גבות</p>
        <h1 className="mt-8 font-display text-2xl">מערכת ניהול הקליניקה</h1>
        <p className="mt-2 text-muted-foreground">יומן תורים, לקוחות, מחירון והכנסות</p>
        <Button asChild variant="hero" size="lg" className="mt-8 w-full">
          <Link to="/dashboard">כניסה ליומן</Link>
        </Button>
      </div>
    </main>
  );
}
