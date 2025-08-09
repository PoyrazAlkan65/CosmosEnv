const crypto = require('crypto');

// 32 karakterlik (256 bit) key kullan
function encrypt(text, keyString) {
  const key = crypto.createHash('sha256').update(keyString).digest(); // 32 byte key
  const iv = crypto.randomBytes(12); // 96 bit IV (GCM için önerilen uzunluk)

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return {
    content: encrypted,
    iv: iv.toString('hex'),
    tag: authTag.toString('hex'),
  };
}

function decrypt(encryptedData, keyString) {
  const key = crypto.createHash('sha256').update(keyString).digest();
  const iv = Buffer.from(encryptedData.iv, 'hex');
  const tag = Buffer.from(encryptedData.tag, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encryptedData.content, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

module.exports.enc = encrypt;
module.exports.dnc = decrypt;

// // Örnek kullanım
// const myKey = "benimGizliKeyim1234567890"; // Bu senin belirleyeceğin key
// const myText = "Saklanması gereken gizli bilgi";

// const encrypted = encrypt(myText, myKey);
// console.log("Şifreli:", encrypted);

// const decrypted = decrypt(encrypted, myKey);
// console.log("Çözülmüş:", decrypted);
