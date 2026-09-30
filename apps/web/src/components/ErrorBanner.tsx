export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="border border-risk-negative/40 bg-risk-negative/10 px-4 py-3 text-sm text-risk-negative-strong">
      {message}
    </div>
  );
}
