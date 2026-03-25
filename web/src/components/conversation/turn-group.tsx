import type { ReactNode } from "react";

interface TurnGroupProps {
  turnNumber: number;
  isLast?: boolean;
  children: ReactNode;
}

export function TurnGroup({ turnNumber, isLast, children }: TurnGroupProps) {
  return (
    <div className="relative pl-6">
      {/* Timeline spine */}
      {!isLast && (
        <div className="absolute left-[5px] top-[10px] bottom-0 w-0.5 bg-green-500/40 rounded-full" />
      )}
      {/* Timeline dot */}
      <div className="absolute left-0 top-[3px] size-[11px] rounded-full bg-green-500 ring-2 ring-background" />

      {/* Turn header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-semibold text-muted-foreground">Turn {turnNumber}</span>
      </div>

      {/* Turn content */}
      <div className="space-y-2.5 pb-1">
        {children}
      </div>
    </div>
  );
}

export function SessionEndMarker({ costUsd, durationMs, numTurns }: {
  costUsd?: number | null;
  durationMs?: number | null;
  numTurns?: number | null;
}) {
  return (
    <div className="relative pl-6">
      <div className="absolute left-0 top-[3px] size-[11px] rounded-full bg-blue-500 ring-2 ring-background" />
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-blue-500">Session Complete</span>
        <span className="text-[11px] text-muted-foreground/60">
          {[
            costUsd != null && `$${costUsd < 0.01 ? costUsd.toFixed(4) : costUsd.toFixed(2)}`,
            durationMs != null && `${durationMs < 1000 ? `${Math.round(durationMs)}ms` : `${(durationMs / 1000).toFixed(1)}s`}`,
            numTurns != null && `${numTurns} turns`,
          ].filter(Boolean).join(" · ")}
        </span>
      </div>
    </div>
  );
}
