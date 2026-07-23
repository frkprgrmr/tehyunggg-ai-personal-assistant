"use client";

import { useEffect, useRef, useState, FormEvent, useCallback } from "react";
import { Send, Bot, User, Wrench, Loader2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface ConversationMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  createdAt: string;
}

interface ToolCallResult {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
}

interface ChatResponse {
  message: string;
  toolCalls?: ToolCallResult[];
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load history on mount
  useEffect(() => {
    fetch("/api/chat/history")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setMessages(data);
      })
      .catch(console.error)
      .finally(() => setHistoryLoading(false));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
    setLoading(true);

    // Optimistically add user message
    const optimisticMsg: ConversationMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const data: ChatResponse = await res.json();

      if (res.ok) {
        const newMessages: ConversationMessage[] = [];

        // Add tool call result if present
        if (data.toolCalls && data.toolCalls.length > 0) {
          newMessages.push({
            id: `tool-${Date.now()}`,
            role: "tool",
            content: JSON.stringify(data.toolCalls),
            createdAt: new Date().toISOString(),
          });
        }

        // Add assistant message
        newMessages.push({
          id: `asst-${Date.now()}`,
          role: "assistant",
          content: data.message,
          createdAt: new Date().toISOString(),
        });

        setMessages((prev) => [...prev, ...newMessages]);
      } else {
        // Add error message
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: "assistant",
            content: `⚠️ Error: ${data.message || "Gagal memproses pesan."}`,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "⚠️ Gagal menghubungi server. Coba lagi.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] lg:h-[calc(100vh-4rem)] max-w-3xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg shadow-brand-600/20">
            <Bot size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Tehyungggg</h1>
            <p className="text-xs text-white/40">AI Personal Assistant — Chat</p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 scrollbar-thin">
        {historyLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-white/20" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500/20 to-brand-700/20 border border-brand-500/10 flex items-center justify-center mb-4">
              <Bot size={32} className="text-brand-400" />
            </div>
            <h2 className="text-lg font-semibold text-white/70 mb-1">Halo! 👋</h2>
            <p className="text-sm text-white/40 max-w-sm">
              Aku Tehyungggg, Chief of Staff pribadimu. Mau ngapain hari ini?
              Coba ketik perintah seperti:
            </p>
            <div className="mt-4 space-y-2">
              {[
                '"Besok follow up Jorge."',
                '"Tampilkan semua task yang belum selesai."',
                '"Task migrasi Odoo udah kelar."',
              ].map((example) => (
                <button
                  key={example}
                  onClick={() => setInput(example.replace(/"/g, ""))}
                  className="block w-full text-left px-4 py-2.5 rounded-xl bg-surface-50 border border-white/[0.06] text-sm text-white/50 hover:text-white/80 hover:bg-surface-100 hover:border-white/[0.1] transition-all cursor-pointer"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))
        )}

        {/* Loading indicator */}
        {loading && (
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-brand-600/15 border border-brand-500/15 flex items-center justify-center">
              <Bot size={16} className="text-brand-400" />
            </div>
            <div className="bg-surface-50 border border-white/[0.06] rounded-2xl rounded-tl-md px-4 py-3">
              <div className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-brand-400" />
                <span className="text-sm text-white/40">Lagi mikir...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 border-t border-white/[0.06] pt-4">
        <form onSubmit={handleSubmit} className="flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                // Auto-resize textarea
                const el = e.target;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 150) + "px";
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ketik pesan..."
              rows={1}
              style={{ maxHeight: "150px" }}
              className="w-full bg-surface-50 border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-brand-500/40 focus:ring-1 focus:ring-brand-500/20 resize-none transition-colors overflow-y-auto"
              disabled={loading}
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="flex-shrink-0 w-11 h-11 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-30 disabled:hover:bg-brand-600 flex items-center justify-center transition-all cursor-pointer disabled:cursor-not-allowed shadow-lg shadow-brand-600/20"
          >
            <Send size={16} className="text-white" />
          </button>
        </form>
        <p className="text-[10px] text-white/20 text-center mt-2">
          Tehyungggg bisa salah. Selalu verifikasi informasi penting.
        </p>
      </div>
    </div>
  );
}

// ─── Message Bubble Component ──────────────────────────

function MessageBubble({ message }: { message: ConversationMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex items-start gap-3 justify-end">
        <div className="max-w-[80%]">
          <div className="bg-brand-600/20 border border-brand-500/15 rounded-2xl rounded-tr-md px-4 py-3">
            <p className="text-sm text-white whitespace-pre-wrap">{message.content}</p>
          </div>
          <p className="text-[10px] text-white/20 text-right mt-1 mr-1">
            {format(new Date(message.createdAt), "HH:mm", { locale: idLocale })}
          </p>
        </div>
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-surface-100 border border-white/[0.08] flex items-center justify-center">
          <User size={16} className="text-white/50" />
        </div>
      </div>
    );
  }

  if (message.role === "tool") {
    let toolCalls: ToolCallResult[] = [];
    try {
      toolCalls = JSON.parse(message.content);
    } catch {
      return null;
    }

    return (
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-yellow-500/10 border border-yellow-500/15 flex items-center justify-center">
          <Wrench size={14} className="text-yellow-400" />
        </div>
        <div className="max-w-[80%] space-y-2">
          {toolCalls.map((tc, i) => (
            <ToolCallCard key={i} toolCall={tc} />
          ))}
        </div>
      </div>
    );
  }

  // assistant
  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-brand-600/15 border border-brand-500/15 flex items-center justify-center">
        <Bot size={16} className="text-brand-400" />
      </div>
      <div className="max-w-[80%]">
        <div className="bg-surface-50 border border-white/[0.06] rounded-2xl rounded-tl-md px-4 py-3">
          <p className="text-sm text-white/80 whitespace-pre-wrap">{message.content}</p>
        </div>
        <p className="text-[10px] text-white/20 mt-1 ml-1">
          {format(new Date(message.createdAt), "HH:mm", { locale: idLocale })}
        </p>
      </div>
    </div>
  );
}

// ─── Tool Call Card Component ──────────────────────────

function ToolCallCard({ toolCall }: { toolCall: ToolCallResult }) {
  const result = toolCall.result as Record<string, unknown>;
  const isError = "error" in result;

  const toolLabels: Record<string, string> = {
    createTask: "✅ Task Dibuat",
    updateTask: "📝 Task Diupdate",
    deleteTask: "🗑️ Task Dihapus",
    searchTask: "🔍 Pencarian Task",
    searchProject: "📂 Pencarian Project",
    createReminder: "🔔 Reminder Dibuat",
    listReminders: "📋 Daftar Reminder",
    dismissReminder: "✅ Reminder Dismissed",
  };

  const label = toolLabels[toolCall.name] || toolCall.name;

  if (toolCall.name === "searchTask") {
    const tasks = result as unknown as Array<{ id: string; title: string; status: string }>;
    return (
      <div className="bg-surface-50 border border-white/[0.06] rounded-xl px-3 py-2">
        <p className="text-xs font-medium text-white/50 mb-1.5">{label}</p>
        {Array.isArray(tasks) && tasks.length > 0 ? (
          <div className="space-y-1">
            {tasks.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-xs text-white/60">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    t.status === "Done"
                      ? "bg-green-400"
                      : t.status === "InProgress"
                      ? "bg-blue-400"
                      : "bg-white/30"
                  }`}
                />
                <span className="truncate">{t.title}</span>
              </div>
            ))}
            {tasks.length > 5 && (
              <p className="text-[10px] text-white/30">
                ...dan {tasks.length - 5} task lainnya
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-white/30">Tidak ada task ditemukan.</p>
        )}
      </div>
    );
  }

  return (
    <div
      className={`border rounded-xl px-3 py-2 ${
        isError
          ? "bg-danger/5 border-danger/15"
          : "bg-surface-50 border-white/[0.06]"
      }`}
    >
      <p className="text-xs font-medium text-white/50">{label}</p>
      {!isError && "title" in result && (
        <p className="text-xs text-white/70 mt-0.5">{String(result.title)}</p>
      )}
      {!isError && "deletedTitle" in result && (
        <p className="text-xs text-white/70 mt-0.5">{String(result.deletedTitle)}</p>
      )}
      {isError && (
        <p className="text-xs text-danger/70 mt-0.5">{String(result.error)}</p>
      )}
    </div>
  );
}
