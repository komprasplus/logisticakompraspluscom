import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class MapErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Map Error Boundary caught an error:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[300px] bg-muted/30 rounded-xl border border-border p-6">
          <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Error al cargar el mapa
          </h3>
          <p className="text-sm text-muted-foreground text-center mb-4 max-w-md">
            {this.props.fallbackMessage || 
              "Hubo un problema al cargar el mapa. Por favor intenta nuevamente."}
          </p>
          <Button
            onClick={this.handleRetry}
            variant="outline"
            className="gap-2"
          >
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

export default MapErrorBoundary;
