import imageCompression from "browser-image-compression";

/**
 * Compress an image file to WebP with sensible defaults for handwritten
 * answer photos. Falls back to the original file if compression fails.
 */
export async function compressAnswerImage(file: File): Promise<File> {
  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: 1.5,
      maxWidthOrHeight: 2200,
      useWebWorker: true,
      fileType: "image/webp",
      initialQuality: 0.85,
    });
    // Rename extension to .webp for clarity
    const newName = file.name.replace(/\.[^.]+$/, "") + ".webp";
    return new File([compressed], newName, { type: "image/webp" });
  } catch (e) {
    console.warn("[compressAnswerImage] fallback to original", e);
    return file;
  }
}
