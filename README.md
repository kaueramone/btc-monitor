# ₿ BTC Monitor 24/7 — Real-Time Pulse ⚡

> "Because the market never sleeps, your monitoring shouldn't either."

![BTC Monitor Banner](https://img.shields.io/badge/Bitcoin-Monitor-F7931A?style=for-the-badge&logo=bitcoin&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![WebSocket](https://img.shields.io/badge/WebSocket-010101?style=for-the-badge&logo=socketdotio&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)

Este é um monitor de alta precisão para o par **BTCUSDT**, projetado para rodar em servidores VPS e suportar múltiplos usuários simultâneos com baixíssimo consumo de recursos.

---

## ✨ Diferenciais Criativos

### 🎯 O "Preço X" e o Veredito
A cada 5 minutos, o sistema define o **Preço X** (Abertura). Pelos próximos 300 segundos, ele monitora cada oscilação. Ao final, o veredito é implacável: **▲ SUBIU** ou **▼ CAIU** em relação ao ponto de partida.

### 📊 Timeline de 10 Segundos
Não espere 5 minutos para saber o que está acontecendo. Nossa timeline exclusiva tira "raios-x" do preço a cada **10 segundos**, gerando um histórico visual de micro-tendências dentro de cada candle.

### 🌑 Design Glassmorphism Premium
Uma interface escura, moderna e minimalista. Desenvolvida para ser fixada em uma segunda tela ou monitorada via mobile, sem poluição visual, focando no que importa: o preço.

---

## 🛠️ Arquitetura de Elite

- **Backend:** Node.js robusto que centraliza a conexão com a Binance.
- **Broadcast:** Apenas o servidor consome a API; os clientes recebem dados via WebSocket local, otimizando banda e evitando rate-limits.
- **Banco de Dados:** Persistência automática no Supabase para análise histórica.
- **Frontend:** Ultra-leve usando **Lightweight Charts** (pela equipe do TradingView).

---

## 🚀 Como Iniciar

### 1. Preparação
```bash
git clone https://github.com/kaueramone/btc-monitor.git
cd btc-monitor
cd backend && npm install
```

### 2. Variáveis de Ambiente
Crie um arquivo `.env` na raiz com:
```env
PORT=3000
SUPABASE_URL=seu_url
SUPABASE_KEY=sua_chave
```

### 3. Decolagem
```bash
# Desenvolvimento
node backend/server.js

# Produção (PM2)
pm2 start ecosystem.config.js
```

---

## 📸 Snapshot do Sistema

*(Adicione aqui um screenshot da sua aplicação rodando)*

---

## 📄 Licença
Distribuído sob a licença MIT. Veja `LICENSE` para mais informações.

---

<p align="center">
  Desenvolvido com 🧡 para a comunidade cripto.
</p>
