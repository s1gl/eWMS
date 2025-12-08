import { ReactNode } from "react";

type Props = {
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
};

export default function Card({ title, children, actions }: Props) {
  return (
    <section className="card">
      {(title || actions) && (
        <header className="card-header">
          {title && <h2>{title}</h2>}
          {actions}
        </header>
      )}
      <div className="card-body">{children}</div>
    </section>
  );
}
