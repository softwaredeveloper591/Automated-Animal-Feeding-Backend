const { storeTemperature, storeSeedLevel, storeAlert, storeLog } = require('./Helper Functions/dbFunctions');
const WebSocket = require('ws');
const net = require('net');
const http = require('http');
const url = require('url');

let connectedClient = null;
let wsClient =  null;
let latestTemperature = null;
let latestHumidity = null;
let initialConnectionReceived = false;
let messageBuffer = ''; // Buffer to store incoming messages

const tcpServer = net.createServer((socket) => {
    console.log('ESP32 connected with socket:', socket.remoteAddress, socket.remotePort);   

    connectedClient = socket; 
    
    socket.write('Hello from server!\n');
  
    socket.on('data', (message) => {
        try {
            messageBuffer += message.toString();
            console.log('Raw data received:', message.toString());
            
            if (messageBuffer.includes('\n')) {
                // Split buffer into lines and process each complete line
                const lines = messageBuffer.split('\n');
                // Keep the last incomplete line in the buffer
                messageBuffer = lines.pop();
          
                lines.forEach(line => {
                  line = line.trim();
                  if (line) {
                    console.log('Processing complete line:', line);
                    
                    // Check for initial connection message
                    if (line === 'ESP32 has connected!' && !initialConnectionReceived) {
                      initialConnectionReceived = true;
                      console.log('ESP32 initial connection confirmed');
                    }
                    
                    // Try to match the full sensor data pattern
                    const fullMatch = line.match(/TEMP:\s*(\d+(?:\.\d+))\s*C,\s*HUM:\s*(\d+(?:\.\d+))\s*%/);
                    if (fullMatch) {
                      latestTemperature = parseFloat(fullMatch[1]);
                      latestHumidity = parseFloat(fullMatch[2]);
                      console.log('Parsed values:', { temperature: latestTemperature, humidity: latestHumidity });
                      sendSensorDataToWebSocket(latestTemperature, latestHumidity);
                    }
                  }
                });
              }
    } catch (error) {console.error(error.message);}
    });
  
    socket.on('close', () => {
        console.log('ESP32 disconnected');
        connectedClient = null;
        initialConnectionReceived = false;  // Reset connection state
      });

    socket.on('error', (error) => {
        console.error('TCP Socket error:', error);
        connectedClient = null;
        initialConnectionReceived = false;  // Reset connection state
    });
  });

  function sendToESP32(command) {
    if (connectedClient && connectedClient.writable) {
      console.log('Sending to ESP32:', command);
      connectedClient.write(command + '\n');
      return true;
    } else {
      console.log('No ESP32 connected or connection not writable');
      return false;
    }
  }

  // Function to send the latest temperature and humidity to the WebSocket client
  function sendSensorDataToWebSocket(temperature, humidity) {
    if (wsClient && temperature !== null && humidity !== null) {
        const data = JSON.stringify({
            type: 'sensor_data',
            temperature: temperature,
            humidity: humidity,
            timestamp: new Date().toISOString()
        });
        wsClient.send(data);
        console.log('Sent data to WebSocket client:', data);
    }
}

  const httpServer = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    // console.log('HTTP Request received:', req.method, req.url);  // Commented out status request logs
    
    // Set CORS headers to allow requests from any origin
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    
    // Handle feed interval change
    if (parsedUrl.pathname === '/set-interval') {
      const interval = parseInt(parsedUrl.query.value);
      if (!isNaN(interval) && interval >= 1000) {  // Minimum 1 second
        // Ensure clean interval value
        const intervalStr = interval.toString().trim();
        console.log('Sending interval command:', 'INTERVAL=' + intervalStr);
        if (sendToESP32('INTERVAL=' + intervalStr)) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: `Feed interval set to ${interval}ms` }));
        } else {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'ESP32 not connected' }));
        }
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Invalid interval value' }));
      }
      return;
    }
  
    // Handle feed command
    if (parsedUrl.pathname === '/feed') {
      const amount = parseInt(parsedUrl.query.value);
      if (isNaN(amount) || amount <= 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Invalid feed amount' }));
        return;
      }
      if (sendToESP32('FEED=' + amount)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Feed command sent to ESP32 with amount: ' + amount }));
      } else {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'ESP32 not connected' }));
      }
      return;
    }
    
    // Handle status request
    if (parsedUrl.pathname === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        esp32Connected: connectedClient !== null && connectedClient.writable && initialConnectionReceived,
        serverTime: new Date().toISOString(),
        temperature: latestTemperature,
        humidity: latestHumidity
      }));
      return;
    }
    
    // Serve a simple HTML interface
    if (parsedUrl.pathname === '/' || parsedUrl.pathname === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Smart Farm Demo</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
          <style>
            :root {
              --primary-color: #2196F3;
              --success-color: #4CAF50;
              --warning-color: #ff9800;
              --error-color: #f44336;
              --text-color: #333;
              --bg-color: #f5f5f5;
              --card-bg: #fff;
            }
  
            body {
              font-family: 'Segoe UI', Arial, sans-serif;
              background-color: var(--bg-color);
              margin: 0;
              padding: 20px;
              color: var(--text-color);
            }
  
            .container {
              max-width: 800px;
              margin: 0 auto;
            }
  
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
  
            h1 {
              color: var(--primary-color);
              font-size: 2.5em;
              margin-bottom: 10px;
            }
  
            .card {
              background: var(--card-bg);
              border-radius: 10px;
              padding: 20px;
              margin-bottom: 20px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              transition: all 0.3s ease;
            }
  
            .card:hover {
              transform: translateY(-2px);
              box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            }
  
            .status-card {
              display: flex;
              align-items: center;
              gap: 15px;
            }
  
            .status-icon {
              font-size: 24px;
              width: 40px;
              height: 40px;
              display: flex;
              align-items: center;
              justify-content: center;
              border-radius: 50%;
              background: var(--primary-color);
              color: white;
            }
  
            .sensor-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
              gap: 20px;
              margin: 20px 0;
            }
  
            .control-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
              gap: 20px;
              margin: 20px 0;
            }
  
            .input-group {
              margin-top: 15px;
              margin-top: 15px;
              display: flex;
              gap: 10px;
            }
  
            select {
              flex: 1;
              padding: 8px;
              border-radius: 4px;
              border: 1px solid #ddd;
              font-size: 16px;
            }
  
            .primary-button {
              background-color: var(--primary-color);
              width: 100%;
            }
  
            .primary-button:hover {
              background-color: #1976D2;
            }
  
            .sensor-card {
              text-align: center;
              padding: 20px;
            }
  
            .sensor-value {
              font-size: 2em;
              font-weight: bold;
              margin: 10px 0;
              color: var(--primary-color);
            }
  
            .sensor-label {
              color: #666;
              font-size: 0.9em;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
  
            button {
              background-color: var(--success-color);
              border: none;
              color: white;
              padding: 15px 32px;
              text-align: center;
              font-size: 16px;
              margin: 10px 2px;
              cursor: pointer;
              border-radius: 25px;
              width: 100%;
              max-width: 300px;
              transition: all 0.3s ease;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 10px;
            }
  
            button:hover {
              background-color: #45a049;
              transform: translateY(-1px);
              box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            }
  
            button:disabled {
              background-color: #cccccc;
              cursor: not-allowed;
              transform: none;
              box-shadow: none;
            }
  
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
            }
  
            .fade-in {
              animation: fadeIn 0.3s ease;
            }
  
            @media (max-width: 600px) {
              body { padding: 10px; }
              h1 { font-size: 2em; }
              .sensor-grid { grid-template-columns: 1fr; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Smart Farm Demo</h1>
            </div>
  
            <div class="card status-card">
              <div class="status-icon">
                <i class="fas fa-wifi"></i>
              </div>
              <div id="status">Checking status...</div>
            </div>
  
            <div class="sensor-grid">
              <div class="card sensor-card">
                <i class="fas fa-thermometer-half" style="font-size: 24px; color: #ff9800;"></i>
                <div class="sensor-label">Temperature</div>
                <div id="temperature" class="sensor-value">--&deg;C</div>
              </div>
  
              <div class="card sensor-card">
                <i class="fas fa-tint" style="font-size: 24px; color: #2196F3;"></i>
                <div class="sensor-label">Humidity</div>
                <div id="humidity" class="sensor-value">--%</div>
              </div>
            </div>
  
            <div class="control-grid">
              <div class="card">
                <div class="sensor-label">Auto Feed Interval</div>
                <div class="input-group">
                  <select id="intervalSelect">
                    <option value="10000">10 seconds</option>
                    <option value="30000">30 seconds</option>
                    <option value="60000">1 minute</option>
                    <option value="300000">5 minutes</option>
                  </select>
                  <button id="setIntervalButton">
                    <i class="fas fa-save"></i>
                    Set
                  </button>
                </div>
              </div>
  
              <div class="card">
                <div class="sensor-label">Manual Feed</div>
                <button id="feedButton" class="primary-button" style="margin-top: 15px;">
                  <i class="fas fa-cookie-bite"></i>
                  FEED NOW
                </button>
              </div>
            </div>
          </div>
          
          <script>
            const statusDiv = document.getElementById('status');
            const sensorDiv = document.getElementById('sensorData');
            const feedButton = document.getElementById('feedButton');
            const intervalSelect = document.getElementById('intervalSelect');
            const setIntervalButton = document.getElementById('setIntervalButton');
            
            // Update status initially and every 5 seconds
            updateStatus();
            setInterval(updateStatus, 1000);  // Update every 1 second
            
            // Add button event listener
            feedButton.addEventListener('click', async () => {
              feedButton.disabled = true;
              try {
                const response = await fetch('/feed');
                const data = await response.json();
                statusDiv.textContent = data.message;
                setTimeout(() => feedButton.disabled = false, 2000);
              } catch (error) {
                statusDiv.textContent = 'Error: ' + error.message;
                feedButton.disabled = false;
              }
            });
  
            // Add interval change handler
            setIntervalButton.addEventListener('click', async () => {
              setIntervalButton.disabled = true;
              try {
                const interval = intervalSelect.value;
                const response = await fetch('/set-interval?value=' + interval);
                const data = await response.json();
                statusDiv.textContent = data.message;
                setTimeout(() => setIntervalButton.disabled = false, 1000);
              } catch (error) {
                statusDiv.textContent = 'Error: ' + error.message;
                setIntervalButton.disabled = false;
              }
            });
            
            // Function to update status
            async function updateStatus() {
              try {
                const response = await fetch('/status');
                const data = await response.json();
                // Update connection status
                statusDiv.innerHTML = data.esp32Connected
                  ? '<span style="color: var(--success-color)"><i class="fas fa-check-circle"></i> ESP32 Connected</span>'
                  : '<span style="color: var(--error-color)"><i class="fas fa-times-circle"></i> ESP32 Disconnected</span>';
  
                // Update sensor values with animation only when values change
                const tempDiv = document.getElementById('temperature');
                const humDiv = document.getElementById('humidity');
                
                if (data.temperature !== null && data.humidity !== null) {
                  // Extract just the number from the current display for comparison
                  const currentTemp = parseFloat(tempDiv.innerHTML.split('&deg;')[0]);
                  const currentHum = parseFloat(humDiv.textContent);
                  
                  // Only update and animate if values have changed
                  if (currentTemp !== data.temperature) {
                    tempDiv.innerHTML = data.temperature + '&deg;C';
                    tempDiv.classList.add('fade-in');
                    setTimeout(() => tempDiv.classList.remove('fade-in'), 300);
                  }
                  
                  if (currentHum !== data.humidity) {
                    humDiv.textContent = data.humidity + '%';
                    humDiv.classList.add('fade-in');
                    setTimeout(() => humDiv.classList.remove('fade-in'), 300);
                  }
                } else {
                  tempDiv.innerHTML = '--&deg;C';
                  humDiv.textContent = '--%';
                }
                
                feedButton.disabled = !data.esp32Connected;
              } catch (error) {
                statusDiv.textContent = 'Error checking status: ' + error.message;
              }
            }
          </script>
        </body>
        </html>
      `);
      return;
    }
    
    // Default response for any other path
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found\n');
  });

const wss = new WebSocket.Server({ server: httpServer });

wss.on('connection', (ws) => {
    console.log('Mobile Device connected!');
    ws.send('Hello from server!');
    wsClient = ws; // Store the WebSocket client reference
    sendSensorDataToWebSocket(latestTemperature, latestHumidity); // Send latest data on connection if available

    ws.on('message', (message) => {
        console.log('Received message from client:', message);  
    });

    ws.on('close', () => {
        console.log('ESP32 disconnected');
    });
});

// Handle WebSocket server errors
wss.on('error', (error) => {
    console.error('WebSocket Server error:', error);
    wsClient = null; // Clear the WebSocket client reference on error
  });

// Listen HTTP server on port 3000
httpServer.listen(3000, '0.0.0.0', () => {
    console.log('HTTP Server and Websocket Server are listening on 0.0.0.0:3000');
    console.log('Visit http://localhost:3000 in your browser to control ESP32');
  });

// Handle HTTP server errors
httpServer.on('error', (error) => {
    console.error('HTTP Server error:', error);
});

tcpServer.listen(4321, '0.0.0.0', () => console.log('TCP server on 0.0.0.0:4321'));

// Handle TCP server errors
tcpServer.on('error', (error) => {
    console.error('TCP Server error:', error);
  });
  


