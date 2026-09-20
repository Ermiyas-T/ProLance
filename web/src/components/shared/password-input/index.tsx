"use client";

import type { InputHTMLAttributes } from "react";
import { useId, useState } from "react";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label?: string;
  labelClassName?: string;
};

export function PasswordInput({
  id,
  label,
  labelClassName = "block text-sm font-medium text-foreground mb-1.5",
  className = "",
  ...inputProps
}: PasswordInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [isVisible, setIsVisible] = useState(false);

  // Keep the visibility control next to the field so it remains easy to discover.
  return (
    <div>
      {label && (
        <label htmlFor={inputId} className={labelClassName}>
          {label}
        </label>
      )}
      <div className="relative">
        <input
          {...inputProps}
          id={inputId}
          type={isVisible ? "text" : "password"}
          className={`${className} pr-10`}
        />
        <button
          type="button"
          onClick={() => setIsVisible((visible) => !visible)}
          aria-label={isVisible ? "Hide password" : "Show password"}
          aria-pressed={isVisible}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {isVisible ? (
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.5 12s3.75 6.75 10.5 6.75a10.47 10.47 0 005.272-1.42M6.228 6.228A10.45 10.45 0 0112 5.25c6.75 0 10.5 6.75 10.5 6.75a18.045 18.045 0 01-3.168 3.936M6.228 6.228L3 3m3.228 3.228l3.047 3.047m0 0a3 3 0 104.243 4.243m-4.243-4.243l4.243 4.243m0 0L21 21" />
            </svg>
          ) : (
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5.25 12 5.25S20.268 7.943 21.542 12C20.268 16.057 16.477 18.75 12 18.75S3.732 16.057 2.458 12z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
