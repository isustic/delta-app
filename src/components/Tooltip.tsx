import { cloneElement, useEffect, useId, useRef, useState } from "react";
import type { HTMLAttributes, ReactElement } from "react";
import { createPortal } from "react-dom";

/** Fără wrapper: păstrează dimensiunile și poziția controlului în layout. */
export function Tooltip({ content, children }: {
  content?: string;
  children: ReactElement<HTMLAttributes<HTMLElement>>;
}) {
  const id = useId();
  const [position, setPosition] = useState<{ x: number; y: number; below: boolean } | null>(null);
  const closing = useRef<ReturnType<typeof setTimeout>>();
  const cancelClose = () => clearTimeout(closing.current);
  const close = () => {
    cancelClose();
    closing.current = setTimeout(() => setPosition(null), 150);
  };
  const show = (element: HTMLElement) => {
    cancelClose();
    const rect = element.getBoundingClientRect();
    const below = rect.top < 80;
    setPosition({
      x: Math.max(136, Math.min(window.innerWidth - 136, rect.left + rect.width / 2)),
      y: below ? rect.bottom + 8 : rect.top - 8,
      below,
    });
  };

  useEffect(() => () => clearTimeout(closing.current), []);
  useEffect(() => {
    if (!position) return;
    const dismiss = () => setPosition(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [position]);

  if (!content) return children;
  return (
    <>
      {cloneElement(children, {
        "aria-label": children.props["aria-label"] ?? content,
        "aria-describedby": [children.props["aria-describedby"], position ? id : undefined]
          .filter(Boolean).join(" ") || undefined,
        onMouseEnter: (event) => {
          children.props.onMouseEnter?.(event);
          show(event.currentTarget);
        },
        onMouseLeave: (event) => {
          children.props.onMouseLeave?.(event);
          close();
        },
        onFocus: (event) => {
          children.props.onFocus?.(event);
          show(event.currentTarget);
        },
        onBlur: (event) => {
          children.props.onBlur?.(event);
          close();
        },
        onClick: (event) => {
          setPosition(null);
          children.props.onClick?.(event);
        },
      })}
      {position && createPortal(
        <div
          id={id}
          role="tooltip"
          onMouseEnter={cancelClose}
          onMouseLeave={close}
          className="fixed z-[100] w-max max-w-64 rounded-control bg-accent px-3 py-2 text-xs font-medium leading-relaxed text-on-accent shadow-elev-8"
          style={{
            left: position.x,
            top: position.y,
            transform: `translate(-50%, ${position.below ? "0" : "-100%"})`,
          }}
        >
          {content}
        </div>,
        document.body,
      )}
    </>
  );
}
