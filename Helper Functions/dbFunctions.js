const sqlite3 = require('sqlite3').verbose();

// Open SQLite database
const db = new sqlite3.Database('./autofarm.db', (err) => {
    if (err) console.error('Error opening database:', err.message);
    else console.log('Connected to SQLite database');
});


function storeTemperature(device_id, temp) {
    db.run(
        `INSERT INTO temperatures (device_id, temp) VALUES (?, ?)`,
        [device_id, temp],
        function (err) {
            if (err) console.error('Error inserting temperature:', err.message);
            else console.log(`Temperature logged: ${temp}°C for device ${device_id}`);
        }
    );
}

function storeSeedLevel(device_id, level) {
    db.run(
        `INSERT INTO seed_level (device_id, level) VALUES (?, ?)`,
        [device_id, level],
        function (err) {
            if (err) console.error('Error inserting seed level:', err.message);
            else console.log(`Seed level logged: ${level} for device ${device_id}`);
        }
    );
}

function storeAlert(device_id, type, message) {
    db.run(
        `INSERT INTO alerts (device_id, type, message) VALUES (?, ?, ?)`,
        [device_id, type, message],
        function (err) {
            if (err) console.error('Error inserting alert:', err.message);
            else console.log(`Alert logged: ${type} - ${message} for device ${device_id}`);
        }
    );
}

function storeLog(device_id, type, message) {
    db.run(
        `INSERT INTO logs (device_id, type, message) VALUES (?, ?, ?)`,
        [device_id, type, message],
        function (err) {
            if (err) console.error('Error inserting log:', err.message);
            else console.log(`Log stored: ${type} - ${message} for device ${device_id}`);
        }
    );
}

module.exports = {
    storeTemperature,
    storeSeedLevel,
    storeAlert,
    storeLog
};