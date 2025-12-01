# Architecture Decisions & Technical Specifications

## 1. SBE XML Schema Definition
This schema defines the binary format for market data, orders, and executions. It is designed for zero-copy deserialization and minimal bandwidth usage.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<sbe:messageSchema xmlns:sbe="http://fixprotocol.io/2016/sbe"
                   package="com.vibecode.hft.sbe"
                   id="1"
                   version="1"
                   semanticVersion="1.0"
                   description="Vibe Code HFT Market Data Schema"
                   byteOrder="littleEndian">

    <types>
        <composite name="messageHeader" description="Message identifiers and length of message root">
            <type name="blockLength" primitiveType="uint16"/>
            <type name="templateId" primitiveType="uint16"/>
            <type name="schemaId" primitiveType="uint16"/>
            <type name="version" primitiveType="uint16"/>
        </composite>
        <type name="u64" primitiveType="uint64"/>
        <type name="u32" primitiveType="uint32"/>
        <type name="u16" primitiveType="uint16"/>
        <type name="u8" primitiveType="uint8"/>
        <type name="price" primitiveType="int64" description="Price with 8 decimal places implied"/>
        <type name="quantity" primitiveType="uint64" description="Quantity with 8 decimal places implied"/>
        <enum name="Side" encodingType="u8">
            <validValue name="Buy">1</validValue>
            <validValue name="Sell">2</validValue>
        </enum>
        <enum name="ExchangeID" encodingType="u8">
            <validValue name="Binance">1</validValue>
            <validValue name="Bybit">2</validValue>
            <validValue name="Coinbase">3</validValue>
        </enum>
    </types>

    <message name="MarketDataUpdate" id="1" description="L3 Order Book Update">
        <field name="timestamp" id="1" type="u64" description="Exchange timestamp (ns)"/>
        <field name="exchangeId" id="2" type="ExchangeID"/>
        <field name="symbolId" id="3" type="u32"/>
        <field name="side" id="4" type="Side"/>
        <field name="price" id="5" type="price"/>
        <field name="quantity" id="6" type="quantity"/>
        <field name="isSnapshot" id="7" type="u8" description="1 if snapshot, 0 if delta"/>
    </message>

    <message name="OrderEntry" id="2" description="New Order Submission">
        <field name="timestamp" id="1" type="u64"/>
        <field name="clOrdId" id="2" type="u64"/>
        <field name="exchangeId" id="3" type="ExchangeID"/>
        <field name="symbolId" id="4" type="u32"/>
        <field name="side" id="5" type="Side"/>
        <field name="price" id="6" type="price"/>
        <field name="quantity" id="7" type="quantity"/>
        <field name="orderType" id="8" type="u8" description="1=Limit, 2=Market"/>
    </message>

    <message name="ExecutionReport" id="3" description="Order Execution Confirmation">
        <field name="timestamp" id="1" type="u64"/>
        <field name="clOrdId" id="2" type="u64"/>
        <field name="execId" id="3" type="u64"/>
        <field name="filledQuantity" id="4" type="quantity"/>
        <field name="filledPrice" id="5" type="price"/>
        <field name="status" id="6" type="u8" description="1=New, 2=PartiallyFilled, 3=Filled, 4=Canceled"/>
    </message>
</sbe:messageSchema>
```

## 2. Rust Workspace Structure
The project will be organized as a Cargo workspace to ensure modularity and compilation speed.

```
vibe-hft/
├── Cargo.toml              # Workspace definition
├── crates/
│   ├── core/               # Shared types, traits, and utilities (No heavy deps)
│   │   ├── src/lib.rs
│   │   └── Cargo.toml
│   ├── sbe_messages/       # Generated SBE code (rustysbe output)
│   │   ├── src/lib.rs
│   │   └── Cargo.toml
│   ├── market_data/        # L3 Order Book reconstruction & Indicators (OFI/CVD)
│   │   ├── src/lib.rs      # Contains the hot path (No Allocations)
│   │   └── Cargo.toml
│   ├── algo/               # Execution logic & Strategy engine
│   │   ├── src/lib.rs
│   │   └── Cargo.toml
│   └── wasm_client/        # Rust logic compiled to WASM for Frontend
│       ├── src/lib.rs      # Decoders & Client-side calculations
│       └── Cargo.toml
└── services/
    └── gateway/            # Main entry point (WebSocket Server)
        ├── src/main.rs
        └── Cargo.toml
```

## 3. Approved Crates (Allow List)
To maintain strict control over performance and dependencies, only the following crates are approved for the core path.

| Crate | Usage | Justification |
| :--- | :--- | :--- |
| `tokio` | Async Runtime | Industry standard, required for high-concurrency IO. |
| `hftbacktest` | Market Data Structures | Optimized L3 order book management and backtesting capabilities. |
| `rustysbe` | Serialization | SBE implementation for Rust. Zero-copy. |
| `wasm-bindgen` | WASM Interop | Essential for Rust -> JS communication. |
| `web-sys` | Web APIs | Access to browser APIs from WASM. |
| `js-sys` | JS Types | Raw JS types for WASM. |
| `parking_lot` | Concurrency | Faster synchronization primitives (Mutex/RwLock) than std. |
| `crossbeam-channel` | Messaging | High-performance MPC channels for internal thread communication. |
| `smallvec` | Optimization | Stack allocation for small vectors to avoid heap. |
| `thiserror` | Error Handling | Ergonomic error definition (Macro-based). |
| `anyhow` | Error Handling | Application-level error handling (Gateway only). |
| `serde` | Config Parsing | ONLY for startup configuration (JSON/YAML). BANNED in hot path. |
| `serde_json` | Config Parsing | ONLY for startup configuration. |

## 4. Performance Guidelines (Non-Negotiable)
1.  **Hot Path Allocations**: `String`, `Vec` (dynamic), and `Box` are strictly forbidden in the `market_data` update loop. Use `ArrayVec`, `SmallVec`, or pre-allocated ring buffers.
2.  **SBE Decoding**: Must happen in-place on the network buffer. No intermediate struct copying if possible.
3.  **WASM Bridge**: Minimize calls between JS and WASM. Batch updates (e.g., send 100ms of data at once) rather than calling per-tick.
