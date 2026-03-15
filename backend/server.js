require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const BinanceStream = require('./binance-stream');
const CandleAggregator = require('./candle-aggregator');
const SupabaseService = require('./supabase-service');

// ─── Configuração ───────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
const PRICE_THROTTLE_MS = 1000; // Envia tick de preço no máximo 1x/s

// ─── MIME types para servir frontend ───────────────────────
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// ─── Inicializa módulos ─────────────────────────────────────
const binance = new BinanceStream();
const aggregator = new CandleAggregator();
const supabase = new SupabaseService();

let currentSession = null;
let closedCandles = [];
let lastPriceBroadcast = 0;

// ─── HTTP Server (serve frontend estático) ──────────────────
const server = http.createServer((req, res) => {
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(FRONTEND_DIR, filePath);

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

// ─── WebSocket Server ───────────────────────────────────────
const wss = new WebSocket.Server({ server });

function broadcast(message) {
    const data = JSON.stringify(message);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}

wss.on('connection', (ws) => {
    console.log(`[WS] Cliente conectado. Total: ${wss.clients.size}`);

    // Envia estado atual para o novo cliente
    const currentCandleData = aggregator.getCurrentCandleData();

    ws.send(JSON.stringify({
        type: 'session_state',
        candles: closedCandles,
        currentCandle: currentCandleData,
        lastPrice: aggregator.getLastPrice(),
        markers: aggregator.getMarkers()
    }));

    ws.on('close', () => {
        console.log(`[WS] Cliente desconectado. Total: ${wss.clients.size}`);
    });
});

// ─── Binance → Aggregator → Broadcast ──────────────────────
binance.on('trade', (trade) => {
    aggregator.processTrade(trade);

    // Throttle: envia tick de preço no máximo 1x/s
    const now = Date.now();
    if (now - lastPriceBroadcast >= PRICE_THROTTLE_MS) {
        lastPriceBroadcast = now;
        broadcast({
            type: 'price_tick',
            price: trade.price,
            timestamp: trade.timestamp
        });
    }
});

aggregator.on('candle_update', (candle) => {
    broadcast({
        type: 'candle_update',
        candle
    });
});

aggregator.on('marker', (marker) => {
    broadcast({
        type: 'marker',
        marker
    });
});

aggregator.on('candle_closed', async (candle) => {
    closedCandles.push(candle);

    // Mantém apenas os últimos 200 candles em memória
    if (closedCandles.length > 200) {
        closedCandles = closedCandles.slice(-200);
    }

    // Salva no Supabase
    if (currentSession) {
        await supabase.saveCandle(currentSession.id, candle);
    }

    broadcast({
        type: 'candle_closed',
        candle
    });
});

// ─── Inicia tudo (24h, sem restrição de horário) ────────────
async function startMonitoring() {
    console.log('[Server] Iniciando monitoramento 24h...');

    // Busca ou cria sessão de hoje
    currentSession = await supabase.getTodaySession();

    // Carrega candles já salvos nesta sessão
    if (currentSession) {
        const saved = await supabase.getSessionCandles(currentSession.id);
        closedCandles = saved.map(c => ({
            open: c.open,
            close: c.close,
            high: c.high,
            low: c.low,
            timestamp: new Date(c.timestamp).getTime(),
            isComplete: true,
            direction: c.close > c.open ? 'up' : c.close < c.open ? 'down' : 'neutral',
            diffPercent: parseFloat(((c.close - c.open) / c.open * 100).toFixed(4))
        }));
        console.log(`[Server] ${closedCandles.length} candles carregados do Supabase.`);
    }

    // Inicia coleta
    binance.start();
    aggregator.start();
}

// ─── Meia-noite: nova sessão ────────────────────────────────
function scheduleMidnightReset() {
    const now = new Date();
    const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const tomorrow = new Date(brt);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const delay = tomorrow.getTime() - brt.getTime();

    setTimeout(async () => {
        console.log('[Server] Meia-noite BRT — criando nova sessão...');
        currentSession = await supabase.getTodaySession();
        closedCandles = [];
        scheduleMidnightReset();
    }, delay);
}

server.listen(PORT, () => {
    console.log(`\n════════════════════════════════════════════════`);
    console.log(`  BTC Monitor — 24h | Porta ${PORT}`);
    console.log(`  Frontend: http://localhost:${PORT}`);
    console.log(`════════════════════════════════════════════════\n`);

    startMonitoring();
    scheduleMidnightReset();
});

// ─── Graceful shutdown ──────────────────────────────────────
process.on('SIGINT', () => {
    console.log('\n[Server] Encerrando...');
    binance.stop();
    aggregator.stop();
    wss.close();
    server.close(() => {
        console.log('[Server] Encerrado.');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    process.emit('SIGINT');
});
