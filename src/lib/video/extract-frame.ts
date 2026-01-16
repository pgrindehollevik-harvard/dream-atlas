import { tmpdir } from "os";
import { join } from "path";
import { readFileSync, unlinkSync } from "fs";

/**
 * Extract the first frame from a video URL and return it as a Buffer
 * Note: Requires ffmpeg to be available (may not work in serverless environments)
 */
export async function extractFirstFrame(videoUrl: string): Promise<Buffer> {
  // Dynamic import to avoid issues if ffmpeg isn't available
  const ffmpeg = (await import("fluent-ffmpeg")).default;
  const ffmpegInstaller = await import("@ffmpeg-installer/ffmpeg");
  
  // Set ffmpeg path
  ffmpeg.setFfmpegPath(ffmpegInstaller.default.path);
  
  return new Promise((resolve, reject) => {
    const outputPath = join(tmpdir(), `frame-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`);
    
    ffmpeg(videoUrl)
      .frames(1)
      .format("image2")
      .outputOptions(["-vframes", "1", "-q:v", "2"]) // Extract 1 frame, high quality
      .output(outputPath)
      .on("error", (err) => {
        reject(new Error(`FFmpeg error: ${err.message}`));
      })
      .on("end", () => {
        try {
          const buffer = readFileSync(outputPath);
          // Clean up temp file
          try {
            unlinkSync(outputPath);
          } catch (cleanupError) {
            // Ignore cleanup errors
          }
          resolve(buffer);
        } catch (readError) {
          reject(new Error(`Failed to read extracted frame: ${readError instanceof Error ? readError.message : String(readError)}`));
        }
      })
      .run();
  });
}

