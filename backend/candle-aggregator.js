const EventEmitter = require('events');

const CANDLE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos
const MARKER_INTERVAL_MS = 10 * 1000;      // 10 segundos

class CandleAggregator extends EventEmitter {
    constructor() {
        super();
        this.currentCandle = null;
        this.timer = null;
        this.markerTimer = null;
        this.lastPrice = null;
        this.markers = []; // Marcações a cada 10s dentro do candle
    }

    start() {
        // Calcula o próximo limite de 5 minutos alinhado
        const now = Date.now();
        const nextBoundary = Math.ceil(now / CANDLE_INTERVAL_MS) * CANDLE_INTERVAL_MS;
        const delay = nextBoundary - now;

        // Inicia um candle a partir de agora
        this._startNewCandle(now);

        // Inicia o timer de marcações a cada 10s
        this._startMarkerTimer();

        // Agenda o fechamento no próximo limite de 5 minutos
        this.timer = setTimeout(() => {
            this._closeCandle();
            // Depois usa setInterval para fechar a cada 5 minutos exatos
            this.timer = setInterval(() => {
                this._closeCandle();
            }, CANDLE_INTERVAL_MS);
        }, delay);

        console.log(`[Aggregator] Iniciado. Próximo fechamento em ${(delay / 1000).toFixed(1)}s`);
    }

    stop() {
        if (this.timer) {
            clearTimeout(this.timer);
            clearInterval(this.timer);
            this.timer = null;
        }
        this._stopMarkerTimer();

        // Fecha o candle atual se existir
        if (this.currentCandle && this.currentCandle.tradeCount > 0) {
            this._closeCandle();
        }

        this.currentCandle = null;
        console.log('[Aggregator] Parado.');
    }

    processTrade(trade) {
        this.lastPrice = trade.price;

        if (!this.currentCandle) {
            this._startNewCandle(trade.timestamp);
        }

        const candle = this.currentCandle;

        if (candle.open === null) {
            candle.open = trade.price;
        }

        candle.close = trade.price;
        candle.high = Math.max(candle.high || trade.price, trade.price);
        candle.low = Math.min(candle.low || trade.price, trade.price);
        candle.tradeCount++;

        // Emite atualização do candle em progresso
        this.emit('candle_update', this.getCurrentCandleData());
    }

    getCurrentCandleData() {
        if (!this.currentCandle) return null;

        const c = this.currentCandle;
        const now = Date.now();
        const elapsed = now - c.timestamp;
        const remaining = Math.max(0, CANDLE_INTERVAL_MS - elapsed);

        return {
            open: c.open,
            close: c.close,
            high: c.high,
            low: c.low,
            timestamp: c.timestamp,
            remainingMs: remaining,
            isComplete: false,
            markers: this.markers
        };
    }

    getLastPrice() {
        return this.lastPrice;
    }

    getMarkers() {
        return this.markers;
    }

    _startMarkerTimer() {
        this._stopMarkerTimer();
        this.markerTimer = setInterval(() => {
            this._captureMarker();
        }, MARKER_INTERVAL_MS);
    }

    _stopMarkerTimer() {
        if (this.markerTimer) {
            clearInterval(this.markerTimer);
            this.markerTimer = null;
        }
    }

    _captureMarker() {
        if (!this.currentCandle || this.lastPrice === null || this.currentCandle.open === null) return;

        const now = Date.now();
        const open = this.currentCandle.open;
        const price = this.lastPrice;
        const direction = price > open ? 'up' : price < open ? 'down' : 'neutral';
        const diffPercent = ((price - open) / open * 100);

        const marker = {
            timestamp: now,
            price: price,
            openPrice: open,
            direction: direction,
            diffPercent: parseFloat(diffPercent.toFixed(4)),
            elapsed: now - this.currentCandle.timestamp
        };

        this.markers.push(marker);
        this.emit('marker', marker);
    }

    _startNewCandle(timestamp) {
        // Alinha o timestamp ao limite de 5 minutos
        const aligned = Math.floor(timestamp / CANDLE_INTERVAL_MS) * CANDLE_INTERVAL_MS;

        this.currentCandle = {
            open: null,
            close: null,
            high: null,
            low: null,
            timestamp: aligned,
            tradeCount: 0
        };

        // Limpa marcadores do candle anterior
        this.markers = [];
    }

    _closeCandle() {
        if (this.currentCandle && this.currentCandle.tradeCount > 0) {
            const c = this.currentCandle;
            const direction = c.close > c.open ? 'up' : c.close < c.open ? 'down' : 'neutral';

            const closedCandle = {
                open: c.open,
                close: c.close,
                high: c.high,
                low: c.low,
                timestamp: c.timestamp,
                isComplete: true,
                direction: direction,
                diffPercent: parseFloat(((c.close - c.open) / c.open * 100).toFixed(4)),
                markers: [...this.markers]
            };

            console.log(`[Aggregator] Candle fechado: O:${closedCandle.open} C:${closedCandle.close} → ${direction.toUpperCase()} (${closedCandle.diffPercent > 0 ? '+' : ''}${closedCandle.diffPercent}%)`);
            this.emit('candle_closed', closedCandle);
        }

        // Inicia novo candle
        this._startNewCandle(Date.now());
    }
}

module.exports = CandleAggregator;
