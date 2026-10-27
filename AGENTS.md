<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Project rules
- Booking-slot rules live only in `src/lib/scheduling.ts` (pure, unit-tested); UI must call it, never re-implement it.
- Clinic data is shared by all staff: RLS allows any authenticated user; data access goes through `src/lib/clinic.ts` query options/mutations.
- Revenue for paid appointments is written by the DB trigger `sync_appointment_revenue`, not by the client, so it can't drift.
- UI is Hebrew RTL (`dir="rtl"` on `<html>`); desktop-first, must stay usable on mobile.
