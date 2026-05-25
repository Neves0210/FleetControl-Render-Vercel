import { useRef, useState, useCallback, useEffect } from 'react';
import { BrowserQRCodeReader } from '@zxing/browser';

/**
 * useQrScanner
 *
 * Estratégia de leitura (ordem de prioridade):
 *  1. BarcodeDetector (API nativa do SO — melhor para QR Codes danificados)
 *  2. ZXing (fallback JS para navegadores sem BarcodeDetector)
 *
 * Uso:
 *  const { scannerAberto, urlLida, abrirScanner, fecharScanner, videoRef } = useQrScanner({ onResult });
 */
export function useQrScanner({ onResult }) {
  const [scannerAberto, setScannerAberto] = useState(false);
  const [urlLida, setUrlLida] = useState('');

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);
  const zxingControlsRef = useRef(null);
  const encerrandoRef = useRef(false);

  // Verifica suporte nativo
  const temBarcodeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  function pararTudo() {
    encerrandoRef.current = true;

    // Para animation frame (BarcodeDetector)
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    // Para ZXing
    if (zxingControlsRef.current) {
      try { zxingControlsRef.current.stop(); } catch (_) {}
      zxingControlsRef.current = null;
    }

    // Para stream da câmera
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  async function pegarCamera() {
    const constraints = {
      video: {
        facingMode: { ideal: 'environment' }, // câmera traseira
        width: { ideal: 1920 },               // alta resolução ajuda em QR Codes ruins
        height: { ideal: 1080 },
      }
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    streamRef.current = stream;

    const video = videoRef.current;
    video.srcObject = stream;
    video.setAttribute('playsinline', true);

    await new Promise((resolve, reject) => {
      video.onloadedmetadata = () => video.play().then(resolve).catch(reject);
      setTimeout(reject, 8000); // timeout de segurança
    });
  }

  // ─── Estratégia 1: BarcodeDetector (nativo) ───────────────────────────────
  async function iniciarComBarcodeDetector() {
    const detector = new BarcodeDetector({ formats: ['qr_code'] });
    const video = videoRef.current;

    async function tick() {
      if (encerrandoRef.current || !video || video.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(tick);
        return;
      }

      try {
        const codigos = await detector.detect(video);

        if (codigos.length > 0) {
          const url = codigos[0].rawValue;

          pararTudo();
          setScannerAberto(false);
          setUrlLida(url);
          onResult(url);
          return;
        }
      } catch (_) {
        // Frame com erro — continua tentando
      }

      animFrameRef.current = requestAnimationFrame(tick);
    }

    animFrameRef.current = requestAnimationFrame(tick);
  }

  // ─── Estratégia 2: ZXing (fallback) ───────────────────────────────────────
  async function iniciarComZxing() {
    const reader = new BrowserQRCodeReader(null, {
      hints: new Map([
        // Tenta mais agressivamente
        [2, true], // TRY_HARDER
        [3, true], // TRY_INVERTED
      ]),
    });

    const devices = await BrowserQRCodeReader.listVideoInputDevices();
    const cameraTraseira =
      devices.find(d => /back|rear|traseira|environment/i.test(d.label)) ||
      devices[0];

    if (!cameraTraseira) throw new Error('Nenhuma câmera encontrada.');

    const controls = await reader.decodeFromVideoDevice(
      cameraTraseira.deviceId,
      videoRef.current,
      (result) => {
        if (!result || encerrandoRef.current) return;

        const url = result.getText();

        pararTudo();
        setScannerAberto(false);
        setUrlLida(url);
        onResult(url);
      }
    );

    zxingControlsRef.current = controls;
  }

  // ─── Iniciar scanner ───────────────────────────────────────────────────────
  const abrirScanner = useCallback(async () => {
    encerrandoRef.current = false;
    setScannerAberto(true);

    // Aguarda o vídeo aparecer no DOM
    await new Promise(r => setTimeout(r, 350));

    try {
      if (temBarcodeDetector) {
        // BarcodeDetector gerencia a câmera diretamente via getUserMedia
        await pegarCamera();
        await iniciarComBarcodeDetector();
      } else {
        // ZXing gerencia a câmera internamente
        await iniciarComZxing();
      }
    } catch (err) {
      pararTudo();
      setScannerAberto(false);
      throw err; // Deixa o componente tratar o erro com toast
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [temBarcodeDetector, onResult]);

  // ─── Fechar scanner manualmente ───────────────────────────────────────────
  const fecharScanner = useCallback(() => {
    pararTudo();
    setScannerAberto(false);
  }, []);

  // Cleanup ao desmontar
  useEffect(() => () => pararTudo(), []);

  return {
    scannerAberto,
    urlLida,
    videoRef,
    abrirScanner,
    fecharScanner,
    temBarcodeDetector,
  };
}
