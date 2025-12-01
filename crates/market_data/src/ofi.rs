use std::collections::VecDeque;

/// Order Flow Imbalance (OFI) Calculator
/// Measures the net pressure on the order book by tracking changes
/// in bid and ask volumes at the best price levels
#[derive(Debug, Clone)]
pub struct OFICalculator {
    /// Window size for OFI calculation (number of events)
    window_size: usize,
    /// History of bid events
    bid_events: VecDeque<f64>,
    /// History of ask events
    ask_events: VecDeque<f64>,
    /// Last known best bid price and quantity
    last_bid: Option<(i64, u64)>,
    /// Last known best ask price and quantity
    last_ask: Option<(i64, u64)>,
}

impl OFICalculator {
    pub fn new(window_size: usize) -> Self {
        Self {
            window_size,
            bid_events: VecDeque::with_capacity(window_size),
            ask_events: VecDeque::with_capacity(window_size),
            last_bid: None,
            last_ask: None,
        }
    }

    /// Update the OFI with a new order book snapshot
    /// Returns the current OFI value
    pub fn update(&mut self, bid_price: i64, bid_qty: u64, ask_price: i64, ask_qty: u64) -> f64 {
        // Calculate bid event
        let bid_event = if let Some((last_price, last_qty)) = self.last_bid {
            if bid_price > last_price {
                // Price improvement (bid moved up) - strong buy pressure
                bid_qty as f64
            } else if bid_price < last_price {
                // Price deterioration (bid moved down) - weak buy pressure
                -(last_qty as f64)
            } else {
                // Same price, volume change
                (bid_qty as f64) - (last_qty as f64)
            }
        } else {
            0.0
        };

        // Calculate ask event
        let ask_event = if let Some((last_price, last_qty)) = self.last_ask {
            if ask_price < last_price {
                // Price improvement (ask moved down) - strong sell pressure
                ask_qty as f64
            } else if ask_price > last_price {
                // Price deterioration (ask moved up) - weak sell pressure
                -(last_qty as f64)
            } else {
                // Same price, volume change
                (ask_qty as f64) - (last_qty as f64)
            }
        } else {
            0.0
        };

        // Store events
        self.bid_events.push_back(bid_event);
        self.ask_events.push_back(ask_event);

        // Maintain window size
        if self.bid_events.len() > self.window_size {
            self.bid_events.pop_front();
        }
        if self.ask_events.len() > self.window_size {
            self.ask_events.pop_front();
        }

        // Update last known values
        self.last_bid = Some((bid_price, bid_qty));
        self.last_ask = Some((ask_price, ask_qty));

        // Calculate OFI
        self.calculate_ofi()
    }

    /// Calculate the current OFI value
    /// OFI = sum(bid_events) - sum(ask_events)
    fn calculate_ofi(&self) -> f64 {
        let bid_sum: f64 = self.bid_events.iter().sum();
        let ask_sum: f64 = self.ask_events.iter().sum();
        bid_sum - ask_sum
    }

    /// Calculate Normalized Order Book Imbalance (NOBI)
    /// NOBI = OFI / (total_bid_depth + total_ask_depth)
    /// Returns a value between -1 and 1
    pub fn calculate_nobi(&self, total_bid_depth: u64, total_ask_depth: u64) -> f64 {
        let ofi = self.calculate_ofi();
        let total_depth = (total_bid_depth + total_ask_depth) as f64;
        
        if total_depth > 0.0 {
            ofi / total_depth
        } else {
            0.0
        }
    }

    /// Get the current OFI value
    pub fn get_ofi(&self) -> f64 {
        self.calculate_ofi()
    }

    /// Reset the calculator
    pub fn reset(&mut self) {
        self.bid_events.clear();
        self.ask_events.clear();
        self.last_bid = None;
        self.last_ask = None;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ofi_price_improvement() {
        let mut ofi = OFICalculator::new(10);
        
        // Initial state
        ofi.update(100, 10, 101, 10);
        
        // Bid price improves (moves up) - buy pressure
        let result = ofi.update(101, 15, 102, 10);
        assert!(result > 0.0, "OFI should be positive with bid improvement");
    }

    #[test]
    fn test_ofi_price_deterioration() {
        let mut ofi = OFICalculator::new(10);
        
        // Initial state
        ofi.update(100, 10, 101, 10);
        
        // Bid price deteriorates (moves down) - sell pressure
        let result = ofi.update(99, 10, 100, 10);
        assert!(result < 0.0, "OFI should be negative with bid deterioration");
    }

    #[test]
    fn test_nobi_normalization() {
        let mut ofi = OFICalculator::new(10);
        
        ofi.update(100, 10, 101, 10);
        ofi.update(101, 15, 102, 10);
        
        let nobi = ofi.calculate_nobi(100, 100);
        assert!(nobi >= -1.0 && nobi <= 1.0, "NOBI should be between -1 and 1");
    }
}
