import type { ConversationMessageResponse } from "@claude-otel/lib";
import { UserMessage } from "./user-message";
import { AssistantMessage } from "./assistant-message";
import { ResultMessage } from "./result-message";
import { SystemMessage } from "./system-message";
import { ToolSummaryMessage } from "./tool-summary-message";

export function ConversationMessage({ message }: { message: ConversationMessageResponse }) {
  switch (message.role) {
    case "user":
      return <UserMessage message={message} />;
    case "assistant":
      return <AssistantMessage message={message} />;
    case "result":
      return <ResultMessage message={message} />;
    case "system":
      return <SystemMessage message={message} />;
    case "tool_summary":
      return <ToolSummaryMessage message={message} />;
    default:
      return null;
  }
}
