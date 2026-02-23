import { useState, useRef, useEffect, useCallback } from 'react';
import type { TimeBlock } from '../types/schedule';
import { sendMessage } from '../services/aiService';
import type { ChatMessage } from '../services/aiService';
import { formatTo12Hour } from '../utils/timeUtils';

interface AIAssistantProps {
  timeBlocks: TimeBlock[];
  onApplySchedule: (timeBlocks: TimeBlock[]) => void;
  scheduleName: string;
}

interface DisplayMessage {
  role: 'user' | 'assistant';
  content: string;
  timeBlocks?: TimeBlock[];
  timestamp: Date;
}

export default function AIAssistant({ timeBlocks, onApplySchedule, scheduleName }: AIAssistantProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>([
    {
      role: 'assistant',
      content: `Hi! I'm your AI scheduling assistant. I can help you plan your day, suggest schedule improvements, or create a new schedule from scratch.\n\nYou currently have ${timeBlocks.length} time block${timeBlocks.length !== 1 ? 's' : ''} in "${scheduleName}". How can I help?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    setError(null);
    const userMessage: DisplayMessage = {
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Build chat history for API (exclude the initial greeting)
    const chatHistory: ChatMessage[] = messages
      .filter((_, i) => i > 0) // skip greeting
      .map((m) => ({ role: m.role, content: m.content }));
    chatHistory.push({ role: 'user', content: trimmed });

    try {
      const response = await sendMessage(chatHistory, timeBlocks);

      const assistantMessage: DisplayMessage = {
        role: 'assistant',
        content: response.message,
        timeBlocks: response.timeBlocks,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Something went wrong';
      setError(errorMsg);
      const errorMessage: DisplayMessage = {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${errorMsg}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleApplySchedule = (blocks: TimeBlock[]) => {
    if (confirm('This will replace your current schedule with the AI-generated one. Continue?')) {
      onApplySchedule(blocks);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Schedule applied! Switch to the Schedule Editor to see your new time blocks.',
          timestamp: new Date(),
        },
      ]);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-sm">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">AI Assistant</h2>
            <p className="text-xs text-gray-500">Powered by Claude</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-800 shadow-sm'
              }`}
            >
              <div className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</div>

              {/* Schedule Preview */}
              {msg.timeBlocks && msg.timeBlocks.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Suggested Schedule
                    </span>
                    <span className="text-xs text-gray-400">
                      {msg.timeBlocks.length} block{msg.timeBlocks.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {msg.timeBlocks.map((block, j) => (
                      <div
                        key={j}
                        className="flex items-center gap-2 text-xs bg-gray-50 rounded-lg px-3 py-2"
                      >
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: block.color }}
                        />
                        <span className="font-medium text-gray-700 flex-1 truncate">
                          {block.label}
                        </span>
                        <span className="text-gray-500 flex-shrink-0">
                          {formatTo12Hour(block.startTime)} - {formatTo12Hour(block.endTime)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => handleApplySchedule(msg.timeBlocks!)}
                    className="mt-3 w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Apply This Schedule
                  </button>
                </div>
              )}

              <div
                className={`text-[10px] mt-1.5 ${
                  msg.role === 'user' ? 'text-blue-200' : 'text-gray-400'
                }`}
              >
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs text-gray-500">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mx-4 sm:mx-6 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs text-red-700 flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Quick Suggestions */}
      {messages.length <= 1 && (
        <div className="px-4 sm:px-6 pb-2 flex-shrink-0">
          <div className="flex flex-wrap gap-2">
            {[
              'Create a productive morning routine',
              'Plan a balanced work day',
              'Help me optimize my current schedule',
              'Suggest a study schedule',
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => {
                  setInput(suggestion);
                  inputRef.current?.focus();
                }}
                className="px-3 py-1.5 text-xs bg-white border border-gray-200 text-gray-600 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 px-4 sm:px-6 py-3 flex-shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your schedule or request a new one..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-gray-400 max-h-32"
            style={{ minHeight: '42px' }}
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="p-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm hover:shadow-md flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
