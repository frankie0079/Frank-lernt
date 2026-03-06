/**
 * Generate PWA icons from the Wandervoegel logo.
 * Creates properly sized and padded icons for PWA manifest.
 *
 * Run: node scripts/generate-icons.mjs
 *
 * Requires: sharp (available as transitive dep of next.js)
 */
import { createRequire } from "module";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "public", "icons");
const logoPath = join(__dirname, "..", "public", "Logo_Wandervoegel.JPG");

mkdirSync(outDir, { recursive: true });

// Teal background color matching theme: hsl(174 62% 38%) -> #25918a
const TEAL_BG = { r: 37, g: 145, b: 138, alpha: 1 };

async function generateIcon(size, filename, isMaskable) {
  // For maskable icons, the safe zone is the inner 80% circle,
  // so we need more padding. For regular icons, less padding.
  const padding = isMaskable ? Math.round(size * 0.15) : Math.round(size * 0.05);
  const logoSize = size - padding * 2;

  // Resize logo to fit, maintaining aspect ratio, then composite on teal background
  const resizedLogo = await sharp(logoPath)
    .resize(logoSize, logoSize, { fit: "cover" })
    .toBuffer();

  // Create the icon with teal background and centered logo
  const icon = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: TEAL_BG,
    },
  })
    .composite([
      {
        input: resizedLogo,
        left: padding,
        top: padding,
      },
    ])
    .png()
    .toFile(join(outDir, filename));

  console.log(`Generated ${filename} (${size}x${size})`);
  return icon;
}

async function main() {
  // Regular icons (minimal padding, logo fills most of the space)
  await generateIcon(192, "icon-192.png", false);
  await generateIcon(512, "icon-512.png", false);

  // Maskable icons (extra padding for safe zone on Android)
  await generateIcon(192, "icon-maskable-192.png", true);
  await generateIcon(512, "icon-maskable-512.png", true);

  // Apple touch icon (180x180 is standard for iOS)
  await generateIcon(180, "apple-touch-icon.png", false);

  console.log("\nAll PWA icons generated successfully.");
}

main().catch((err) => {
  console.error("Error generating icons:", err);
  process.exit(1);
});
