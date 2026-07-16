import { Children, cloneElement, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/utils/cn";

type Side = "top" | "bottom" | "left" | "right";

interface TooltipProps {
  label: string;
  side?: Side;
  /** Render the child untouched (e.g. expanded sidebar already shows its label) */
  disabled?: boolean;
  children: React.ReactElement<React.HTMLAttributes<HTMLElement>>;
}

const SHOW_DELAY_MS = 350;
const GAP_PX = 6;

/**
 * Styled replacement for native title= tooltips: instant-feeling, themed,
 * portaled to <body> so overflow/transform containers can't clip it.
 */
export function Tooltip({ label, side = "top", disabled = false, children }: TooltipProps) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const timerRef = useRef<number | null>(null);

  const cancel = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setAnchor(null);
  };

  useEffect(() => cancel, []);

  const child = Children.only(children);

  if (disabled) return child;

  const schedule = (target: HTMLElement) => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setAnchor(target.getBoundingClientRect());
    }, SHOW_DELAY_MS);
  };

  const trigger = cloneElement(child, {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      child.props.onMouseEnter?.(e);
      schedule(e.currentTarget);
    },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
      child.props.onMouseLeave?.(e);
      cancel();
    },
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      child.props.onFocus?.(e);
      schedule(e.currentTarget);
    },
    onBlur: (e: React.FocusEvent<HTMLElement>) => {
      child.props.onBlur?.(e);
      cancel();
    },
    // Clicking usually changes state — a lingering tooltip just gets in the way
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      child.props.onClick?.(e);
      cancel();
    },
  });

  const style: React.CSSProperties | null = anchor
    ? side === "top"
      ? { left: anchor.left + anchor.width / 2, top: anchor.top - GAP_PX, transform: "translate(-50%, -100%)" }
      : side === "bottom"
        ? { left: anchor.left + anchor.width / 2, top: anchor.bottom + GAP_PX, transform: "translate(-50%, 0)" }
        : side === "right"
          ? { left: anchor.right + GAP_PX, top: anchor.top + anchor.height / 2, transform: "translate(0, -50%)" }
          : { left: anchor.left - GAP_PX, top: anchor.top + anchor.height / 2, transform: "translate(-100%, -50%)" }
    : null;

  return (
    <>
      {trigger}
      {anchor &&
        style &&
        createPortal(
          <div
            role="tooltip"
            style={style}
            className={cn(
              "fixed z-[100] pointer-events-none whitespace-nowrap max-w-xs truncate",
              "px-2 py-1 rounded-lg text-2xs text-cortex-text",
              "bg-cortex-surface-3 border border-cortex-border shadow-cortex-lg",
              "animate-fade-in",
            )}
          >
            {label}
          </div>,
          document.body,
        )}
    </>
  );
}
