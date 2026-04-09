const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableMediaMessage,
    delay
} = require('@adiwajshing/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

const startBot = async () => {
    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info');
    const { version } = await fetchLatestBaileysVersion();
    
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state,
        browser: ['MikuBot', 'Safari', '1.0.0'],
        version,
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            // Si quieres el QR en el terminal o usar qrcode-terminal
            // qrcode.generate(qr, { small: true }); 
            console.log('Escanea este QR con tu teléfono: ', qr);
            // Aquí podrías enviar el QR a un canal si lo configuras
        }
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut);
            console.log('Conexión cerrada debido a ', lastDisconnect.error, ', reconectando ', shouldReconnect);
            if (shouldReconnect) {
                startBot();
            } else {
                console.log('Conexión cerrada permanentemente. Por favor, reinicia el bot o elimina la sesión.');
            }
        } else if (connection === 'open') {
            console.log('Conexión abierta! Bot listo.');
            // Envía un mensaje de confirmación al propietario si quieres
            // sock.sendMessage('5492281367797@s.whatsapp.net', { text: 'El bot ha iniciado correctamente!' });
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        const type = Object.keys(msg.message)[0];
        const body = (type === 'conversation' && msg.message.conversation) ? msg.message.conversation : (type === 'imageMessage' && msg.message.imageMessage.caption) ? msg.message.imageMessage.caption : (type === 'videoMessage' && msg.message.videoMessage.caption) ? msg.message.videoMessage.caption : (type === 'extendedTextMessage' && msg.message.extendedTextMessage.text) ? msg.message.extendedTextMessage.text : '';

        const prefix = /^[.!#?*@\/-]/.test(body) ? body.match(/^[.!#?*@\/-]/)[0] : '';
        const command = body.replace(prefix, '').split(/ +/)[0].toLowerCase();
        const args = body.split(/ +/).slice(1);

        console.log(`Mensaje recibido de ${from}: ${body}`);

        // Reenvío de mensajes al canal
        const canalID = '0029VbC2606K0IBc9fNug21g@newsletter'; // ID de tu canal de WhatsApp
        if (from !== canalID) { // Para no reenviar mensajes que ya vienen del canal
            await sock.sendMessage(canalID, { text: `Nuevo mensaje de ${from}: \n\n${body}` });
        }


        // Comandos
        switch (command) {
            case 'ping':
                await sock.sendMessage(from, { text: 'Pong!' });
                break;
            case 'menu':
                let menuMessage = `¡Hola! Soy MikuBot. Aquí tienes mis comandos:\n\n`;
                menuMessage += `${prefix}ping - Respondo con 'Pong!'\n`;
                menuMessage += `${prefix}code - Genero un código aleatorio.\n`;
                menuMessage += `${prefix}code quiere ser el mí - ¡Un mensaje especial!\n`;
                menuMessage += `(Pronto habrá más comandos!)\n\n`;
                menuMessage += `Para contactar al dueño: ${prefix}owner`; // Puedes agregar un comando para owner
                await sock.sendMessage(from, { text: menuMessage });
                break;
            case 'code':
                if (body.toLowerCase().includes('quiere ser el mí')) {
                    await sock.sendMessage(from, { text: '¡Solo los elegidos pueden ser el tuyo!' });
                } else {
                    const randomCode = Math.floor(100000 + Math.random() * 900000).toString(); // Código de 6 dígitos
                    await sock.sendMessage(from, { text: `Tu código aleatorio es: ${randomCode}` });
                }
                break;
            // Puedes añadir más comandos aquí
            default:
                // Si no es un comando conocido, puedes ignorarlo o responder algo
                // await sock.sendMessage(from, { text: 'Comando no reconocido. Escribe !menu para ver los comandos.' });
                break;
        }
    });

    sock.ev.on('creds.update', saveCreds);
};

startBot();
  
