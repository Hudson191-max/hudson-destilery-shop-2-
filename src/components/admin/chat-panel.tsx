"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessagesSquare } from "lucide-react";

interface ChatMessage {
  id: number;
  author: string;
  content: string;
  created_at: number;
}

interface ChatPanelProps {
  currentUser: string;
}

export function ChatPanel({ currentUser }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const firstLoadDoneRef = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = useCallback(async () => {
    try {
      // Only the first load gets a loading state — background polls stay
      // silent so the transcript doesn't flicker every couple of seconds.
      if (!firstLoadDoneRef.current) setLoading(true);
      const data = await api<ChatMessage[]>("/api/admin/chat/messages?limit=100");
      setMessages(data);
      firstLoadDoneRef.current = true;
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + polling that pauses while the tab is hidden. Staff leave
  // this panel open in a background tab all shift — no point asking the
  // server for messages nobody can see. Polling resumes with an immediate
  // refresh the moment the tab becomes visible again.
  useEffect(() => {
    let paused = document.hidden;
    fetchMessages();
    pollIntervalRef.current = setInterval(() => {
      if (!paused) void fetchMessages();
    }, 2000);

    const onVisibility = () => {
      paused = document.hidden;
      if (!paused) void fetchMessages();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchMessages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    try {
      setSending(true);
      await api("/api/admin/chat/send", {
        method: "POST",
        body: { content: input },
      });
      setInput("");
      await fetchMessages(); // Refresh messages immediately
    } catch (err) {
      toast("Failed to send message", "err");
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-lg border bg-[var(--bg1)] border-[var(--border)]"
      style={{ boxShadow: "var(--shadow, 0 10px 30px rgba(0,0,0,.25))" }}
      aria-label="Staff chat"
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--bg2)] px-4 py-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ background: "var(--accent-soft)" }}
          aria-hidden="true"
        >
          <MessagesSquare size={17} className="text-[var(--accent)]" />
        </span>
        <div className="min-w-0">
          <h3
            className="font-semibold leading-tight text-[var(--text0)]"
            style={{ fontFamily: "var(--font-head)" }}
          >
            Staff Chat
          </h3>
          <p className="text-xs text-[var(--text2)]">
            Real-time messaging without Discord
          </p>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && !loading && (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-8 text-center">
            <span
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: "var(--accent-soft)" }}
              aria-hidden="true"
            >
              <MessagesSquare size={24} className="text-[var(--accent)]" />
            </span>
            <p
              className="text-sm font-semibold text-[var(--text1)]"
              style={{ fontFamily: "var(--font-head)", letterSpacing: 1 }}
            >
              NO MESSAGES YET
            </p>
            <p className="max-w-56 text-xs leading-relaxed text-[var(--text2)]">
              Start the conversation — everyone on shift sees it instantly.
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const isOwn = msg.author === currentUser;
          const timestamp = new Date(msg.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <div
              key={msg.id}
              className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-xs rounded-2xl px-3.5 py-2 ${
                  isOwn
                    ? "rounded-br-md text-[#1a1508]"
                    : "rounded-bl-md border border-[var(--border2)] bg-[var(--bg3)] text-[var(--text0)]"
                }`}
                style={
                  isOwn
                    ? {
                        background:
                          "linear-gradient(135deg, var(--accent2), var(--accent))",
                      }
                    : undefined
                }
              >
                {!isOwn && (
                  <p
                    className="mb-1 text-xs font-semibold text-[var(--accent)]"
                    style={{ letterSpacing: 0.4 }}
                  >
                    {msg.author}
                  </p>
                )}
                <p className="text-sm break-words">{msg.content}</p>
                <p
                  className={`mt-1 text-[11px] ${
                    isOwn ? "text-[#1a1508]/60" : "text-[var(--text2)]"
                  }`}
                >
                  {timestamp}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="border-t border-[var(--border)] bg-[var(--bg2)] px-4 py-3">
        <form onSubmit={handleSend} className="flex gap-2">
          <Input
            type="text"
            placeholder="Type a message…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={sending}
            maxLength={1000}
            className="flex-1"
            aria-label="Chat message"
          />
          <Button type="submit" disabled={sending || !input.trim()} size="sm">
            {sending ? "…" : "Send"}
          </Button>
        </form>
        <p
          className={`mt-2 text-xs ${
            input.length >= 1000 ? "text-[var(--red)]" : "text-[var(--text2)]"
          }`}
        >
          {input.length}/1000
        </p>
      </div>
    </div>
  );
}
