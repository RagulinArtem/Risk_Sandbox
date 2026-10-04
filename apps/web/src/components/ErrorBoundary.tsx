import { Component, type ErrorInfo, type ReactNode } from "react";

/** Contains a render crash to one panel instead of blanking the whole app. */
export class ErrorBoundary extends Component<
  { fallback: ReactNode; resetKey?: string; children: ReactNode },
  { failed: boolean; resetKey?: string }
> {
  state = { failed: false, resetKey: this.props.resetKey };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  static getDerivedStateFromProps(
    props: { resetKey?: string },
    state: { failed: boolean; resetKey?: string },
  ) {
    return props.resetKey !== state.resetKey ? { failed: false, resetKey: props.resetKey } : null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Panel crashed:", error, info.componentStack);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
