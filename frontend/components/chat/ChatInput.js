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
        border-t border-white/[0.06]
        bg-[#0d1017]/80
        px-3 py-3
        backdrop-blur-xl
        sm:px-4
      "
    >
      <div
        className="
          mx-auto flex max-w-4xl items-center gap-2
          rounded-2xl
          border border-white/[0.07]
          bg-white/[0.025]
          p-1.5
          shadow-[0_8px_30px_rgba(0,0,0,0.12)]
          transition-colors duration-200
          focus-within:border-white/[0.12]
          focus-within:bg-white/[0.035]
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
            !bg-blue-600
            !text-white
            !shadow-sm
            !shadow-blue-950/30
            transition-all duration-200
            hover:!bg-blue-500
            hover:!shadow-md
            hover:!shadow-blue-950/30
            active:!scale-95
            disabled:!cursor-not-allowed
            disabled:!opacity-35
            disabled:hover:!bg-blue-600
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

