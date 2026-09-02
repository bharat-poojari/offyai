import React, { forwardRef, memo } from "react";

const Button = forwardRef(
  (
    {
      children,
      onClick,
      disabled = false,
      type = "button",
      className = "",
      variant = "primary",
      size = "md",
      loading = false,
      fullWidth = false,
      leftIcon = null,
      rightIcon = null,
      ariaLabel,
      ...props
    },
    ref
  ) => {
    const variants = {
      primary: `
        bg-[var(--primary)]
        text-[var(--primary-foreground)]
        shadow-sm shadow-[color:rgba(15,156,143,0.18)]
        hover:bg-[var(--primary-hover)]
        hover:shadow-md hover:shadow-[color:rgba(15,156,143,0.22)]
        active:bg-[var(--primary-hover)]
        focus-visible:ring-[var(--primary)]
        dark:bg-[var(--primary)]
        dark:hover:bg-[var(--primary-hover)]
        dark:active:bg-[var(--primary-hover)]
      `,

      secondary: `
        bg-[var(--surface-raised)]
        text-[var(--text-primary)]
        shadow-sm shadow-[color:rgba(31,30,28,0.05)]
        hover:bg-[var(--surface)]
        hover:shadow-md hover:shadow-[color:rgba(31,30,28,0.08)]
        active:bg-[var(--surface)]
        focus-visible:ring-[var(--primary)]
        dark:shadow-[color:rgba(0,0,0,0.12)]
      `,

      danger: `
        bg-red-600
        text-white
        shadow-sm shadow-red-600/20
        hover:bg-red-700
        hover:shadow-md hover:shadow-red-600/20
        active:bg-red-800
        focus-visible:ring-red-500
        dark:bg-red-600
        dark:hover:bg-red-500
        dark:active:bg-red-700
      `,

      ghost: `
        bg-transparent
        text-[var(--text-primary)]
        hover:bg-[var(--surface-raised)]
        hover:text-[var(--text-primary)]
        active:bg-[var(--surface)]
        focus-visible:ring-[var(--primary)]
      `,

      outline: `
        border
        border-[var(--border)]
        bg-[var(--surface)]
        text-[var(--text-primary)]
        shadow-sm
        hover:border-[var(--border)]
        hover:bg-[var(--surface-raised)]
        hover:text-[var(--text-primary)]
        active:bg-[var(--surface-raised)]
        focus-visible:ring-[var(--primary)]
      `,

      subtle: `
        bg-[var(--surface-raised)]
        text-[var(--text-primary)]
        hover:bg-[var(--surface)]
        hover:text-[var(--text-primary)]
        active:bg-[var(--surface)]
        focus-visible:ring-[var(--primary)]
      `,
    };

    const sizes = {
      xs: `
        min-h-7
        px-2
        py-1
        gap-1.5
        rounded-md
        text-xs
      `,

      sm: `
        min-h-8
        px-2.5
        py-1.5
        gap-1.5
        rounded-md
        text-sm
      `,

      md: `
        min-h-10
        px-4
        py-2
        gap-2
        rounded-lg
        text-sm
      `,

      lg: `
        min-h-11
        px-5
        py-2.5
        gap-2
        rounded-lg
        text-base
      `,

      xl: `
        min-h-12
        px-6
        py-3
        gap-2.5
        rounded-xl
        text-base
      `,
    };

    const isDisabled = disabled || loading;

    const classes = [
      // Base
      "group",
      "relative",
      "inline-flex",
      "min-w-0",
      "items-center",
      "justify-center",
      "overflow-hidden",
      "font-medium",
      "whitespace-nowrap",

      // Interaction
      "select-none",
      "transition-all",
      "duration-200",
      "ease-out",
      "active:scale-[0.98]",

      // Focus
      "focus:outline-none",
      "focus-visible:ring-2",
      "focus-visible:ring-offset-2",
      "focus-visible:ring-offset-white",
      "dark:focus-visible:ring-offset-gray-900",

      // Disabled
      "disabled:pointer-events-none",
      "disabled:cursor-not-allowed",
      "disabled:opacity-50",
      "disabled:shadow-none",

      // Loading
      loading ? "cursor-wait" : "",

      // Width
      fullWidth ? "w-full" : "w-auto",

      // Variant
      variants[variant] || variants.primary,

      // Size
      sizes[size] || sizes.md,

      // User classes
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <button
        ref={ref}
        type={type}
        onClick={onClick}
        disabled={isDisabled}
        aria-label={ariaLabel}
        aria-busy={loading || undefined}
        className={classes}
        {...props}
      >
        {/* Subtle hover highlight */}
        <span
          aria-hidden="true"
          className="
            pointer-events-none
            absolute
            inset-0
            opacity-0
            transition-opacity
            duration-200
            group-hover:opacity-100
            bg-gradient-to-r
            from-white/[0.08]
            via-white/[0.04]
            to-transparent
          "
        />

        {/* Content */}
        <span
          className="
            relative
            z-10
            inline-flex
            min-w-0
            items-center
            justify-center
            gap-[inherit]
          "
        >
          {/* Left icon */}
          {!loading && leftIcon && (
            <span
              aria-hidden="true"
              className="
                inline-flex
                shrink-0
                items-center
                justify-center
                [&>svg]:h-4
                [&>svg]:w-4
                [&>svg]:shrink-0
              "
            >
              {leftIcon}
            </span>
          )}

          {/* Loading indicator */}
          {loading && (
            <span
              aria-hidden="true"
              className="
                inline-block
                shrink-0
                animate-spin
                rounded-full
                border-2
                border-current
                border-t-transparent
                h-4
                w-4
              "
            />
          )}

          {/* Button content */}
          <span className="min-w-0 truncate">
            {children}
          </span>

          {/* Right icon */}
          {!loading && rightIcon && (
            <span
              aria-hidden="true"
              className="
                inline-flex
                shrink-0
                items-center
                justify-center
                transition-transform
                duration-200
                group-hover:translate-x-0.5
                [&>svg]:h-4
                [&>svg]:w-4
                [&>svg]:shrink-0
              "
            >
              {rightIcon}
            </span>
          )}
        </span>
      </button>
    );
  }
);

Button.displayName = "Button";

export default memo(Button);