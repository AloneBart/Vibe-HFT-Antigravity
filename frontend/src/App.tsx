import { useState, useEffect, useRef, useCallback } from 'react'
import { type CandlestickData, type HistogramData, type Time } from 'lightweight-charts'
import { TradingChart } from './components/TradingChart'
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
  const wasmModuleRef = useRef<any>(null)
  const lastPriceRef = useRef<number>(50000)

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

    if (!wasmModuleRef.current) {
      console.error('WASM module not initialized')
      return
    }

    // Nettoyer toute connexion existante
    cleanupWebSocket()

    try {
      console.log('🔌 Attempting connection to gateway...')
      setStatus('Connecting...')

      const ws = new WebSocket('ws://127.0.0.1:8080')
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
          const buffer = new Uint8Array(event.data)
          const { decode_market_data } = wasmModuleRef.current
          const update = decode_market_data(buffer)

          setMessages(prev => [update as MarketUpdate, ...prev].slice(0, 20))
          updateChartData(update as MarketUpdate)
        } catch (e) {
          console.error('Error decoding message:', e)
          setError(`Decode error: ${e}`)
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
        setStatus('Loading WASM...')

        try {
          const wasmModule = await import('vibe-hft-wasm-client')
          if (!isMountedRef.current) return

          wasmModule.init_client()
          wasmModuleRef.current = wasmModule

          console.log('✅ WASM client initialized')
          setChartReady(true)
          setStatus('WASM Ready')

          // Démarrer la connexion WebSocket seulement si pas en mode simulation
          if (!isSimulatingRef.current) {
            connectWebSocket()
          }
        } catch (wasmError) {
          console.warn('⚠️ WASM not available, running in simulation-only mode')
          setChartReady(true)
          setStatus('WASM Unavailable')
          setError('WASM module not found. Use Simulation Mode to test the UI.')
        }

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
    }
  }, [connectWebSocket, cleanupWebSocket, cleanupSimulation])

  // Effet pour gérer le changement de mode simulation
  useEffect(() => {
    if (isSimulating) {
      // Passer en mode simulation : nettoyer le WebSocket
      console.log('🔄 Switching to simulation mode')
      cleanupWebSocket()
    } else if (wasmModuleRef.current && chartReady) {
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
          <TradingChart data={candlestickData} volumeData={volumeData} />
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
