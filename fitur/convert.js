const axios = require('axios');

const currencyToFlag = (code) => {
    const country = {
        USD: 'US', IDR: 'ID', EUR: 'EU', GBP: 'GB',
        JPY: 'JP', MYR: 'MY', SGD: 'SG', AUD: 'AU',
        CAD: 'CA', CNY: 'CN', KRW: 'KR', THB: 'TH',
        INR: 'IN', CHF: 'CH', NZD: 'NZ', PHP: 'PH',
        HKD: 'HK', SAR: 'SA', AED: 'AE', RUB: 'RU'
    }[code.toUpperCase()] || 'UN'; // UN = Unknown

    return country.replace(/./g, c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65));
};

module.exports = async (sock, msg, command, args) => {
    if (args.length < 3) {
        return sock.sendMessage(msg.key.remoteJid, {
            text: '⚠️ Format salah!\nContoh: .convert 100 usd idr'
        }, { quoted: msg });
    }

    const amount = parseFloat(args[0]);
    const from = args[1].toUpperCase();
    const to = args[2].toUpperCase();

    if (isNaN(amount)) {
        return sock.sendMessage(msg.key.remoteJid, {
            text: '⚠️ Jumlah harus angka!'
        }, { quoted: msg });
    }

    try {
        const res = await axios.get(`https://open.er-api.com/v6/latest/${from}`);
        const rate = res.data?.rates?.[to];

        if (!rate) throw new Error('Kode mata uang salah');

        const converted = (amount * rate).toLocaleString('id-ID', {
            maximumFractionDigits: 2
        });

        const flagFrom = currencyToFlag(from);
        const flagTo = currencyToFlag(to);

        await sock.sendMessage(msg.key.remoteJid, {
            text: `💱 *Konversi Mata Uang*\n\n${flagFrom} ${amount} ${from} = *${converted} ${to}* ${flagTo}\n\nSumber: open.er-api.com`
        }, { quoted: msg });

    } catch (e) {
        console.error(e.message);
        await sock.sendMessage(msg.key.remoteJid, {
            text: '❌ Gagal melakukan konversi. Periksa koneksi dan kode mata uang.'
        }, { quoted: msg });
    }
};
