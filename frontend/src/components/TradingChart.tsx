import { useEffect, useRef } from 'react'
import { createChart, ColorType, CandlestickSeries, HistogramSeries, type IChartApi, type ISeriesApi, type CandlestickData, type HistogramData } from 'lightweight-charts'
import './TradingChart.css'

interface TradingChartProps {
    data: CandlestickData[]
    volumeData: HistogramData[]
}

export function TradingChart({ data, volumeData }: TradingChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null)
    const chartRef = useRef<IChartApi | null>(null)
    const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
    const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
    const resizeObserverRef = useRef<ResizeObserver | null>(null)

    useEffect(() => {
        if (!chartContainerRef.current) return

        // Clean up existing chart if any
        if (chartRef.current) {
            chartRef.current.remove()
            chartRef.current = null
        }

        // Clean up existing ResizeObserver if any
        if (resizeObserverRef.current) {
            resizeObserverRef.current.disconnect()
            resizeObserverRef.current = null
        }

        try {
            const chart = createChart(chartContainerRef.current, {
                layout: {
                    background: { type: ColorType.Solid, color: '#0a0e27' },
                    textColor: '#e0e6ff',
                },
                grid: {
                    vertLines: { color: '#1a1f3a' },
                    horzLines: { color: '#1a1f3a' },
                },
                crosshair: { mode: 1 },
                rightPriceScale: { borderColor: '#2d3561' },
                timeScale: {
                    borderColor: '#2d3561',
                    timeVisible: true,
                    secondsVisible: true,
                },
                width: chartContainerRef.current.clientWidth,
                height: 500,
            })

            chartRef.current = chart

            // Use addSeries with CandlestickSeries - correct v5 API
            const candlestickSeries = chart.addSeries(CandlestickSeries, {
                upColor: '#00ff88',
                downColor: '#ff4757',
                borderUpColor: '#00ff88',
                borderDownColor: '#ff4757',
                wickUpColor: '#00ff88',
                wickDownColor: '#ff4757',
            })
            candlestickSeriesRef.current = candlestickSeries

            // Use addSeries with HistogramSeries - correct v5 API
            const volumeSeries = chart.addSeries(HistogramSeries, {
                color: '#26a69a',
                priceFormat: { type: 'volume' },
                priceScaleId: '',
            })
            chart.priceScale('').applyOptions({
                scaleMargins: {
                    top: 0.8,
                    bottom: 0,
                },
            })
            volumeSeriesRef.current = volumeSeries

            // Set up ResizeObserver for responsive chart sizing
            const resizeObserver = new ResizeObserver((entries) => {
                if (entries.length === 0 || !entries[0].target) return
                const newRect = entries[0].contentRect
                chart.applyOptions({ width: newRect.width, height: newRect.height })
            })
            resizeObserver.observe(chartContainerRef.current)
            resizeObserverRef.current = resizeObserver

            return () => {
                if (resizeObserverRef.current) {
                    resizeObserverRef.current.disconnect()
                    resizeObserverRef.current = null
                }
                if (chartRef.current) {
                    chartRef.current.remove()
                    chartRef.current = null
                }
            }
        } catch (error) {
            console.error('Error creating TradingChart:', error)
        }
    }, [])

    useEffect(() => {
        if (candlestickSeriesRef.current && data.length > 0) {
            candlestickSeriesRef.current.setData(data as any)
        }
    }, [data])

    useEffect(() => {
        if (volumeSeriesRef.current && volumeData.length > 0) {
            volumeSeriesRef.current.setData(volumeData as any)
        }
    }, [volumeData])

    return (
        <div className="trading-chart-container" style={{ width: '100%', height: '100%' }}>
            <div ref={chartContainerRef} className="trading-chart" style={{ width: '100%', height: '100%' }} />
        </div>
    )
}
