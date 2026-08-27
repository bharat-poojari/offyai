import React from "react";

const TypingAnimation = ({
  size = "md",
  className = "",
  label = "Assistant is typing",
}) => {
  const sizeClasses = {
    sm: {
      container: "gap-0.5",
      dot: "h-1 w-1",
    },
    md: {
      container: "gap-1",
      dot: "h-1.5 w-1.5",
    },
    lg: {
      container: "gap-1.5",
      dot: "h-2 w-2",
    },
  };

  const resolvedSize = sizeClasses[size] || sizeClasses.md;

  return (
    <div
      role="status"
      aria-label={label}
      className={`
        inline-flex
        items-center
        justify-center
        ${resolvedSize.container}
        ${className}
      `}
    >
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          aria-hidden="true"
          className={`
            rounded-full
            bg-gray-400
            dark:bg-gray-500
            ${resolvedSize.dot}
            animate-[typing_1.2s_ease-in-out_infinite]
            will-change-transform
          `}
          style={{
            animationDelay: `${index * 150}ms`,
          }}
        />
      ))}
    </div>
  );
};

export default TypingAnimation;