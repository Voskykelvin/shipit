import React, { useEffect, useRef, useState } from 'react';
import { riderFeedback } from '../utils/feedback';

interface BarcodeDetectorResult {
  rawValue: string;
}

interface BarcodeDetectorInstance {
  detect(source: HTMLVideoElement): Promise<BarcodeDetectorResult[]>;
}

interface BarcodeDetectorConstructor {
  new (options: { formats: string[] }): BarcodeDetectorInstance;
  getSupportedFormats(): Promise<string[]>;
}

export function ParcelCameraScanner({ onScan }: { onScan: (value: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scannerError, setScannerError] = useState('');

  useEffect(() => {
    let stopped = false;
    let scanning = false;
    let timeout: number | undefined;
    let stream: MediaStream | undefined;

    async function startScanner() {
      const Detector = (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor })
        .BarcodeDetector;
      if (!Detector) {
        setScannerError(
          'Camera scanning is not supported here. Use a handheld scanner or enter the waybill barcode.',
        );
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setScannerError('Camera access is unavailable. Use a handheld scanner or enter the waybill barcode.');
        return;
      }

      const supportedFormats = await Detector.getSupportedFormats();
      const formats = ['code_128', 'qr_code'].filter((format) =>
        supportedFormats.includes(format),
      );
      if (!formats.length) {
        setScannerError(
          'This camera cannot read Ship It waybills. Use a handheld scanner or enter the barcode.',
        );
        return;
      }

      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' } },
      });
      const video = videoRef.current;
      if (!video || stopped) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      video.srcObject = stream;
      await video.play();
      const detector = new Detector({ formats });

      const detect = async () => {
        if (stopped || scanning) return;
        scanning = true;
        try {
          const [result] = await detector.detect(video);
          if (result) {
            riderFeedback.success();
            onScan(result.rawValue);
            return;
          }
        } catch {
          setScannerError(
            'Could not read a barcode. Adjust the camera and try again, or enter it manually.',
          );
          return;
        } finally {
          scanning = false;
        }
        if (!stopped) timeout = window.setTimeout(() => void detect(), 250);
      };
      void detect();
    }

    void startScanner().catch((cause: unknown) => {
      if (!stopped) {
        setScannerError(
          cause instanceof Error
            ? `Camera could not start: ${cause.message}`
            : 'Camera could not start. Check camera permissions or enter the barcode manually.',
        );
      }
    });

    return () => {
      stopped = true;
      if (timeout !== undefined) window.clearTimeout(timeout);
      stream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [onScan]);

  return (
    <div className="barcode-scanner">
      <video ref={videoRef} muted playsInline aria-label="Camera barcode scanner" />
      <p role="status">
        {scannerError || 'Point the rear camera at the parcel waybill barcode.'}
      </p>
    </div>
  );
}
