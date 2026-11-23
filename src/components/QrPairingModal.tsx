import { Camera, Check, Copy, QrCode, RefreshCw, Upload, X } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';

interface QrPairingModalProps {
  open: boolean;
  onClose: () => void;
  roomId: string;
  userName: string;
  onJoinRoom: (roomId: string, userName: string) => void;
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

function extractRoomCode(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    const param = parsed.searchParams.get('room');
    if (param) {
      return param.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16) || null;
    }
  } catch {
    // Not a URL; inspect as direct room code
  }
  const match = trimmed.toUpperCase().match(/[A-Z0-9]{2,8}-[A-Z0-9]{2,8}|[A-Z0-9]{4,12}/);
  return match ? match[0].slice(0, 16) : null;
}

export function QrPairingModal({
  open,
  onClose,
  roomId,
  userName,
  onJoinRoom,
}: QrPairingModalProps) {
  const [tab, setTab] = useState<'show' | 'scan'>('show');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const inviteUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/?room=${encodeURIComponent(roomId)}`
      : `https://watchmedarling.app/?room=${encodeURIComponent(roomId)}`;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void QRCode.toDataURL(inviteUrl, {
      width: 280,
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
  }, [open, inviteUrl]);

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

  useEffect(() => {
    if (!cameraActive || !open || tab !== 'scan') return;
    const DetectorCtor = (window as WindowWithBarcodeDetector).BarcodeDetector;
    if (!DetectorCtor) return;

    const detector = new DetectorCtor({ formats: ['qr_code'] });
    let active = true;

    const scanFrame = async () => {
      if (!active || !videoRef.current) return;
      if (videoRef.current.readyState >= 2) {
        try {
          const hits = await detector.detect(videoRef.current);
          const raw = hits[0]?.rawValue;
          if (raw) {
            const parsedCode = extractRoomCode(raw);
            if (parsedCode) {
              stopCamera();
              onJoinRoom(parsedCode, userName);
              onClose();
              return;
            }
          }
        } catch {
          // Ignore transient frame decode errors
        }
      }
      if (active) {
        window.setTimeout(() => {
          if (active) void scanFrame();
        }, 250);
      }
    };

    void scanFrame();
    return () => {
      active = false;
    };
  }, [cameraActive, open, tab, onJoinRoom, userName, onClose]);

  if (!open) return null;

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleFreshRoom = () => {
    const nextCode = `WMD-${Math.floor(1000 + Math.random() * 9000)}`;
    onJoinRoom(nextCode, userName);
  };

  const handleStartCamera = async () => {
    setScanError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setScanError('Camera API is not available in this browser. Paste an invite link below.');
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
          'Live QR auto-decode is unavailable in this browser. Use your phone camera app on your partner’s QR or paste their invite link below.'
        );
      }
    } catch (err: unknown) {
      setScanError(
        err instanceof Error
          ? err.message
          : 'Camera permission was denied. Paste your partner’s invite link or room code below.'
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
      setScanError(
        'Image QR decoding requires Chrome/Android BarcodeDetector. Enter the room code manually below.'
      );
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const detector = new DetectorCtor({ formats: ['qr_code'] });
      const hits = await detector.detect(bitmap);
      const raw = hits[0]?.rawValue;
      const code = raw ? extractRoomCode(raw) : null;
      if (code) {
        onJoinRoom(code, userName);
        onClose();
      } else {
        setScanError('No valid Watch me Darling room QR code was detected in that image.');
      }
    } catch {
      setScanError('Could not read QR code from that image.');
    }
  };

  const handleJoinManual = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = extractRoomCode(manualInput);
    if (!parsed) {
      setScanError('Enter a valid room code (e.g. WMD-4821) or invite link.');
      return;
    }
    onJoinRoom(parsed, userName);
    setManualInput('');
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="QR Code Couple Pairing"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-[#16141A] p-6 sm:rounded-3xl">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-white/20 sm:hidden" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-medium text-[#F5F2EE]">
              QR Code Pairing
            </h2>
            <p className="mt-1 text-xs text-[#A099A8]">
              Pair iOS or Android partners instantly by scanning a private room QR code.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close QR pairing"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-[#0D0C0F] text-[#A099A8] hover:text-[#F5F2EE] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Segmented Show / Scan Tabs */}
        <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl border border-white/[0.08] bg-[#0D0C0F] p-1">
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
            Show My QR
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
            Scan Partner QR
          </button>
        </div>

        {tab === 'show' ? (
          <div className="mt-5 flex flex-col items-center text-center">
            <div className="rounded-3xl border border-white/15 bg-[#F5F2EE] p-4 shadow-xl">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR pairing code for room ${roomId}`}
                  className="h-52 w-52 rounded-xl"
                />
              ) : (
                <div className="flex h-52 w-52 items-center justify-center text-xs text-[#0D0C0F]">
                  Generating QR...
                </div>
              )}
            </div>

            <div className="mt-4">
              <div className="font-mono-tabular text-base font-semibold text-[#F5F2EE]">
                Room {roomId}
              </div>
              <p className="mt-1 max-w-sm text-xs text-[#A099A8] leading-relaxed">
                Have your partner scan this QR with their iPhone or Android camera to join your live smartwatch &amp; earbud session.
              </p>
            </div>

            <div className="mt-5 grid w-full grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => void handleCopyInvite()}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#0D0C0F] px-3 py-2 text-xs font-medium text-[#F5F2EE] hover:bg-[#231F2B] cursor-pointer"
              >
                {copied ? <Check className="h-4 w-4 text-[#E8C5A5]" /> : <Copy className="h-4 w-4" />}
                <span>{copied ? 'Link Copied' : 'Copy Invite Link'}</span>
              </button>
              <button
                type="button"
                onClick={handleFreshRoom}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#0D0C0F] px-3 py-2 text-xs font-medium text-[#F5F2EE] hover:bg-[#231F2B] cursor-pointer"
              >
                <RefreshCw className="h-4 w-4 text-[#E85D75]" />
                <span>Fresh QR Code</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="relative flex aspect-video w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#0D0C0F]">
              {cameraActive ? (
                <>
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="h-full w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-[#E85D75]/75" />
                </>
              ) : (
                <div className="p-6 text-center">
                  <Camera className="mx-auto h-8 w-8 text-[#E8C5A5]" />
                  <p className="mt-2 text-xs text-[#A099A8]">
                    Open your camera to scan your partner&apos;s QR code or upload a QR screenshot.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => void handleStartCamera()}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#E85D75] px-4 py-2 text-xs font-semibold text-white hover:bg-[#d94d66] cursor-pointer"
                    >
                      <Camera className="h-4 w-4" />
                      Start Camera Scan
                    </button>
                    <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-[#16141A] px-4 py-2 text-xs font-medium text-[#F5F2EE] hover:bg-[#221E29]">
                      <Upload className="h-4 w-4 text-[#E8C5A5]" />
                      <span>Upload QR Image</span>
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

            {scanError && (
              <p className="text-xs text-[#F47286] leading-relaxed">{scanError}</p>
            )}

            <form onSubmit={handleJoinManual} className="space-y-2 border-t border-white/[0.06] pt-4">
              <label htmlFor="qr-manual-code" className="block text-xs font-medium text-[#A099A8]">
                Or paste partner invite link / room code
              </label>
              <div className="flex gap-2">
                <input
                  id="qr-manual-code"
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="https://.../?room=WMD-4821 or WMD-4821"
                  className="h-11 flex-1 rounded-xl border border-white/10 bg-[#0D0C0F] px-3.5 text-xs text-[#F5F2EE] placeholder:text-[#6E6778] focus:border-[#E85D75] focus:outline-none"
                />
                <button
                  type="submit"
                  className="min-h-[44px] rounded-xl bg-[#25212C] px-4 py-2 text-xs font-semibold text-[#F5F2EE] hover:bg-[#322C3B] cursor-pointer whitespace-nowrap"
                >
                  Pair Now
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
