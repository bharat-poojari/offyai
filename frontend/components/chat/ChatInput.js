import React, { useState } from "react";
import Input from "../ui/input";
import Button from "../ui/Button";

export const ChatInput = ({ sendMessage, isLoading, placeholder = "Type your message...", currentChat }) => {
  const [message, setMessage] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    sendMessage(message);
    setMessage("");
  };

  const effectivePlaceholder = currentChat ? placeholder : "Create a new chat to start messaging...";

  return (
    <form onSubmit={handleSubmit} className="flex items-center border-t border-gray-700 p-3">
      <Input
        placeholder={effectivePlaceholder}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        disabled={isLoading || !currentChat}
        className="flex-1 mr-2"
      />
      <Button type="submit" disabled={isLoading || !message.trim() || !currentChat}>
        {isLoading ? "Sending..." : "Send"}
      </Button>
    </form>
  );
};