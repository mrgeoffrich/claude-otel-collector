import type { ConversationMessageResponse } from "@claude-otel/lib";

export function SystemMessage({ message }: { message: ConversationMessageResponse }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-md bg-muted/30 px-2.5 py-1 text-[11px] text-muted-foreground">
      <span>{message.textContent || "System"}</span>
      {message.model && (
        <>
          <span className="text-muted-foreground/40">·</span>
          <span>{message.model.replace("claude-", "").split("-202")[0]}</span>
        </>
      )}
    </div>
  );
}
