console.log("Worker script started");
import init, { decode_market_data, calculate_ofi } from "vibe-hft-wasm-client";
console.log("WASM client imported");

// Initialize WASM
let isWasmInitialized = false;

const initializeWasm = async () => {
    if (!isWasmInitialized) {
        try {
            console.log("Initializing WASM...");
            // Workaround: Load WASM from public folder
            await init('/vibe_hft_wasm_client_bg.wasm');
            console.log("WASM initialized successfully");
            isWasmInitialized = true;
            postMessage({ type: 'WASM_READY' });
        } catch (err) {
            console.error("WASM initialization failed:", err);
            postMessage({ type: 'ERROR', payload: `WASM Init Failed: ${err}` });
        }
    }
};

initializeWasm();

// State for OFI calculation
let prevBidVol = 0;
let prevAskVol = 0;
let prevBidPrice = 0;
let prevAskPrice = 0;

self.onmessage = async (e: MessageEvent) => {
    if (!isWasmInitialized) {
        await initializeWasm();
    }

    const { type, payload } = e.data;

    if (type === 'PROCESS_UPDATE') {
        try {
            // Decode SBE data using WASM
            // payload is Uint8Array
            const decoded = decode_market_data(payload);

            // Calculate OFI if it's a trade or relevant update
            // For simplicity, we assume decoded has price/quantity/side
            // In a real scenario, we'd maintain order book state here or in WASM

            // Example OFI calc (simplified)
            let ofi = 0;
            if (decoded.side === 'Buy') {
                ofi = calculate_ofi(decoded.quantity, 0, prevBidVol, prevAskVol, decoded.price, prevAskPrice, prevBidPrice, prevAskPrice);
                prevBidVol = decoded.quantity;
                prevBidPrice = decoded.price;
            } else {
                ofi = calculate_ofi(0, decoded.quantity, prevBidVol, prevAskVol, prevBidPrice, decoded.price, prevBidPrice, prevAskPrice);
                prevAskVol = decoded.quantity;
                prevAskPrice = decoded.price;
            }

            postMessage({
                type: 'MARKET_UPDATE',
                payload: {
                    ...decoded,
                    ofi
                }
            });

        } catch (err) {
            console.error("Worker error:", err);
            postMessage({ type: 'ERROR', payload: String(err) });
        }
    }
};
