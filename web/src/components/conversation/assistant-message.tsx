import { useState } from "react";
import type { ConversationMessageResponse, ToolCallEntry } from "@claude-otel/lib";
import ReactMarkdown from "react-markdown";
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

  const hasText = !!message.textContent;

  // Tool-only message (no text): render just the tool calls, no card wrapper
  if (!hasText && toolCalls.length > 0) {
    return (
      <div className="space-y-1.5">
        {toolCalls.map((tc) => (
          <ToolCallBlock key={tc.id} toolCall={tc} />
        ))}
      </div>
    );
  }

  // No content at all: skip rendering
  if (!hasText && toolCalls.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg bg-card/60 ring-1 ring-foreground/[0.06] px-4 py-3">
      <div className="text-[11px] font-medium text-green-500 mb-2">Assistant</div>
      <div className="prose prose-sm dark:prose-invert max-w-none text-[13px] leading-relaxed">
        <ReactMarkdown>{message.textContent!}</ReactMarkdown>
      </div>
      {toolCalls.length > 0 && (
        <div className="mt-3 space-y-1.5">
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
      <CollapsibleTrigger className="flex items-center gap-2 w-full text-left px-3 py-1.5 rounded-md bg-amber-500/[0.08] hover:bg-amber-500/[0.12] transition-colors cursor-pointer">
        <ChevronRight className={`size-3 text-amber-500 transition-transform ${open ? "rotate-90" : ""}`} />
        <code className="text-xs text-amber-500">{toolCall.name}</code>
        {!open && toolCall.input && (
          <span className="text-[11px] text-muted-foreground/60 truncate">
            {summarizeInput(toolCall.input)}
          </span>
        )}
        <span className="flex-1" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="mt-1 ml-5 text-[11px] bg-muted/20 rounded-md p-2.5 overflow-x-auto text-muted-foreground">
          {JSON.stringify(toolCall.input, null, 2)}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}

function summarizeInput(input: unknown): string {
  if (!input || typeof input !== "object") return "";
  const obj = input as Record<string, unknown>;
  // Show first string value as a hint
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === "string" && val.length > 0) {
      const preview = val.length > 60 ? val.slice(0, 60) + "…" : val;
      return `${key}: ${preview}`;
    }
  }
  return "";
}
