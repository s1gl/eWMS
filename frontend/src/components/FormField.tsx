import { ReactNode } from "react";

type Props = {
  label: string;
  children: ReactNode;
};

export default function FormField({ label, children }: Props) {
  return (
    <label className="form-field">
      <span className="form-label">{label}</span>
      {children}
    </label>
  );
}
