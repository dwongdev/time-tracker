import { auth } from '../firebase';
import type { TimeBlock } from '../types/schedule';

// API base URL: Railway in production, local dev server otherwise
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIScheduleResponse {
  message: string;
  timeBlocks?: Array<{
    startTime: string;
    endTime: string;
    label: string;
    color: string;
  }>;
}

/**
 * Get the current user's Firebase auth token for API requests
 */
async function getAuthToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Please sign in to use the AI assistant.');
  }
  return user.getIdToken();
}

/**
 * Send a message to the AI assistant via backend proxy
 */
export const sendMessage = async (
  messages: ChatMessage[],
  currentTimeBlocks: TimeBlock[]
): Promise<{ message: string; timeBlocks?: TimeBlock[] }> => {
  const token = await getAuthToken();

  try {
    const response = await fetch(`${API_BASE_URL}/api/ai/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        messages,
        timeBlocks: currentTimeBlocks,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      if (response.status === 401) {
        throw new Error('Please sign in to use the AI assistant.');
      }
      throw new Error(
        errorData?.error || `API request failed with status ${response.status}`
      );
    }

    const data = await response.json();

    // Add client-side IDs and order to returned time blocks
    const enrichedBlocks = data.timeBlocks?.map(
      (block: { startTime: string; endTime: string; label: string; color: string }, index: number) => ({
        id: crypto.randomUUID(),
        startTime: block.startTime,
        endTime: block.endTime,
        label: block.label,
        color: block.color || '#60a5fa',
        order: index,
      })
    );

    return {
      message: data.message,
      timeBlocks: enrichedBlocks,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to communicate with AI assistant');
  }
};
