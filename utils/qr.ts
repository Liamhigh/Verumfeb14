import QRCode from "qrcode";
import jsQR from "jsqr";

export const generateQRCode = async (text: string): Promise<string> => {
  try {
    // Generate as Data URL (base64 image)
    return await QRCode.toDataURL(text, {
      color: {
        dark: '#27ae60',  // Verum Green
        light: '#000000' // Black background
      },
      margin: 2
    });
  } catch (err) {
    console.error(err);
    return "";
  }
};

export const scanQRCode = (canvas: HTMLCanvasElement, video: HTMLVideoElement): string | null => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    // Ensure canvas matches video dims
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
    });

    if (code) {
        return code.data;
    }
    return null;
}