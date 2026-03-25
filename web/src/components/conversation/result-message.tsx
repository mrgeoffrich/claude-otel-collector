import type { ConversationMessageResponse } from "@claude-otel/lib";
import { formatCost, formatDuration } from "@/lib/format";

export function ResultMessage({ message }: { message: ConversationMessageResponse }) {
  const isError = message.isError === true;

  return (
    <div className={`rounded-lg px-4 py-3 ${isError ? "bg-destructive/10" : "bg-muted/30"}`}>
      <p className={`text-xs font-medium mb-1 ${isError ? "text-destructive" : "text-muted-foreground"}`}>
        {isError ? "Session Error" : "Session Complete"}
      </p>
      <div className="flex items-center gap-4 text-sm">
        {message.costUsd != null && (
          <span className="text-muted-foreground">Cost: <span className="text-foreground font-medium">{formatCost(message.costUsd)}</span></span>
        )}
        {message.durationMs != null && (
          <span className="text-muted-foreground">Duration: <span className="text-foreground font-medium">{formatDuration(message.durationMs)}</span></span>
        )}
        {message.numTurns != null && (
          <span className="text-muted-foreground">Turns: <span className="text-foreground font-medium">{message.numTurns}</span></span>
        )}
      </div>
      {message.resultText && (
        <p className="mt-2 text-xs text-muted-foreground">{message.resultText}</p>
      )}
    </div>
  );
}
