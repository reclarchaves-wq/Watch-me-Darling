import {
  Bluetooth,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  QrCode,
  RefreshCw,
  Upload,
  Watch,
  Waves,
  X,
} from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';
import { scanAndPairSmartwatch } from '../engines/bluetoothBridge.ts';
import type { WatchDeviceState } from '../types.ts';
import { DarlingWordmark } from './DarlingWordmark.tsx';

interface SmartwatchQrModalProps {
  open: boolean;
  isInitialOnboarding: boolean;
  onClose: () => void;
  watchCode: string;
  onChangeWatchCode: (nextCode: string) => void;
  watch: WatchDeviceState;
  onUpdateWatch: (next: WatchDeviceState) => void;
  onTestWatchVibration: () => void;
  onCompleteOnboarding: () => void;
}

interface BarcodeResultLike {
  rawValue?: string;
}

interface BarcodeDetectorLike {
  detect(source: ImageBitmapSource): Promise<BarcodeResultLike[]>;
}

interface WindowWithBarcodeDetector extends Window {
  BarcodeDetector?: new (opts?: { formats?: string[] }) => BarcodeDetectorLike;
}

function extractWatchQrPayload(raw: string): { code: string; name: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const param = url.searchParams.get('watchPair') || url.searchParams.get('watch');
    if (param) {
      const cleaned = param.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20);
      if (cleaned) return { code: cleaned, name: `QR Watch (${cleaned})` };
    }
  } catch {
    // Plain QR payload or watch pairing code
  }
  const cleaned = trimmed.toUpperCase().replace(/[^A-Z0-9:-]/g, '').slice(0, 20);
  if (cleaned.length >= 4) {
    return { code: cleaned, name: `Smartwatch (${cleaned.slice(0, 12)})` };
  }
  return null;
}

export function SmartwatchQrModal({
  open,
  isInitialOnboarding,
  onClose,
  watchCode,
  onChangeWatchCode,
  watch,
  onUpdateWatch,
  onTestWatchVibration,
  onCompleteOnboarding,
}: SmartwatchQrModalProps) {
  const [tab, setTab] = useState<'show' | 'scan'>('show');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [manualWatchCode, setManualWatchCode] = useState('');
  const [bleScanning, setBleScanning] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const watchPairUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/?watchPair=${encodeURIComponent(watchCode)}`
      : `https://watchmedarling.app/?watchPair=${encodeURIComponent(watchCode)}`;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void QRCode.toDataURL(watchPairUrl, {
      width: 240,
      margin: 2,
      color: {
        dark: '#0D0C0F',
        light: '#F5F2EE',
      },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });

    return () => {
      cancelled = true;
    };
  }, [open, watchPairUrl]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (!open || tab !== 'scan') {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [open, tab]);

  const applyScannedWatch = (parsed: { code: string; name: string }) => {
    onChangeWatchCode(parsed.code);
    onUpdateWatch({
      connected: true,
      name: parsed.name,
      platformBridge: 'qr-watch-link',
      batteryLevel: null,
      firmwareNote: `Vibration Only · QR Linked (${parsed.code})`,
      watchPairCode: parsed.code,
    });
    setStatusNote(`Smartwatch paired via QR (${parsed.code}). Vibration-only channel active.`);
  };

  useEffect(() => {
    if (!cameraActive || !open || tab !== 'scan') return;
    const DetectorCtor = (window as WindowWithBarcodeDetector).BarcodeDetector;
    if (!DetectorCtor) return;

    const detector = new DetectorCtor({ formats: ['qr_code'] });
    let active = true;

    const tick = async () => {
      if (!active || !videoRef.current) return;
      if (videoRef.current.readyState >= 2) {
        try {
          const hits = await detector.detect(videoRef.current);
          const raw = hits[0]?.rawValue;
          const parsed = raw ? extractWatchQrPayload(raw) : null;
          if (parsed) {
            stopCamera();
            applyScannedWatch(parsed);
            setTab('show');
            return;
          }
        } catch {
          // Ignore transient frame decode errors
        }
      }
      if (active) {
        window.setTimeout(() => {
          if (active) void tick();
        }, 250);
      }
    };

    void tick();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraActive, open, tab]);

  if (!open) return null;

  const handleCopyWatchUrl = async () => {
    try {
      await navigator.clipboard.writeText(watchPairUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleRegenerateCode = () => {
    const nextCode = `WMD-W${Math.floor(100 + Math.random() * 900)}`;
    onChangeWatchCode(nextCode);
    setStatusNote(null);
  };

  const handleStartCamera = async () => {
    setScanError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setScanError('Camera access unavailable here. Upload a watch QR photo or enter your watch code below.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setCameraActive(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
      if (!(window as WindowWithBarcodeDetector).BarcodeDetector) {
        setScanError(
          'Live QR auto-decode is unsupported in this browser. Enter your smartwatch QR code manually below.'
        );
      }
    } catch (err: unknown) {
      setScanError(
        err instanceof Error
          ? err.message
          : 'Camera permission denied. Enter your smartwatch pairing code below.'
      );
      stopCamera();
    }
  };

  const handleQrImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setScanError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const DetectorCtor = (window as WindowWithBarcodeDetector).BarcodeDetector;
    if (!DetectorCtor) {
      setScanError('Image QR decode requires Chrome/Android BarcodeDetector. Enter code manually below.');
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const detector = new DetectorCtor({ formats: ['qr_code'] });
      const hits = await detector.detect(bitmap);
      const raw = hits[0]?.rawValue;
      const parsed = raw ? extractWatchQrPayload(raw) : null;
      if (parsed) {
        applyScannedWatch(parsed);
        setTab('show');
      } else {
        setScanError('No valid smartwatch QR code found in that image.');
      }
    } catch {
      setScanError('Unable to decode QR from that image.');
    }
  };

  const handleManualPair = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = extractWatchQrPayload(manualWatchCode);
    if (!parsed) {
      setScanError('Enter a smartwatch QR code or pairing ID (e.g. WMD-W482 or WATCH-8842).');
      return;
    }
    setScanError(null);
    applyScannedWatch(parsed);
    setManualWatchCode('');
    setTab('show');
  };

  const handleDirectBlePair = async () => {
    setStatusNote(null);
    setBleScanning(true);
    try {
      const paired = await scanAndPairSmartwatch();
      onUpdateWatch(paired);
      setStatusNote(`Bluetooth paired with ${paired.name} (${paired.firmwareNote}).`);
    } catch (err: unknown) {
      setStatusNote(
        err instanceof Error
          ? err.message
          : 'Bluetooth pairing cancelled. You can scan the QR code above on your smartwatch.'
      );
    } finally {
      setBleScanning(false);
    }
  };

  const handleProceed = () => {
    if (isInitialOnboarding) {
      onCompleteOnboarding();
    } else {
      onClose();
    }
  };

  const handleSkipVirtual = () => {
    onUpdateWatch({
      connected: false,
      name: 'Virtual Watch Bridge',
      platformBridge: 'virtual-wrist',
      batteryLevel: null,
      firmwareNote: 'Virtual wrist pulse active',
    });
    if (isInitialOnboarding) {
      onCompleteOnboarding();
    } else {
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Smartwatch QR Pairing Setup"
      className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-[#09080B]/92 backdrop-blur-md p-4"
    >
      <div className="my-auto max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-[#E85D75]/35 bg-[#16141A] p-6 sm:p-7 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            {isInitialOnboarding && (
              <div className="mb-2">
                <DarlingWordmark variant="compact" />
              </div>
            )}
            <span className="text-xs font-semibold text-[#E8C5A5]">
              {isInitialOnboarding
                ? 'STEP 1 · BEFORE ANYTHING ELSE'
                : 'SMARTWATCH QR BRIDGE'}
            </span>
            <h2 className="font-display mt-1 text-2xl font-medium text-[#F5F2EE]">
              Pair Your Smartwatch via QR Code
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[#A099A8]">
              Link your smartwatch first for silent <strong>Vibration-Only</strong> pulses (music &amp; voice stay strictly inside your earbuds).
            </p>
          </div>
          {!isInitialOnboarding && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close smartwatch QR pairing"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#0D0C0F] text-[#A099A8] hover:text-[#F5F2EE] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Live Watch Link Status Banner */}
        <div
          className={`mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-xs ${
            watch.connected
              ? 'border-[#E8C5A5]/50 bg-[#1F1A24] text-[#F5F2EE]'
              : 'border-white/[0.08] bg-[#0D0C0F] text-[#A099A8]'
          }`}
        >
          <div className="flex items-center gap-2">
            {watch.connected ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#E8C5A5]" />
            ) : (
              <Watch className="h-4 w-4 shrink-0 text-[#E85D75]" />
            )}
            <span>
              {watch.connected
                ? `Connected: ${watch.name} · ${watch.firmwareNote}`
                : `Waiting for Smartwatch QR scan · Watch ID ${watchCode}`}
            </span>
          </div>
          {watch.connected && (
            <button
              type="button"
              onClick={onTestWatchVibration}
              className="inline-flex items-center gap-1 rounded-lg bg-[#E85D75]/20 px-2.5 py-1 text-[11px] font-semibold text-[#F5F2EE] hover:bg-[#E85D75]/35 cursor-pointer"
            >
              <Waves className="h-3 w-3 text-[#E85D75]" />
              Test Pulse
            </button>
          )}
        </div>

        {/* Show Watch QR vs Scan Watch QR Tabs */}
        <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl border border-white/[0.08] bg-[#0D0C0F] p-1">
          <button
            type="button"
            onClick={() => setTab('show')}
            className={`flex min-h-[40px] items-center justify-center gap-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              tab === 'show'
                ? 'bg-[#E85D75] text-white'
                : 'text-[#A099A8] hover:text-[#F5F2EE]'
            }`}
          >
            <QrCode className="h-4 w-4" />
            Show QR for Watch
          </button>
          <button
            type="button"
            onClick={() => setTab('scan')}
            className={`flex min-h-[40px] items-center justify-center gap-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              tab === 'scan'
                ? 'bg-[#E85D75] text-white'
                : 'text-[#A099A8] hover:text-[#F5F2EE]'
            }`}
          >
            <Camera className="h-4 w-4" />
            Scan Watch QR
          </button>
        </div>

        {tab === 'show' ? (
          <div className="mt-4 flex flex-col items-center rounded-2xl border border-white/[0.06] bg-[#0D0C0F] p-5 text-center">
            <div className="rounded-2xl border border-white/15 bg-[#F5F2EE] p-3.5 shadow-xl">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`Smartwatch QR pairing code ${watchCode}`}
                  className="h-44 w-44 rounded-lg"
                />
              ) : (
                <div className="flex h-44 w-44 items-center justify-center text-xs text-[#0D0C0F]">
                  Generating Watch QR...
                </div>
              )}
            </div>

            <div className="mt-3">
              <div className="font-mono-tabular text-sm font-semibold text-[#F5F2EE]">
                Watch Pair ID: {watchCode}
              </div>
              <p className="mt-1 max-w-sm text-xs leading-relaxed text-[#A099A8]">
                Scan this QR with your smartwatch browser or companion watch phone to lock silent wrist vibration pulses before starting.
              </p>
            </div>

            <div className="mt-4 grid w-full grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void handleCopyWatchUrl()}
                className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#16141A] px-3 py-2 text-xs font-medium text-[#F5F2EE] hover:bg-[#231F2B] cursor-pointer"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-[#E8C5A5]" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? 'Link Copied' : 'Copy Watch Link'}</span>
              </button>
              <button
                type="button"
                onClick={handleRegenerateCode}
                className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#16141A] px-3 py-2 text-xs font-medium text-[#F5F2EE] hover:bg-[#231F2B] cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5 text-[#E85D75]" />
                <span>New Watch QR</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3 rounded-2xl border border-white/[0.06] bg-[#0D0C0F] p-4">
            <div className="relative flex aspect-video w-full flex-col items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#16141A]">
              {cameraActive ? (
                <>
                  <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
                  <div className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-[#E85D75]/80" />
                </>
              ) : (
                <div className="p-5 text-center">
                  <Watch className="mx-auto h-7 w-7 text-[#E8C5A5]" />
                  <p className="mt-2 text-xs text-[#A099A8]">
                    Point your camera at the QR code shown on your Wear OS, Galaxy Watch, or companion watch screen.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleStartCamera()}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#E85D75] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#d94d66] cursor-pointer"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      Scan Watch QR
                    </button>
                    <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl border border-white/10 bg-[#0D0C0F] px-3.5 py-2 text-xs font-medium text-[#F5F2EE] hover:bg-[#221E29]">
                      <Upload className="h-3.5 w-3.5 text-[#E8C5A5]" />
                      <span>Upload Watch QR</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => void handleQrImageUpload(e)}
                        className="sr-only"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            {scanError && <p className="text-xs text-[#F47286]">{scanError}</p>}

            <form onSubmit={handleManualPair} className="space-y-1.5 pt-1">
              <label htmlFor="manual-watch-qr" className="block text-[11px] font-medium text-[#A099A8]">
                Or enter your smartwatch QR code / ID manually
              </label>
              <div className="flex gap-2">
                <input
                  id="manual-watch-qr"
                  type="text"
                  value={manualWatchCode}
                  onChange={(e) => setManualWatchCode(e.target.value)}
                  placeholder="WATCH-8842 or WMD-W482"
                  className="h-10 flex-1 rounded-xl border border-white/10 bg-[#16141A] px-3 text-xs text-[#F5F2EE] placeholder:text-[#6E6778] focus:border-[#E85D75] focus:outline-none"
                />
                <button
                  type="submit"
                  className="min-h-[40px] rounded-xl bg-[#25212C] px-4 py-2 text-xs font-semibold text-[#F5F2EE] hover:bg-[#322C3B] cursor-pointer whitespace-nowrap"
                >
                  Link Watch
                </button>
              </div>
            </form>
          </div>
        )}

        {statusNote && (
          <p className="mt-3 text-xs text-[#E8C5A5]">{statusNote}</p>
        )}

        {/* Direct Bluetooth BLE + Continue Actions */}
        <div className="mt-4 space-y-2.5 border-t border-white/[0.06] pt-4">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <button
              type="button"
              disabled={bleScanning}
              onClick={() => void handleDirectBlePair()}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#0D0C0F] px-4 py-2 text-xs font-medium text-[#F5F2EE] hover:bg-[#231F2B] disabled:opacity-60 cursor-pointer"
            >
              <Bluetooth className="h-4 w-4 text-[#E8C5A5]" />
              <span>{bleScanning ? 'Scanning BLE...' : 'Direct Bluetooth Pair'}</span>
            </button>

            <button
              type="button"
              onClick={handleProceed}
              className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                watch.connected
                  ? 'bg-[#E85D75] text-white hover:bg-[#d94d66]'
                  : 'bg-[#25212C] text-[#F5F2EE] hover:bg-[#322C3B]'
              }`}
            >
              <span>
                {watch.connected
                  ? 'Continue to Watch me Darling'
                  : 'Continue after QR Pairing'}
              </span>
            </button>
          </div>

          {isInitialOnboarding && !watch.connected && (
            <div className="text-center">
              <button
                type="button"
                onClick={handleSkipVirtual}
                className="text-[11px] text-[#8F8898] underline-offset-2 hover:text-[#D3CDD9] hover:underline cursor-pointer"
              >
                Skip for now &amp; preview with Virtual Watch Simulator
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
