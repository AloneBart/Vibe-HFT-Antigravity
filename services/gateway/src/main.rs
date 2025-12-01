use futures_util::{SinkExt, StreamExt};
use tokio::net::{TcpListener, TcpStream};
use tokio_tungstenite::{accept_async, connect_async, tungstenite::protocol::Message};
use tokio::sync::broadcast;
use url::Url;
use serde::Deserialize;
use vibe_hft_sbe_messages::{MarketDataUpdate, ExchangeID, Side};
use vibe_hft_market_data::OrderBook;
use vibe_hft_strategy::{Strategy, SimpleMarketMaker};

#[derive(Deserialize, Debug)]
struct BinanceDepthUpdate {
    #[serde(rename = "E")]
    event_time: u64,
    #[serde(rename = "s")]
    symbol: String,
    #[serde(rename = "b")]
    bids: Vec<[String; 2]>,
    #[serde(rename = "a")]
    asks: Vec<[String; 2]>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let addr = "127.0.0.1:8080";
    let listener = TcpListener::bind(&addr).await?;
    println!("Gateway listening on: {}", addr);

    // Channel to broadcast market data updates to all connected frontend clients
    let (tx, _) = broadcast::channel::<Vec<u8>>(10000);

    // Spawn Binance WebSocket Client
    let tx_binance = tx.clone();
    tokio::spawn(async move {
        if let Err(e) = run_binance_client(tx_binance).await {
            eprintln!("Binance client error: {}", e);
        }
    });

    // Accept incoming frontend connections
    while let Ok((stream, _)) = listener.accept().await {
        let rx = tx.subscribe();
        tokio::spawn(accept_connection(stream, rx));
    }

    Ok(())
}

async fn run_binance_client(tx: broadcast::Sender<Vec<u8>>) -> anyhow::Result<()> {
    let url = Url::parse("wss://stream.binance.com:9443/ws/btcusdt@depth20@100ms")?;
    println!("Connecting to Binance: {}", url);

    println!("Attempting handshake with Binance...");
    let (ws_stream, _) = connect_async(url).await?;
    println!("✅ Connected to Binance WebSocket");

    let (_, mut read) = ws_stream.split();

    // Initialize OrderBook and Strategy
    let mut order_book = OrderBook::new();
    let mut strategy = SimpleMarketMaker::new(10.0, 0.5); // 10 bps spread, 0.5 BTC size

    while let Some(msg) = read.next().await {
        match msg {
            Ok(Message::Text(text)) => {
                // println!("Received msg: {:.50}...", text); // Debug log
                if let Ok(update) = serde_json::from_str::<BinanceDepthUpdate>(&text) {
                    // Process Bids
                    for bid in update.bids {
                        let price = (bid[0].parse::<f64>().unwrap_or(0.0) * 100_000_000.0) as i64;
                        let quantity = (bid[1].parse::<f64>().unwrap_or(0.0) * 100_000_000.0) as u64;
                        
                        let sbe_update = MarketDataUpdate {
                            timestamp: update.event_time,
                            exchange_id: ExchangeID::Binance,
                            symbol_id: 1,
                            side: Side::Buy,
                            price,
                            quantity,
                            is_snapshot: 0,
                        };
                        
                        // Update OrderBook and Run Strategy
                        order_book.apply_update(&sbe_update);
                        strategy.on_market_data(&mut order_book);

                        let _ = tx.send(sbe_update.to_bytes().to_vec());
                    }

                    // Process Asks
                    for ask in update.asks {
                        let price = (ask[0].parse::<f64>().unwrap_or(0.0) * 100_000_000.0) as i64;
                        let quantity = (ask[1].parse::<f64>().unwrap_or(0.0) * 100_000_000.0) as u64;
                        
                        let sbe_update = MarketDataUpdate {
                            timestamp: update.event_time,
                            exchange_id: ExchangeID::Binance,
                            symbol_id: 1,
                            side: Side::Sell,
                            price,
                            quantity,
                            is_snapshot: 0,
                        };
                        
                        // Update OrderBook and Run Strategy
                        order_book.apply_update(&sbe_update);
                        strategy.on_market_data(&mut order_book);

                        let _ = tx.send(sbe_update.to_bytes().to_vec());
                    }
                }
            }
            Ok(Message::Ping(ping)) => {
                // Handle ping if needed, tungstenite usually handles it
            }
            Err(e) => eprintln!("Error reading from Binance: {}", e),
            _ => {}
        }
    }

    Ok(())
}

async fn accept_connection(stream: TcpStream, mut rx: broadcast::Receiver<Vec<u8>>) {
    let addr = stream.peer_addr().expect("connected streams should have a peer address");
    println!("New Frontend connection: {}", addr);

    let ws_stream = accept_async(stream)
        .await
        .expect("Error during the websocket handshake occurred");

    let (mut write, _) = ws_stream.split();

    loop {
        match rx.recv().await {
            Ok(bytes) => {
                if let Err(e) = write.send(Message::Binary(bytes)).await {
                    println!("Client {} disconnected: {}", addr, e);
                    break;
                }
            }
            Err(broadcast::error::RecvError::Lagged(skipped)) => {
                eprintln!("Client {} lagged, skipped {} messages", addr, skipped);
                continue;
            }
            Err(e) => {
                eprintln!("Broadcast error for {}: {}", addr, e);
                break;
            }
        }
    }
    println!("Frontend connection closed: {}", addr);
}
