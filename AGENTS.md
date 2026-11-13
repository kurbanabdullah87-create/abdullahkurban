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

- Operational modules use team-scoped Cloud records with server-enforced apprentice ownership; financial writes remain master-only.
- Keep home-screen metadata and register generated offline caching only in published, top-level production contexts.
- Queue writes in IndexedDB by signed-in identity using stable record IDs; never send another identity's pending records.
- PIN and platform credentials are a local session privacy lock, not authorization; Cloud policies remain authoritative.
