const sharp = require('sharp');
const fs = require('fs');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#2b3858" rx="20"/>
  <text x="50" y="67" font-size="50" text-anchor="middle" fill="white" font-family="Arial">📚</text>
</svg>`;

async function generateIcons() {
  for (const size of sizes) {
    await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toFile(`public/icons/icon-${size}x${size}.png`);
    console.log(`✅ icon-${size}x${size}.png`);
  }
  
  // Копируем 192 для apple-touch
  await sharp(`public/icons/icon-192x192.png`)
    .toFile(`public/icons/apple-touch-icon.png`);
  console.log(`✅ apple-touch-icon.png`);
}

generateIcons();