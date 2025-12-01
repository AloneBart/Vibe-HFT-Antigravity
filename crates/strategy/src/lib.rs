use vibe_hft_core::{Order, OrderSide};
use vibe_hft_market_data::OrderBook;
use log::info;

pub trait Strategy {
    fn on_market_data(&mut self, order_book: &mut OrderBook) -> Option<Vec<Order>>;
}

pub struct SimpleMarketMaker {
    spread_bps: f64,
    order_size: f64,
}

impl SimpleMarketMaker {
    pub fn new(spread_bps: f64, order_size: f64) -> Self {
        Self {
            spread_bps,
            order_size,
        }
    }
}

impl Strategy for SimpleMarketMaker {
    fn on_market_data(&mut self, order_book: &mut OrderBook) -> Option<Vec<Order>> {
        let best_bid = order_book.best_bid()?;
        let best_ask = order_book.best_ask()?;

        let mid_price = (best_bid.price as f64 + best_ask.price as f64) / 2.0;
        let half_spread = mid_price * (self.spread_bps / 10000.0) / 2.0;

        let bid_price = mid_price - half_spread;
        let ask_price = mid_price + half_spread;

        // In a real HFT system, we would manage order state, cancellations, etc.
        // Here we just generate "ideal" quotes for demonstration.
        
        info!("Strategy Signal: Quote Bid {:.2} @ {:.4} | Ask {:.2} @ {:.4}", 
            bid_price, self.order_size, ask_price, self.order_size);

        // Returning None as we are just logging signals for now
        None 
    }
}
