// Đây là phiên bản JavaScript sử dụng Node.js với các thư viện: node-telegram-bot-api, express, axios, firebase

// Cài đặt thư viện trước bằng:
// npm install node-telegram-bot-api express axios firebase-admin

const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');
const crypto = require('crypto');

const BOT_TOKEN = '7997802249:AAHx3SLJP8fKOZ-aoe-D7yyCbGw-7k1K7cI';
const FIREBASE_URL = 'https://bot-telegram-99852-default-rtdb.firebaseio.com/shared';
const CHANNEL_USERNAME = '@hoahocduong_vip';

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const app = express();

const userFiles = new Map();
const userAlias = new Map();
const userProtection = new Map();

// Hàm tạo alias ngẫu nhiên
function generateAlias(length = 7) {
  const datePrefix = new Date().toISOString().slice(0, 10).split('-').reverse().join('');
  const randomPart = crypto.randomBytes(length).toString('hex').slice(0, length);
  return datePrefix + randomPart;
}

// Kiểm tra đã tham gia kênh
async function checkMembership(userId) {
  try {
    const res = await bot.getChatMember(CHANNEL_USERNAME, userId);
    return ['member', 'administrator', 'creator'].includes(res.status);
  } catch (err) {
    return false;
  }
}

bot.onText(/\/start(?:\s+(\S+))?/, async (msg, match) => {
  const userId = msg.from.id;
  const alias = match[1];

  if (!(await checkMembership(userId))) {
    const confirmLink = `https://t.me/${bot.username}?start=${alias || 'start'}`;
    const keyboard = {
      inline_keyboard: [
        [{ text: '🔥 THAM GIA KÊNH NGAY', url: `https://t.me/${CHANNEL_USERNAME.slice(1)}` }],
        [{ text: '🔓 XÁC NHẬN ĐÃ THAM GIA', url: confirmLink }]
      ]
    };
    return bot.sendMessage(userId, `📛 BẠN PHẢI THAM GIA KÊNH TRƯỚC KHI SỬ DỤNG BOT!\n👉 Kênh yêu cầu: ${CHANNEL_USERNAME}\n✅ Sau khi tham gia, nhấn nút XÁC NHẬN để tiếp tục`, { reply_markup: keyboard });
  }

  if (alias) {
    try {
      const res = await axios.get(`${FIREBASE_URL}/${alias}.json`);
      const data = res.data;
      if (!data) return bot.sendMessage(userId, '❌ Không tìm thấy dữ liệu với mã này.');

      const media = [], texts = [];
      data.forEach(item => {
        if (item.type === 'photo') media.push({ type: 'photo', media: item.file_id });
        else if (item.type === 'video') media.push({ type: 'video', media: item.file_id });
        else if (item.type === 'text') texts.push(item.file_id);
      });
      if (texts.length) await bot.sendMessage(userId, texts.join('\n\n'));
      for (let i = 0; i < media.length; i += 10) {
        await bot.sendMediaGroup(userId, media.slice(i, i + 10));
      }
    } catch (err) {
      bot.sendMessage(userId, '🔒 Lỗi kết nối database');
    }
  } else {
    bot.sendMessage(userId, '📥 Gửi lệnh để bắt đầu tạo liên kết lưu trữ nội dung. Nếu bạn muốn sử dụng miễn phí hãy liên hệ @nothinginthissss để được cấp quyền');
  }
});

bot.onText(/\/newlink/, async msg => {
  const userId = msg.from.id;
  if (!(await checkMembership(userId))) return;
  userFiles.set(userId, []);
  userAlias.set(userId, generateAlias());
  bot.sendMessage(userId, '✅ Bây giờ bạn có thể gửi ảnh, video hoặc text. Khi xong hãy nhắn /done để tạo link.');
});

bot.onText(/\/done/, async msg => {
  const userId = msg.from.id;
  if (!(await checkMembership(userId))) return;
  const files = userFiles.get(userId) || [];
  const alias = userAlias.get(userId);
  if (!files.length || !alias) return bot.sendMessage(userId, '❌ Bạn chưa bắt đầu bằng link hoặc chưa gửi nội dung.');

  try {
    await axios.put(`${FIREBASE_URL}/${alias}.json`, files);
    const link = `https://t.me/upbaiviet_bot?start=${alias}`;
    bot.sendMessage(userId, `✅ Đã lưu thành công!\n🔗 Link truy cập: ${link}\n📦 Tổng số nội dung: ${files.length} (Ảnh/Video/Text)`);
  } catch (err) {
    bot.sendMessage(userId, '❌ Lỗi khi lưu dữ liệu.');
  }
  userFiles.delete(userId);
  userAlias.delete(userId);
});

bot.onText(/\/sigmaboy (on|off)/, (msg, match) => {
  const userId = msg.from.id;
  userProtection.set(userId, match[1] === 'off');
  bot.sendMessage(userId, '.');
});

bot.on('message', msg => {
  const userId = msg.from.id;
  if (!userFiles.has(userId)) return;

  const entry = msg.photo ? { type: 'photo', file_id: msg.photo.pop().file_id } :
                msg.video ? { type: 'video', file_id: msg.video.file_id } :
                msg.text && !msg.text.startsWith('/') ? { type: 'text', file_id: msg.text } : null;

  if (entry) {
    const files = userFiles.get(userId);
    if (!files.find(f => f.file_id === entry.file_id)) {
      files.push(entry);
    }
  }
});

// Web server để giữ bot online trên Koyeb
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(8000, () => console.log('Web server running on port 8000'));
