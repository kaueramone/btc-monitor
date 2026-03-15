const { createClient } = require('@supabase/supabase-js');

class SupabaseService {
    constructor() {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_KEY;

        if (!url || !key) {
            console.warn('[Supabase] SUPABASE_URL ou SUPABASE_KEY não configurados. Persistência desabilitada.');
            this.client = null;
            return;
        }

        this.client = createClient(url, key);
        console.log('[Supabase] Cliente inicializado.');
    }

    async getTodaySession() {
        if (!this.client) return null;

        const today = this._getTodayDateBRT();

        try {
            // Verifica se já existe sessão para hoje
            const { data: existing, error: fetchError } = await this.client
                .from('btc_sessions')
                .select('*')
                .eq('date', today)
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') {
                console.error('[Supabase] Erro ao buscar sessão:', fetchError.message);
                return null;
            }

            if (existing) {
                console.log(`[Supabase] Sessão encontrada: ${existing.id} (${today})`);
                return existing;
            }

            // Cria nova sessão
            return await this.createSession(today);
        } catch (err) {
            console.error('[Supabase] Erro ao obter sessão de hoje:', err.message);
            return null;
        }
    }

    async createSession(date) {
        if (!this.client) return null;

        try {
            const { data, error } = await this.client
                .from('btc_sessions')
                .insert({ date })
                .select()
                .single();

            if (error) {
                console.error('[Supabase] Erro ao criar sessão:', error.message);
                return null;
            }

            console.log(`[Supabase] Nova sessão criada: ${data.id} (${date})`);
            return data;
        } catch (err) {
            console.error('[Supabase] Erro ao criar sessão:', err.message);
            return null;
        }
    }

    async saveCandle(sessionId, candle) {
        if (!this.client || !sessionId) return null;

        try {
            const { data, error } = await this.client
                .from('btc_candles')
                .insert({
                    session_id: sessionId,
                    open: candle.open,
                    close: candle.close,
                    high: candle.high,
                    low: candle.low,
                    timestamp: new Date(candle.timestamp).toISOString()
                })
                .select()
                .single();

            if (error) {
                console.error('[Supabase] Erro ao salvar candle:', error.message);
                return null;
            }

            console.log(`[Supabase] Candle salvo: ${data.id}`);
            return data;
        } catch (err) {
            console.error('[Supabase] Erro ao salvar candle:', err.message);
            return null;
        }
    }

    async getSessionCandles(sessionId) {
        if (!this.client || !sessionId) return [];

        try {
            const { data, error } = await this.client
                .from('btc_candles')
                .select('*')
                .eq('session_id', sessionId)
                .order('timestamp', { ascending: true });

            if (error) {
                console.error('[Supabase] Erro ao buscar candles:', error.message);
                return [];
            }

            return data || [];
        } catch (err) {
            console.error('[Supabase] Erro ao buscar candles:', err.message);
            return [];
        }
    }

    _getTodayDateBRT() {
        // Horário de Brasília = UTC-3
        const now = new Date();
        const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
        return brt.toISOString().split('T')[0];
    }
}

module.exports = SupabaseService;
