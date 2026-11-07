/**
 * Photo de profil : recadrage carré centré (comme l'app, aspect 1:1) et
 * réencodage JPEG. Le réencodage retire aussi les métadonnées du fichier
 * d'origine (position GPS, appareil…).
 */
const MAX_SIDE = 1080;
export const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 6 * 1024 * 1024;

export async function toSquareJpeg(file: Blob): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    if (!side) throw new Error('image vide');
    const out = Math.min(MAX_SIDE, side);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = out;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, out, out);
    for (const quality of [0.86, 0.75, 0.6]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob && blob.size <= MAX_OUTPUT_BYTES) return blob;
    }
    throw new Error('trop lourde');
  } finally {
    URL.revokeObjectURL(url);
  }
}
