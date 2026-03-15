const WebSocket = require('ws');
const EventEmitter = require('events');

class BinanceStream extends EventEmitter {
  constructor() {
    super();
    this.ws = null;
    this.isConnected = false;
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    this.shouldReconnect = false;
    this.url = 'wss://stream.binance.com:9443/ws/btcusdt@trade';
  }

  start() {
    this.shouldReconnect = true;
    this.reconnectDelay = 1000;
    this._connect();
  }

  stop() {
    this.shouldReconnect = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    console.log('[Binance] Stream parado.');
  }

  _connect() {
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
    }

    console.log('[Binance] Conectando...');

    this.ws = new WebSocket(this.url);

    this.ws.on('open', () => {
      console.log('[Binance] Conectado ao stream BTCUSDT.');
      this.isConnected = true;
      this.reconnectDelay = 1000;
      this.emit('connected');
    });

    this.ws.on('message', (data) => {
      try {
        const trade = JSON.parse(data);
        this.emit('trade', {
          price: parseFloat(trade.p),
          quantity: parseFloat(trade.q),
          timestamp: trade.T,
          isBuyerMaker: trade.m
        });
      } catch (err) {
        console.error('[Binance] Erro ao parsear trade:', err.message);
      }
    });

    this.ws.on('close', () => {
      this.isConnected = false;
      console.log('[Binance] Conexão fechada.');
      this._maybeReconnect();
    });

    this.ws.on('error', (err) => {
      console.error('[Binance] Erro:', err.message);
      this.isConnected = false;
    });
  }

  _maybeReconnect() {
    if (!this.shouldReconnect) return;

    console.log(`[Binance] Reconectando em ${this.reconnectDelay / 1000}s...`);
    setTimeout(() => {
      this._connect();
    }, this.reconnectDelay);

    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
  }
}

module.exports = BinanceStream;
