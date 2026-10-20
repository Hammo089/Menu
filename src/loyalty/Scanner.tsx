import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus } from 'lucide-react';
import { readScan } from './lib';

export default function Scanner({ onScan }: { onScan: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const controls = useRef<{ stop(): void } | null>(null);
  const [error, setError] = useState(''),
    [running, setRunning] = useState(false);
  const detected = useRef(false);
  const reader = useRef<import('@zxing/browser').BrowserQRCodeReader | null>(null);
  const generation = useRef(0);
  function stop() {
    generation.current++;
    controls.current?.stop();
    controls.current = null;
    const stream = video.current?.srcObject;
    if (stream instanceof MediaStream) stream.getTracks().forEach((t) => t.stop());
    setRunning(false);
  }
  useEffect(
    () => () => {
      generation.current++;
      controls.current?.stop();
      const stream = video.current?.srcObject;
      if (stream instanceof MediaStream) stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  async function start() {
    const current = ++generation.current;
    setError('');
    setRunning(true);
    detected.current = false;
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      if (current !== generation.current) return;
      reader.current = new BrowserQRCodeReader();
      if (!video.current) return;
      controls.current = await reader.current.decodeFromConstraints(
        { video: { facingMode: 'environment' }, audio: false },
        video.current,
        (result) => {
          if (!result || detected.current || current !== generation.current) return;
          const code = readScan(result.getText());
          if (!code) {
            setError('Ce QR n’est pas une carte Blanco.');
            return;
          }
          detected.current = true;
          stop();
          onScan(code);
        },
      );
      if (detected.current || current !== generation.current) controls.current.stop();
    } catch {
      if (current !== generation.current) return;
      setRunning(false);
      setError(
        'Caméra indisponible. Autorisez la caméra, importez une photo ou saisissez le code.',
      );
    }
  }
  return (
    <section className="loy-scanner">
      <div className={running ? 'loy-camera active' : 'loy-camera'}>
        <video ref={video} muted playsInline autoPlay aria-label="Caméra pour scanner la carte" />
        {!running && <Camera size={42} />}
      </div>
      <div className="loy-actions">
        <button className="loy-button" onClick={() => (running ? stop() : void start())}>
          {running ? 'Arrêter la caméra' : 'Scanner une carte'}
        </button>
        <label className="loy-secondary loy-file">
          <ImagePlus size={17} /> Photo du QR
          <input
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              if (file.size > 12 * 1024 * 1024) {
                setError('Choisissez une photo de moins de 12 Mo.');
                return;
              }
              setError('');
              const url = URL.createObjectURL(file);
              try {
                const { BrowserQRCodeReader } = await import('@zxing/browser');
                const result = await new BrowserQRCodeReader().decodeFromImageUrl(url);
                const code = readScan(result.getText());
                if (!code) throw Error();
                stop();
                onScan(code);
              } catch {
                setError('QR illisible. Essayez une photo plus nette ou saisissez le code.');
              } finally {
                URL.revokeObjectURL(url);
              }
            }}
          />
        </label>
      </div>
      <p className="loy-field-help">
        La caméra et les photos sont traitées sur cet appareil, jamais envoyées au serveur.
      </p>
      {error && (
        <p role="alert" className="loy-alert">
          {error}
        </p>
      )}
    </section>
  );
}
