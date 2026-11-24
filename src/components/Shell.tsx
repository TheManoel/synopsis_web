import clsx from 'clsx'
import { Activity, ChartCandlestick, Flame, Landmark, Moon, Orbit, Sigma, Sun } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import { useSection } from '../lib/api'
import { fmtChange, fmtLevel } from '../lib/format'
import { setTheme, useTheme } from '../lib/theme'
import type { InstrumentCard } from '../lib/types'
import { Delta } from './ui'

const NAV = [
  { to: '/indices', label: 'Índices', icon: ChartCandlestick },
  { to: '/amplitud', label: 'Amplitud', icon: Activity },
  { to: '/grupos', label: 'Grupos y rotación', icon: Orbit },
  { to: '/materias-primas', label: 'Materias primas', icon: Flame },
  { to: '/divisas-bonos', label: 'Divisas y bonos', icon: Landmark },
  { to: '/opciones', label: 'Opciones', icon: Sigma, badge: 'PoC' },
]

const TAPE: Record<string, string[]> = {
  indices: ['^SPX@CBOE', '^NDX@XNAS', '^STOXX@XETR'],
  commodities: ['GC=F@XCEC', 'CL=F@XNYM', 'HG=F@XCEC'],
  rates_fx: ['^TNX@CBOE', 'DX-Y@IFUS', 'EURUSD=X@FXSP'],
  volatility: ['^VIX@CBOE'],
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="8" fill="var(--surface-3)" />
        <circle cx="16" cy="16" r="9" fill="none" stroke="var(--accent)" strokeWidth="2" />
        <path d="M16 5v22" stroke="var(--accent)" strokeWidth="2" />
        <path d="M7 19c3-1 6-6 9-6s6 5 9 6" fill="none" stroke="var(--up)" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <div className="leading-tight">
        <div className="text-[15px] font-semibold tracking-tight">Synopsis</div>
        <div className="text-[10px] text-ink-3">Estudio de mercados</div>
      </div>
    </div>
  )
}

function ThemeToggle() {
  const theme = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      onClick={() => setTheme(next)}
      className="inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-ink-3 hover:bg-surface-2 hover:text-ink-2"
      aria-label={`Cambiar a tema ${next === 'dark' ? 'oscuro' : 'claro'}`}
    >
      {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
      <span className="hidden lg:inline">Tema {next === 'dark' ? 'oscuro' : 'claro'}</span>
    </button>
  )
}

function TapeItem({ card }: { card: InstrumentCard }) {
  const d1 = card.changes.find((c) => c.horizon === '1D')
  return (
    <div className="flex shrink-0 items-baseline gap-2 px-3" title={card.as_of ? `Cierre ${card.as_of}` : undefined}>
      <span className="text-[11px] font-medium text-ink-2">{card.label}</span>
      <span className="num text-xs text-ink">{fmtLevel(card.last, card.kind)}</span>
      <Delta value={d1?.value} text={fmtChange(d1, card.kind)} className="text-[11px]" />
    </div>
  )
}

function Tape() {
  const sections = [
    { code: 'indices', q: useSection('indices') },
    { code: 'commodities', q: useSection('commodities') },
    { code: 'rates_fx', q: useSection('rates_fx') },
    { code: 'volatility', q: useSection('volatility') },
  ]
  const cards = sections.flatMap(({ code, q }) =>
    TAPE[code].map((k) => q.data?.groups.flatMap((g) => g.cards).find((c) => c.key === k)).filter(Boolean),
  ) as InstrumentCard[]
  return (
    <div className="scroll-thin flex h-10 items-center overflow-x-auto border-b border-line bg-surface/70 backdrop-blur">
      {cards.length === 0 ? (
        <div className="px-4 text-[11px] text-ink-3">Cargando cotizaciones…</div>
      ) : (
        cards.map((c, i) => (
          <div key={c.key} className={clsx('flex shrink-0 items-center', i > 0 && 'border-l border-line')}>
            <TapeItem card={c} />
          </div>
        ))
      )}
    </div>
  )
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[220px] shrink-0 flex-col border-r border-line bg-surface px-3 py-4 md:flex">
        <div className="px-2 pb-6">
          <Logo />
        </div>
        <div className="eyebrow px-2.5 pb-2">Mercados</div>
        <nav className="flex flex-col gap-0.5">
          {NAV.map(({ to, label, icon: Icon, badge }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
                  isActive ? 'bg-accent-soft text-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} className={isActive ? 'text-accent' : 'text-ink-3 group-hover:text-ink-2'} />
                  <span className="flex-1">{label}</span>
                  {badge && <span className="rounded-md bg-surface-3 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-ink-3">{badge}</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-line pt-3">
          <ThemeToggle />
          <p className="px-2.5 pt-2 text-[10px] leading-relaxed text-ink-3">
            Datos de cierre diario de la base del screener. Opciones: Yahoo Finance, con retraso.
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile navigation */}
        <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 md:hidden">
          <Logo />
          <ThemeToggle />
        </div>
        <nav className="scroll-thin flex gap-1 overflow-x-auto border-b border-line bg-surface px-3 py-2 md:hidden">
          {NAV.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx('whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium', isActive ? 'bg-accent-soft text-ink' : 'text-ink-2')
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <Tape />
        <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  )
}
