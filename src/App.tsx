import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { Shell } from './components/Shell'
import { Skeleton } from './components/ui'

const MarketSectionPage = lazy(() => import('./pages/MarketSectionPage').then((m) => ({ default: m.MarketSectionPage })))
const BreadthPage = lazy(() => import('./pages/BreadthPage').then((m) => ({ default: m.BreadthPage })))
const GroupsPage = lazy(() => import('./pages/GroupsPage').then((m) => ({ default: m.GroupsPage })))
const OptionsPage = lazy(() => import('./pages/OptionsPage').then((m) => ({ default: m.OptionsPage })))

const client = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60_000, refetchOnWindowFocus: false, retry: 1 },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <Shell>
          <Suspense fallback={<Skeleton className="h-[480px]" />}>
          <Routes>
            <Route path="/" element={<Navigate to="/indices" replace />} />
            <Route path="/indices" element={<MarketSectionPage key="indices" section="indices" />} />
            <Route path="/amplitud" element={<BreadthPage />} />
            <Route path="/grupos" element={<GroupsPage />} />
            <Route path="/materias-primas" element={<MarketSectionPage key="commodities" section="commodities" />} />
            <Route path="/divisas-bonos" element={<MarketSectionPage key="rates_fx" section="rates_fx" />} />
            <Route path="/opciones" element={<OptionsPage />} />
            <Route path="*" element={<Navigate to="/indices" replace />} />
          </Routes>
          </Suspense>
        </Shell>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
