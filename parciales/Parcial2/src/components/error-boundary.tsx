import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { logger } from "@/lib/logger";

type Props = { children: ReactNode; area: string; resetKey?: string };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error("Error de renderizado en el storefront", error, {
      area: this.props.area,
      action: "react.render",
      componentStack: info.componentStack,
    });
  }

  componentDidUpdate(previous: Props) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <ServerErrorPage onRetry={() => this.setState({ error: null })} />;
  }
}

export function ServerErrorPage({ onRetry }: { onRetry?: () => void }) {
  return (
    <main className="system-page container">
      <section className="system-card panel" role="alert">
        <span className="system-code" aria-hidden="true">500</span>
        <h1>Error interno</h1>
        <p>Tu información sigue segura. Puedes volver a intentarlo o regresar al inicio.</p>
        <div className="system-actions">
          <button className="button button-primary" type="button" onClick={onRetry ?? (() => window.location.reload())}>
            Volver a intentar
          </button>
          <Link className="button button-outline" to="/">Ir al inicio</Link>
        </div>
      </section>
    </main>
  );
}
