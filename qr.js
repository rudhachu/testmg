const PastebinAPI = require('pastebin-js'),
pastebin = new PastebinAPI('Q80IAWeVRBgHkz5GVKCnwZmc0iudKVgk')
const {makeid} = require('./id');
const QRCode = require('qrcode');
const express = require('express');
const path = require('path');
const fs = require('fs');
let router = express.Router()
const pino = require("pino");
const {
	default: makeWASocket,
	useMultiFileAuthState,
	jidNormalizedUser,
	Browsers,
	delay,
	fetchLatestBaileysVersion,
	makeInMemoryStore,
} = require("@whiskeysockets/baileys");

// List of available browser configurations
const browserOptions = [
		Browsers.macOS("Safari"),
		Browsers.macOS("Desktop"),
		Browsers.macOS("Chrome"),
		Browsers.macOS("Firefox"),
		Browsers.macOS("Opera"),
];

// Function to pick a random browser
function getRandomBrowser() {
		return browserOptions[Math.floor(Math.random() * browserOptions.length)];
}

function removeFile(FilePath) {
	if (!fs.existsSync(FilePath)) return false;
	fs.rmSync(FilePath, {
		recursive: true,
		force: true
	})
};

const specificFiles = [
		'creds.json',
		'app-state-sync-key-AAAAAED1.json',
		'pre-key-1.json',
		'pre-key-2.json',
		'pre-key-3.json',
		'pre-key-5.json',
		'pre-key-6.json'
];

function readSpecificJSONFiles(folderPath) {
		const result = {};
		specificFiles.forEach(file => {
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

const {
	readFile
} = require("node:fs/promises")
router.get('/', async (req, res) => {
	const id = makeid();
	async function Getqr() {
		const {
			state,
			saveCreds
		} = await useMultiFileAuthState('./temp/' + id)
		try {
			let session = makeWASocket({
				auth: state,
				printQRInTerminal: false,
				logger: pino({
					level: "silent"
				}),
				browser: getRandomBrowser(), // Assign a random browser
});

			session.ev.on('creds.update', saveCreds)
			session.ev.on("connection.update", async (s) => {
				const {
					connection,
					lastDisconnect,
					qr
				} = s;
const colors = ['#FFFFFF', '#FFFF00', '#00FF00', '#FF0000', '#0000FF', '#800080'];  // Array of colors
const randomColor = colors[Math.floor(Math.random() * colors.length)];  // Pick a random color

if (qr) {
  const buffer = await QRCode.toBuffer(qr, {
    type: 'png',              // Output type (PNG)
    color: {
      dark: randomColor,      // Random dark color
      light: '#00000000'      // Transparent background
    },
    width: 300,               // Adjust the size if needed
  });

  await res.end(buffer);
}
				if (connection == "open") {
					await delay(10000);
					const mergedJSON = await readSpecificJSONFiles(__dirname+`/temp/${id}/`);
					fs.writeFileSync(__dirname+`/temp/${id}/${id}.json`, JSON.stringify(mergedJSON));
					const output = await pastebin.createPasteFromFile(__dirname+`/temp/${id}/${id}.json`, "pastebin-js test", null, 1, "N");
					let message = output.split('/')[3];
										let msg = `Rudhra~${message.split('').reverse().join('')}`;
					await session.sendMessage(session.user.id, {
						text: msg
					})
					await delay(100);
					await session.ws.close();
					return await removeFile("temp/" + id);
				} else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode != 401) {
					await delay(10000);
					Getqr();
				}
			});
		} catch (err) {
			if (!res.headersSent) {
				await res.json({
					code: "Service Unavailable"
				});
			}
			console.log(err);
			await removeFile("temp/" + id);
		}
	}
	return await Getqr()
	//return //'qr.png', { root: "./" });
});
module.exports = router