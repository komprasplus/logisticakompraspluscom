import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
  title?: string;
  minHeightClassName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Generic, production-safe ErrorBoundary for critical dashboard widgets.
 * Prevents a single broken table/modal from taking down the whole app.
 */
class CriticalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("CriticalErrorBoundary caught:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className={
            `flex flex-col items-center justify-center ${
              this.props.minHeightClassName ?? "min-h-[240px]"
            } bg-muted/30 rounded-xl border border-border p-6`
          }
        >
          <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {this.props.title ?? "Error en el módulo"}
          </h3>
          <p className="text-sm text-muted-foreground text-center mb-4 max-w-md">
            {this.props.fallbackMessage ??
              "Este módulo falló al cargar. Puedes reintentar sin perder el acceso al panel."}
          </p>
          <Button onClick={this.handleRetry} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </Button>

          {process.env.NODE_ENV === "development" && this.state.error && (
            <pre className="mt-4 p-3 bg-destructive/10 rounded text-xs text-destructive max-w-full overflow-x-auto">
              {this.state.error.message}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default CriticalErrorBoundary;
