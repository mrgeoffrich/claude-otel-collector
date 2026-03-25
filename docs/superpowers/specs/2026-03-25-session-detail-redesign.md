# Session Detail Page Redesign

## Goal

Redesign the session detail page from a flat message list into a turn-based timeline that works as both conversation replay and debugging tool.

## Design

### Header
Compact single-line bar: session ID (mono), model badge, version badge left-aligned. Cost, duration, turns, message count right-aligned separated by dots. Separated from conversation by a subtle border.

### Conversation: Turn Timeline
- Messages grouped by turn, separated by user messages (or session start)
- Each turn has a header: "Turn N" with per-turn cost and duration
- Green vertical timeline spine on the left with dots at each turn start
- Session end: blue dot with cumulative stats, no duplicated result text

### Message Types
- **System (init)**: Compact inline pill — "Session started · model"
- **Assistant with text**: Card with green "Assistant" label, markdown-rendered content
- **Assistant tool-only** (no text, just tool calls): Don't render as a separate message — fold into the tool call row
- **Tool calls**: Compact amber row with tool name, expandable to show input JSON on click
- **User**: Card with blue "User" label
- **Result**: Only the final result renders as the session end marker (blue dot). No card.

### What's Removed
- Model badges on every assistant message (shown once in header + system init)
- `stop_reason` badges
- Colored left borders (replaced by timeline spine)
- Result text duplication (the `resultText` field repeats the last assistant message)
- Empty assistant message boxes

## Data Changes

### API: Per-turn cost/duration
The current data only has cumulative cost on the final result message. To show per-turn stats, the frontend will compute turn boundaries from the message sequence (turns are separated by user messages). Per-turn cost is not available from the current data, so we'll show it only on the session end marker.

Turn headers will show "Turn N" without individual cost — only the final session end shows cumulative totals.

## Files to Change

1. `web/src/pages/session-detail.tsx` — group messages into turns, new header layout
2. `web/src/components/conversation/conversation-message.tsx` — pass turn context
3. `web/src/components/conversation/assistant-message.tsx` — remove model badge, new card style
4. `web/src/components/conversation/user-message.tsx` — new card style
5. `web/src/components/conversation/system-message.tsx` — compact inline pill
6. `web/src/components/conversation/result-message.tsx` — replace with session end marker
7. `web/src/components/conversation/tool-summary-message.tsx` — compact amber row style
8. New: `web/src/components/conversation/turn-group.tsx` — turn wrapper with timeline spine
