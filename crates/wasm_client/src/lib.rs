use wasm_bindgen::prelude::*;
use vibe_hft_sbe_messages::{MarketDataUpdate, ExchangeID, Side};

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen]
pub fn init_client() {
    log("WASM Client Initialized");
}

#[derive(serde::Serialize)]
pub struct DecodedUpdate {
    pub timestamp: u64,
    pub price: f64,
    pub quantity: f64,
    pub side: String,
}

#[wasm_bindgen]
pub fn decode_market_data(data: &[u8]) -> Result<JsValue, JsValue> {
    if data.len() < 31 {
        return Err(JsValue::from_str("Data too short"));
    }

    // Manual deserialization matching the gateway's to_bytes
    // timestamp (8) + exchange (1) + symbol (4) + side (1) + price (8) + quantity (8) + snapshot (1)
    
    let mut ts_bytes = [0u8; 8];
    ts_bytes.copy_from_slice(&data[0..8]);
    let timestamp = u64::from_le_bytes(ts_bytes);

    let side_byte = data[13];
    let side = match side_byte {
        1 => "Buy",
        2 => "Sell",
        _ => "Unknown",
    };

    let mut price_bytes = [0u8; 8];
    price_bytes.copy_from_slice(&data[14..22]);
    let price_raw = i64::from_le_bytes(price_bytes);
    let price = price_raw as f64 / 100_000_000.0; // Assuming 8 decimal places

    let mut qty_bytes = [0u8; 8];
    qty_bytes.copy_from_slice(&data[22..30]);
    let qty_raw = u64::from_le_bytes(qty_bytes);
    let quantity = qty_raw as f64 / 100_000_000.0;

    let update = DecodedUpdate {
        timestamp,
        price,
        quantity,
        side: side.to_string(),
    };

    Ok(serde_wasm_bindgen::to_value(&update)?)
}
