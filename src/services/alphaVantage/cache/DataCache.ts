// =============================================================================
// Stock Advisors - Two-Level Data Cache
// =============================================================================
// In-memory cache with per-data-type TTLs for Alpha Vantage API responses.
// Reduces redundant API calls across agents that share the same data needs.
// =============================================================================

import { DataRequirement } from '../../../agents/base/types';

// -----------------------------------------------------------------------------
// TTL Configuration (in milliseconds)
// -----------------------------------------------------------------------------

/** Time-to-live values by data type */
const TTL_MS: Record<DataRequirement, number> = {
  [DataRequirement.QUOTE]: 60 * 1000,                      // 60 seconds
  [DataRequirement.INTRADAY]: 60 * 1000,                    // 60 seconds
  [DataRequirement.DAILY_SERIES]: 60 * 60 * 1000,           // 1 hour
  [DataRequirement.WEEKLY_SERIES]: 24 * 60 * 60 * 1000,     // 24 hours
  [DataRequirement.FUNDAMENTALS]: 24 * 60 * 60 * 1000,      // 24 hours
  [DataRequirement.INCOME_STATEMENT]: 24 * 60 * 60 * 1000,  // 24 hours
  [DataRequirement.BALANCE_SHEET]: 24 * 60 * 60 * 1000,     // 24 hours
  [DataRequirement.CASH_FLOW]: 24 * 60 * 60 * 1000,         // 24 hours
  [DataRequirement.EARNINGS]: 60 * 60 * 1000,               // 1 hour
  [DataRequirement.NEWS_SENTIMENT]: 5 * 60 * 1000,          // 5 minutes
  [DataRequirement.SECTOR_PERFORMANCE]: 15 * 60 * 1000,     // 15 minutes
  [DataRequirement.TECHNICAL_RSI]: 30 * 60 * 1000,          // 30 minutes
  [DataRequirement.TECHNICAL_MACD]: 30 * 60 * 1000,         // 30 minutes
  [DataRequirement.TECHNICAL_BBANDS]: 30 * 60 * 1000,       // 30 minutes
  [DataRequirement.TECHNICAL_SMA]: 30 * 60 * 1000,          // 30 minutes
  [DataRequirement.TECHNICAL_EMA]: 30 * 60 * 1000,          // 30 minutes
};

/**
 * Get the TTL for a given data requirement. If a requirement has no
 * explicit TTL configured, defaults to 5 minutes.
 */
export function getTTL(requirement: DataRequirement): number {
  return TTL_MS[requirement] ?? 5 * 60 * 1000;
}

// -----------------------------------------------------------------------------
// Cache Entry
// -----------------------------------------------------------------------------

interface CacheEntry<T = unknown> {
  /** The cached data */
  data: T;
  /** Timestamp when this entry was stored */
  storedAt: number;
  /** TTL in milliseconds; entry expires at storedAt + ttl */
  ttl: number;
}

// -----------------------------------------------------------------------------
// Cache Statistics
// -----------------------------------------------------------------------------

/** Hit/miss statistics returned by getStats() */
export interface CacheStats {
  /** Number of cache hits (key found and not expired) */
  hits: number;
  /** Number of cache misses (key not found or expired) */
  misses: number;
  /** Hit rate as a decimal (0.0 to 1.0) */
  hitRate: number;
  /** Current number of entries (including potentially expired) */
  size: number;
}

// -----------------------------------------------------------------------------
// DataCache
// -----------------------------------------------------------------------------

/**
 * In-memory cache with per-entry TTL support. Designed for caching Alpha
 * Vantage API responses with appropriate freshness windows for each data type.
 *
 * Cache keys are typically structured as `${symbol}:${dataRequirement}` or
 * `${symbol}:${dataRequirement}:${extraParam}` to uniquely identify data.
 *
 * Usage:
 * ```ts
 * const cache = new DataCache();
 *
 * // Store a quote with the QUOTE TTL
 * cache.set('AAPL:quote', quoteData, getTTL(DataRequirement.QUOTE));
 *
 * // Retrieve if not expired
 * const data = cache.get<QuoteResponse>('AAPL:quote');
 * if (data) { ... }
 * ```
 */
export class DataCache {
  /** Internal storage map */
  private store: Map<string, CacheEntry> = new Map();

  /** Running hit count */
  private hitCount: number = 0;

  /** Running miss count */
  private missCount: number = 0;

  // ---------------------------------------------------------------------------
  // Core API
  // ---------------------------------------------------------------------------

  /**
   * Retrieve a cached value by key. Returns undefined if the key is not
   * found or the entry has expired. Expired entries are lazily cleaned up
   * on access.
   *
   * @param key - The cache key
   * @returns The cached data cast to type T, or undefined
   */
  get<T = unknown>(key: string): T | undefined {
    const entry = this.store.get(key);

    if (!entry) {
      this.missCount++;
      return undefined;
    }

    // Check if the entry has expired
    const now = Date.now();
    if (now - entry.storedAt > entry.ttl) {
      // Expired - remove and count as miss
      this.store.delete(key);
      this.missCount++;
      return undefined;
    }

    this.hitCount++;
    return entry.data as T;
  }

  /**
   * Store a value in the cache with a specified TTL.
   *
   * @param key - The cache key
   * @param data - The data to cache
   * @param ttl - Time-to-live in milliseconds
   */
  set(key: string, data: unknown, ttl: number): void {
    this.store.set(key, {
      data,
      storedAt: Date.now(),
      ttl,
    });
  }

  /**
   * Check if a key exists in the cache and is not expired.
   *
   * @param key - The cache key
   * @returns true if the key exists and has not expired
   */
  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;

    const now = Date.now();
    if (now - entry.storedAt > entry.ttl) {
      // Expired - clean up
      this.store.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Remove all entries from the cache and reset statistics.
   */
  clear(): void {
    this.store.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  /**
   * Get cache hit/miss statistics.
   */
  getStats(): CacheStats {
    const total = this.hitCount + this.missCount;
    return {
      hits: this.hitCount,
      misses: this.missCount,
      hitRate: total > 0 ? this.hitCount / total : 0,
      size: this.store.size,
    };
  }

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------

  /**
   * Remove all expired entries from the cache. This is called lazily on
   * individual gets, but can be called explicitly for batch cleanup.
   *
   * @returns The number of expired entries that were removed
   */
  prune(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.store.entries()) {
      if (now - entry.storedAt > entry.ttl) {
        this.store.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Get the number of entries currently in the cache (including expired).
   */
  get size(): number {
    return this.store.size;
  }
}
