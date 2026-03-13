import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import Anthropic from "@anthropic-ai/sdk";

const claudeApiKey = defineSecret("CLAUDE_API_KEY");

interface TimeBlock {
  startTime: string;
  endTime: string;
  label: string;
  color: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface SendAIMessageData {
  messages: ChatMessage[];
  timeBlocks: TimeBlock[];
}

const SYSTEM_PROMPT = `You are a helpful AI scheduling assistant for DayChart, a visual time-blocking app. You help users plan their day by creating and discussing schedules.

When the user asks you to create or suggest a schedule, you MUST respond with a JSON block containing time blocks. Use this exact format embedded in your response:

\`\`\`schedule
[
  {
    "startTime": "HH:MM",
    "endTime": "HH:MM",
    "label": "Activity Name",
    "color": "#hexcolor"
  }
]
\`\`\`

Rules for time blocks:
- Times must be in 24-hour "HH:MM" format, snapped to 5-minute increments (e.g., "07:00", "09:30", "14:15")
- Time blocks must NOT overlap
- Use these colors: #f87171 (red), #60a5fa (blue), #34d399 (green), #fbbf24 (yellow), #a78bfa (purple), #fb923c (orange), #a3e635 (lime), #f472b6 (pink), #38bdf8 (sky), #c084fc (violet)
- Give each block a concise, descriptive label
- Cover the full day if the user asks for a full schedule, or just the requested portion

When NOT creating a schedule, just respond conversationally about time management, productivity tips, or answer questions about their current schedule.

If the user shares their current schedule, analyze it and provide helpful feedback.`;

function formatScheduleContext(timeBlocks: TimeBlock[]): string {
  if (timeBlocks.length === 0) {
    return "The user currently has no time blocks in their schedule.";
  }

  const sorted = [...timeBlocks].sort((a, b) => {
    const [aH, aM] = a.startTime.split(":").map(Number);
    const [bH, bM] = b.startTime.split(":").map(Number);
    return aH * 60 + aM - (bH * 60 + bM);
  });

  const lines = sorted.map(
    (b) => `- ${b.startTime} to ${b.endTime}: ${b.label}`
  );

  return `The user's current schedule:\n${lines.join("\n")}`;
}

function parseScheduleFromResponse(text: string): TimeBlock[] | null {
  const scheduleMatch = text.match(/```schedule\s*\n([\s\S]*?)\n```/);
  if (!scheduleMatch) return null;

  try {
    const parsed = JSON.parse(scheduleMatch[1]);
    if (!Array.isArray(parsed)) return null;

    return parsed.map(
      (block: { startTime: string; endTime: string; label: string; color: string }) => ({
        startTime: block.startTime,
        endTime: block.endTime,
        label: block.label,
        color: block.color || "#60a5fa",
      })
    );
  } catch {
    return null;
  }
}

function stripScheduleBlock(text: string): string {
  return text.replace(/```schedule\s*\n[\s\S]*?\n```/g, "").trim();
}

export const sendAIMessage = onCall(
  {
    secrets: [claudeApiKey],
    maxInstances: 10,
    timeoutSeconds: 60,
  },
  async (request) => {
    // Require authentication
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be signed in to use the AI assistant."
      );
    }

    const { messages, timeBlocks } = request.data as SendAIMessageData;

    if (!messages || !Array.isArray(messages)) {
      throw new HttpsError("invalid-argument", "Messages array is required.");
    }

    const scheduleContext = formatScheduleContext(timeBlocks || []);

    const apiMessages = messages.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));

    try {
      const client = new Anthropic({
        apiKey: claudeApiKey.value(),
      });

      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: `${SYSTEM_PROMPT}\n\n${scheduleContext}`,
        messages: apiMessages,
      });

      const assistantText =
        response.content[0].type === "text"
          ? response.content[0].text
          : "Sorry, I could not generate a response.";

      const parsedBlocks = parseScheduleFromResponse(assistantText);
      const displayMessage = stripScheduleBlock(assistantText);

      return {
        message:
          displayMessage ||
          (parsedBlocks ? "Here's a schedule I created for you:" : assistantText),
        timeBlocks: parsedBlocks || undefined,
      };
    } catch (error) {
      console.error("Claude API error:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError(
        "internal",
        "Failed to communicate with AI assistant. Please try again."
      );
    }
  }
);
