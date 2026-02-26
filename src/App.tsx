// =============================================================================
// Stock Advisors - Root Application Component
// =============================================================================
// Sets up React Router with all application routes. Each route renders inside
// the AppShell layout which provides the title bar, sidebar, main content area,
// and status bar in a native macOS-style layout.
// =============================================================================

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppShell from './components/layout/AppShell';

// Page components
import DashboardPage from './pages/DashboardPage';
import AgentPage from './pages/AgentPage';
import SettingsPage from './pages/SettingsPage';

// -----------------------------------------------------------------------------
// Placeholder Page Components
// -----------------------------------------------------------------------------
// These pages are not yet fully implemented. Each placeholder renders a simple
// heading so navigation works immediately.

function AnalysisPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-[var(--color-sa-text-primary)]">Analysis</h1>
      <p className="mt-2 text-[var(--color-sa-text-secondary)]">
        Synthesized analysis results from all agents.
      </p>
    </div>
  );
}

function PortfolioPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-[var(--color-sa-text-primary)]">Portfolio</h1>
      <p className="mt-2 text-[var(--color-sa-text-secondary)]">
        Track your portfolio holdings and performance.
      </p>
    </div>
  );
}

function WatchlistPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-[var(--color-sa-text-primary)]">Watchlist</h1>
      <p className="mt-2 text-[var(--color-sa-text-secondary)]">
        Stocks you are monitoring for potential trades.
      </p>
    </div>
  );
}

function HistoryPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-[var(--color-sa-text-primary)]">History</h1>
      <p className="mt-2 text-[var(--color-sa-text-secondary)]">
        Past analysis runs and their results.
      </p>
    </div>
  );
}

function PerformancePage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-[var(--color-sa-text-primary)]">Performance</h1>
      <p className="mt-2 text-[var(--color-sa-text-secondary)]">
        Track recommendation accuracy and agent performance metrics.
      </p>
    </div>
  );
}

function PaperTradingPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-[var(--color-sa-text-primary)]">Paper Trading</h1>
      <p className="mt-2 text-[var(--color-sa-text-secondary)]">
        Simulated trading to test strategies without real money.
      </p>
    </div>
  );
}

// -----------------------------------------------------------------------------
// App
// -----------------------------------------------------------------------------

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/agent/:agentId" element={<AgentPage />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/watchlist" element={<WatchlistPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/performance" element={<PerformancePage />} />
          <Route path="/paper-trading" element={<PaperTradingPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
