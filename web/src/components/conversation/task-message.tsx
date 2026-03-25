import type { ConversationMessageResponse } from "@claude-otel/lib";

export function TaskMessage({ message }: { message: ConversationMessageResponse }) {
  const isStarted = message.role === "task_started";
  const statusLabel = isStarted
    ? "Sub-task started"
    : `Sub-task ${message.taskStatus || "completed"}`;

  return (
    <div className="inline-flex items-center gap-1.5 rounded-md bg-blue-500/10 px-2.5 py-1 text-[11px] text-blue-400">
      <span className="font-medium">{statusLabel}</span>
      {message.textContent && (
        <>
          <span className="text-blue-400/40">·</span>
          <span className="text-muted-foreground">{message.textContent}</span>
        </>
      )}
      {!isStarted && message.durationMs != null && (
        <>
          <span className="text-blue-400/40">·</span>
          <span className="text-muted-foreground">
            {(message.durationMs / 1000).toFixed(1)}s
          </span>
        </>
      )}
    </div>
  );
}
