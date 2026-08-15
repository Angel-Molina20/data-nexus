import { type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";

interface QueryBuilderResizeHandleProps {
  direction: "horizontal" | "vertical";
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  onReset: () => void;
  reverse?: boolean;
  value: number;
}

export function QueryBuilderResizeHandle({
  direction,
  label,
  max,
  min,
  onChange,
  onReset,
  value,
  reverse = false,
}: QueryBuilderResizeHandleProps) {
  const keydown = (event: KeyboardEvent<HTMLDivElement>) => {
    const decrease = direction === "vertical" ? "ArrowLeft" : "ArrowUp";
    const increase = direction === "vertical" ? "ArrowRight" : "ArrowDown";
    if (event.key === decrease || event.key === increase) {
      event.preventDefault();
      onChange(Math.min(max, Math.max(min, value + (event.key === increase ? 16 : -16))));
    } else if (event.key === "Home") onChange(min);
    else if (event.key === "End") onChange(max);
  };
  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = direction === "vertical" ? event.clientX : event.clientY;
    const initial = value;
    const target = event.currentTarget;
    const move = (moveEvent: PointerEvent) => {
      const current = direction === "vertical" ? moveEvent.clientX : moveEvent.clientY;
      const delta = current - start;
      onChange(Math.min(max, Math.max(min, initial + (reverse ? -delta : delta))));
    };
    const finish = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", finish);
      target.removeEventListener("pointercancel", finish);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", finish);
    target.addEventListener("pointercancel", finish);
  };
  return (
    <div
      aria-label={label}
      aria-orientation={direction}
      aria-valuemax={max}
      aria-valuemin={min}
      aria-valuenow={Math.round(value)}
      className={`query-builder-resize-handle query-builder-resize-handle--${direction}`}
      onDoubleClick={onReset}
      onKeyDown={keydown}
      onPointerDown={pointerDown}
      role="separator"
      tabIndex={0}
      title={`${label}. Usa flechas para ajustar; doble clic restaura.`}
    />
  );
}
