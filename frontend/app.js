/* ═══════════════════════════════════════════════
   BTC Monitor — Frontend Application
   ═══════════════════════════════════════════════ */

(function () {
    'use strict';

    // ─── Config ─────────────────────────────────
    const WS_RECONNECT_DELAY = 3000;
    const CANDLE_INTERVAL_MS = 5 * 60 * 1000;
    const TOTAL_MARKERS = 30; // 5min / 10s = 30 marcações
    const BRT_OFFSET = -3;

    // ─── Estado ─────────────────────────────────
    let ws = null;
    let chart = null;
    let candleSeries = null;
    let candles = [];
    let currentCandle = null;
    let markers = [];
    let lastPrice = null;
    let previousPrice = null;
    let clockInterval = null;

    // ─── Elements ───────────────────────────────
    const els = {
        connectionStatus: document.getElementById('connectionStatus'),
        clockBRT: document.getElementById('clockBRT'),
        currentPrice: document.getElementById('currentPrice'),
        priceChange: document.getElementById('priceChange'),
        changeArrow: document.getElementById('changeArrow'),
        changeValue: document.getElementById('changeValue'),
        openPrice: document.getElementById('openPrice'),
        openPriceLabel: document.getElementById('openPriceLabel'),
        candleCountdown: document.getElementById('candleCountdown'),
        candleProgress: document.getElementById('candleProgress'),
        resultCard: document.getElementById('resultCard'),
        resultDirection: document.getElementById('resultDirection'),
        resultPercent: document.getElementById('resultPercent'),
        markerTimeline: document.getElementById('markerTimeline'),
        markerEmpty: document.getElementById('markerEmpty'),
        markerCount: document.getElementById('markerCount'),
        chartOverlay: document.getElementById('chartOverlay'),
        overlayText: document.getElementById('overlayText'),
        ohlcOpen: document.getElementById('ohlcOpen'),
        ohlcHigh: document.getElementById('ohlcHigh'),
        ohlcLow: document.getElementById('ohlcLow'),
        ohlcClose: document.getElementById('ohlcClose'),
        lastResultSection: document.getElementById('lastResultSection'),
        lastResultDirection: document.getElementById('lastResultDirection'),
        lastResultOpen: document.getElementById('lastResultOpen'),
        lastResultClose: document.getElementById('lastResultClose'),
        lastResultPercent: document.getElementById('lastResultPercent'),
        priceCard: document.querySelector('.price-card')
    };

    // ─── Init Chart ─────────────────────────────
    function initChart() {
        const container = document.getElementById('chart');

        chart = LightweightCharts.createChart(container, {
            layout: {
                background: { type: 'solid', color: 'transparent' },
                textColor: '#94a3b8',
                fontFamily: "'Inter', sans-serif",
                fontSize: 12,
            },
            grid: {
                vertLines: { color: 'rgba(148, 163, 184, 0.04)' },
                horzLines: { color: 'rgba(148, 163, 184, 0.04)' },
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
                vertLine: {
                    color: 'rgba(247, 147, 26, 0.3)',
                    width: 1,
                    style: LightweightCharts.LineStyle.Dashed,
                    labelBackgroundColor: '#F7931A',
                },
                horzLine: {
                    color: 'rgba(247, 147, 26, 0.3)',
                    width: 1,
                    style: LightweightCharts.LineStyle.Dashed,
                    labelBackgroundColor: '#F7931A',
                },
            },
            rightPriceScale: {
                borderColor: 'rgba(148, 163, 184, 0.08)',
                scaleMargins: { top: 0.1, bottom: 0.1 },
            },
            timeScale: {
                borderColor: 'rgba(148, 163, 184, 0.08)',
                timeVisible: true,
                secondsVisible: false,
                rightOffset: 5,
                barSpacing: 12,
            },
            handleScroll: { mouseWheel: true, pressedMouseMove: true },
            handleScale: { axisPressedMouseMove: true, mouseWheel: true },
        });

        candleSeries = chart.addCandlestickSeries({
            upColor: '#22c55e',
            downColor: '#ef4444',
            borderUpColor: '#22c55e',
            borderDownColor: '#ef4444',
            wickUpColor: '#22c55e',
            wickDownColor: '#ef4444',
        });

        // Responsive resize
        const ro = new ResizeObserver(entries => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                chart.applyOptions({ width, height });
            }
        });
        ro.observe(container);
    }

    // ─── WebSocket ──────────────────────────────
    function connectWebSocket() {
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${location.host}`;

        setConnectionStatus('connecting');
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('[WS] Conectado');
            setConnectionStatus('connected');
        };

        ws.onclose = () => {
            console.log('[WS] Desconectado. Reconectando...');
            setConnectionStatus('disconnected');
            setTimeout(connectWebSocket, WS_RECONNECT_DELAY);
        };

        ws.onerror = (err) => {
            console.error('[WS] Erro:', err);
            setConnectionStatus('error');
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                handleMessage(msg);
            } catch (err) {
                console.error('[WS] Erro ao parsear mensagem:', err);
            }
        };
    }

    function handleMessage(msg) {
        switch (msg.type) {
            case 'session_state':
                handleSessionState(msg);
                break;
            case 'price_tick':
                handlePriceTick(msg);
                break;
            case 'candle_update':
                handleCandleUpdate(msg);
                break;
            case 'candle_closed':
                handleCandleClosed(msg);
                break;
            case 'marker':
                handleMarker(msg);
                break;
        }
    }

    // ─── Handlers ───────────────────────────────
    function handleSessionState(msg) {
        if (msg.candles && msg.candles.length > 0) {
            candles = msg.candles.map(formatCandleForChart);
            candleSeries.setData(candles);
            hideOverlay();
            chart.timeScale().fitContent();
        }

        if (msg.currentCandle) {
            currentCandle = msg.currentCandle;
            updateCurrentCandleOnChart(currentCandle);
            updateOHLC(currentCandle);
            updateOpenPrice(currentCandle.open);
            updateResult(currentCandle);
        }

        if (msg.markers && msg.markers.length > 0) {
            markers = msg.markers;
            renderMarkers();
        }

        if (msg.lastPrice) {
            updatePrice(msg.lastPrice);
        }
    }

    function handlePriceTick(msg) {
        updatePrice(msg.price);
    }

    function handleCandleUpdate(msg) {
        currentCandle = msg.candle;
        updateCurrentCandleOnChart(msg.candle);
        updateOHLC(msg.candle);
        updateOpenPrice(msg.candle.open);
        updateResult(msg.candle);
        hideOverlay();
    }

    function handleCandleClosed(msg) {
        const formatted = formatCandleForChart(msg.candle);
        candles.push(formatted);
        candleSeries.update(formatted);

        // Flash animation
        if (els.priceCard) {
            const cls = msg.candle.close >= msg.candle.open ? 'flash-up' : 'flash-down';
            els.priceCard.classList.add(cls);
            setTimeout(() => els.priceCard.classList.remove(cls), 600);
        }

        // Mostra resultado do candle fechado
        showLastResult(msg.candle);

        // Limpa marcadores para o novo candle
        markers = [];
        renderMarkers();
        currentCandle = null;

        // Reset result card
        els.resultCard.classList.remove('up', 'down');
        els.resultDirection.textContent = '—';
        els.resultPercent.textContent = '0.00%';
        els.openPrice.textContent = '--,--';
        els.openPriceLabel.textContent = 'Novo candle...';
    }

    function handleMarker(msg) {
        markers.push(msg.marker);
        renderMarkers();
    }

    // ─── Chart Helpers ──────────────────────────
    function formatCandleForChart(candle) {
        const timeSeconds = Math.floor(candle.timestamp / 1000);
        return {
            time: timeSeconds,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
        };
    }

    function updateCurrentCandleOnChart(candle) {
        if (!candle || candle.open === null) return;
        const formatted = formatCandleForChart(candle);
        candleSeries.update(formatted);
    }

    // ─── Marker Timeline ───────────────────────
    function renderMarkers() {
        els.markerCount.textContent = `${markers.length} / ${TOTAL_MARKERS} marcações`;

        if (markers.length === 0) {
            els.markerTimeline.innerHTML = '<div class="marker-empty">Aguardando marcações...</div>';
            return;
        }

        // Calcula o max diff para normalizar alturas
        const maxDiff = Math.max(...markers.map(m => Math.abs(m.diffPercent)), 0.001);

        let html = '';
        markers.forEach((m, i) => {
            const height = Math.max(15, (Math.abs(m.diffPercent) / maxDiff) * 100);
            const dir = m.direction;
            const elapsedSec = Math.floor(m.elapsed / 1000);
            const min = Math.floor(elapsedSec / 60);
            const sec = elapsedSec % 60;
            const timeStr = `${min}:${String(sec).padStart(2, '0')}`;
            const sign = m.diffPercent >= 0 ? '+' : '';
            const tooltip = `${formatPrice(m.price)} | ${sign}${m.diffPercent.toFixed(4)}% | ${timeStr}`;

            html += `<div class="marker-bar ${dir}" style="height:${height}%" data-tooltip="${tooltip}">
        <span class="marker-label">${sign}${m.diffPercent.toFixed(2)}%</span>
        <span class="marker-time">${timeStr}</span>
      </div>`;
        });

        els.markerTimeline.innerHTML = html;

        // Scroll para o final
        els.markerTimeline.scrollLeft = els.markerTimeline.scrollWidth;
    }

    // ─── UI Updates ─────────────────────────────
    function updatePrice(price) {
        previousPrice = lastPrice;
        lastPrice = price;

        els.currentPrice.textContent = formatPrice(price);

        // Direction indicator
        if (previousPrice !== null) {
            const direction = price > previousPrice ? 'up' : price < previousPrice ? 'down' : '';
            els.currentPrice.classList.remove('up', 'down');
            if (direction) els.currentPrice.classList.add(direction);
        }

        // Change % vs candle open
        if (currentCandle && currentCandle.open) {
            const changePct = ((price - currentCandle.open) / currentCandle.open * 100).toFixed(2);
            const isUp = changePct >= 0;

            els.changeArrow.textContent = isUp ? '▲' : '▼';
            els.changeValue.textContent = `${isUp ? '+' : ''}${changePct}%`;
            els.priceChange.classList.remove('up', 'down');
            els.priceChange.classList.add(isUp ? 'up' : 'down');
        }
    }

    function updateOpenPrice(open) {
        if (open) {
            els.openPrice.textContent = formatPrice(open);
            els.openPriceLabel.textContent = 'Preço X de referência';
        }
    }

    function updateResult(candle) {
        if (!candle || !candle.open || !candle.close) return;

        const diff = candle.close - candle.open;
        const pct = ((diff / candle.open) * 100).toFixed(4);
        const isUp = diff >= 0;

        els.resultCard.classList.remove('up', 'down');
        els.resultCard.classList.add(isUp ? 'up' : 'down');
        els.resultDirection.textContent = isUp ? '▲ SUBIU' : '▼ CAIU';
        els.resultPercent.textContent = `${isUp ? '+' : ''}${pct}%`;
    }

    function showLastResult(candle) {
        const section = els.lastResultSection;
        const dir = candle.direction || (candle.close >= candle.open ? 'up' : 'down');

        section.style.display = 'flex';
        section.classList.remove('up', 'down');
        section.classList.add(dir);

        els.lastResultDirection.textContent = dir === 'up' ? '▲ SUBIU' : '▼ CAIU';
        els.lastResultOpen.textContent = formatPrice(candle.open);
        els.lastResultClose.textContent = formatPrice(candle.close);

        const pct = ((candle.close - candle.open) / candle.open * 100).toFixed(4);
        els.lastResultPercent.textContent = `(${pct >= 0 ? '+' : ''}${pct}%)`;
    }

    function updateOHLC(candle) {
        if (!candle) return;
        els.ohlcOpen.textContent = candle.open ? formatPrice(candle.open) : '--';
        els.ohlcHigh.textContent = candle.high ? formatPrice(candle.high) : '--';
        els.ohlcLow.textContent = candle.low ? formatPrice(candle.low) : '--';
        els.ohlcClose.textContent = candle.close ? formatPrice(candle.close) : '--';
    }

    function setConnectionStatus(status) {
        const dot = els.connectionStatus.querySelector('.status-dot');
        const text = els.connectionStatus.querySelector('.status-text');

        dot.classList.remove('connected', 'error');

        switch (status) {
            case 'connected':
                dot.classList.add('connected');
                text.textContent = 'Conectado';
                break;
            case 'connecting':
                text.textContent = 'Conectando...';
                break;
            case 'disconnected':
                text.textContent = 'Reconectando...';
                break;
            case 'error':
                dot.classList.add('error');
                text.textContent = 'Erro';
                break;
        }
    }

    function hideOverlay() {
        els.chartOverlay.classList.add('hidden');
    }

    // ─── Clock & Countdown ──────────────────────
    function startClock() {
        updateClock();
        clockInterval = setInterval(updateClock, 1000);
    }

    function updateClock() {
        const brt = getBRTDate();
        const hours = String(brt.getHours()).padStart(2, '0');
        const minutes = String(brt.getMinutes()).padStart(2, '0');
        const seconds = String(brt.getSeconds()).padStart(2, '0');

        els.clockBRT.textContent = `${hours}:${minutes}:${seconds}`;

        // Candle countdown
        updateCandleCountdown();
    }

    function updateCandleCountdown() {
        const now = Date.now();
        const nextBoundary = Math.ceil(now / CANDLE_INTERVAL_MS) * CANDLE_INTERVAL_MS;
        const remaining = nextBoundary - now;

        const totalMinutes = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);

        els.candleCountdown.textContent = `${String(totalMinutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

        // Progress
        const progress = ((CANDLE_INTERVAL_MS - remaining) / CANDLE_INTERVAL_MS) * 100;
        els.candleProgress.style.width = `${progress}%`;
    }

    // ─── Utilidades ─────────────────────────────
    function formatPrice(price) {
        return new Intl.NumberFormat('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(price);
    }

    function getBRTDate() {
        const now = new Date();
        const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
        return new Date(utcMs + BRT_OFFSET * 60 * 60 * 1000);
    }

    // ─── Inicialização ─────────────────────────
    function init() {
        initChart();
        connectWebSocket();
        startClock();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
