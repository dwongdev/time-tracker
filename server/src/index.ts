import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import * as admin from 'firebase-admin';

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Firebase Admin for auth token verification
admin.initializeApp({
  projectId: process.env.FIREBASE_PROJECT_ID,
});

// CORS - allow your frontend origins
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    process.env.FRONTEND_URL || '',
  ].filter(Boolean),
  methods: ['POST'],
}));

app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Types
interface TimeBlock {
  startTime: string;
  endTime: string;
  label: string;
  color: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
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
        color: block.color || '#60a5fa',
      })
    );
  } catch {
    return null;
  }
}

function stripScheduleBlock(text: string): string {
  return text.replace(/```schedule\s*\n[\s\S]*?\n```/g, '').trim();
}

// Verify Firebase auth token from Authorization header
async function verifyAuth(req: express.Request): Promise<string> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header');
  }

  const token = authHeader.split('Bearer ')[1];
  const decoded = await admin.auth().verifyIdToken(token);
  return decoded.uid;
}

// AI message endpoint
app.post('/api/ai/message', async (req, res) => {
  try {
    // Verify user is authenticated
    await verifyAuth(req);

    const { messages, timeBlocks } = req.body as {
      messages: ChatMessage[];
      timeBlocks: TimeBlock[];
    };

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: 'Messages array is required' });
      return;
    }

    const claudeApiKey = process.env.CLAUDE_API_KEY;
    if (!claudeApiKey) {
      res.status(500).json({ error: 'AI service not configured' });
      return;
    }

    const scheduleContext = formatScheduleContext(timeBlocks || []);

    const client = new Anthropic({ apiKey: claudeApiKey });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: `${SYSTEM_PROMPT}\n\n${scheduleContext}`,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
    });

    const assistantText =
      response.content[0].type === 'text'
        ? response.content[0].text
        : 'Sorry, I could not generate a response.';

    const parsedBlocks = parseScheduleFromResponse(assistantText);
    const displayMessage = stripScheduleBlock(assistantText);

    res.json({
      message:
        displayMessage ||
        (parsedBlocks ? "Here's a schedule I created for you:" : assistantText),
      timeBlocks: parsedBlocks || undefined,
    });
  } catch (error) {
    console.error('AI endpoint error:', error);

    if (error instanceof Error && error.message.includes('authorization')) {
      res.status(401).json({ error: 'Unauthorized. Please sign in.' });
      return;
    }

    res.status(500).json({ error: 'Failed to communicate with AI assistant' });
  }
});

app.listen(PORT, () => {
  console.log(`DayChart API server running on port ${PORT}`);
});
