import type { ConversationMessageResponse } from "@claude-otel/lib";

export function UserMessage({ message }: { message: ConversationMessageResponse }) {
  return (
    <div className="border-l-4 border-blue-500 bg-card rounded-lg px-4 py-3 ring-1 ring-foreground/10">
      <p className="text-xs font-medium text-muted-foreground mb-1">User</p>
      <p className="whitespace-pre-wrap text-sm">{message.userContent}</p>
    </div>
  );
}
