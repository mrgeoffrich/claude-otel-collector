import type { ConversationMessageResponse } from "@claude-otel/lib";
import { Badge } from "@/components/ui/badge";

export function SystemMessage({ message }: { message: ConversationMessageResponse }) {
  return (
    <div className="rounded-lg bg-muted/20 px-4 py-2 border border-border/50">
      <div className="flex items-center gap-2">
        <p className="text-xs text-muted-foreground">{message.textContent || "System"}</p>
        {message.model && <Badge variant="secondary">{message.model.replace("claude-", "").split("-202")[0]}</Badge>}
      </div>
    </div>
  );
}
