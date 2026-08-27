import React, { forwardRef, memo } from "react";

const Input = forwardRef(
  (
    {
      className = "",
      type = "text",
      size = "md",
      variant = "default",
      leftIcon = null,
      rightIcon = null,
      error = false,
      ...props
    },
    ref
  ) => {
    const sizes = {
      sm: `
        h-8
        px-2.5
        text-xs
        rounded-md
      `,

      md: `
        h-10
        px-3
        text-sm
        rounded-lg
      `,

      lg: `
        h-11
        px-3.5
        text-sm
        rounded-lg
      `,

      xl: `
        h-12
        px-4
        text-base
        rounded-xl
      `,
    };

    const variants = {
      default: `
        border-gray-200
        bg-white
        text-gray-900
        shadow-sm
        hover:border-gray-300
        focus:border-blue-500
        focus:ring-blue-500/20
        dark:border-gray-700
        dark:bg-gray-900
        dark:text-gray-100
        dark:hover:border-gray-600
        dark:focus:border-blue-500
      `,

      subtle: `
        border-transparent
        bg-gray-100/80
        text-gray-900
        hover:bg-gray-100
        focus:border-blue-500
        focus:bg-white
        focus:ring-blue-500/20
        dark:border-transparent
        dark:bg-gray-800
        dark:text-gray-100
        dark:hover:bg-gray-750
        dark:focus:border-blue-500
        dark:focus:bg-gray-900
      `,

      ghost: `
        border-transparent
        bg-transparent
        text-gray-900
        hover:bg-gray-100
        focus:border-gray-300
        focus:bg-white
        focus:ring-blue-500/20
        dark:text-gray-100
        dark:hover:bg-gray-800
        dark:focus:border-gray-700
        dark:focus:bg-gray-900
      `,

      filled: `
        border-gray-200/80
        bg-gray-50
        text-gray-900
        hover:bg-gray-100
        focus:border-blue-500
        focus:bg-white
        focus:ring-blue-500/20
        dark:border-gray-700
        dark:bg-gray-800
        dark:text-gray-100
        dark:hover:bg-gray-750
        dark:focus:border-blue-500
        dark:focus:bg-gray-900
      `,
    };

    const errorClasses = error
      ? `
        !border-red-400
        !focus:border-red-500
        !focus:ring-red-500/20
        dark:!border-red-500/70
        dark:!focus:border-red-500
      `
      : "";

    const hasLeftIcon = Boolean(leftIcon);
    const hasRightIcon = Boolean(rightIcon);

    const inputClasses = [
      "group",
      "block",
      "w-full",
      "min-w-0",
      "border",
      "outline-none",

      // Typography
      "font-normal",
      "leading-none",

      // Placeholder
      "placeholder:text-gray-400",
      "dark:placeholder:text-gray-500",

      // Selection
      "selection:bg-blue-500/20",
      "selection:text-blue-900",
      "dark:selection:bg-blue-400/20",
      "dark:selection:text-blue-100",

      // Interaction
      "transition-all",
      "duration-200",
      "ease-out",

      // Focus
      "focus:ring-4",

      // Disabled
      "disabled:cursor-not-allowed",
      "disabled:opacity-50",
      "disabled:bg-gray-100",
      "dark:disabled:bg-gray-800",

      // Read only
      "read-only:cursor-default",

      // Autofill
      "[&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_white]",
      "dark:[&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_#111827]",
      "[&:-webkit-autofill]:[-webkit-text-fill-color:inherit]",

      // Size
      sizes[size] || sizes.md,

      // Variant
      variants[variant] || variants.default,

      // Icons
      hasLeftIcon ? "pl-10" : "",
      hasRightIcon ? "pr-10" : "",

      // Error
      errorClasses,

      className,
    ]
      .filter(Boolean)
      .join(" ");

    /*
     * Wrapper is only necessary when an icon is supplied.
     * Without icons the DOM remains a simple input for maximum compatibility.
     */
    if (!hasLeftIcon && !hasRightIcon) {
      return (
        <input
          ref={ref}
          type={type}
          className={inputClasses}
          aria-invalid={error || undefined}
          {...props}
        />
      );
    }

    return (
      <div className="group relative min-w-0 w-full">
        {/* Left icon */}
        {hasLeftIcon && (
          <span
            aria-hidden="true"
            className="
              pointer-events-none
              absolute
              left-0
              top-0
              z-10
              flex
              h-full
              w-10
              items-center
              justify-center
              text-gray-400
              transition-colors
              duration-200
              group-focus-within:text-blue-500
              dark:text-gray-500
              dark:group-focus-within:text-blue-400
              [&>svg]:h-4
              [&>svg]:w-4
              [&>svg]:shrink-0
            "
          >
            {leftIcon}
          </span>
        )}

        <input
          ref={ref}
          type={type}
          className={inputClasses}
          aria-invalid={error || undefined}
          {...props}
        />

        {/* Right icon */}
        {hasRightIcon && (
          <span
            aria-hidden="true"
            className="
              pointer-events-none
              absolute
              right-0
              top-0
              z-10
              flex
              h-full
              w-10
              items-center
              justify-center
              text-gray-400
              transition-colors
              duration-200
              group-focus-within:text-blue-500
              dark:text-gray-500
              dark:group-focus-within:text-blue-400
              [&>svg]:h-4
              [&>svg]:w-4
              [&>svg]:shrink-0
            "
          >
            {rightIcon}
          </span>
        )}

        {/* Subtle focus glow */}
        <span
          aria-hidden="true"
          className="
            pointer-events-none
            absolute
            inset-0
            rounded-[inherit]
            opacity-0
            ring-1
            ring-blue-500/20
            transition-opacity
            duration-200
            group-focus-within:opacity-100
          "
        />
      </div>
    );
  }
);

Input.displayName = "Input";

export default memo(Input);