"use client";

import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface PasswordFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** wrapper className (the input itself keeps the shared paper style) */
  wrapperClassName?: string;
}

const FIELD_CLS =
  "w-full bg-paper-sheet border border-paper-edge rounded-[3px] pl-3 pr-10 py-2.5 font-body text-[15px] text-ink placeholder:text-ink-faint focus:outline-2 focus:outline-blood focus:outline-offset-2";

/**
 * Paper-themed password input with a show/hide (eye) toggle.
 * Used everywhere a password is entered so the affordance is consistent.
 */
export const PasswordField: React.FC<PasswordFieldProps> = ({
  className,
  wrapperClassName,
  disabled,
  ...rest
}) => {
  const [show, setShow] = useState(false);
  return (
    <div className={`relative ${wrapperClassName ?? ""}`}>
      <input
        {...rest}
        type={show ? "text" : "password"}
        disabled={disabled}
        className={`${FIELD_CLS} ${className ?? ""}`}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        disabled={disabled}
        tabIndex={-1}
        aria-label={show ? "hide password" : "show password"}
        title={show ? "hide password" : "show password"}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-ink-faint hover:text-ink transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
};

export default PasswordField;
