import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

const QR_READER_ELEMENT_ID = 'reader';

export function useQrScanner({ onResult }) {
  const scannerRef = useRef(null);
  const runningRef = useRef(false);
  const [scannerAberto, setScannerAberto] = useState(false);
  const [cameraErro, setCameraErro] = useState('');

  async function pararScanner() {
    const scanner = scannerRef.current;

    if (!scanner) return;

    try {
      if (runningRef.current) {
        await scanner.stop();
      }
    } catch (err) {
      console.warn('Erro ao parar scanner:', err);
    }

    try {
      await scanner.clear();
    } catch (err) {
      console.warn('Erro ao limpar scanner:', err);
    }

    runningRef.current = false;
    scannerRef.current = null;
  }

  async function fecharScanner() {
    await pararScanner();
    setScannerAberto(false);
  }

  async function abrirScanner() {
    setCameraErro('');
    setScannerAberto(true);

    // Garante que o elemento #reader já foi renderizado antes de iniciar a câmera.
    await new Promise(resolve => setTimeout(resolve, 150));

    const readerElement = document.getElementById(QR_READER_ELEMENT_ID);

    if (!readerElement) {
      setScannerAberto(false);
      throw new Error('Elemento do leitor QR Code não encontrado.');
    }

    await pararScanner();

    const scanner = new Html5Qrcode(QR_READER_ELEMENT_ID);
    scannerRef.current = scanner;

    try {
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 280, height: 280 },
          aspectRatio: 1,
          disableFlip: false
        },
        async decodedText => {
          if (!decodedText) return;

          await fecharScanner();
          await onResult?.(decodedText);
        },
        () => {
          // Ignora falhas intermediárias de leitura enquanto a câmera está aberta.
        }
      );

      runningRef.current = true;
    } catch (err) {
      console.error('Erro ao iniciar scanner:', err);
      setCameraErro('Não foi possível acessar a câmera. Verifique permissão, HTTPS e se existe câmera disponível.');
      await fecharScanner();
      throw err;
    }
  }

  useEffect(() => {
    return () => {
      pararScanner();
    };
  }, []);

  return {
    scannerAberto,
    abrirScanner,
    fecharScanner,
    cameraErro,
    readerElementId: QR_READER_ELEMENT_ID
  };
}
