// =============================================================================
// Stock Advisors - Alpha Vantage API Client
// =============================================================================
// Rate-limited, caching client for the Alpha Vantage financial data API.
// Supports all endpoints used by the agent platform: quotes, time series,
// fundamentals, technicals, news sentiment, and sector performance.
// =============================================================================

import { DataRequirement } from '../../agents/base/types';
import { AV_BASE_URL } from '../../lib/constants';
import { DataCache, getTTL } from './cache/DataCache';

// -----------------------------------------------------------------------------
// Response Types
// -----------------------------------------------------------------------------

/** Global Quote response from Alpha Vantage */
export interface AVQuoteResponse {
  'Global Quote': {
    '01. symbol': string;
    '02. open': string;
    '03. high': string;
    '04. low': string;
    '05. price': string;
    '06. volume': string;
    '07. latest trading day': string;
    '08. previous close': string;
    '09. change': string;
    '10. change percent': string;
  };
}

/** Time Series daily/weekly/intraday response (generic) */
export interface AVTimeSeriesResponse {
  'Meta Data': Record<string, string>;
  [key: string]: Record<string, Record<string, string>> | Record<string, string>;
}

/** Company Overview (fundamentals) response */
export interface AVFundamentalsResponse {
  Symbol: string;
  Name: string;
  Description: string;
  Exchange: string;
  Sector: string;
  Industry: string;
  MarketCapitalization: string;
  PERatio: string;
  PEGRatio: string;
  BookValue: string;
  DividendPerShare: string;
  DividendYield: string;
  EPS: string;
  ProfitMargin: string;
  OperatingMarginTTM: string;
  ReturnOnAssetsTTM: string;
  ReturnOnEquityTTM: string;
  RevenueTTM: string;
  GrossProfitTTM: string;
  '52WeekHigh': string;
  '52WeekLow': string;
  '50DayMovingAverage': string;
  '200DayMovingAverage': string;
  Beta: string;
  AnalystTargetPrice: string;
  [key: string]: string;
}

/** Income Statement / Balance Sheet / Cash Flow response */
export interface AVFinancialStatementResponse {
  symbol: string;
  annualReports: Record<string, string>[];
  quarterlyReports: Record<string, string>[];
}

/** Earnings response */
export interface AVEarningsResponse {
  symbol: string;
  annualEarnings: Record<string, string>[];
  quarterlyEarnings: Record<string, string>[];
}

/** Technical indicator response */
export interface AVTechnicalIndicatorResponse {
  'Meta Data': Record<string, string>;
  [key: string]: Record<string, Record<string, string>> | Record<string, string>;
}

/** News sentiment response */
export interface AVNewsSentimentResponse {
  items: string;
  sentiment_score_definition: string;
  relevance_score_definition: string;
  feed: Array<{
    title: string;
    url: string;
    time_published: string;
    summary: string;
    source: string;
    overall_sentiment_score: number;
    overall_sentiment_label: string;
    ticker_sentiment?: Array<{
      ticker: string;
      relevance_score: string;
      ticker_sentiment_score: string;
      ticker_sentiment_label: string;
    }>;
  }>;
}

/** Sector performance response */
export interface AVSectorPerformanceResponse {
  'Meta Data': Record<string, string>;
  [key: string]: Record<string, string>;
}

/** Symbol search result */
export interface AVSearchResponse {
  bestMatches: Array<{
    '1. symbol': string;
    '2. name': string;
    '3. type': string;
    '4. region': string;
    '8. currency': string;
    '9. matchScore': string;
  }>;
}

// -----------------------------------------------------------------------------
// Rate Limiter
// -----------------------------------------------------------------------------

/** Modes that determine rate limit thresholds */
export type RateLimitTier = 'premium' | 'free';

interface QueuedRequest<T> {
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

class RateLimiter {
  /** Maximum calls allowed in the time window */
  private maxCalls: number;
  /** Time window in milliseconds */
  private windowMs: number;
  /** Timestamps of recent calls within the window */
  private callTimestamps: number[] = [];
  /** Pending request queue */
  private queue: QueuedRequest<unknown>[] = [];
  /** Whether the drain loop is currently running */
  private draining: boolean = false;

  constructor(tier: RateLimitTier) {
    if (tier === 'premium') {
      this.maxCalls = 75;
      this.windowMs = 60 * 1000; // 1 minute
    } else {
      // Free tier: 25 calls per day
      this.maxCalls = 25;
      this.windowMs = 24 * 60 * 60 * 1000; // 24 hours
    }
  }

  /**
   * Schedule a request through the rate limiter. If capacity is available,
   * it executes immediately. Otherwise it queues and waits.
   */
  async schedule<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        execute: fn as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.drain();
    });
  }

  /**
   * Get the number of remaining calls available in the current window.
   */
  getRemainingCalls(): number {
    this.pruneOldTimestamps();
    return Math.max(0, this.maxCalls - this.callTimestamps.length);
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;

    while (this.queue.length > 0) {
      this.pruneOldTimestamps();

      if (this.callTimestamps.length >= this.maxCalls) {
        // Calculate how long until the oldest call expires
        const oldestTimestamp = this.callTimestamps[0];
        const waitTime = oldestTimestamp + this.windowMs - Date.now() + 50; // 50ms buffer
        if (waitTime > 0) {
          await this.sleep(waitTime);
        }
        continue;
      }

      const request = this.queue.shift();
      if (!request) break;

      this.callTimestamps.push(Date.now());

      try {
        const result = await request.execute();
        request.resolve(result);
      } catch (error) {
        request.reject(
          error instanceof Error ? error : new Error(String(error))
        );
      }
    }

    this.draining = false;
  }

  private pruneOldTimestamps(): void {
    const cutoff = Date.now() - this.windowMs;
    while (this.callTimestamps.length > 0 && this.callTimestamps[0] < cutoff) {
      this.callTimestamps.shift();
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// -----------------------------------------------------------------------------
// AlphaVantageClient
// -----------------------------------------------------------------------------

/**
 * Rate-limited, caching client for the Alpha Vantage API. All methods
 * go through the rate limiter and check the cache before making network
 * requests.
 *
 * Usage:
 * ```ts
 * const client = new AlphaVantageClient('YOUR_API_KEY', 'premium');
 * const quote = await client.getQuote('AAPL');
 * const daily = await client.getDailySeries('MSFT');
 * ```
 */
export class AlphaVantageClient {
  private readonly apiKey: string;
  private readonly rateLimiter: RateLimiter;
  private readonly cache: DataCache;

  constructor(apiKey: string, tier: RateLimitTier = 'premium') {
    this.apiKey = apiKey;
    this.rateLimiter = new RateLimiter(tier);
    this.cache = new DataCache();
  }

  // ---------------------------------------------------------------------------
  // Quote & Time Series
  // ---------------------------------------------------------------------------

  /** Fetch the latest global quote for a symbol */
  async getQuote(symbol: string): Promise<AVQuoteResponse> {
    return this.cachedFetch<AVQuoteResponse>(
      `${symbol}:quote`,
      DataRequirement.QUOTE,
      { function: 'GLOBAL_QUOTE', symbol }
    );
  }

  /** Fetch daily adjusted OHLCV time series */
  async getDailySeries(symbol: string): Promise<AVTimeSeriesResponse> {
    return this.cachedFetch<AVTimeSeriesResponse>(
      `${symbol}:daily`,
      DataRequirement.DAILY_SERIES,
      { function: 'TIME_SERIES_DAILY_ADJUSTED', symbol, outputsize: 'compact' }
    );
  }

  /** Fetch weekly adjusted OHLCV time series */
  async getWeeklySeries(symbol: string): Promise<AVTimeSeriesResponse> {
    return this.cachedFetch<AVTimeSeriesResponse>(
      `${symbol}:weekly`,
      DataRequirement.WEEKLY_SERIES,
      { function: 'TIME_SERIES_WEEKLY_ADJUSTED', symbol }
    );
  }

  /** Fetch intraday time series at the given interval */
  async getIntraday(
    symbol: string,
    interval: '1min' | '5min' | '15min' | '30min' | '60min' = '5min'
  ): Promise<AVTimeSeriesResponse> {
    return this.cachedFetch<AVTimeSeriesResponse>(
      `${symbol}:intraday:${interval}`,
      DataRequirement.INTRADAY,
      { function: 'TIME_SERIES_INTRADAY', symbol, interval, outputsize: 'compact' }
    );
  }

  // ---------------------------------------------------------------------------
  // Fundamentals
  // ---------------------------------------------------------------------------

  /** Fetch company overview / fundamentals */
  async getFundamentals(symbol: string): Promise<AVFundamentalsResponse> {
    return this.cachedFetch<AVFundamentalsResponse>(
      `${symbol}:fundamentals`,
      DataRequirement.FUNDAMENTALS,
      { function: 'OVERVIEW', symbol }
    );
  }

  /** Fetch income statements (quarterly and annual) */
  async getIncomeStatement(symbol: string): Promise<AVFinancialStatementResponse> {
    return this.cachedFetch<AVFinancialStatementResponse>(
      `${symbol}:income_statement`,
      DataRequirement.INCOME_STATEMENT,
      { function: 'INCOME_STATEMENT', symbol }
    );
  }

  /** Fetch balance sheets (quarterly and annual) */
  async getBalanceSheet(symbol: string): Promise<AVFinancialStatementResponse> {
    return this.cachedFetch<AVFinancialStatementResponse>(
      `${symbol}:balance_sheet`,
      DataRequirement.BALANCE_SHEET,
      { function: 'BALANCE_SHEET', symbol }
    );
  }

  /** Fetch cash flow statements (quarterly and annual) */
  async getCashFlow(symbol: string): Promise<AVFinancialStatementResponse> {
    return this.cachedFetch<AVFinancialStatementResponse>(
      `${symbol}:cash_flow`,
      DataRequirement.CASH_FLOW,
      { function: 'CASH_FLOW', symbol }
    );
  }

  /** Fetch earnings history and estimates */
  async getEarnings(symbol: string): Promise<AVEarningsResponse> {
    return this.cachedFetch<AVEarningsResponse>(
      `${symbol}:earnings`,
      DataRequirement.EARNINGS,
      { function: 'EARNINGS', symbol }
    );
  }

  // ---------------------------------------------------------------------------
  // Technical Indicators
  // ---------------------------------------------------------------------------

  /**
   * Fetch a technical indicator for a symbol.
   *
   * @param symbol - Ticker symbol
   * @param indicator - Alpha Vantage indicator function name (e.g., 'RSI', 'MACD')
   * @param params - Additional indicator-specific parameters
   */
  async getTechnicalIndicator(
    symbol: string,
    indicator: string,
    params: Record<string, string | number> = {}
  ): Promise<AVTechnicalIndicatorResponse> {
    const cacheKey = `${symbol}:technical:${indicator}:${JSON.stringify(params)}`;
    const defaultParams = {
      time_period: '14',
      series_type: 'close',
      interval: 'daily',
    };

    // Map indicator to the appropriate DataRequirement for TTL
    const requirementMap: Record<string, DataRequirement> = {
      RSI: DataRequirement.TECHNICAL_RSI,
      MACD: DataRequirement.TECHNICAL_MACD,
      BBANDS: DataRequirement.TECHNICAL_BBANDS,
      SMA: DataRequirement.TECHNICAL_SMA,
      EMA: DataRequirement.TECHNICAL_EMA,
    };
    const requirement = requirementMap[indicator.toUpperCase()] ?? DataRequirement.TECHNICAL_RSI;

    return this.cachedFetch<AVTechnicalIndicatorResponse>(
      cacheKey,
      requirement,
      {
        function: indicator.toUpperCase(),
        symbol,
        ...defaultParams,
        ...params,
      }
    );
  }

  // ---------------------------------------------------------------------------
  // News & Sentiment
  // ---------------------------------------------------------------------------

  /** Fetch news articles with sentiment analysis for the given tickers */
  async getNewsSentiment(
    tickers: string | string[]
  ): Promise<AVNewsSentimentResponse> {
    const tickerStr = Array.isArray(tickers) ? tickers.join(',') : tickers;
    return this.cachedFetch<AVNewsSentimentResponse>(
      `news:${tickerStr}`,
      DataRequirement.NEWS_SENTIMENT,
      { function: 'NEWS_SENTIMENT', tickers: tickerStr }
    );
  }

  // ---------------------------------------------------------------------------
  // Sector Performance
  // ---------------------------------------------------------------------------

  /** Fetch real-time and historical sector performance */
  async getSectorPerformance(): Promise<AVSectorPerformanceResponse> {
    return this.cachedFetch<AVSectorPerformanceResponse>(
      'sector_performance',
      DataRequirement.SECTOR_PERFORMANCE,
      { function: 'SECTOR' }
    );
  }

  // ---------------------------------------------------------------------------
  // Symbol Search
  // ---------------------------------------------------------------------------

  /** Search for ticker symbols by keywords */
  async search(keywords: string): Promise<AVSearchResponse> {
    return this.rateLimiter.schedule(() =>
      this.fetchFromAPI<AVSearchResponse>({
        function: 'SYMBOL_SEARCH',
        keywords,
      })
    );
  }

  // ---------------------------------------------------------------------------
  // Batch Fetcher for Agents
  // ---------------------------------------------------------------------------

  /**
   * Fetch a bundle of data for one or more symbols based on a set of
   * DataRequirements. Deduplicates API calls using the cache and
   * fetches missing data in parallel (within rate limits).
   *
   * @param requirements - The data types needed
   * @param symbols - Ticker symbols to fetch data for
   * @returns A map of symbol -> requirement -> data
   */
  async fetchBundleForAgent(
    requirements: DataRequirement[],
    symbols: string[]
  ): Promise<Record<string, Partial<Record<DataRequirement, unknown>>>> {
    const result: Record<string, Partial<Record<DataRequirement, unknown>>> = {};

    // Initialize result structure
    for (const symbol of symbols) {
      result[symbol] = {};
    }

    // Build list of fetch tasks, deduplicating via cache
    const tasks: Array<{
      symbol: string;
      requirement: DataRequirement;
      fetch: () => Promise<unknown>;
    }> = [];

    for (const symbol of symbols) {
      for (const req of requirements) {
        const fetcher = this.getRequirementFetcher(symbol, req);
        if (fetcher) {
          tasks.push({ symbol, requirement: req, fetch: fetcher });
        }
      }
    }

    // Execute all tasks (the rate limiter will queue them appropriately)
    const results = await Promise.allSettled(
      tasks.map(async (task) => {
        try {
          const data = await task.fetch();
          return { symbol: task.symbol, requirement: task.requirement, data };
        } catch (error) {
          console.warn(
            `Failed to fetch ${task.requirement} for ${task.symbol}:`,
            error
          );
          return { symbol: task.symbol, requirement: task.requirement, data: null };
        }
      })
    );

    // Collect results
    for (const settled of results) {
      if (settled.status === 'fulfilled' && settled.value.data !== null) {
        result[settled.value.symbol][settled.value.requirement] = settled.value.data;
      }
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  /** Returns true if the client has a valid API key configured */
  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 0);
  }

  /** Get the number of API calls remaining in the current rate limit window */
  getRemainingCalls(): number {
    return this.rateLimiter.getRemainingCalls();
  }

  // ---------------------------------------------------------------------------
  // Private: Network Layer
  // ---------------------------------------------------------------------------

  /**
   * Fetch data from Alpha Vantage with caching and rate limiting.
   */
  private async cachedFetch<T>(
    cacheKey: string,
    requirement: DataRequirement,
    params: Record<string, string | number>
  ): Promise<T> {
    // Check cache first
    const cached = this.cache.get<T>(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    // Fetch through rate limiter
    const data = await this.rateLimiter.schedule(() =>
      this.fetchFromAPI<T>(params)
    );

    // Cache the result
    this.cache.set(cacheKey, data, getTTL(requirement));

    return data;
  }

  /**
   * Make a raw HTTP request to the Alpha Vantage API.
   */
  private async fetchFromAPI<T>(
    params: Record<string, string | number>
  ): Promise<T> {
    const url = new URL(AV_BASE_URL);
    url.searchParams.set('apikey', this.apiKey);

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(
        `Alpha Vantage API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    // Alpha Vantage returns errors as JSON with a "Note" or "Error Message" key
    if (data['Error Message']) {
      throw new Error(`Alpha Vantage error: ${data['Error Message']}`);
    }
    if (data['Note']) {
      throw new Error(
        `Alpha Vantage rate limit: ${data['Note']}`
      );
    }

    return data as T;
  }

  /**
   * Map a DataRequirement to the appropriate fetch function for a symbol.
   * Returns null if the requirement is not supported.
   */
  private getRequirementFetcher(
    symbol: string,
    requirement: DataRequirement
  ): (() => Promise<unknown>) | null {
    switch (requirement) {
      case DataRequirement.QUOTE:
        return () => this.getQuote(symbol);
      case DataRequirement.DAILY_SERIES:
        return () => this.getDailySeries(symbol);
      case DataRequirement.WEEKLY_SERIES:
        return () => this.getWeeklySeries(symbol);
      case DataRequirement.INTRADAY:
        return () => this.getIntraday(symbol);
      case DataRequirement.FUNDAMENTALS:
        return () => this.getFundamentals(symbol);
      case DataRequirement.INCOME_STATEMENT:
        return () => this.getIncomeStatement(symbol);
      case DataRequirement.BALANCE_SHEET:
        return () => this.getBalanceSheet(symbol);
      case DataRequirement.CASH_FLOW:
        return () => this.getCashFlow(symbol);
      case DataRequirement.EARNINGS:
        return () => this.getEarnings(symbol);
      case DataRequirement.TECHNICAL_RSI:
        return () => this.getTechnicalIndicator(symbol, 'RSI');
      case DataRequirement.TECHNICAL_MACD:
        return () => this.getTechnicalIndicator(symbol, 'MACD');
      case DataRequirement.TECHNICAL_BBANDS:
        return () => this.getTechnicalIndicator(symbol, 'BBANDS');
      case DataRequirement.TECHNICAL_SMA:
        return () => this.getTechnicalIndicator(symbol, 'SMA');
      case DataRequirement.TECHNICAL_EMA:
        return () => this.getTechnicalIndicator(symbol, 'EMA');
      case DataRequirement.NEWS_SENTIMENT:
        return () => this.getNewsSentiment(symbol);
      case DataRequirement.SECTOR_PERFORMANCE:
        return () => this.getSectorPerformance();
      default:
        return null;
    }
  }
}
