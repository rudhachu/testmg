const express = require('express');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const pino = require('pino');
const { upload } = require('./mega');
const { makeid } = require('./id');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    Browsers,
    delay,
} = require('@whiskeysockets/baileys');

// Initialize Express Router
let router = express.Router();

// Helper Functions

// List of available browser configurations
const browserOptions = [
    Browsers.macOS('Safari'),
    Browsers.macOS('Desktop'),
    Browsers.macOS('Chrome'),
    Browsers.macOS('Firefox'),
    Browsers.macOS('Opera'),
];

// Function to pick a random browser
function getRandomBrowser() {
    return browserOptions[Math.floor(Math.random() * browserOptions.length)];
}

// Function to remove a file or folder
function removeFile(filePath) {
    if (fs.existsSync(filePath)) {
        fs.rmSync(filePath, { recursive: true, force: true });
    }
}

// List of specific files to read
const specificFiles = [
    'creds.json',
    'app-state-sync-key-AAAAAED1.json',
    'pre-key-1.json',
    'pre-key-2.json',
    'pre-key-3.json',
    'pre-key-5.json',
    'pre-key-6.json',
];

// Function to read specific JSON files from a folder
function readSpecificJSONFiles(folderPath) {
    const result = {};
    specificFiles.forEach((file) => {
        const filePath = path.join(folderPath, file);
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            result[file] = JSON.parse(fileContent);
        } else {
            console.warn(`File not found: ${filePath}`);
        }
    });
    return result;
}

// Route Handler
router.get('/', async (req, res) => {
    const id = makeid(); // Generate a unique ID

    // Function to handle QR generation and connection
    async function Getqr() {
        const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);

        try {
            const session = makeWASocket({
                auth: state,
                printQRInTerminal: false,
                logger: pino({ level: 'silent' }),
                browser: getRandomBrowser(),
            });

            session.ev.on('creds.update', saveCreds);

            session.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;

                // Generate and send QR code
                if (qr) {
                    const colors = ['#FFFFFF', '#FFFF00', '#00FF00', '#FF0000', '#0000FF', '#800080'];
                    const randomColor = colors[Math.floor(Math.random() * colors.length)];

                    const buffer = await QRCode.toBuffer(qr, {
                        type: 'png',
                        color: {
                            dark: randomColor,
                            light: '#00000000', // Transparent background
                        },
                        width: 300,
                    });

                    res.writeHead(200, { 'Content-Type': 'image/png' });
                    return res.end(buffer);
                }

                // Handle successful connection
                if (connection === 'open') {
                    await delay(10000);
                    const mergedJSON = readSpecificJSONFiles(path.join(__dirname, `/temp/${id}`));
                    const filePath = path.join(__dirname, `/temp/${id}/${id}.json`);
                    fs.writeFileSync(filePath, JSON.stringify(mergedJSON));

                    const output = await upload(filePath);
                    const message = output.replace('https://mega.nz/file/', '');
                    const msg = `Rudhra~${message.split('').reverse().join('')}`;

                    await session.sendMessage(session.user.id, { text: msg });
                    await delay(100);
                    await session.ws.close();

                    removeFile(path.join(__dirname, `/temp/${id}`));
                }

                // Handle connection closure and retry
                if (
                    connection === 'close' &&
                    lastDisconnect &&
                    lastDisconnect.error &&
                    lastDisconnect.error.output.statusCode !== 401
                ) {
                    await delay(10000);
                    Getqr();
                }
            });
        } catch (err) {
            if (!res.headersSent) {
                res.status(503).json({ code: 'Service Unavailable' });
            }
            console.error(err);
            removeFile(path.join(__dirname, `/temp/${id}`));
        }
    }

    // Call the QR generation function
    Getqr();
});

module.exports = router;
