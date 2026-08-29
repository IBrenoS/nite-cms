export default function MembershipsLoading() {
  return (
    <main aria-busy="true" className="grid gap-5">
      <div className="h-9 w-48 animate-pulse rounded bg-nite-section" />
      <div className="h-72 animate-pulse rounded-xl border border-nite-border-subtle bg-nite-section" />
    </main>
  );
}
