// @ts-ignore -- heic2any has no bundled types
import heic2any from 'heic2any'

const HEIC_TYPES = ['image/heic', 'image/heif']
const HEIC_EXTENSIONS = ['.heic', '.heif']

function isHeic(file: File): boolean {
  if (HEIC_TYPES.includes(file.type.toLowerCase())) return true
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
  return HEIC_EXTENSIONS.includes(ext)
}

/**
 * If the file is HEIC/HEIF, convert it to JPEG.
 * Otherwise return the original file unchanged.
 */
export async function ensureJpeg(file: File): Promise<File> {
  if (!isHeic(file)) return file

  const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 }) as Blob
  const name = file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg')
  return new File([blob], name, { type: 'image/jpeg' })
}
