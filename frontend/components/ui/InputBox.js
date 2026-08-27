import React, {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  FiSend,
  FiCornerDownLeft,
} from "react-icons/fi";

export default function InputBox({
  value,
  onChange,
  onSend,
  disabled = false,
}) {
  const textareaRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);

  const hasText = Boolean(value?.trim());

  /* ---------------------------------------------------------------------- */
  /* AUTO RESIZE                                                            */
  /* ---------------------------------------------------------------------- */

  const resizeTextarea = () => {
    const textarea = textareaRef.current;

    if (!textarea) return;

    textarea.style.height = "auto";

    const maxHeight = 180;
    const nextHeight = Math.min(
      textarea.scrollHeight,
      maxHeight
    );

    textarea.style.height = `${nextHeight}px`;

    textarea.style.overflowY =
      textarea.scrollHeight > maxHeight
        ? "auto"
        : "hidden";
  };

  useEffect(() => {
    resizeTextarea();
  }, [value]);

  /* ---------------------------------------------------------------------- */
  /* SEND                                                                   */
  /* ---------------------------------------------------------------------- */

  const handleSend = () => {
    if (disabled || !hasText) return;

    onSend?.();
  };

  /* ---------------------------------------------------------------------- */
  /* KEYBOARD                                                               */
  /* ---------------------------------------------------------------------- */

  const handleKeyDown = (event) => {
    /*
     * Enter     -> Send
     * Shift+Enter -> New line
     */

    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      handleSend();
    }
  };

  /* ---------------------------------------------------------------------- */
  /* RENDER                                                                 */
  /* ---------------------------------------------------------------------- */

  return (
    <div
      className="
        relative
        shrink-0
        border-t
        border-gray-200/70
        bg-white/80
        px-3
        pb-3
        pt-2.5
        backdrop-blur-xl
        dark:border-gray-800/80
        dark:bg-gray-950/80
        sm:px-4
        sm:pb-4
      "
    >
      {/* ------------------------------------------------------------------ */}
      {/* COMPOSER                                                           */}
      {/* ------------------------------------------------------------------ */}

      <div
        className={`
          relative
          mx-auto
          w-full
          max-w-4xl
          rounded-2xl
          border
          bg-white
          shadow-sm
          transition-all
          duration-200
          dark:bg-gray-900
          ${
            isFocused
              ? `
                border-blue-400
                shadow-[0_0_0_3px_rgba(59,130,246,0.10)]
                dark:border-blue-500/70
                dark:shadow-[0_0_0_3px_rgba(59,130,246,0.10)]
              `
              : `
                border-gray-200
                hover:border-gray-300
                dark:border-gray-700
                dark:hover:border-gray-600
              `
          }
        `}
      >
        {/* -------------------------------------------------------------- */}
        {/* TEXTAREA                                                        */}
        {/* -------------------------------------------------------------- */}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={disabled}
          rows={1}
          spellCheck
          aria-label="Message"
          placeholder={
            disabled
              ? "Waiting for response..."
              : "Message OffyAI..."
          }
          className="
            block
            w-full
            resize-none
            overflow-hidden
            bg-transparent
            px-4
            pb-12
            pt-3.5
            text-sm
            leading-6
            text-gray-900
            outline-none
            placeholder:text-gray-400
            disabled:cursor-not-allowed
            disabled:opacity-60
            dark:text-gray-100
            dark:placeholder:text-gray-500
          "
          style={{
            minHeight: "58px",
            maxHeight: "180px",
          }}
        />

        {/* -------------------------------------------------------------- */}
        {/* BOTTOM TOOLBAR                                                  */}
        {/* -------------------------------------------------------------- */}

        <div
          className="
            pointer-events-none
            absolute
            bottom-2
            left-3
            right-3
            flex
            items-center
            justify-between
          "
        >
          {/* Keyboard hint */}
          <div
            className="
              hidden
              items-center
              gap-1.5
              text-[10px]
              text-gray-400
              dark:text-gray-500
              sm:flex
            "
          >
            <span
              className="
                inline-flex
                items-center
                gap-1
                rounded-md
                border
                border-gray-200
                bg-gray-50
                px-1.5
                py-0.5
                font-medium
                dark:border-gray-700
                dark:bg-gray-800
              "
            >
              <FiCornerDownLeft className="h-3 w-3" />
              Enter
            </span>

            <span>to send</span>

            <span className="mx-0.5 text-gray-300 dark:text-gray-700">
              ·
            </span>

            <span>Shift + Enter for newline</span>
          </div>

          {/* Mobile hint */}
          <div
            className="
              flex
              items-center
              text-[10px]
              text-gray-400
              dark:text-gray-500
              sm:hidden
            "
          >
            Shift + Enter for newline
          </div>

          {/* ------------------------------------------------------------ */}
          {/* SEND BUTTON                                                   */}
          {/* ------------------------------------------------------------ */}

          <button
            type="button"
            onClick={handleSend}
            disabled={
              disabled || !hasText
            }
            aria-label={
              disabled
                ? "Sending message"
                : "Send message"
            }
            title={
              disabled
                ? "Please wait"
                : hasText
                  ? "Send message"
                  : "Type a message first"
            }
            className={`
              pointer-events-auto
              group
              flex
              h-8
              w-8
              shrink-0
              items-center
              justify-center
              rounded-xl
              transition-all
              duration-200
              focus:outline-none
              focus-visible:ring-2
              focus-visible:ring-blue-500
              focus-visible:ring-offset-2
              dark:focus-visible:ring-offset-gray-900
              ${
                disabled
                  ? `
                    cursor-not-allowed
                    bg-gray-100
                    text-gray-400
                    dark:bg-gray-800
                    dark:text-gray-600
                  `
                  : !hasText
                    ? `
                      cursor-not-allowed
                      bg-gray-100
                      text-gray-400
                      dark:bg-gray-800
                      dark:text-gray-600
                    `
                    : `
                      bg-blue-600
                      text-white
                      shadow-sm
                      shadow-blue-600/20
                      hover:-translate-y-0.5
                      hover:bg-blue-700
                      hover:shadow-md
                      hover:shadow-blue-600/25
                      active:translate-y-0
                      active:scale-95
                      dark:bg-blue-600
                      dark:hover:bg-blue-500
                    `
              }
            `}
          >
            {disabled ? (
              <span
                className="
                  h-3.5
                  w-3.5
                  animate-spin
                  rounded-full
                  border-2
                  border-gray-300
                  border-t-gray-500
                  dark:border-gray-600
                  dark:border-t-gray-300
                "
              />
            ) : (
              <FiSend
                className="
                  h-3.5
                  w-3.5
                  transition-transform
                  duration-200
                  group-hover:-translate-y-0.5
                  group-hover:translate-x-0.5
                "
              />
            )}
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* FOOTNOTE                                                            */}
      {/* ------------------------------------------------------------------ */}

      <div
        className="
          mx-auto
          mt-1.5
          hidden
          max-w-4xl
          text-center
          text-[9px]
          text-gray-400
          dark:text-gray-600
          sm:block
        "
      >
        OffyAI can make mistakes. Verify important information.
      </div>
    </div>
  );
}