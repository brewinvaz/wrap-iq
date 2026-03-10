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
    <div className="flex min-h-screen flex-col bg-[#f8f8fa]">
      {/* Header */}
      <header className="border-b border-[#e6e6eb] bg-white">
        <div className="mx-auto flex h-14 max-w-2xl items-center px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#18181b]">
              <span className="font-mono text-[11px] font-bold text-white">WF</span>
            </div>
            <span className="text-[15px] font-bold text-[#18181b]">
              Wrap<span className="text-blue-600">Flow</span>
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#e6e6eb] bg-white py-4">
        <p className="text-center text-[12px] text-[#a8a8b4]">
          Powered by WrapFlow
        </p>
      </footer>
    </div>
  );
}
