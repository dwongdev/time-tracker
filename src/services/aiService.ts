import type { TimeBlock } from '../types/schedule';

const CLAUDE_API_KEY = import.meta.env.VITE_CLAUDE_API_KEY || 'your-claude-api-key-here';
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIScheduleResponse {
  message: string;
  timeBlocks?: TimeBlock[];
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

/**
 * Parse time blocks from AI response text
 */
export const parseScheduleFromResponse = (text: string): TimeBlock[] | null => {
  const scheduleMatch = text.match(/```schedule\s*\n([\s\S]*?)\n```/);
  if (!scheduleMatch) return null;

  try {
    const parsed = JSON.parse(scheduleMatch[1]);
    if (!Array.isArray(parsed)) return null;

    return parsed.map((block: { startTime: string; endTime: string; label: string; color: string }, index: number) => ({
      id: crypto.randomUUID(),
      startTime: block.startTime,
      endTime: block.endTime,
      label: block.label,
      color: block.color || '#60a5fa',
      order: index,
    }));
  } catch {
    return null;
  }
};

/**
 * Strip the schedule JSON block from the message for display
 */
export const stripScheduleBlock = (text: string): string => {
  return text.replace(/```schedule\s*\n[\s\S]*?\n```/g, '').trim();
};

/**
 * Format current schedule as context for the AI
 */
export const formatScheduleContext = (timeBlocks: TimeBlock[]): string => {
  if (timeBlocks.length === 0) {
    return 'The user currently has no time blocks in their schedule.';
  }

  const sorted = [...timeBlocks].sort((a, b) => {
    const [aH, aM] = a.startTime.split(':').map(Number);
    const [bH, bM] = b.startTime.split(':').map(Number);
    return aH * 60 + aM - (bH * 60 + bM);
  });

  const lines = sorted.map(
    (b) => `- ${b.startTime} to ${b.endTime}: ${b.label}`
  );

  return `The user's current schedule:\n${lines.join('\n')}`;
};

/**
 * Send a message to the Claude API
 */
export const sendMessage = async (
  messages: ChatMessage[],
  currentTimeBlocks: TimeBlock[]
): Promise<AIScheduleResponse> => {
  if (CLAUDE_API_KEY === 'your-claude-api-key-here') {
    throw new Error(
      'Claude API key not configured. Add VITE_CLAUDE_API_KEY to your .env file.'
    );
  }

  const scheduleContext = formatScheduleContext(currentTimeBlocks);

  const apiMessages = messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  try {
    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: `${SYSTEM_PROMPT}\n\n${scheduleContext}`,
        messages: apiMessages,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        errorData?.error?.message || `API request failed with status ${response.status}`
      );
    }

    const data = await response.json();
    const assistantText =
      data.content?.[0]?.text || 'Sorry, I could not generate a response.';

    const timeBlocks = parseScheduleFromResponse(assistantText);
    const displayMessage = stripScheduleBlock(assistantText);

    return {
      message: displayMessage || (timeBlocks ? 'Here\'s a schedule I created for you:' : assistantText),
      timeBlocks: timeBlocks || undefined,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to communicate with AI assistant');
  }
};
