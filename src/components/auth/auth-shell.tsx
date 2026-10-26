import Link from "next/link";
import { Users, FileText, ShieldCheck, LockKeyhole } from "lucide-react";

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
    <div className="min-h-screen w-full bg-[#121214] flex flex-col lg:flex-row font-sans selection:bg-red/25 selection:text-white">
      {/* LEFT PANEL: Approximately 60% Width (Asymmetric Split Layout) */}
      <aside className="relative hidden lg:flex lg:w-[60%] lg:flex-[1.5] flex-col justify-between overflow-hidden bg-black p-10 xl:p-16 select-none min-h-screen">
        {/* Background Visual: Cinematic Brutalist Architecture */}
        <div className="absolute inset-0 z-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/apthex-bg.jpg"
            alt="Apthex Monolith"
            className="absolute inset-0 h-full w-full object-cover object-[65%_center] opacity-85 select-none pointer-events-none"
          />
          {/* Charcoal overlay for maximum headline legibility */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/75 to-black/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/75" />
          {/* Extremely faint architectural grid */}
          <div className="absolute inset-0 apt-grid opacity-15" />
        </div>

        {/* Top Header Row */}
        <div className="relative z-10 flex items-start justify-between">
          {/* Logo & Workspace Brand */}
          <Link href="/login" className="flex items-center gap-3.5 group">
            <ApthexLogo className="size-8 transition-transform group-hover:scale-105" />
            <div>
              <span className="block font-display text-[15.5px] font-semibold tracking-[0.22em] text-white">
                APTHEX
              </span>
              <span className="block font-mono text-[10px] font-medium tracking-[0.2em] text-zinc-400 mt-0.5">
                INTERNAL OPERATIONS
              </span>
            </div>
          </Link>

          {/* Top-Right HUD Coordinates (IBM Plex Mono 400) & Red Crosshair */}
          <div className="relative text-right">
            <div className="font-mono text-[11.5px] font-normal tracking-[0.14em] text-zinc-300 leading-tight">
              <div>19.0760° N</div>
              <div className="mt-0.5">72.8777° E</div>
            </div>
            <div className="mt-1.5 text-right text-red text-[13px] font-mono font-medium leading-none">
              +
            </div>
          </div>
        </div>

        {/* Center Hero Area */}
        <div className="relative z-10 my-auto max-w-[560px] py-12 xl:py-16">
          {/* Category Tag (IBM Plex Mono 500) */}
          <div className="mb-5 flex items-center gap-2.5 font-mono text-[11.5px] font-medium uppercase tracking-[0.2em] text-red">
            <span className="h-px w-5 bg-red" aria-hidden />
            <span>// PRIVATE WORKSPACE</span>
          </div>

          {/* Main Hero Heading: Space Grotesk 600, clamp(44px, 4vw, 68px), tight line-height 1.02 */}
          <h1 className="font-display text-[clamp(44px,4vw,68px)] font-semibold leading-[1.02] tracking-[-0.035em] text-white">
            The operating
            <br />
            desk behind
            <br />
            the <span className="text-red inline-flex items-baseline">
              work.
              <span className="inline-block w-[3.5px] h-[0.75em] bg-red ml-2 align-baseline animate-pulse shadow-[0_0_8px_rgba(225,29,46,0.85)]" />
            </span>
          </h1>

          {/* Supporting Text: Inter 400, 16px to 17px, generous spacing */}
          <p className="mt-7 xl:mt-8 font-sans text-[16px] xl:text-[17px] font-normal leading-[1.65] text-zinc-300/90 max-w-[490px]">
            Leads, delivery, people and money in one place — visible to the team that does the work, and nobody else.
          </p>

          {/* 3 Feature Rows: Inter 400 descriptions (15.5px), IBM Plex Mono indices, consistent icons */}
          <div className="mt-10 max-w-[460px] border-t border-white/10">
            <div className="flex items-center gap-4 border-b border-white/[0.08] py-4.5">
              <span className="font-mono text-[12.5px] font-medium text-red w-5">01</span>
              <Users className="size-5 text-white/90 shrink-0" aria-hidden />
              <span className="font-sans text-[15px] xl:text-[15.5px] font-normal text-zinc-200">
                One record of every lead and client
              </span>
            </div>
            <div className="flex items-center gap-4 border-b border-white/[0.08] py-4.5">
              <span className="font-mono text-[12.5px] font-normal text-zinc-500 w-5">02</span>
              <FileText className="size-5 text-white/90 shrink-0" aria-hidden />
              <span className="font-sans text-[15px] xl:text-[15.5px] font-normal text-zinc-200">
                Delivery notes, hours and ratings
              </span>
            </div>
            <div className="flex items-center gap-4 border-b border-white/[0.08] py-4.5">
              <span className="font-mono text-[12.5px] font-normal text-zinc-500 w-5">03</span>
              <ShieldCheck className="size-5 text-white/90 shrink-0" aria-hidden />
              <span className="font-sans text-[15px] xl:text-[15.5px] font-normal text-zinc-200">
                An audit trail no one can edit
              </span>
            </div>
          </div>
        </div>

        {/* Monolith Floating HUD Box (Center-Right on the building, IBM Plex Mono 400) */}
        <div className="hidden xl:block absolute right-14 top-1/2 -translate-y-10 z-10 select-none pointer-events-none">
          <div className="border border-white/20 bg-black/60 backdrop-blur-md px-3.5 py-2.5 shadow-2xl">
            <div className="font-mono text-[10px] font-normal tracking-[0.24em] text-zinc-200 leading-relaxed space-y-0.5">
              <div>SECURE</div>
              <div>OPERATE</div>
              <div>SCALE</div>
            </div>
          </div>
          <div className="mt-3 font-mono text-[9px] font-normal tracking-[0.2em] text-zinc-400 leading-tight">
            <div>APTHEX</div>
            <div>INTERNAL</div>
            <div>OPERATIONS</div>
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 font-mono text-[9.5px] text-zinc-400">
            <span className="text-red font-medium">+</span>
            <span className="h-[1px] w-14 bg-white/20" />
          </div>
        </div>

        {/* Bottom Status Row (IBM Plex Mono 400-500) */}
        <div className="relative z-10 flex items-end justify-between pt-6 border-t border-white/[0.08]">
          {/* Bottom Left Restricted Warning with Corner Bracket */}
          <div className="flex items-start gap-2.5">
            <span className="text-red font-mono text-[13px] leading-none select-none">|—</span>
            <div className="font-mono text-[10px] font-normal tracking-[0.16em] text-zinc-300 leading-relaxed uppercase">
              <div>ACCESS IS RESTRICTED TO</div>
              <div>APTHEX MEMBERS.</div>
              <div>EVERY ACTION IS LOGGED.</div>
            </div>
          </div>

          {/* Bottom Center / Right Modules */}
          <div className="font-mono text-[10.5px] font-normal tracking-[0.22em] text-zinc-300 uppercase leading-relaxed text-right">
            <div>PEOPLE</div>
            <div>PROJECTS</div>
            <div>FINANCE</div>
            <div className="flex items-center justify-end gap-1.5 text-white font-medium">
              <span>GROWTH</span>
              <span className="inline-block w-1.5 h-3 bg-red" aria-hidden />
            </div>
          </div>
        </div>
      </aside>

      {/* RIGHT PANEL: Approximately 40% Width with Warm Ivory & Architectural Grid */}
      <main className="relative flex flex-1 lg:w-[40%] flex-col justify-between bg-[#F7F6F2] apt-ivory-grid min-h-screen text-[#17171B] overflow-hidden">
        {/* Subtle geometric drafting lines in ivory canvas background */}
        <div className="pointer-events-none absolute inset-0 select-none overflow-hidden" aria-hidden>
          {/* Top-right drafting crosshair */}
          <div className="absolute top-8 right-8 text-zinc-300/60 font-mono text-[11px]">+</div>
          {/* Bottom-left drafting crosshair */}
          <div className="absolute bottom-8 left-8 text-zinc-300/60 font-mono text-[11px]">+</div>
          {/* Very soft ambient vignette */}
          <div className="absolute inset-0 bg-radial-gradient from-transparent via-[#F7F6F2]/30 to-[#ECEAE4]/60 pointer-events-none" />
        </div>

        {/* Mobile Header (visible only on screens < lg) */}
        <div className="relative z-20 flex items-center justify-between border-b border-[#D8D5CD] bg-[#121214] px-6 py-4 text-white lg:hidden">
          <Link href="/login" className="flex items-center gap-3">
            <ApthexLogo className="size-6" />
            <span className="font-display text-[15px] font-semibold tracking-[0.2em]">APTHEX</span>
            <span className="font-mono text-[9.5px] font-medium uppercase tracking-[0.15em] text-zinc-400">INTERNAL</span>
          </Link>
          <span className="flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-400">
            <LockKeyhole className="size-3.5 text-red" aria-hidden /> Restricted
          </span>
        </div>

        {/* Desktop Top Header Tag (IBM Plex Mono 400) */}
        <div className="relative z-10 hidden lg:flex items-center justify-end px-10 pt-8 pb-3">
          <div className="font-mono text-[11.5px] font-normal tracking-[0.16em] text-zinc-500">
            01 —— // INTERNAL ACCESS
          </div>
        </div>

        {/* Centered Login Panel Area */}
        <div className="relative z-10 flex flex-1 items-center justify-center p-5 sm:p-8 lg:p-10">
          <div className={wide ? "w-full max-w-[540px]" : "w-full max-w-[480px]"}>
            {children}
          </div>
        </div>

        {/* Bottom Technical Status Bar (IBM Plex Mono 400) */}
        <div className="relative z-10 flex items-center justify-between border-t border-[#DCD9D0]/80 bg-white/40 backdrop-blur-xs px-8 py-4 font-mono text-[11px] text-zinc-500">
          <span className="tracking-[0.18em] uppercase font-normal">APTHEX INTERNAL — PRIVATE ACCESS ONLY</span>
          <span className="tracking-widest text-zinc-400 font-normal">—— 01 / 01</span>
        </div>
      </main>
    </div>
  );
}
