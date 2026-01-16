/**
 * Extract the first frame from a video URL (client-side, browser only)
 * Uses HTML5 video element and canvas to capture the first frame
 */
export async function extractFirstFrameClient(videoUrl: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "metadata";
    
    video.onloadedmetadata = () => {
      // Seek to the first frame (0 seconds)
      video.currentTime = 0;
    };
    
    video.onseeked = () => {
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
    
    video.onerror = (error) => {
      reject(new Error(`Video loading error: ${error}`));
    };
    
    video.src = videoUrl;
  });
}

