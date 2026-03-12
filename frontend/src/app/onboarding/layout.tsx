export const metadata = {
  title: 'Get Started | WrapFlow',
  description: 'Complete your vehicle wrap project onboarding',
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--surface-app)]">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--surface-card)]">
        <div className="mx-auto flex h-14 max-w-2xl items-center px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)]">
              <span className="font-mono text-[11px] font-bold text-white">W</span>
            </div>
            <span className="text-[15px] font-bold text-[var(--text-primary)]">
              Wrap<span className="text-[var(--accent-primary)]">Flow</span>
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] bg-[var(--surface-card)] py-4">
        <p className="text-center text-[12px] text-[var(--text-muted)]">
          Powered by WrapFlow
        </p>
      </footer>
    </div>
  );
}
