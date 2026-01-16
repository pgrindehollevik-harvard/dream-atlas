/**
 * Extract the first frame from a video URL (client-side, browser only)
 * Uses HTML5 video element and canvas to capture a frame early in the video
 * Seeks to 0.1 seconds to avoid black frames that sometimes occur at 0.0
 */
export async function extractFirstFrameClient(videoUrl: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "metadata";
    video.muted = true; // Mute to allow autoplay in some browsers
    
    let seekAttempts = 0;
    const maxSeekAttempts = 3;
    
    const captureFrame = () => {
      try {
        // Create a canvas to capture the frame
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }
        
        // Draw the video frame to the canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Check if the frame is all black (or very dark)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        let totalBrightness = 0;
        const sampleSize = Math.min(pixels.length / 4, 10000); // Sample up to 10k pixels
        
        for (let i = 0; i < sampleSize * 4; i += 4) {
          // Calculate brightness (RGB average)
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          totalBrightness += (r + g + b) / 3;
        }
        
        const avgBrightness = totalBrightness / sampleSize;
        
        // If frame is too dark (average brightness < 10), try seeking further
        if (avgBrightness < 10 && seekAttempts < maxSeekAttempts) {
          seekAttempts++;
          // Try seeking to progressively later times: 0.1s, 0.5s, 1s
          const seekTime = seekAttempts === 1 ? 0.1 : seekAttempts === 2 ? 0.5 : 1.0;
          video.currentTime = seekTime;
          return; // Will trigger onseeked again
        }
        
        // Convert canvas to blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Failed to convert canvas to blob"));
            }
          },
          "image/jpeg",
          0.9 // Quality
        );
      } catch (error) {
        reject(error);
      }
    };
    
    video.onloadedmetadata = () => {
      // Seek to 0.1 seconds to avoid black frames at 0.0
      video.currentTime = 0.1;
    };
    
    video.onseeked = () => {
      captureFrame();
    };
    
    video.onerror = (error) => {
      reject(new Error(`Video loading error: ${error}`));
    };
    
    video.src = videoUrl;
  });
}

