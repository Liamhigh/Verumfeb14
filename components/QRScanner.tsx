import React, { useEffect, useRef, useState } from 'react';
import { scanQRCode } from '../utils/qr';

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onScan, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let stream: MediaStream;
    let animationId: number;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", "true");
          videoRef.current.play();
          requestAnimationFrame(tick);
        }
      } catch (err) {
        setError("Camera access denied or unavailable.");
      }
    };

    const tick = () => {
      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        if (canvasRef.current) {
           const code = scanQRCode(canvasRef.current, videoRef.current);
           if (code) {
             onScan(code);
             return; // Stop scanning on success
           }
        }
      }
      animationId = requestAnimationFrame(tick);
    };

    startCamera();

    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
      cancelAnimationFrame(animationId);
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
      <div className="relative w-full max-w-md bg-verum-gray border-2 border-verum-green rounded-lg overflow-hidden shadow-[0_0_30px_rgba(39,174,96,0.3)]">
        <div className="bg-verum-green text-black font-mono font-bold px-4 py-2 flex justify-between items-center">
            <span>SCAN FORENSIC SEAL</span>
            <button onClick={onClose} className="text-black hover:text-white"><span className="material-icons">close</span></button>
        </div>
        
        <div className="relative aspect-square bg-black">
             <video ref={videoRef} className="w-full h-full object-cover" />
             <canvas ref={canvasRef} className="hidden" />
             
             {/* Scanner Overlay */}
             <div className="absolute inset-0 border-2 border-verum-green/50 m-12 animate-pulse pointer-events-none"></div>
             <div className="absolute top-1/2 left-0 w-full h-0.5 bg-verum-red shadow-[0_0_10px_#c0392b] animate-scan pointer-events-none"></div>
        </div>
        
        <div className="p-4 text-center">
            {error ? (
                <p className="text-verum-red font-mono text-sm">{error}</p>
            ) : (
                <p className="text-verum-green font-mono text-xs animate-pulse">SEARCHING FOR SHA-512 SIGNATURE...</p>
            )}
        </div>
      </div>
      <style>{`
        @keyframes scan {
            0% { top: 10%; }
            50% { top: 90%; }
            100% { top: 10%; }
        }
        .animate-scan {
            animation: scan 3s linear infinite;
        }
      `}</style>
    </div>
  );
};