export default function AgendarLoading() {
  return (
    <div className="booking-shell min-h-dvh">
      <div className="mx-auto max-w-lg px-4 py-6">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 animate-pulse rounded-full bg-[var(--surface-2)]" />
          <div className="flex-1 space-y-2">
            <div className="h-6 w-48 animate-pulse rounded bg-[var(--surface-2)]" />
            <div className="h-4 w-64 animate-pulse rounded bg-[var(--surface-2)]" />
          </div>
        </div>
        <div className="mt-8 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-[72px] animate-pulse rounded-xl bg-[var(--surface-2)]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
