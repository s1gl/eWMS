import { ReactNode } from "react";

type Props = {
  tone?: "success" | "error" | "info";
  children: ReactNode;
};

export default function Notice({ tone = "info", children }: Props) {
  return <div className={`notice notice-${tone}`}>{children}</div>;
}
