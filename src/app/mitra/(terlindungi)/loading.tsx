export default function PanelLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true">
      <div className="h-8 w-48 rounded-lg bg-neutral-soft" />
      <div className="h-4 w-96 rounded bg-neutral-soft" />
      <div className="mt-8 h-64 rounded-[1.75rem] border border-line bg-surface p-8" />
    </div>
  );
}
