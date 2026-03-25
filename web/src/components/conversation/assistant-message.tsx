import { useState } from "react";
import type { ConversationMessageResponse, ToolCallEntry } from "@claude-otel/lib";
import ReactMarkdown from "react-markdown";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";

export function AssistantMessage({ message }: { message: ConversationMessageResponse }) {
  let toolCalls: ToolCallEntry[] = [];
  if (message.toolCalls) {
    try {
      toolCalls = JSON.parse(message.toolCalls);
    } catch {
      // Ignore parse errors
    }
  }

  return (
    <div className="border-l-4 border-green-500 bg-card rounded-lg px-4 py-3 ring-1 ring-foreground/10">
      <div className="flex items-center gap-2 mb-1">
        <p className="text-xs font-medium text-muted-foreground">Assistant</p>
        {message.model && <Badge variant="secondary">{message.model.replace("claude-", "").split("-202")[0]}</Badge>}
        {message.stopReason === "tool_use" && <Badge variant="outline">tool_use</Badge>}
      </div>
      {message.textContent && (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown>{message.textContent}</ReactMarkdown>
        </div>
      )}
      {toolCalls.length > 0 && (
        <div className="mt-3 space-y-2">
          {toolCalls.map((tc) => (
            <ToolCallBlock key={tc.id} toolCall={tc} />
          ))}
        </div>
      )}
    </div>
  );
}

function ToolCallBlock({ toolCall }: { toolCall: ToolCallEntry }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer">
        <ChevronRight className={`size-3 transition-transform ${open ? "rotate-90" : ""}`} />
        <Badge variant="outline">{toolCall.name}</Badge>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="mt-1 ml-5 text-xs bg-muted/30 rounded p-2 overflow-x-auto">
          {JSON.stringify(toolCall.input, null, 2)}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}
