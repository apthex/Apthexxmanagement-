import Link from "next/link";

export function ApthexLogo({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-label="Apthex">
      {/* Red Left Wing / Chevron */}
      <path
        d="M14.6 4.2L4.5 25.8H9.8L14.8 14.8L17.2 20.2H12.2L11 23H21.5L16 11.2L14.6 4.2Z"
        fill="#E11D2E"
      />
      {/* White Right Wing */}
      <path
        d="M16.5 4.2L27 25.8H21.8L17.2 15.6L16.5 4.2Z"
        fill="#FFFFFF"
      />
      {/* Central Red Accent Notch */}
      <rect x="13.5" y="16.5" width="3" height="2" rx="0.5" fill="#E11D2E" />
    </svg>
  );
}

export function AuthShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen w-full bg-[#08090d] text-zinc-100 flex flex-col justify-between font-sans selection:bg-red-500/25 selection:text-white relative overflow-hidden">
      {/* Background Image: exactly same as team section */}
      <div
        className="absolute inset-0 pointer-events-none select-none z-0 bg-cover bg-no-repeat"
        style={{
          backgroundImage: `url("/team-bg.png")`,
          backgroundPosition: "50% 20%",
        }}
        aria-hidden="true"
      />

      {/* Cinematic dark shade & vignette overlay matching #team */}
      <div
        className="absolute inset-0 pointer-events-none select-none z-0"
        style={{
          background: `
            linear-gradient(90deg, rgba(8,9,13,0.92) 0%, rgba(8,9,13,0.65) 45%, rgba(8,9,13,0.50) 75%, rgba(8,9,13,0.72) 100%),
            linear-gradient(0deg, #08090d 5%, transparent 35%),
            linear-gradient(180deg, rgba(8,9,13,0.9) 0%, transparent 30%)
          `,
        }}
        aria-hidden="true"
      />

      {/* Subtle ambient lighting */}
      <div className="absolute inset-0 pointer-events-none select-none z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-red-600/[0.06] blur-[120px] rounded-full" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-red-950/[0.12] blur-[100px] rounded-full" />
      </div>

      {/* Minimal Top Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10 border-b border-white/[0.08] backdrop-blur-sm bg-black/20">
        <Link href="/login" className="flex items-center gap-3 group">
          <ApthexLogo className="size-7 transition-transform group-hover:scale-105" />
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-[15px] font-bold tracking-[0.18em] text-white">
              APTHEX
            </span>
            <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-red-500">
              OPS
            </span>
          </div>
        </Link>
        <div className="font-mono text-[11px] text-zinc-500 tracking-wider">
          v2.4
        </div>
      </header>

      {/* Centered Card Content */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div className={wide ? "w-full max-w-[540px]" : "w-full max-w-[420px]"}>
          {children}
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="relative z-10 flex items-center justify-between px-6 py-4 sm:px-10 border-t border-white/[0.08] backdrop-blur-sm bg-black/20 text-[11px] font-mono text-zinc-500">
        <span>APTHEX OPS</span>
        <span>WORKSPACE</span>
      </footer>
    </div>
  );
}
