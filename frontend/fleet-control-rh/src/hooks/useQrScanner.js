import { useEffect, useRef, useState } from 'react';

export function useQrScanner({ onResult }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const [scannerAberto, setScannerAberto] = useState(false);
  const temBarcodeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  async function fecharScanner() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    setScannerAberto(false);
  }

  async function abrirScanner() {
    if (!temBarcodeDetector) {
      throw new Error('BarcodeDetector não está disponível neste navegador.');
    }

    setScannerAberto(true);

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false
    });

    streamRef.current = stream;

    setTimeout(async () => {
      if (!videoRef.current) return;

      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });

      intervalRef.current = setInterval(async () => {
        try {
          if (!videoRef.current) return;

          const codes = await detector.detect(videoRef.current);
          const value = codes?.[0]?.rawValue;

          if (value) {
            await fecharScanner();
            await onResult?.(value);
          }
        } catch {
          // Mantém o scanner ativo enquanto tenta detectar o QR Code.
        }
      }, 700);
    }, 100);
  }

  useEffect(() => {
    return () => {
      fecharScanner();
    };
  }, []);

  return {
    scannerAberto,
    videoRef,
    abrirScanner,
    fecharScanner,
    temBarcodeDetector
  };
}
