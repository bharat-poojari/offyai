import React from "react";

const LoadingSpinner = ({
  size = "md",
  label = "Loading",
  className = "",
}) => {
  const sizeClasses = {
    xs: "h-3 w-3 border-[1.5px]",
    sm: "h-4 w-4 border-2",
    md: "h-6 w-6 border-2",
    lg: "h-8 w-8 border-[2.5px]",
    xl: "h-12 w-12 border-[3px]",
  };

  const resolvedSize = sizeClasses[size] || sizeClasses.md;

  return (
    <span
      role="status"
      aria-label={label}
      className={`
        inline-flex
        shrink-0
        items-center
        justify-center
        ${className}
      `}
    >
      <span
        aria-hidden="true"
        className={`
          relative
          block
          rounded-full
          ${resolvedSize}
          border-gray-200
          border-t-blue-600
          border-r-blue-400/60
          animate-spin
          dark:border-gray-700
          dark:border-t-blue-400
          dark:border-r-blue-500/60
        `}
        style={{
          animationDuration: "700ms",
        }}
      />
    </span>
  );
};

export default LoadingSpinner;