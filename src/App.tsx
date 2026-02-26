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
import AnalysisPage from './pages/AnalysisPage';
import PortfolioPage from './pages/PortfolioPage';
import WatchlistPage from './pages/WatchlistPage';
import HistoryPage from './pages/HistoryPage';
import PerformancePage from './pages/PerformancePage';
import PaperTradingPage from './pages/PaperTradingPage';

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
