import type { ConversationMessageResponse } from "@claude-otel/lib";

export function ResultMessage({ message }: { message: ConversationMessageResponse }) {
  // Result messages with errors still render as a visible card
  if (!message.isError) {
    // Non-error results are rendered by SessionEndMarker in the turn layout
    return null;
  }

  return (
    <div className="rounded-lg bg-destructive/10 px-4 py-3">
      <p className="text-xs font-medium text-destructive mb-1">Session Error</p>
      {message.resultText && (
        <p className="text-xs text-destructive/80">{message.resultText}</p>
      )}
    </div>
  );
}
