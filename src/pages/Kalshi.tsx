<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DFlow Trading Module - Fixed</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://unpkg.com/lightweight-charts/dist/lightweight-charts.standalone.production.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        body {
            background: #0a0e17;
            color: #fff;
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 0;
            border-bottom: 1px solid #1e2530;
            margin-bottom: 20px;
        }

        .logo {
            font-size: 24px;
            font-weight: bold;
            color: #00d4aa;
        }

        .connection-status {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 16px;
            background: #1a1f2e;
            border-radius: 20px;
        }

        .status-indicator {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #ef4444;
        }

        .status-indicator.connected {
            background: #10b981;
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        .trading-layout {
            display: grid;
            grid-template-columns: 1fr 350px;
            gap: 20px;
            height: calc(100vh - 150px);
        }

        .main-panel {
            display: flex;
            flex-direction: column;
            gap: 20px;
        }

        .market-selector {
            background: #1a1f2e;
            border-radius: 12px;
            padding: 15px;
        }

        .market-select {
            width: 100%;
            padding: 10px;
            background: #131722;
            border: 1px solid #2a2e39;
            border-radius: 8px;
            color: white;
            font-size: 16px;
        }

        .market-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 15px;
        }

        .price-display {
            font-size: 32px;
            font-weight: bold;
            color: #00d4aa;
        }

        .price-change {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
        }

        .price-change.positive {
            background: rgba(16, 185, 129, 0.2);
            color: #10b981;
        }

        .price-change.negative {
            background: rgba(239, 68, 68, 0.2);
            color: #ef4444;
        }

        .chart-container {
            background: #1a1f2e;
            border-radius: 12px;
            padding: 20px;
            flex: 1;
            position: relative;
        }

        #trading-chart {
            width: 100%;
            height: 400px;
        }

        .chart-controls {
            display: flex;
            gap: 10px;
            margin-top: 15px;
            padding: 10px;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 8px;
        }

        .timeframe-btn {
            padding: 6px 12px;
            background: transparent;
            border: 1px solid #2a2e39;
            border-radius: 6px;
            color: #8a94a6;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s;
        }

        .timeframe-btn:hover {
            background: rgba(42, 46, 57, 0.5);
        }

        .timeframe-btn.active {
            background: #00d4aa;
            color: white;
            border-color: #00d4aa;
        }

        .trading-controls {
            background: #1a1f2e;
            border-radius: 12px;
            padding: 20px;
        }

        .trade-form {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }

        .form-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .form-label {
            font-size: 14px;
            color: #8a94a6;
        }

        .form-input {
            padding: 12px;
            background: #131722;
            border: 1px solid #2a2e39;
            border-radius: 8px;
            color: white;
            font-size: 16px;
        }

        .slippage-selector {
            grid-column: 1 / -1;
        }

        .trade-buttons {
            grid-column: 1 / -1;
            display: flex;
            gap: 10px;
            margin-top: 10px;
        }

        .trade-button {
            flex: 1;
            padding: 14px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }

        .buy-button {
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
        }

        .buy-button:hover {
            background: linear-gradient(135deg, #059669, #047857);
            transform: translateY(-2px);
        }

        .sell-button {
            background: linear-gradient(135deg, #ef4444, #dc2626);
            color: white;
        }

        .sell-button:hover {
            background: linear-gradient(135deg, #dc2626, #b91c1c);
            transform: translateY(-2px);
        }

        .side-panel {
            display: flex;
            flex-direction: column;
            gap: 20px;
        }

        .orderbook-panel, .trades-panel, .positions-panel {
            background: #1a1f2e;
            border-radius: 12px;
            padding: 20px;
            flex: 1;
        }

        .panel-title {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 15px;
            color: #e0e0e0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .orderbook {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .orderbook-header {
            display: grid;
            grid-template-columns: 1fr 1fr;
            padding: 8px 0;
            font-size: 12px;
            color: #8a94a6;
            border-bottom: 1px solid #2a2e39;
        }

        .orderbook-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            padding: 8px 0;
            font-size: 13px;
            transition: background 0.2s;
        }

        .orderbook-row:hover {
            background: rgba(42, 46, 57, 0.3);
        }

        .bid-row {
            color: #10b981;
        }

        .ask-row {
            color: #ef4444;
        }

        .trade-history {
            max-height: 300px;
            overflow-y: auto;
        }

        .trade-row {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            padding: 8px 0;
            font-size: 13px;
            border-bottom: 1px solid rgba(42, 46, 57, 0.5);
        }

        .trade-row:last-child {
            border-bottom: none;
        }

        .trade-side.buy {
            color: #10b981;
        }

        .trade-side.sell {
            color: #ef4444;
        }

        .positions-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .position-item {
            background: rgba(42, 46, 57, 0.3);
            padding: 12px;
            border-radius: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .position-pnl {
            font-weight: 600;
        }

        .position-pnl.positive {
            color: #10b981;
        }

        .position-pnl.negative {
            color: #ef4444;
        }

        .loading-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(26, 31, 46, 0.9);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            gap: 15px;
            border-radius: 12px;
            z-index: 100;
        }

        .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid #2a2e39;
            border-top-color: #00d4aa;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .error-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(26, 31, 46, 0.95);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            gap: 15px;
            border-radius: 12px;
            z-index: 100;
            padding: 20px;
            text-align: center;
        }

        .error-icon {
            font-size: 48px;
            color: #ef4444;
        }

        .retry-button {
            padding: 10px 20px;
            background: #00d4aa;
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            margin-top: 10px;
        }

        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: #1a1f2e;
            border-left: 4px solid #00d4aa;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 1000;
            animation: slideIn 0.3s ease;
            max-width: 300px;
        }

        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }

        .notification.error {
            border-left-color: #ef4444;
        }

        .notification.warning {
            border-left-color: #f59e0b;
        }

        @media (max-width: 1200px) {
            .trading-layout {
                grid-template-columns: 1fr;
                height: auto;
            }
            
            .side-panel {
                display: grid;
                grid-template-columns: 1fr 1fr;
            }
        }

        @media (max-width: 768px) {
            .side-panel {
                grid-template-columns: 1fr;
            }
            
            .trade-form {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <div class="logo">DFlow Trading</div>
            <div class="connection-status">
                <div class="status-indicator" id="status-indicator"></div>
                <span id="status-text">Connecting...</span>
            </div>
        </div>

        <!-- Main Trading Layout -->
        <div class="trading-layout">
            <!-- Left Panel -->
            <div class="main-panel">
                <!-- Market Selector -->
                <div class="market-selector">
                    <select class="market-select" id="market-select">
                        <option value="">Loading markets...</option>
                    </select>
                    <div class="market-info">
                        <div>
                            <div id="market-title" class="text-lg font-semibold">Select a market</div>
                            <div id="market-volume" class="text-sm text-gray-400">Volume: -</div>
                        </div>
                        <div class="text-right">
                            <div id="market-price" class="price-display">-</div>
                            <div id="price-change" class="price-change">0.00%</div>
                        </div>
                    </div>
                </div>

                <!-- Chart -->
                <div class="chart-container">
                    <div id="trading-chart"></div>
                    <div class="chart-controls">
                        <button class="timeframe-btn active" data-interval="1">1m</button>
                        <button class="timeframe-btn" data-interval="5">5m</button>
                        <button class="timeframe-btn" data-interval="15">15m</button>
                        <button class="timeframe-btn" data-interval="60">1h</button>
                        <button class="timeframe-btn" data-interval="240">4h</button>
                        <button class="timeframe-btn" data-interval="1440">1d</button>
                    </div>
                </div>

                <!-- Trading Controls -->
                <div class="trading-controls">
                    <div class="trade-form">
                        <div class="form-group">
                            <label class="form-label">Amount</label>
                            <input type="number" class="form-input" id="trade-amount" placeholder="0.00" step="0.01" min="0">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Price</label>
                            <input type="number" class="form-input" id="trade-price" placeholder="0.00" step="0.0001" min="0">
                        </div>
                        <div class="form-group slippage-selector">
                            <label class="form-label">Slippage Tolerance</label>
                            <select class="form-input" id="slippage-select">
                                <option value="10">0.1%</option>
                                <option value="50" selected>0.5%</option>
                                <option value="100">1.0%</option>
                                <option value="200">2.0%</option>
                                <option value="500">5.0%</option>
                            </select>
                        </div>
                        <div class="trade-buttons">
                            <button class="trade-button buy-button" id="buy-button">
                                BUY YES
                            </button>
                            <button class="trade-button sell-button" id="sell-button">
                                SELL YES
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right Panel -->
            <div class="side-panel">
                <!-- Orderbook -->
                <div class="orderbook-panel">
                    <div class="panel-title">
                        <span>Order Book</span>
                        <span id="orderbook-spread">Spread: -</span>
                    </div>
                    <div class="orderbook-header">
                        <div>Bid (YES)</div>
                        <div>Ask (NO)</div>
                    </div>
                    <div class="orderbook" id="orderbook">
                        <!-- Orderbook rows will be inserted here -->
                    </div>
                </div>

                <!-- Recent Trades -->
                <div class="trades-panel">
                    <div class="panel-title">Recent Trades</div>
                    <div class="trade-history" id="trade-history">
                        <!-- Trade rows will be inserted here -->
                    </div>
                </div>

                <!-- Positions -->
                <div class="positions-panel">
                    <div class="panel-title">Open Positions</div>
                    <div class="positions-list" id="positions-list">
                        <!-- Position items will be inserted here -->
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Loading Overlay -->
    <div class="loading-overlay" id="loading-overlay">
        <div class="spinner"></div>
        <div>Connecting to DFlow...</div>
    </div>

    <!-- Notification Container -->
    <div id="notification-container"></div>

    <script>
        // ==============================
        // CONFIGURATION & SECRETS
        // ==============================
        const DFLOW_CONFIG = {
            // Get API key from secrets manager or localStorage
            getApiKey: function() {
                // Priority 1: Global secrets manager
                if (window.dflowSecrets?.apiKey) {
                    return window.dflowSecrets.apiKey;
                }
                
                // Priority 2: LocalStorage
                const storedKey = localStorage.getItem('dflow_api_key');
                if (storedKey) {
                    return storedKey;
                }
                
                // Priority 3: Environment variable (if using Node)
                if (typeof process !== 'undefined' && process.env.DFLOW_API_KEY) {
                    return process.env.DFLOW_API_KEY;
                }
                
                throw new Error('DFlow API key not found. Please add it to dflowSecrets.apiKey or localStorage');
            },
            
            endpoints: {
                ws: 'wss://prediction-markets-api.dflow.net/api/v1/ws',
                markets: 'https://prediction-markets-api.dflow.net/api/v1/markets',
                events: 'https://prediction-markets-api.dflow.net/api/v1/events',
                market: 'https://prediction-markets-api.dflow.net/api/v1/market',
                candlesticks: 'https://prediction-markets-api.dflow.net/api/v1/market',
                orderbook: 'https://prediction-markets-api.dflow.net/api/v1/orderbook/by-mint',
                trades: 'https://prediction-markets-api.dflow.net/api/v1/trades',
                quote: 'https://quote-api.dflow.net/quote',
                swap: 'https://quote-api.dflow.net/swap',
                orderStatus: 'https://quote-api.dflow.net/order-status'
            },
            
            defaultMarket: 'BTCD-25DEC0313-T92749.99', // Fallback market
            maxReconnectAttempts: 5,
            cacheTTL: 300000, // 5 minutes
            priceUpdateInterval: 1000, // 1 second
            chartHistoryHours: 24
        };

        // ==============================
        // FIXED WEBSOCKET MANAGER
        // ==============================
        class FixedWebSocketManager {
            constructor() {
                this.ws = null;
                this.apiKey = null;
                this.reconnectAttempts = 0;
                this.maxAttempts = DFLOW_CONFIG.maxReconnectAttempts;
                this.isConnected = false;
                this.isConnecting = false;
                this.subscriptions = new Set();
                this.messageQueue = [];
                this.reconnectTimeout = null;
                this.heartbeatInterval = null;
                
                // Bind event handlers
                this.handleOpen = this.handleOpen.bind(this);
                this.handleMessage = this.handleMessage.bind(this);
                this.handleError = this.handleError.bind(this);
                this.handleClose = this.handleClose.bind(this);
                
                // Initialize
                this.initialize();
            }
            
            async initialize() {
                try {
                    this.apiKey = DFLOW_CONFIG.getApiKey();
                    console.log('✅ Got API key');
                    await this.connect();
                } catch (error) {
                    console.error('❌ Failed to initialize WebSocket:', error);
                    this.showError('Connection failed: ' + error.message);
                    this.scheduleReconnect();
                }
            }
            
            async connect() {
                if (this.isConnecting || this.isConnected) {
                    return;
                }
                
                this.isConnecting = true;
                this.updateStatus('Connecting...');
                
                try {
                    // Close existing connection
                    if (this.ws) {
                        this.ws.close();
                    }
                    
                    // Create new connection with API key
                    const wsUrl = `${DFLOW_CONFIG.endpoints.ws}?x-api-key=${encodeURIComponent(this.apiKey)}`;
                    console.log('🔗 Connecting to:', wsUrl);
                    
                    this.ws = new WebSocket(wsUrl);
                    
                    // Set up event handlers
                    this.ws.onopen = this.handleOpen;
                    this.ws.onmessage = this.handleMessage;
                    this.ws.onerror = this.handleError;
                    this.ws.onclose = this.handleClose;
                    
                    // Set connection timeout
                    setTimeout(() => {
                        if (this.ws?.readyState === WebSocket.CONNECTING) {
                            console.error('WebSocket connection timeout');
                            this.ws.close();
                            this.scheduleReconnect();
                        }
                    }, 10000);
                    
                } catch (error) {
                    console.error('WebSocket connection error:', error);
                    this.isConnecting = false;
                    this.scheduleReconnect();
                }
            }
            
            handleOpen() {
                console.log('✅ WebSocket connected successfully');
                this.isConnected = true;
                this.isConnecting = false;
                this.reconnectAttempts = 0;
                
                // Clear any reconnect timeout
                if (this.reconnectTimeout) {
                    clearTimeout(this.reconnectTimeout);
                    this.reconnectTimeout = null;
                }
                
                // Update UI
                this.updateStatus('Connected', true);
                this.hideLoading();
                
                // Send queued messages
                this.flushMessageQueue();
                
                // Restore subscriptions
                this.restoreSubscriptions();
                
                // Start heartbeat
                this.startHeartbeat();
                
                // Emit connected event
                this.dispatchEvent('connected');
            }
            
            handleMessage(event) {
                try {
                    const data = JSON.parse(event.data);
                    
                    // Handle heartbeat response
                    if (data.type === 'pong') {
                        return;
                    }
                    
                    // Route message by channel
                    switch (data.channel) {
                        case 'prices':
                            this.handlePriceUpdate(data);
                            break;
                        case 'trades':
                            this.handleTradeUpdate(data);
                            break;
                        case 'orderbook':
                            this.handleOrderbookUpdate(data);
                            break;
                        default:
                            console.log('Unknown channel:', data.channel, data);
                    }
                    
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error, event.data);
                }
            }
            
            handleError(error) {
                console.error('WebSocket error:', error);
                this.isConnecting = false;
                this.dispatchEvent('error', error);
            }
            
            handleClose(event) {
                console.log(`WebSocket closed: ${event.code} ${event.reason}`);
                this.isConnected = false;
                this.isConnecting = false;
                
                // Clean up heartbeat
                this.stopHeartbeat();
                
                // Update UI
                this.updateStatus('Disconnected', false);
                
                // Notify listeners
                this.dispatchEvent('disconnected', event);
                
                // Reconnect if not normal closure
                if (event.code !== 1000 && event.code !== 1005) {
                    this.scheduleReconnect();
                }
            }
            
            scheduleReconnect() {
                if (this.reconnectAttempts >= this.maxAttempts) {
                    console.error('Max reconnection attempts reached');
                    this.showError('Unable to connect to DFlow. Please refresh the page.');
                    return;
                }
                
                this.reconnectAttempts++;
                const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
                
                console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxAttempts})`);
                
                this.reconnectTimeout = setTimeout(() => {
                    this.connect();
                }, delay);
            }
            
            startHeartbeat() {
                this.stopHeartbeat();
                this.heartbeatInterval = setInterval(() => {
                    if (this.isConnected) {
                        this.send({ type: 'ping' });
                    }
                }, 30000); // Every 30 seconds
            }
            
            stopHeartbeat() {
                if (this.heartbeatInterval) {
                    clearInterval(this.heartbeatInterval);
                    this.heartbeatInterval = null;
                }
            }
            
            send(data) {
                const message = JSON.stringify(data);
                
                if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
                    this.ws.send(message);
                    return true;
                } else {
                    // Queue message for when connection is restored
                    this.messageQueue.push(message);
                    return false;
                }
            }
            
            flushMessageQueue() {
                while (this.messageQueue.length > 0) {
                    const message = this.messageQueue.shift();
                    if (this.ws?.readyState === WebSocket.OPEN) {
                        this.ws.send(message);
                    }
                }
            }
            
            subscribe(channel, options = {}) {
                const subscription = {
                    type: 'subscribe',
                    channel,
                    ...options
                };
                
                // Store subscription
                const key = JSON.stringify(subscription);
                this.subscriptions.add(key);
                
                // Send subscription
                if (this.isConnected) {
                    this.send(subscription);
                }
                
                return () => this.unsubscribe(channel, options);
            }
            
            unsubscribe(channel, options = {}) {
                const unsubscribeMsg = {
                    type: 'unsubscribe',
                    channel,
                    ...options
                };
                
                // Remove from stored subscriptions
                const subKey = JSON.stringify({
                    type: 'subscribe',
                    channel,
                    ...options
                });
                this.subscriptions.delete(subKey);
                
                // Send unsubscribe
                if (this.isConnected) {
                    this.send(unsubscribeMsg);
                }
            }
            
            restoreSubscriptions() {
                this.subscriptions.forEach(subStr => {
                    try {
                        const sub = JSON.parse(subStr);
                        this.send(sub);
                    } catch (error) {
                        console.error('Failed to restore subscription:', error);
                    }
                });
            }
            
            handlePriceUpdate(data) {
                // Update chart
                if (window.tradingChart) {
                    window.tradingChart.updatePrice(data);
                }
                
                // Update price display
                this.updatePriceDisplay(data);
                
                // Dispatch event
                this.dispatchEvent('price', data);
            }
            
            handleTradeUpdate(data) {
                // Update trade history
                this.updateTradeHistory(data);
                
                // Dispatch event
                this.dispatchEvent('trade', data);
            }
            
            handleOrderbookUpdate(data) {
                // Update orderbook display
                this.updateOrderbook(data);
                
                // Dispatch event
                this.dispatchEvent('orderbook', data);
            }
            
            updateStatus(text, connected = false) {
                const indicator = document.getElementById('status-indicator');
                const statusText = document.getElementById('status-text');
                
                if (indicator) {
                    indicator.className = 'status-indicator';
                    if (connected) {
                        indicator.classList.add('connected');
                    }
                }
                
                if (statusText) {
                    statusText.textContent = text;
                }
            }
            
            updatePriceDisplay(data) {
                const price = data.yes_bid || data.yes_ask || data.price;
                if (price) {
                    const priceElement = document.getElementById('market-price');
                    if (priceElement) {
                        priceElement.textContent = `$${parseFloat(price).toFixed(4)}`;
                    }
                }
            }
            
            updateTradeHistory(data) {
                // Implementation depends on your trade history UI
                // This is a placeholder
                console.log('Trade update:', data);
            }
            
            updateOrderbook(data) {
                // Implementation depends on your orderbook UI
                // This is a placeholder
                console.log('Orderbook update:', data);
            }
            
            dispatchEvent(eventName, data = null) {
                const event = new CustomEvent(`dflow:${eventName}`, {
                    detail: data
                });
                window.dispatchEvent(event);
            }
            
            showError(message) {
                this.showNotification(message, 'error');
            }
            
            showNotification(message, type = 'info') {
                const container = document.getElementById('notification-container');
                if (!container) return;
                
                const notification = document.createElement('div');
                notification.className = `notification ${type}`;
                notification.textContent = message;
                notification.style.opacity = '1';
                
                container.appendChild(notification);
                
                // Remove after 5 seconds
                setTimeout(() => {
                    notification.style.opacity = '0';
                    setTimeout(() => {
                        if (notification.parentNode) {
                            notification.parentNode.removeChild(notification);
                        }
                    }, 300);
                }, 5000);
            }
            
            hideLoading() {
                const overlay = document.getElementById('loading-overlay');
                if (overlay) {
                    overlay.style.display = 'none';
                }
            }
            
            disconnect() {
                if (this.ws) {
                    this.ws.close(1000, 'User disconnected');
                }
                this.stopHeartbeat();
                this.subscriptions.clear();
                this.messageQueue = [];
                this.isConnected = false;
                this.isConnecting = false;
            }
        }

        // ==============================
        // FIXED CHART IMPLEMENTATION
        // ==============================
        class FixedTradingChart {
            constructor(containerId) {
                this.container = document.getElementById(containerId);
                if (!this.container) {
                    throw new Error(`Chart container #${containerId} not found`);
                }
                
                this.chart = null;
                this.candlestickSeries = null;
                this.volumeSeries = null;
                this.currentData = [];
                this.currentInterval = 60; // 1 hour default
                this.currentMarket = null;
                
                // Initialize
                this.initialize();
            }
            
            initialize() {
                // Clear container
                this.container.innerHTML = '';
                
                // Create chart instance
                this.chart = LightweightCharts.createChart(this.container, {
                    width: this.container.clientWidth,
                    height: this.container.clientHeight,
                    layout: {
                        background: { color: '#131722' },
                        textColor: '#d1d4dc',
                    },
                    grid: {
                        vertLines: { color: 'rgba(42, 46, 57, 0.6)' },
                        horzLines: { color: 'rgba(42, 46, 57, 0.6)' },
                    },
                    rightPriceScale: {
                        borderColor: 'rgba(197, 203, 206, 0.8)',
                        scaleMargins: {
                            top: 0.1,
                            bottom: 0.2,
                        },
                    },
                    timeScale: {
                        borderColor: 'rgba(197, 203, 206, 0.8)',
                        timeVisible: true,
                        secondsVisible: false,
                        fixLeftEdge: true,
                        fixRightEdge: true,
                    },
                    crosshair: {
                        mode: LightweightCharts.CrosshairMode.Normal,
                    },
                    handleScroll: {
                        mouseWheel: true,
                        pressedMouseMove: true,
                        horzTouchDrag: true,
                        vertTouchDrag: true,
                    },
                    handleScale: {
                        axisPressedMouseMove: true,
                        mouseWheel: true,
                        pinch: true,
                    },
                });
                
                // Create candlestick series
                this.candlestickSeries = this.chart.addCandlestickSeries({
                    upColor: '#26a69a',
                    downColor: '#ef5350',
                    borderDownColor: '#ef5350',
                    borderUpColor: '#26a69a',
                    wickDownColor: '#ef5350',
                    wickUpColor: '#26a69a',
                    priceFormat: {
                        type: 'price',
                        precision: 4,
                        minMove: 0.0001,
                    },
                });
                
                // Create volume series
                this.volumeSeries = this.chart.addHistogramSeries({
                    color: 'rgba(38, 166, 154, 0.3)',
                    priceFormat: {
                        type: 'volume',
                    },
                    priceScaleId: '',
                    scaleMargins: {
                        top: 0.8,
                        bottom: 0,
                    },
                });
                
                // Handle window resize
                window.addEventListener('resize', () => {
                    this.chart.applyOptions({
                        width: this.container.clientWidth,
                        height: this.container.clientHeight,
                    });
                });
                
                // Set up timeframe buttons
                this.setupTimeframeControls();
            }
            
            setupTimeframeControls() {
                const buttons = document.querySelectorAll('.timeframe-btn');
                buttons.forEach(btn => {
                    btn.addEventListener('click', () => {
                        // Remove active class from all buttons
                        buttons.forEach(b => b.classList.remove('active'));
                        // Add active class to clicked button
                        btn.classList.add('active');
                        
                        // Update chart interval
                        const interval = parseInt(btn.dataset.interval);
                        this.updateInterval(interval);
                    });
                });
            }
            
            async updateInterval(interval) {
                this.currentInterval = interval;
                
                if (this.currentMarket) {
                    await this.loadHistoricalData(this.currentMarket, interval);
                }
            }
            
            async loadHistoricalData(marketId, interval = null) {
                const currentInterval = interval || this.currentInterval;
                this.currentMarket = marketId;
                
                try {
                    // Calculate time range
                    const endTime = Math.floor(Date.now() / 1000);
                    const startTime = endTime - (DFLOW_CONFIG.chartHistoryHours * 3600);
                    
                    // Fetch candlestick data
                    const apiKey = DFLOW_CONFIG.getApiKey();
                    const response = await fetch(
                        `${DFLOW_CONFIG.endpoints.candlesticks}/${marketId}/candlesticks?` +
                        `startTs=${startTime}&` +
                        `endTs=${endTime}&` +
                        `periodInterval=${currentInterval}`,
                        {
                            headers: {
                                'x-api-key': apiKey
                            }
                        }
                    );
                    
                    if (!response.ok) {
                        throw new Error(`Failed to fetch candlestick data: ${response.status}`);
                    }
                    
                    const data = await response.json();
                    
                    // Format data for chart
                    const formattedData = this.formatCandlestickData(data);
                    const volumeData = this.formatVolumeData(data);
                    
                    // Update chart
                    this.candlestickSeries.setData(formattedData);
                    this.volumeSeries.setData(volumeData);
                    
                    // Fit content
                    this.chart.timeScale().fitContent();
                    
                } catch (error) {
                    console.error('Failed to load historical data:', error);
                    this.showChartError('Failed to load chart data');
                }
            }
            
            formatCandlestickData(rawData) {
                if (!rawData || !Array.isArray(rawData.candles)) {
                    return [];
                }
                
                return rawData.candles.map(candle => ({
                    time: Math.floor(candle.timestamp / 1000),
                    open: parseFloat(candle.open) || 0,
                    high: parseFloat(candle.high) || 0,
                    low: parseFloat(candle.low) || 0,
                    close: parseFloat(candle.close) || 0,
                }));
            }
            
            formatVolumeData(rawData) {
                if (!rawData || !Array.isArray(rawData.candles)) {
                    return [];
                }
                
                return rawData.candles.map(candle => ({
                    time: Math.floor(candle.timestamp / 1000),
                    value: parseFloat(candle.volume) || 0,
                    color: parseFloat(candle.close) >= parseFloat(candle.open) ? 
                          'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)',
                }));
            }
            
            updatePrice(priceData) {
                if (!this.candlestickSeries || !priceData) return;
                
                const currentTime = Math.floor(Date.now() / 1000);
                const price = priceData.yes_bid || priceData.yes_ask || priceData.price;
                
                if (!price) return;
                
                // Get current data
                const data = this.candlestickSeries.data();
                const lastCandle = data[data.length - 1];
                
                // Create new candle if needed
                const candleTime = Math.floor(currentTime / (this.currentInterval * 60)) * (this.currentInterval * 60);
                
                if (lastCandle && lastCandle.time === candleTime) {
                    // Update existing candle
                    const updatedCandle = {
                        time: candleTime,
                        open: lastCandle.open,
                        high: Math.max(lastCandle.high, price),
                        low: Math.min(lastCandle.low, price),
                        close: price,
                    };
                    this.candlestickSeries.update(updatedCandle);
                } else {
                    // Create new candle
                    const newCandle = {
                        time: candleTime,
                        open: price,
                        high: price,
                        low: price,
                        close: price,
                    };
                    this.candlestickSeries.update(newCandle);
                }
            }
            
            showChartError(message) {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'error-overlay';
                errorDiv.innerHTML = `
                    <div class="error-icon">⚠️</div>
                    <div>${message}</div>
                    <button class="retry-button" onclick="window.tradingChart.retryLoad()">Retry</button>
                `;
                
                this.container.appendChild(errorDiv);
            }
            
            retryLoad() {
                if (this.currentMarket) {
                    this.loadHistoricalData(this.currentMarket);
                }
            }
            
            destroy() {
                if (this.chart) {
                    this.chart.remove();
                    this.chart = null;
                }
                this.candlestickSeries = null;
                this.volumeSeries = null;
            }
        }

        // ==============================
        // API CACHE MANAGER
        // ==============================
        class ApiCacheManager {
            constructor() {
                this.cache = new Map();
                this.ttl = DFLOW_CONFIG.cacheTTL;
                this.persistentKeys = new Set(['markets', 'events', 'series']);
            }
            
            async get(key, fetchFn, options = {}) {
                const now = Date.now();
                const cacheEntry = this.cache.get(key);
                
                // Check memory cache first
                if (cacheEntry && now - cacheEntry.timestamp < (options.ttl || this.ttl)) {
                    return cacheEntry.data;
                }
                
                // Check localStorage for persistent data
                if (this.persistentKeys.has(key)) {
                    try {
                        const stored = localStorage.getItem(`dflow_cache_${key}`);
                        if (stored) {
                            const parsed = JSON.parse(stored);
                            if (now - parsed.timestamp < (options.ttl || this.ttl)) {
                                // Update memory cache
                                this.cache.set(key, parsed);
                                return parsed.data;
                            }
                        }
                    } catch (error) {
                        console.warn('Failed to read from localStorage:', error);
                    }
                }
                
                // Fetch fresh data
                try {
                    const data = await fetchFn();
                    this.set(key, data);
                    return data;
                } catch (error) {
                    // Return stale cache if allowed
                    if (cacheEntry && options.allowStale) {
                        console.warn('Using stale cache due to fetch error:', error);
                        return cacheEntry.data;
                    }
                    throw error;
                }
            }
            
            set(key, data) {
                const entry = {
                    data,
                    timestamp: Date.now()
                };
                
                this.cache.set(key, entry);
                
                // Persist important data to localStorage
                if (this.persistentKeys.has(key)) {
                    try {
                        localStorage.setItem(`dflow_cache_${key}`, JSON.stringify(entry));
                    } catch (error) {
                        console.warn('Failed to persist cache:', error);
                    }
                }
            }
            
            clear() {
                this.cache.clear();
                // Clear localStorage cache
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key.startsWith('dflow_cache_')) {
                        localStorage.removeItem(key);
                    }
                }
            }
            
            delete(key) {
                this.cache.delete(key);
                localStorage.removeItem(`dflow_cache_${key}`);
            }
        }

        // ==============================
        // TRADING MODULE MANAGER
        // ==============================
        class TradingModuleManager {
            constructor() {
                this.wsManager = null;
                this.chart = null;
                this.cache = new ApiCacheManager();
                this.currentMarket = null;
                this.markets = [];
                this.positions = [];
                this.orderbook = { bids: [], asks: [] };
                this.tradeHistory = [];
                
                // Initialize
                this.initialize();
            }
            
            async initialize() {
                try {
                    // Initialize WebSocket
                    this.wsManager = new FixedWebSocketManager();
                    window.wsManager = this.wsManager;
                    
                    // Initialize chart
                    this.chart = new FixedTradingChart('trading-chart');
                    window.tradingChart = this.chart;
                    
                    // Load initial data
                    await this.loadInitialData();
                    
                    // Set up event listeners
                    this.setupEventListeners();
                    
                    // Set up UI interactions
                    this.setupUI();
                    
                    console.log('✅ Trading module initialized successfully');
                    
                } catch (error) {
                    console.error('❌ Failed to initialize trading module:', error);
                    this.showFatalError('Failed to initialize trading module: ' + error.message);
                }
            }
            
            async loadInitialData() {
                // Load markets
                await this.loadMarkets();
                
                // Load initial market data
                if (this.markets.length > 0) {
                    await this.selectMarket(this.markets[0].ticker);
                }
            }
            
            async loadMarkets() {
                try {
                    const apiKey = DFLOW_CONFIG.getApiKey();
                    
                    const data = await this.cache.get('markets', async () => {
                        const response = await fetch(DFLOW_CONFIG.endpoints.markets, {
                            headers: {
                                'x-api-key': apiKey,
                                'Accept': 'application/json'
                            }
                        });
                        
                        if (!response.ok) {
                            throw new Error(`Failed to fetch markets: ${response.status}`);
                        }
                        
                        return await response.json();
                    }, { ttl: 600000 }); // 10 minute cache
                    
                    this.markets = data.markets || [];
                    this.populateMarketSelector();
                    
                } catch (error) {
                    console.error('Failed to load markets:', error);
                    this.showNotification('Failed to load markets', 'error');
                }
            }
            
            populateMarketSelector() {
                const select = document.getElementById('market-select');
                if (!select) return;
                
                select.innerHTML = '<option value="">Select a market...</option>';
                
                this.markets.forEach(market => {
                    const option = document.createElement('option');
                    option.value = market.ticker;
                    option.textContent = `${market.title} (${market.ticker})`;
                    select.appendChild(option);
                });
                
                // Set default market
                if (this.markets.length > 0) {
                    select.value = this.markets[0].ticker;
                }
            }
            
            async selectMarket(marketId) {
                if (!marketId || this.currentMarket === marketId) return;
                
                // Unsubscribe from previous market
                if (this.currentMarket && this.wsManager) {
                    this.wsManager.unsubscribe('prices', { tickers: [this.currentMarket] });
                    this.wsManager.unsubscribe('trades', { tickers: [this.currentMarket] });
                    this.wsManager.unsubscribe('orderbook', { tickers: [this.currentMarket] });
                }
                
                // Update current market
                this.currentMarket = marketId;
                
                // Update UI
                this.updateMarketInfo(marketId);
                
                // Load chart data
                await this.chart.loadHistoricalData(marketId);
                
                // Subscribe to WebSocket updates
                if (this.wsManager.isConnected) {
                    this.wsManager.subscribe('prices', { tickers: [marketId] });
                    this.wsManager.subscribe('trades', { tickers: [marketId] });
                    this.wsManager.subscribe('orderbook', { tickers: [marketId] });
                }
                
                // Load orderbook and trades
                await this.loadMarketData(marketId);
            }
            
            async updateMarketInfo(marketId) {
                const market = this.markets.find(m => m.ticker === marketId);
                if (!market) return;
                
                // Update title
                const titleElement = document.getElementById('market-title');
                if (titleElement) {
                    titleElement.textContent = market.title;
                }
                
                // Update volume
                const volumeElement = document.getElementById('market-volume');
                if (volumeElement) {
                    volumeElement.textContent = `Volume: $${this.formatNumber(market.volume || 0)}`;
                }
            }
            
            async loadMarketData(marketId) {
                try {
                    const apiKey = DFLOW_CONFIG.getApiKey();
                    
                    // Load orderbook
                    const orderbookResponse = await fetch(
                        `${DFLOW_CONFIG.endpoints.orderbook}/${marketId}`,
                        {
                            headers: {
                                'x-api-key': apiKey
                            }
                        }
                    );
                    
                    if (orderbookResponse.ok) {
                        const orderbookData = await orderbookResponse.json();
                        this.updateOrderbookDisplay(orderbookData);
                    }
                    
                    // Load recent trades
                    const tradesResponse = await fetch(
                        `${DFLOW_CONFIG.endpoints.trades}?ticker=${marketId}&limit=20`,
                        {
                            headers: {
                                'x-api-key': apiKey
                            }
                        }
                    );
                    
                    if (tradesResponse.ok) {
                        const tradesData = await tradesResponse.json();
                        this.updateTradeHistoryDisplay(tradesData.trades || []);
                    }
                    
                } catch (error) {
                    console.error('Failed to load market data:', error);
                }
            }
            
            updateOrderbookDisplay(data) {
                this.orderbook = {
                    bids: Object.entries(data.yes_bids || {}).map(([price, quantity]) => ({
                        price: parseFloat(price),
                        quantity: parseInt(quantity)
                    })).sort((a, b) => b.price - a.price).slice(0, 10),
                    
                    asks: Object.entries(data.no_bids || {}).map(([price, quantity]) => ({
                        price: parseFloat(price),
                        quantity: parseInt(quantity)
                    })).sort((a, b) => a.price - b.price).slice(0, 10)
                };
                
                // Calculate spread
                const topBid = this.orderbook.bids[0]?.price || 0;
                const topAsk = this.orderbook.asks[0]?.price || 0;
                const spread = topAsk - topBid;
                const spreadPercent = topBid > 0 ? (spread / topBid * 100).toFixed(2) : 0;
                
                // Update spread display
                const spreadElement = document.getElementById('orderbook-spread');
                if (spreadElement) {
                    spreadElement.textContent = `Spread: ${spreadPercent}%`;
                }
                
                // Update orderbook UI
                this.renderOrderbook();
            }
            
            renderOrderbook() {
                const orderbookElement = document.getElementById('orderbook');
                if (!orderbookElement) return;
                
                const maxRows = Math.max(this.orderbook.bids.length, this.orderbook.asks.length);
                let html = '';
                
                for (let i = 0; i < maxRows; i++) {
                    const bid = this.orderbook.bids[i];
                    const ask = this.orderbook.asks[i];
                    
                    html += `
                        <div class="orderbook-row">
                            <div class="bid-row">
                                ${bid ? `${bid.price.toFixed(4)} (${bid.quantity})` : ''}
                            </div>
                            <div class="ask-row">
                                ${ask ? `${ask.price.toFixed(4)} (${ask.quantity})` : ''}
                            </div>
                        </div>
                    `;
                }
                
                orderbookElement.innerHTML = html;
            }
            
            updateTradeHistoryDisplay(trades) {
                const historyElement = document.getElementById('trade-history');
                if (!historyElement) return;
                
                let html = '';
                
                trades.slice(0, 20).forEach(trade => {
                    const time = new Date(trade.created_time * 1000).toLocaleTimeString();
                    const sideClass = trade.taker_side === 'yes' ? 'buy' : 'sell';
                    const sideText = trade.taker_side === 'yes' ? 'BUY' : 'SELL';
                    
                    html += `
                        <div class="trade-row">
                            <div>${time}</div>
                            <div>${trade.price}</div>
                            <div class="trade-side ${sideClass}">${sideText}</div>
                        </div>
                    `;
                });
                
                historyElement.innerHTML = html;
            }
            
            formatNumber(num) {
                if (num >= 1000000000) {
                    return (num / 1000000000).toFixed(2) + 'B';
                }
                if (num >= 1000000) {
                    return (num / 1000000).toFixed(2) + 'M';
                }
                if (num >= 1000) {
                    return (num / 1000).toFixed(2) + 'K';
                }
                return num.toFixed(2);
            }
            
            setupEventListeners() {
                // Market selection
                const marketSelect = document.getElementById('market-select');
                if (marketSelect) {
                    marketSelect.addEventListener('change', (e) => {
                        this.selectMarket(e.target.value);
                    });
                }
                
                // WebSocket events
                window.addEventListener('dflow:connected', () => {
                    if (this.currentMarket) {
                        this.wsManager.subscribe('prices', { tickers: [this.currentMarket] });
                        this.wsManager.subscribe('trades', { tickers: [this.currentMarket] });
                        this.wsManager.subscribe('orderbook', { tickers: [this.currentMarket] });
                    }
                });
                
                window.addEventListener('dflow:price', (e) => {
                    this.handlePriceUpdate(e.detail);
                });
                
                window.addEventListener('dflow:trade', (e) => {
                    this.handleTradeUpdate(e.detail);
                });
                
                window.addEventListener('dflow:orderbook', (e) => {
                    this.handleOrderbookUpdate(e.detail);
                });
                
                // Trade execution
                const buyButton = document.getElementById('buy-button');
                const sellButton = document.getElementById('sell-button');
                
                if (buyButton) {
                    buyButton.addEventListener('click', () => {
                        this.executeTrade('buy');
                    });
                }
                
                if (sellButton) {
                    sellButton.addEventListener('click', () => {
                        this.executeTrade('sell');
                    });
                }
            }
            
            setupUI() {
                // Auto-fill price from orderbook
                document.getElementById('trade-price')?.addEventListener('focus', () => {
                    const priceInput = document.getElementById('trade-price');
                    if (!priceInput.value && this.orderbook.asks.length > 0) {
                        priceInput.value = this.orderbook.asks[0].price.toFixed(4);
                    }
                });
                
                // Quantity percentage buttons (optional)
                this.addQuantityShortcuts();
            }
            
            addQuantityShortcuts() {
                // Add quick percentage buttons for quantity
                const shortcuts = [25, 50, 75, 100];
                const amountInput = document.getElementById('trade-amount');
                
                if (!amountInput) return;
                
                const container = amountInput.parentElement;
                const shortcutDiv = document.createElement('div');
                shortcutDiv.style.display = 'flex';
                shortcutDiv.style.gap = '5px';
                shortcutDiv.style.marginTop = '5px';
                
                shortcuts.forEach(pct => {
                    const btn = document.createElement('button');
                    btn.textContent = `${pct}%`;
                    btn.style.padding = '2px 6px';
                    btn.style.fontSize = '11px';
                    btn.style.background = '#2a2e39';
                    btn.style.border = 'none';
                    btn.style.borderRadius = '3px';
                    btn.style.color = '#8a94a6';
                    btn.style.cursor = 'pointer';
                    
                    btn.addEventListener('click', () => {
                        // This would need balance from wallet
                        // For now, just set to percentage of 100
                        amountInput.value = pct;
                    });
                    
                    shortcutDiv.appendChild(btn);
                });
                
                container.appendChild(shortcutDiv);
            }
            
            handlePriceUpdate(data) {
                // Price updates are handled by the chart and WebSocket manager
                console.log('Price update received:', data);
            }
            
            handleTradeUpdate(data) {
                // Add to trade history
                this.tradeHistory.unshift({
                    time: new Date().toLocaleTimeString(),
                    price: data.price,
                    quantity: data.count,
                    side: data.taker_side
                });
                
                // Keep only last 100 trades
                if (this.tradeHistory.length > 100) {
                    this.tradeHistory.pop();
                }
                
                // Update UI
                this.updateTradeHistoryDisplay(this.tradeHistory);
            }
            
            handleOrderbookUpdate(data) {
                this.updateOrderbookDisplay(data);
            }
            
            async executeTrade(side) {
                try {
                    if (!this.currentMarket) {
                        this.showNotification('Please select a market first', 'error');
                        return;
                    }
                    
                    const amount = parseFloat(document.getElementById('trade-amount').value);
                    const price = parseFloat(document.getElementById('trade-price').value);
                    const slippage = parseInt(document.getElementById('slippage-select').value);
                    
                    if (!amount || amount <= 0) {
                        this.showNotification('Please enter a valid amount', 'error');
                        return;
                    }
                    
                    if (!price || price <= 0) {
                        this.showNotification('Please enter a valid price', 'error');
                        return;
                    }
                    
                    // Get user's wallet (you need to integrate with your wallet provider)
                    const userPublicKey = await this.getUserWallet();
                    if (!userPublicKey) {
                        this.showNotification('Please connect your wallet first', 'error');
                        return;
                    }
                    
                    // Get quote
                    const quote = await this.getQuote(side, amount, price, slippage);
                    
                    // Create swap transaction
                    const transaction = await this.createSwapTransaction(quote, userPublicKey);
                    
                    // Sign and send transaction (this depends on your wallet setup)
                    const signature = await this.signAndSendTransaction(transaction, userPublicKey);
                    
                    // Monitor trade
                    this.monitorTrade(signature);
                    
                    this.showNotification('Trade executed successfully!', 'info');
                    
                } catch (error) {
                    console.error('Trade execution failed:', error);
                    this.showNotification('Trade failed: ' + error.message, 'error');
                }
            }
            
            async getQuote(side, amount, price, slippage) {
                const apiKey = DFLOW_CONFIG.getApiKey();
                
                // Determine input/output mints based on side
                // This is simplified - you need to get actual mint addresses
                const inputMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC
                const outputMint = side === 'buy' ? 'YES_MINT_ADDRESS' : 'NO_MINT_ADDRESS';
                
                const response = await fetch(
                    `${DFLOW_CONFIG.endpoints.quote}?` +
                    `inputMint=${inputMint}&` +
                    `outputMint=${outputMint}&` +
                    `amount=${amount}&` +
                    `slippageBps=${slippage}`,
                    {
                        headers: {
                            'x-api-key': apiKey
                        }
                    }
                );
                
                if (!response.ok) {
                    throw new Error(`Failed to get quote: ${response.status}`);
                }
                
                return await response.json();
            }
            
            async createSwapTransaction(quote, userPublicKey) {
                const apiKey = DFLOW_CONFIG.getApiKey();
                
                const response = await fetch(DFLOW_CONFIG.endpoints.swap, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey
                    },
                    body: JSON.stringify({
                        quoteResponse: quote,
                        userPublicKey: userPublicKey
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`Failed to create swap: ${response.status}`);
                }
                
                return await response.json();
            }
            
            async getUserWallet() {
                // Integrate with your wallet provider
                // This is a placeholder - implement based on your wallet setup
                if (window.solana?.isPhantom) {
                    const resp = await window.solana.connect();
                    return resp.publicKey.toString();
                }
                
                if (window.backpack) {
                    const accounts = await window.backpack.getAccounts();
                    return accounts[0]?.address;
                }
                
                // Check for other wallet providers
                return null;
            }
            
            async signAndSendTransaction(transactionData, userPublicKey) {
                // This depends on your wallet integration
                // You need to sign the transaction with the user's wallet
                // and send it to the Solana network
                
                // Placeholder implementation
                console.log('Transaction to sign:', transactionData);
                return 'simulated_signature';
            }
            
            async monitorTrade(signature) {
                // Monitor trade status
                // This would poll the order status endpoint
                console.log('Monitoring trade:', signature);
            }
            
            showNotification(message, type = 'info') {
                if (this.wsManager) {
                    this.wsManager.showNotification(message, type);
                } else {
                    // Fallback notification
                    alert(`${type.toUpperCase()}: ${message}`);
                }
            }
            
            showFatalError(message) {
                const overlay = document.getElementById('loading-overlay');
                if (overlay) {
                    overlay.innerHTML = `
                        <div class="error-icon">❌</div>
                        <div style="text-align: center; margin: 20px 0;">${message}</div>
                        <button class="retry-button" onclick="window.location.reload()">Reload Page</button>
                    `;
                    overlay.style.display = 'flex';
                }
            }
        }

        // ==============================
        // INITIALIZATION
        // ==============================
        document.addEventListener('DOMContentLoaded', () => {
            // Check for API key
            try {
                const apiKey = DFLOW_CONFIG.getApiKey();
                console.log('API key found:', apiKey ? 'Yes' : 'No');
            } catch (error) {
                alert('DFlow API key not found. Please add it to dflowSecrets.apiKey or localStorage');
                return;
            }
            
            // Initialize trading module
            window.tradingModule = new TradingModuleManager();
        });

        // ==============================
        // UTILITY FUNCTIONS
        // ==============================
        window.formatPrice = (price, decimals = 4) => {
            return parseFloat(price).toFixed(decimals);
        };

        window.formatPercent = (value) => {
            return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
        };

        window.formatTime = (timestamp) => {
            return new Date(timestamp * 1000).toLocaleTimeString();
        };

        // Expose for debugging
        window.DFLOW_CONFIG = DFLOW_CONFIG;
        console.log('DFlow Trading Module Loaded');
    </script>
</body>
</html>