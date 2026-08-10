/**
 * Mirrors the real dashboard's block order and sizing so the transition into
 * loaded content doesn't visibly reflow: KPI row, portfolio health, volume +
 * side rail, then the credit lists.
 */
export default function DashboardLoading() {
  return (
    <div className="min-h-full bg-[color:var(--surface-0)] p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="skeleton-dark h-7 w-44 rounded-lg" />
            <div className="skeleton-dark h-3.5 w-32 rounded" />
          </div>
          <div className="skeleton-dark h-9 w-28 rounded-lg" />
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="surface-card space-y-3 p-4">
              <div className="skeleton-dark h-3 w-24 rounded" />
              <div className="skeleton-dark h-6 w-28 rounded" />
              <div className="skeleton-dark h-3 w-32 rounded" />
            </div>
          ))}
        </div>

        {/* Portfolio health */}
        <div className="surface-card flex flex-col gap-6 p-5 sm:flex-row sm:items-center sm:gap-7">
          <div className="skeleton-dark h-[148px] w-[148px] shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-4">
            <div className="skeleton-dark h-3.5 w-40 rounded" />
            <div className="skeleton-dark h-2 w-full rounded-full" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="skeleton-dark h-3 w-16 rounded" />
                  <div className="skeleton-dark h-4 w-20 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Volume + side rail */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="surface-card space-y-4 p-5 lg:col-span-2">
            <div className="space-y-2">
              <div className="skeleton-dark h-3.5 w-28 rounded" />
              <div className="skeleton-dark h-3 w-56 rounded" />
            </div>
            <div className="skeleton-dark h-[180px] w-full rounded-lg" />
            <div className="grid grid-cols-3 gap-4 pt-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="skeleton-dark h-3 w-16 rounded" />
                  <div className="skeleton-dark h-4 w-20 rounded" />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="surface-card space-y-2 p-4">
              <div className="skeleton-dark mb-2 h-3 w-24 rounded" />
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="skeleton-dark h-9 w-full rounded-lg" />
              ))}
            </div>
            <div className="surface-card grid grid-cols-2 gap-4 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="skeleton-dark h-3 w-16 rounded" />
                  <div className="skeleton-dark h-4 w-12 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Credit lists */}
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="surface-card overflow-hidden">
            <div className="border-b border-[color:var(--hairline)] px-5 py-3.5">
              <div className="skeleton-dark h-3.5 w-32 rounded" />
            </div>
            <div className="divide-y divide-[color:var(--hairline)]">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="skeleton-dark h-1.5 w-1.5 shrink-0 rounded-full" />
                    <div className="space-y-1.5">
                      <div className="skeleton-dark h-3.5 w-32 rounded" />
                      <div className="skeleton-dark h-3 w-24 rounded" />
                    </div>
                  </div>
                  <div className="skeleton-dark h-4 w-20 shrink-0 rounded" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
