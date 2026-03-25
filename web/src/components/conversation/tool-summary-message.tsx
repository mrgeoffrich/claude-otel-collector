import type { ConversationMessageResponse } from "@claude-otel/lib";

export function ToolSummaryMessage({ message }: { message: ConversationMessageResponse }) {
  return (
    <div className="flex items-start gap-2 px-3 py-1.5 rounded-md bg-amber-500/[0.06] text-xs text-muted-foreground">
      <span className="text-amber-500 font-medium shrink-0">Summary</span>
      <span>{message.toolSummary}</span>
    </div>
  );
}
