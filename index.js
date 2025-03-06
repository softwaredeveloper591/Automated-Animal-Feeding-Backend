const { storeTemperature, storeSeedLevel, storeAlert, storeLog } = require('./Helper Functions/dbFunctions');
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
    console.log('ESP32 connected');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message); // Parse incoming JSON data
            console.log('Received data:', data);

            const validTypes = ['temperature', 'seed_level', 'alert'];

            if (validTypes.includes(data.type)) {
                if (data.type === 'temperature') {
                    storeTemperature(data.device_id, data.temp);
                } else if (data.type === 'seed_level') {
                    storeSeedLevel(data.device_id, data.level);
                } else if (data.type === 'alert') {
                    storeAlert(data.device_id, data.alert_type, data.message);
                }
                storeLog(data.device_id, data.log_type, data.message);
            } else {
                console.error('Invalid data type received:', data.type);
            }
        } catch (error) {
            console.error('Invalid JSON received:', error.message);
        }
    });

    ws.on('close', () => {
        console.log('ESP32 disconnected');
    });
});

console.log('WebSocket server is running on ws://localhost:8080');

