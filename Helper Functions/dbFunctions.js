const sqlite3 = require('sqlite3').verbose();

// Open SQLite database
const db = new sqlite3.Database('./autofarm.db', (err) => {
    if (err) console.error('Error opening database:', err.message);
    else console.log('Connected to SQLite database');
});

const device_id=7;
function storeTemperature(temp, humidity) {
    db.run(
        `INSERT INTO temperatures (device_id, temp, humidity) VALUES (?, ?, ?)`,
        [device_id, temp, humidity],
        function (err) {
            if (err) {
                console.error('Error inserting temperature:', err.message);
            } else {
                console.log(`Temperature logged: ${temp}°C, Humidity logged: ${humidity}% for device ${device_id}`);
                storeLog(device_id, 'temperature', `Temperature logged: ${temp}°C, Humidity logged: ${humidity}%`);
            }
        }
    );
}

function storeSeedLevel(level) {
    db.run(
        `INSERT INTO seed_level (device_id, level) VALUES (?, ?)`,
        [device_id, level],
        function (err) {
            if (err) {
                console.error('Error inserting seed level:', err.message);
            } else {
                console.log(`Seed level logged: ${level} for device ${device_id}`);
                storeLog(device_id, 'seed_level', `Seed level logged: ${level}`);
            }
        }
    );
}

function storeAlert(type, message) {
    db.run(
        `INSERT INTO alerts (device_id, type, message) VALUES (?, ?, ?)`,
        [device_id, type, message],
        function (err) {
            if (err) {
                console.error('Error inserting alert:', err.message);
            } else {
                console.log(`Alert logged: ${type} - ${message} for device ${device_id}`);
                storeLog(device_id, 'alert', `Alert logged: ${type} - ${message}`);
            }
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

function storeCommand(command) {
    db.run(
        `INSERT INTO command (device_id, message) VALUES (?, ?)`,
        [device_id, command],
        function (err) {
            if (err) console.error('Error inserting command:', err.message);
            else console.log(`Command stored: ${command} for device ${device_id}`);
        }
    );
}

function saveDevice(owner_name, owner_email) {
    console.log('Saving device:', owner_name, owner_email);
    db.run(
        `INSERT INTO devices (owner_name, owner_email) VALUES (?, ?)`,
        [owner_name, owner_email],
        function (err) {
            if (err) console.error('Error inserting device:', err.message);
            else console.log(`Device saved: ${owner_name} (${owner_email})`);
        }
    );
}


// Close the database connection when the process ends

module.exports = {
    storeTemperature,
    storeSeedLevel,
    storeAlert,
    storeLog,   
    saveDevice,
    storeCommand
};