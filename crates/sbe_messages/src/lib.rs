#![no_std]

// This file would typically include the generated code.
// include!(concat!(env!("OUT_DIR"), "/sbe_messages.rs"));

// For the purpose of this scaffolding, we will define the structs manually to ensure compilation
// of dependent crates, as we cannot run the actual SBE generator in this environment.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum Side {
    Buy = 1,
    Sell = 2,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum ExchangeID {
    Binance = 1,
    Bybit = 2,
    Coinbase = 3,
}

#[derive(Debug, Clone, Copy)]
pub struct MarketDataUpdate {
    pub timestamp: u64,
    pub exchange_id: ExchangeID,
    pub symbol_id: u32,
    pub side: Side,
    pub price: i64,
    pub quantity: u64,
    pub is_snapshot: u8,
}

impl MarketDataUpdate {
    pub fn to_bytes(&self) -> [u8; 31] {
        let mut buf = [0u8; 31];
        buf[0..8].copy_from_slice(&self.timestamp.to_le_bytes());
        buf[8] = self.exchange_id as u8;
        buf[9..13].copy_from_slice(&self.symbol_id.to_le_bytes());
        buf[13] = self.side as u8;
        buf[14..22].copy_from_slice(&self.price.to_le_bytes());
        buf[22..30].copy_from_slice(&self.quantity.to_le_bytes());
        buf[30] = self.is_snapshot;
        buf
    }
}

#[derive(Debug, Clone, Copy)]
pub struct OrderEntry {
    pub timestamp: u64,
    pub cl_ord_id: u64,
    pub exchange_id: ExchangeID,
    pub symbol_id: u32,
    pub side: Side,
    pub price: i64,
    pub quantity: u64,
    pub order_type: u8,
}

#[derive(Debug, Clone, Copy)]
pub struct ExecutionReport {
    pub timestamp: u64,
    pub cl_ord_id: u64,
    pub exec_id: u64,
    pub filled_quantity: u64,
    pub filled_price: i64,
    pub status: u8,
}
