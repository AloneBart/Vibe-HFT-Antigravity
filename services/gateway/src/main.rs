use futures_util::{SinkExt, StreamExt};
use tokio::net::{TcpListener, TcpStream};
use tokio_tungstenite::accept_async;
use tokio::time::{interval, Duration};
use vibe_hft_sbe_messages::{MarketDataUpdate, ExchangeID, Side};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let addr = "127.0.0.1:8080";
    let listener = TcpListener::bind(&addr).await?;
    println!("Gateway listening on: {}", addr);

    while let Ok((stream, _)) = listener.accept().await {
        tokio::spawn(accept_connection(stream));
    }

    Ok(())
}

async fn accept_connection(stream: TcpStream) {
    let addr = stream.peer_addr().expect("connected streams should have a peer address");
    println!("Peer address: {}", addr);

    let ws_stream = accept_async(stream)
        .await
        .expect("Error during the websocket handshake occurred");

    println!("New WebSocket connection: {}", addr);

    let (mut write, _) = ws_stream.split();

    let mut interval = interval(Duration::from_millis(100));
    let mut counter = 0;

    loop {
        interval.tick().await;
        
        let update = MarketDataUpdate {
            timestamp: 1234567890 + counter,
            exchange_id: ExchangeID::Binance,
            symbol_id: 1, // BTC/USDT
            side: if counter % 2 == 0 { Side::Buy } else { Side::Sell },
            price: 50000_00000000 + (counter as i64 * 100),
            quantity: 1_00000000,
            is_snapshot: 0,
        };

        let bytes = update.to_bytes();
        
        if let Err(e) = write.send(tokio_tungstenite::tungstenite::Message::Binary(bytes.to_vec())).await {
            println!("Error sending message: {}", e);
            break;
        }
        
        counter += 1;
    }
}
