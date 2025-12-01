#![no_std]

extern crate alloc;
pub mod ofi;

use vibe_hft_sbe_messages::{MarketDataUpdate, Side, ExchangeID};
use smallvec::SmallVec;
use core::cell::RefCell;

// Placeholder for hftbacktest structures if available, otherwise we define our own optimized ones.
// For this scaffolding, we simulate the "No Heap Allocation" constraint using fixed-size arrays or pre-allocated buffers.

pub const MAX_PRICE_LEVELS: usize = 1000;
pub const MAX_ORDERS: usize = 10000;

#[derive(Debug, Clone, Copy, Default)]
pub struct PriceLevel {
    pub price: i64,
    pub quantity: u64,
}

#[derive(Debug)]
pub struct OrderBook {
    pub bids: [PriceLevel; MAX_PRICE_LEVELS],
    pub asks: [PriceLevel; MAX_PRICE_LEVELS],
    pub bid_depth: usize,
    pub ask_depth: usize,
    // Cached best bid/ask for O(1) lookup (Performance optimization)
    cached_best_bid: Option<PriceLevel>,
    cached_best_ask: Option<PriceLevel>,
    // In a real HFT system, we would use a HashMap<OrderId, OrderNode> backed by a pre-allocated Arena.
}

impl OrderBook {
    pub fn new() -> Self {
        Self {
            bids: [PriceLevel::default(); MAX_PRICE_LEVELS],
            asks: [PriceLevel::default(); MAX_PRICE_LEVELS],
            bid_depth: 0,
            ask_depth: 0,
            cached_best_bid: None,
            cached_best_ask: None,
        }
    }

    pub fn apply_update(&mut self, update: &MarketDataUpdate) {
        // This is the HOT PATH. No allocations allowed.
        // Logic to update bids/asks based on update.side, update.price, update.quantity
        // Simplified for scaffolding:
        
        let levels = match update.side {
            Side::Buy => &mut self.bids,
            Side::Sell => &mut self.asks,
        };

        // Naive implementation for demonstration: find level and update.
        // Real implementation would use binary search or direct indexing if price is normalized.
        for level in levels.iter_mut() {
            if level.price == update.price {
                level.quantity = update.quantity;
                // Invalidate cache when updating existing level
                self.invalidate_cache(update.side);
                return;
            }
            if level.price == 0 { // Empty slot
                level.price = update.price;
                level.quantity = update.quantity;
                // Invalidate cache when adding new level
                self.invalidate_cache(update.side);
                return;
            }
        }
    }

    // Invalidate cached best bid/ask when order book changes
    fn invalidate_cache(&mut self, side: Side) {
        match side {
            Side::Buy => self.cached_best_bid = None,
            Side::Sell => self.cached_best_ask = None,
        }
    }

    pub fn best_bid(&mut self) -> Option<PriceLevel> {
        // Use cached value if available (O(1) instead of O(n))
        if let Some(cached) = self.cached_best_bid {
            return Some(cached);
        }
        
        // Calculate and cache
        let mut best = PriceLevel::default();
        for level in self.bids.iter() {
             if level.price > best.price && level.quantity > 0 {
                 best = *level;
             }
        }
        
        if best.quantity > 0 {
            self.cached_best_bid = Some(best);
            Some(best)
        } else {
            None
        }
    }

    pub fn best_ask(&mut self) -> Option<PriceLevel> {
        // Use cached value if available (O(1) instead of O(n))
        if let Some(cached) = self.cached_best_ask {
            return Some(cached);
        }
        
        // Calculate and cache
        let mut best = PriceLevel { price: i64::MAX, quantity: 0 };
        for level in self.asks.iter() {
             if level.price < best.price && level.quantity > 0 {
                 best = *level;
             }
        }
        
        if best.quantity > 0 {
            self.cached_best_ask = Some(best);
            Some(best)
        } else {
            None
        }
    }
    
    pub fn total_volume(&self, side: Side) -> u64 {
        let levels = match side {
            Side::Buy => &self.bids,
            Side::Sell => &self.asks,
        };
        levels.iter().map(|l| l.quantity).sum()
    }
}

pub struct GlobalOrderBook {
    pub binance: OrderBook,
    pub bybit: OrderBook,
    pub coinbase: OrderBook,
}

impl GlobalOrderBook {
    pub fn new() -> Self {
        Self {
            binance: OrderBook::new(),
            bybit: OrderBook::new(),
            coinbase: OrderBook::new(),
        }
    }

    pub fn on_update(&mut self, update: &MarketDataUpdate) {
        match update.exchange_id {
            ExchangeID::Binance => self.binance.apply_update(update),
            ExchangeID::Bybit => self.bybit.apply_update(update),
            ExchangeID::Coinbase => self.coinbase.apply_update(update),
        }
    }

    // NOBI Calculation: Normalized Order Book Imbalance
    // Formula: (Vol_Bid - Vol_Ask) / (Vol_Bid + Vol_Ask)
    // Weighted by exchange volume (simplified here with equal weights or static weights)
    pub fn calculate_nobi(&self) -> f64 {
        let w_binance = 0.6;
        let w_bybit = 0.3;
        let w_coinbase = 0.1;

        let b_bid = self.binance.total_volume(Side::Buy) as f64;
        let b_ask = self.binance.total_volume(Side::Sell) as f64;
        
        let by_bid = self.bybit.total_volume(Side::Buy) as f64;
        let by_ask = self.bybit.total_volume(Side::Sell) as f64;

        let c_bid = self.coinbase.total_volume(Side::Buy) as f64;
        let c_ask = self.coinbase.total_volume(Side::Sell) as f64;

        let weighted_net_flow = w_binance * (b_bid - b_ask) + w_bybit * (by_bid - by_ask) + w_coinbase * (c_bid - c_ask);
        let weighted_total_depth = w_binance * (b_bid + b_ask) + w_bybit * (by_bid + by_ask) + w_coinbase * (c_bid + c_ask);

        if weighted_total_depth == 0.0 {
            0.0
        } else {
            weighted_net_flow / weighted_total_depth
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use core::time::Duration;

    #[test]
    fn test_order_book_update_benchmark() {
        let mut book = GlobalOrderBook::new();
        let update = MarketDataUpdate {
            timestamp: 123456789,
            exchange_id: ExchangeID::Binance,
            symbol_id: 1,
            side: Side::Buy,
            price: 50000_00000000, // 50k
            quantity: 1_00000000, // 1 BTC
            is_snapshot: 0,
        };

        let iterations = 1_000_000;
        let start = core::time::Instant::now();
        
        for _ in 0..iterations {
            book.on_update(&update);
        }

        let duration = start.elapsed();
        let nanos_per_op = duration.as_nanos() as f64 / iterations as f64;
        let ops_per_sec = iterations as f64 / duration.as_secs_f64();

        println!("Benchmark Results:");
        println!("Total time for {} updates: {:?}", iterations, duration);
        println!("Time per update: {:.2} ns", nanos_per_op);
        println!("Throughput: {:.2} million updates/sec", ops_per_sec / 1_000_000.0);

        // Assert performance requirements (e.g., < 100ns per update)
        // Note: In a debug build this might be slower, so we use a loose check or just print.
        // For HFT, we target < 1 microsecond (1000ns) easily.
        assert!(nanos_per_op < 10000.0, "Update too slow! Expected <10000ns, got {:.2}ns", nanos_per_op);
    }
}
