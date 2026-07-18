"use client";

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const inputBase =
  "w-full h-9 px-3 rounded-lg text-[13px] outline-none transition-colors placeholder:text-[color:var(--color-ink-tertiary)]";

const inputStyle: React.CSSProperties = {
  background: "var(--color-surface)",
  color: "var(--color-ink)",
  border: "1px solid var(--color-border)",
};

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(inputBase, "focus:border-[color:var(--color-viridian-500)]", className)}
        style={inputStyle}
        {...rest}
      />
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full px-3 py-2 rounded-lg text-[13px] outline-none transition-colors placeholder:text-[color:var(--color-ink-tertiary)] focus:border-[color:var(--color-viridian-500)]",
          className,
        )}
        style={inputStyle}
        rows={3}
        {...rest}
      />
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select
        ref={ref}
        className={cn(inputBase, "appearance-none cursor-pointer focus:border-[color:var(--color-viridian-500)]", className)}
        style={inputStyle}
        {...rest}
      >
        {children}
      </select>
    );
  },
);

export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] font-medium" style={{ color: "var(--color-ink-secondary)" }}>
          {label}
          {required && <span style={{ color: "var(--color-viridian-500)" }}> *</span>}
        </span>
        {hint}
      </div>
      {children}
      {error && (
        <div className="mt-1 text-[11px] font-medium" style={{ color: "var(--color-ink)" }}>
          {error}
        </div>
      )}
    </label>
  );
}
