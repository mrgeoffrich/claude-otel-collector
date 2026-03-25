import type { ConversationMessageResponse } from "@claude-otel/lib";

export function ToolSummaryMessage({ message }: { message: ConversationMessageResponse }) {
  return (
    <div className="border-l-4 border-amber-500 bg-card rounded-lg px-4 py-3 ring-1 ring-foreground/10">
      <p className="text-xs font-medium text-muted-foreground mb-1">Tool Summary</p>
      <p className="text-sm text-muted-foreground">{message.toolSummary}</p>
    </div>
  );
}
