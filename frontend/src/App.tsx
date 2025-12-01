import { useState, useEffect, useRef, useCallback } from 'react'
import { type CandlestickData, type HistogramData, type Time } from 'lightweight-charts'
import { TradingChart } from './components/TradingChart'
import { LiquidationHeatmap } from './components/LiquidationHeatmap'
import './App.css'

interface MarketUpdate {
  timestamp: number
  price: number
  quantity: number
  side: string
}

function App() {
  const [messages, setMessages] = useState<MarketUpdate[]>([])
  const [status, setStatus] = useState('Initializing...')
  const [error, setError] = useState<string | null>(null)
  const [candlestickData, setCandlestickData] = useState<CandlestickData[]>([])
  const [volumeData, setVolumeData] = useState<HistogramData[]>([])
  const [chartReady, setChartReady] = useState(false)
  const [isSimulating, setIsSimulating] = useState(false)

  // Refs pour maintenir l'état entre les renders et dans les closures
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | undefined>(undefined)
  const simulationIntervalRef = useRef<number | undefined>(undefined)
  const isMountedRef = useRef(true)
  const workerRef = useRef<Worker | null>(null)
  const lastPriceRef = useRef<number>(50000)
  const messageBufferRef = useRef<MarketUpdate[]>([])
  const lastRenderTimeRef = useRef<number>(0)

  // CRITIQUE: Ref pour suivre l'état de simulation dans les closures async
  const isSimulatingRef = useRef(isSimulating)

  // Synchroniser le ref avec le state
  useEffect(() => {
    isSimulatingRef.current = isSimulating
  }, [isSimulating])

  const updateChartData = useCallback((update: MarketUpdate) => {
    const time = Math.floor(update.timestamp / 1000) as Time

    setCandlestickData(prev => {
      const lastCandle = prev[prev.length - 1]
      if (!lastCandle || lastCandle.time !== time) {
        return [...prev, {
          time,
          open: update.price,
          high: update.price,
          low: update.price,
          close: update.price,
        }]
      } else {
        const updated = [...prev]
        updated[updated.length - 1] = {
          ...lastCandle,
          high: Math.max(lastCandle.high as number, update.price),
          low: Math.min(lastCandle.low as number, update.price),
          close: update.price,
        }
        return updated
      }
    })

    setVolumeData(prev => {
      const lastVolume = prev[prev.length - 1]
      if (!lastVolume || lastVolume.time !== time) {
        return [...prev, {
          time,
          value: update.quantity,
          color: update.side === 'Buy' ? '#00ff88' : '#ff4757',
        }]
      } else {
        const updated = [...prev]
        updated[updated.length - 1] = {
          ...lastVolume,
          value: lastVolume.value + update.quantity,
        }
        return updated
      }
    })
  }, [])

  // Fonction pour générer des données de marché simulées
  const generateMockMarketData = useCallback((): MarketUpdate => {
    const now = Date.now()

    const volatility = 0.001
    const trend = (Math.random() - 0.5) * 0.0005
    const change = lastPriceRef.current * (volatility * (Math.random() - 0.5) + trend)

    lastPriceRef.current += change
    if (lastPriceRef.current < 1000) lastPriceRef.current = 1000

    const side = change >= 0 ? 'Buy' : 'Sell'
    const quantity = Math.random() * 0.5 + 0.1

    return {
      timestamp: now,
      price: lastPriceRef.current,
      quantity,
      side
    }
  }, [])

  // Fonction pour nettoyer complètement le WebSocket
  const cleanupWebSocket = useCallback(() => {
    console.log('🧹 Cleaning up WebSocket...')

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = undefined
    }

    if (wsRef.current) {
      wsRef.current.onopen = null
      wsRef.current.onmessage = null
      wsRef.current.onclose = null
      wsRef.current.onerror = null

      if (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close()
      }
      wsRef.current = null
    }
  }, [])

  // Fonction pour nettoyer la simulation
  const cleanupSimulation = useCallback(() => {
    console.log('🧹 Cleaning up Simulation...')

    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current)
      simulationIntervalRef.current = undefined
    }
  }, [])

  // Effet pour gérer le mode simulation
  useEffect(() => {
    if (!isSimulating) {
      cleanupSimulation()
      return
    }

    // Quand on active la simulation, nettoyer le WebSocket
    cleanupWebSocket()

    console.log('🧪 Starting simulation mode...')
    setStatus('Simulation Mode')
    setError(null)

    simulationIntervalRef.current = window.setInterval(() => {
      if (!isMountedRef.current) return

      const mockUpdate = generateMockMarketData()
      setMessages(prev => [mockUpdate, ...prev].slice(0, 20))
      updateChartData(mockUpdate)
    }, 200)

    return () => {
      cleanupSimulation()
    }
  }, [isSimulating, generateMockMarketData, updateChartData, cleanupWebSocket, cleanupSimulation])

  // Fonction de connexion WebSocket avec protection contre les zombie timeouts
  const connectWebSocket = useCallback(() => {
    // VÉRIFICATION CRITIQUE: Utiliser le ref pour vérifier l'état actuel
    if (!isMountedRef.current || isSimulatingRef.current) {
      console.log('❌ Connection blocked: mounted=', isMountedRef.current, 'simulating=', isSimulatingRef.current)
      return
    }

    if (!workerRef.current) {
      console.error('Worker not initialized')
      return
    }

    // Nettoyer toute connexion existante
    cleanupWebSocket()

    try {
      console.log('🔌 Attempting connection to gateway...')
      setStatus('Connecting...')

      const ws = new WebSocket(import.meta.env.VITE_WS_URL || 'ws://127.0.0.1:8080')
      ws.binaryType = 'arraybuffer'
      wsRef.current = ws

      ws.onopen = () => {
        // Vérifier avec le ref, pas le state
        if (!isMountedRef.current || isSimulatingRef.current) return

        console.log('✅ Connected to Gateway')
        setStatus('Connected')
        setError(null)
      }

      ws.onmessage = (event) => {
        // Vérifier avec le ref
        if (!isMountedRef.current || isSimulatingRef.current) return

        try {
          if (workerRef.current) {
            // Offload decoding to worker
            workerRef.current.postMessage({
              type: 'PROCESS_UPDATE',
              payload: event.data
            }, [event.data]) // Transferable
          }
        } catch (e) {
          console.error('Error posting to worker:', e)
          setError(`Worker error: ${e}`)
        }
      }

      ws.onclose = (event) => {
        // Vérifier avec le ref
        if (!isMountedRef.current || isSimulatingRef.current) {
          console.log('⚠️ WebSocket closed but simulation active or unmounted, not reconnecting')
          return
        }

        console.log(`WebSocket closed. Code: ${event.code}`)
        setStatus('Disconnected')
        setError('Connection lost. Retrying in 3s...')

        // Nettoyer tout timeout existant
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
        }

        // Créer un nouveau timeout avec vérification
        reconnectTimeoutRef.current = window.setTimeout(() => {
          // DOUBLE VÉRIFICATION avant de reconnecter
          if (isMountedRef.current && !isSimulatingRef.current) {
            console.log('🔄 Reconnecting...')
            connectWebSocket()
          } else {
            console.log('❌ Reconnection cancelled: mounted=', isMountedRef.current, 'simulating=', isSimulatingRef.current)
          }
        }, 3000)
      }

      ws.onerror = (event) => {
        console.error('WebSocket error:', event)
      }

    } catch (e) {
      console.error('Error creating WebSocket:', e)
      setError(`Connection error: ${e}`)
      setStatus('Error')

      // Réessayer avec vérification
      reconnectTimeoutRef.current = window.setTimeout(() => {
        if (isMountedRef.current && !isSimulatingRef.current) {
          connectWebSocket()
        }
      }, 3000)
    }
  }, [cleanupWebSocket, updateChartData])

  // Effet principal d'initialisation
  useEffect(() => {
    isMountedRef.current = true

    const initSystem = async () => {
      try {
        setStatus('Loading Worker...')

        // Initialize Worker
        const worker = new Worker(new URL('./workers/marketDataWorker.ts', import.meta.url), {
          type: 'module'
        })

        worker.onerror = (err) => {
          console.error("Worker initialization error:", err);
          setError(`Worker Init Error: ${err.message}`);
        };

        worker.onmessage = (e) => {
          const { type, payload } = e.data

          if (type === 'WASM_READY') {
            console.log('✅ Worker & WASM initialized')
            setStatus('WASM Ready')
            setChartReady(true)

            // Démarrer la connexion WebSocket seulement si pas en mode simulation
            if (!isSimulatingRef.current) {
              connectWebSocket()
            }
          } else if (type === 'MARKET_UPDATE') {
            const update = payload as MarketUpdate
            messageBufferRef.current.push(update)

            // Throttle updates to ~60fps (16ms)
            const now = performance.now()
            if (now - lastRenderTimeRef.current > 32) { // 30fps for safety
              const batch = messageBufferRef.current
              messageBufferRef.current = []
              lastRenderTimeRef.current = now

              if (batch.length > 0) {
                setMessages(prev => [...batch.reverse(), ...prev].slice(0, 50))
                // Update chart with the last message of the batch (simplified)
                // Ideally we should aggregate candles
                batch.forEach(u => updateChartData(u))
              }
            }
          } else if (type === 'ERROR') {
            console.error('Worker Error:', payload)
            setError(`Worker: ${payload}`)
          }
        }

        workerRef.current = worker

      } catch (e) {
        console.error('Init Error:', e)
        setError(`Initialization Error: ${e}`)
        setStatus('Init Failed')
        setChartReady(true)
      }
    }

    initSystem()

    return () => {
      console.log('🧹 Cleaning up App component...')
      isMountedRef.current = false
      cleanupWebSocket()
      cleanupSimulation()
      if (workerRef.current) {
        workerRef.current.terminate()
      }
    }
  }, [connectWebSocket, cleanupWebSocket, cleanupSimulation])

  // Effet pour gérer le changement de mode simulation
  useEffect(() => {
    if (isSimulating) {
      // Passer en mode simulation : nettoyer le WebSocket
      console.log('🔄 Switching to simulation mode')
      cleanupWebSocket()
    } else if (workerRef.current && chartReady) {
      // Sortir du mode simulation : reconnecter le WebSocket
      console.log('🔄 Switching to WebSocket mode')
      connectWebSocket()
    }
  }, [isSimulating, chartReady, connectWebSocket, cleanupWebSocket])

  const handleToggleSimulation = () => {
    setIsSimulating(!isSimulating)
  }

  return (
    <div className="app">
      <header className="header">
        <h1>🚀 Vibe HFT Dashboard</h1>
        <div className="header-controls">
          <button
            className={`sim-button ${isSimulating ? 'active' : ''}`}
            onClick={handleToggleSimulation}
            title="Toggle simulation mode"
          >
            {isSimulating ? '⏹ Stop Simulation' : '▶ Start Simulation'}
          </button>
          <div className={`status ${status === 'Connected' ? 'connected' : isSimulating ? 'simulating' : 'disconnected'}`}>
            {status}
          </div>
        </div>
      </header>

      {error && !isSimulating && (
        <div className="error-banner">
          ⚠️ {error}
        </div>
      )}

      {isSimulating && (
        <div className="sim-banner">
          🧪 Mode Simulation Actif - Génération de données de marché fictives
        </div>
      )}

      <main className="main-content">
        {chartReady && (
          <div className="col-span-12 lg:col-span-9 grid grid-rows-6 gap-4">
            {/* Chart Section */}
            <div className="row-span-4 bg-[#111] border border-[#333] rounded-sm p-4 relative">
              <div className="absolute top-2 left-4 z-10 flex gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-[#00ff00] font-bold text-xl">BTC/USDT</span>
                  <span className="text-[#666] text-sm">Binance</span>
                </div>
                <div className="flex gap-2">
                  {['1m', '5m', '15m', '1h', '4h'].map(tf => (
                    <button key={tf} className="px-2 py-1 text-xs text-[#888] hover:text-[#00ff00] hover:bg-[#222] rounded transition-colors">
                      {tf}
                    </button>
                  ))}
                </div>
              </div>
              <TradingChart data={candlestickData} volumeData={volumeData} />
              <LiquidationHeatmap data={messages.map(m => ({ price: m.price, volume: m.quantity }))} />
            </div>
          </div>
        )}

        <section className="market-data">
          <h2>📊 Live Market Data</h2>
          <div className="data-grid">
            {messages.length === 0 ? (
              <div className="no-data">
                {isSimulating ? 'Génération de données...' : 'En attente de données de marché...'}
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div key={idx} className="data-card">
                  <div className="data-row">
                    <span className="label">Time:</span>
                    <span className="value">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="data-row">
                    <span className="label">Side:</span>
                    <span className={`value side-${msg.side.toLowerCase()}`}>{msg.side}</span>
                  </div>
                  <div className="data-row">
                    <span className="label">Price:</span>
                    <span className="value">${msg.price.toFixed(2)}</span>
                  </div>
                  <div className="data-row">
                    <span className="label">Quantity:</span>
                    <span className="value">{msg.quantity.toFixed(8)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App

