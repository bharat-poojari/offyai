import React, { useState } from "react";
import Input from "../ui/input";
import Button from "../ui/Button";
import { Send, Loader2 } from "lucide-react";

export const ChatInput = ({
  sendMessage,
  isLoading,
  placeholder = "Type your message...",
  currentChat,
}) => {
  const [message, setMessage] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    sendMessage(message);
    setMessage("");
  };

  const effectivePlaceholder = currentChat
    ? placeholder
    : "Create a new chat to start messaging...";

  return (
    <form
      onSubmit={handleSubmit}
      className="
        border-t border-[var(--border)]
        bg-[var(--header-bg)]
        px-3 py-3
        backdrop-blur-xl
        sm:px-4
      "
    >
      <div
        className="
          mx-auto flex max-w-4xl items-center gap-2
          rounded-2xl
          border border-[var(--border)]
          bg-[var(--surface-raised)]
          p-1.5
          shadow-[0_8px_30px_rgba(31,30,28,0.06)]
          transition-colors duration-200
          focus-within:border-[var(--primary)]/50
          focus-within:bg-[var(--surface)]
        "
      >
        <Input
          placeholder={effectivePlaceholder}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={isLoading || !currentChat}
          className="
            flex-1
            mr-0
            !border-0
            !bg-transparent
            !shadow-none
            focus:!ring-0
            focus:!outline-none
          "
        />

        <Button
          type="submit"
          disabled={
            isLoading || !message.trim() || !currentChat
          }
          className="
            shrink-0
            !flex
            !h-10
            !w-10
            !items-center
            !justify-center
            !rounded-xl
            !p-0
            !bg-[var(--primary)]
            !text-[var(--primary-foreground)]
            !shadow-sm
            !shadow-[color:rgba(15,156,143,0.18)]
            transition-all duration-200
            hover:!bg-[var(--primary-hover)]
            hover:!shadow-md
            hover:!shadow-[color:rgba(15,156,143,0.22)]
            active:!scale-95
            disabled:!cursor-not-allowed
            disabled:!opacity-35
            disabled:hover:!bg-[var(--primary)]
            disabled:hover:!shadow-sm
          "
          aria-label={isLoading ? "Sending message" : "Send message"}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </form>
  );
};

