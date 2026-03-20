const sharp = require('sharp')
const path = require('path')

const size = 1024
const svg = Buffer.from(`
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#0d0d0f" rx="200"/>
  <text
    x="50%"
    y="54%"
    font-family="Arial Black, Arial"
    font-weight="900"
    font-size="520"
    fill="#c8f135"
    text-anchor="middle"
    dominant-baseline="middle"
  >CR</text>
</svg>
`)

const outputDir = path.join(__dirname, 'assets', 'images')

async function generate() {
  await sharp(svg).resize(1024, 1024).png().toFile(path.join(outputDir, 'icon.png'))
  console.log('✅ icon.png generado')
  await sharp(svg).resize(1024, 1024).png().toFile(path.join(outputDir, 'splash-icon.png'))
  console.log('✅ splash-icon.png generado')
  await sharp(svg).resize(1024, 1024).png().toFile(path.join(outputDir, 'android-icon-foreground.png'))
  console.log('✅ android-icon-foreground.png generado')
}

generate().catch(console.error)