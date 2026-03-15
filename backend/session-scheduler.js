const EventEmitter = require('events');

// Horário de Brasília: UTC-3
const BRT_OFFSET = -3;
const SESSION_START_HOUR = 9;  // 09:00 BRT
const SESSION_END_HOUR = 18;   // 18:00 BRT

class SessionScheduler extends EventEmitter {
    constructor() {
        super();
        this.isActive = false;
        this.timer = null;
        this.checkInterval = null;
    }

    start() {
        console.log('[Scheduler] Iniciando agendador de sessão...');
        this._check();
        // Verifica a cada 30 segundos
        this.checkInterval = setInterval(() => this._check(), 30000);
    }

    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        if (this.isActive) {
            this.isActive = false;
            this.emit('session_end');
        }
        console.log('[Scheduler] Agendador parado.');
    }

    isSessionActive() {
        return this.isActive;
    }

    getSessionInfo() {
        const now = this._getBRTDate();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();

        const currentTimeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        let remainingSessionMs = 0;
        if (this.isActive) {
            const endOfSession = new Date(now);
            endOfSession.setHours(SESSION_END_HOUR, 0, 0, 0);
            remainingSessionMs = Math.max(0, endOfSession.getTime() - now.getTime());
        }

        return {
            isActive: this.isActive,
            currentTimeBRT: currentTimeStr,
            sessionStart: `${String(SESSION_START_HOUR).padStart(2, '0')}:00`,
            sessionEnd: `${String(SESSION_END_HOUR).padStart(2, '0')}:00`,
            remainingSessionMs
        };
    }

    _getBRTDate() {
        const now = new Date();
        // Converte para BRT: UTC-3
        const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
        return new Date(utcMs + BRT_OFFSET * 60 * 60 * 1000);
    }

    _check() {
        const brt = this._getBRTDate();
        const hours = brt.getHours();
        const minutes = brt.getMinutes();
        const currentMinutes = hours * 60 + minutes;

        const startMinutes = SESSION_START_HOUR * 60;
        const endMinutes = SESSION_END_HOUR * 60;

        const shouldBeActive = currentMinutes >= startMinutes && currentMinutes < endMinutes;

        // Dia da semana: 0=Dom, 6=Sáb
        const dayOfWeek = brt.getDay();
        const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

        if (shouldBeActive && isWeekday && !this.isActive) {
            this.isActive = true;
            console.log(`[Scheduler] Sessão INICIADA às ${hours}:${String(minutes).padStart(2, '0')} BRT`);
            this.emit('session_start');
        } else if ((!shouldBeActive || !isWeekday) && this.isActive) {
            this.isActive = false;
            console.log(`[Scheduler] Sessão ENCERRADA às ${hours}:${String(minutes).padStart(2, '0')} BRT`);
            this.emit('session_end');
        }
    }
}

module.exports = SessionScheduler;
