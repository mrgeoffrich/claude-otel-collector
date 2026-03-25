import type { ConversationMessageResponse } from "@claude-otel/lib";

export function UserMessage({ message }: { message: ConversationMessageResponse }) {
  return (
    <div className="rounded-lg bg-blue-500/[0.06] ring-1 ring-blue-500/10 px-4 py-3">
      <div className="text-[11px] font-medium text-blue-500 mb-2">User</div>
      <p className="whitespace-pre-wrap text-sm">{message.userContent}</p>
    </div>
  );
}
