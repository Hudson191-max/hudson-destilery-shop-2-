"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  const lastMessageIdRef = useRef<number | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api<ChatMessage[]>("/api/admin/chat/messages?limit=100");
      setMessages(data);
      if (data.length > 0) {
        lastMessageIdRef.current = data[data.length - 1].id;
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch and polling setup
  useEffect(() => {
    fetchMessages();
    pollIntervalRef.current = setInterval(fetchMessages, 2000); // Poll every 2 seconds
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
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
      toast.error("Failed to send message");
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-white border-b border-slate-200">
        <h3 className="font-semibold text-slate-900">Staff Chat</h3>
        <p className="text-xs text-slate-500">Real-time messaging without Discord</p>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && !loading && (
          <div className="text-center py-8">
            <p className="text-sm text-slate-500">No messages yet. Start the conversation!</p>
          </div>
        )}

        {messages.map((msg) => {
          const isOwn = msg.author === currentUser;
          const timestamp = new Date(msg.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-xs px-3 py-2 rounded-lg ${
                  isOwn
                    ? "bg-blue-500 text-white rounded-br-none"
                    : "bg-white border border-slate-200 text-slate-900 rounded-bl-none"
                }`}
              >
                {!isOwn && <p className="text-xs font-semibold opacity-70 mb-1">{msg.author}</p>}
                <p className="text-sm break-words">{msg.content}</p>
                <p
                  className={`text-xs mt-1 ${
                    isOwn ? "text-blue-100" : "text-slate-500"
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
      <div className="px-4 py-3 bg-white border-t border-slate-200">
        <form onSubmit={handleSend} className="flex gap-2">
          <Input
            type="text"
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={sending}
            maxLength={1000}
            className="flex-1"
          />
          <Button type="submit" disabled={sending || !input.trim()} size="sm">
            {sending ? "..." : "Send"}
          </Button>
        </form>
        <p className="text-xs text-slate-400 mt-2">{input.length}/1000</p>
      </div>
    </div>
  );
}
