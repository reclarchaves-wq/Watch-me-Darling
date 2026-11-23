import { Bluetooth, Headphones, QrCode, RefreshCw, Smartphone, Watch, Waves, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  canPickAudioOutputDevice,
  disconnectSmartwatch,
  isMobileVibrateSupported,
  isWebBluetoothSupported,
  listAudioOutputDevices,
  scanAndPairSmartwatch,
  selectEarbudOutputPrompt,
} from '../engines/bluetoothBridge.ts';
import { getPlatformMeta } from '../utils/platform.ts';
import type {
  AudioOutputOption,
  EarbudDeviceState,
  PlatformType,
  WatchDeviceState,
} from '../types.ts';

interface DeviceBridgeModalProps {
  open: boolean;
  onClose: () => void;
  watch: WatchDeviceState;
  onUpdateWatch: (w: WatchDeviceState) => void;
  earbud: EarbudDeviceState;
  onUpdateEarbud: (e: EarbudDeviceState) => void;
  onSelectAudioSink: (deviceId: string) => Promise<void>;
  vibrateEnabled: boolean;
  onToggleVibrate: (val: boolean) => void;
  platform: PlatformType;
  onTestWatchVibration: () => void;
  onTestEarbudAudio: () => void;
  onTestDualSync: () => void;
  onOpenQr: () => void;
  onOpenWatchQr: () => void;
}

export function DeviceBridgeModal({
  open,
  onClose,
  watch,
  onUpdateWatch,
  earbud,
  onUpdateEarbud,
  onSelectAudioSink,
  vibrateEnabled,
  onToggleVibrate,
  platform,
  onTestWatchVibration,
  onTestEarbudAudio,
  onTestDualSync,
  onOpenQr,
  onOpenWatchQr,
}: DeviceBridgeModalProps) {
  const [bleStatus, setBleStatus] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [audioOutputs, setAudioOutputs] = useState<AudioOutputOption[]>([]);

  useEffect(() => {
    if (!open) return;
    void listAudioOutputDevices().then(setAudioOutputs);
  }, [open]);

  if (!open) return null;

  const handleScanWatch = async () => {
    setBleStatus(null);
    setScanning(true);
    try {
      const paired = await scanAndPairSmartwatch();
      onUpdateWatch(paired);
      setBleStatus(`Connected to ${paired.name} (${paired.firmwareNote}).`);
    } catch (err: unknown) {
      setBleStatus(
        err instanceof Error
          ? err.message
          : 'Bluetooth pairing cancelled or unavailable in this browser.'
      );
    } finally {
      setScanning(false);
    }
  };

  const handleDisconnectWatch = () => {
    disconnectSmartwatch();
    onUpdateWatch({
      connected: false,
      name: 'Virtual Watch Bridge',
      platformBridge: 'virtual-wrist',
      batteryLevel: null,
      firmwareNote: 'Simulated wrist motor active',
    });
    setBleStatus('Smartwatch disconnected; virtual haptic bridge active.');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Dual Device Bluetooth Bridge"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-white/10 bg-[#16141A] p-6 sm:rounded-3xl">
        {/* Drag handle on mobile */}
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-white/20 sm:hidden" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-medium text-[#F5F2EE]">
              Dual-Link Device Bridge
            </h2>
            <p className="mt-1 text-xs text-[#A099A8]">
              Connect your smartwatch and wireless earbuds simultaneously across iOS, Android, and desktop BLE.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close device bridge"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-[#0D0C0F] text-[#A099A8] hover:text-[#F5F2EE] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {/* Smartwatch Card */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#0D0C0F] p-4">
            <div className="flex items-center gap-2.5">
              <Watch className="h-5 w-5 text-[#E85D75]" />
              <div>
                <h3 className="text-sm font-semibold text-[#F5F2EE]">
                  1. Smartwatch · Vibration Only
                </h3>
                <p className="text-[11px] text-[#8F8898]">
                  Pulse motor only · Zero audio routed to watch
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenWatchQr();
                }}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#E85D75] px-4 py-2 text-xs font-semibold text-white hover:bg-[#d94d66] cursor-pointer"
              >
                <QrCode className="h-4 w-4" />
                <span>Pair Smartwatch with QR</span>
              </button>

              <button
                type="button"
                disabled={scanning}
                onClick={() => void handleScanWatch()}
                className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl border border-[#E85D75]/40 bg-[#E85D75]/12 px-4 py-2 text-xs font-semibold text-[#F5F2EE] hover:bg-[#E85D75]/22 disabled:opacity-60 cursor-pointer"
              >
                <Bluetooth className="h-4 w-4 text-[#E85D75]" />
                <span>{scanning ? 'Scanning BLE...' : 'Pair BLE Smartwatch'}</span>
              </button>

              {watch.connected &&
                (watch.platformBridge === 'ble-gatt' || watch.platformBridge === 'qr-watch-link') && (
                  <button
                    type="button"
                    onClick={handleDisconnectWatch}
                    className="min-h-[40px] w-full rounded-xl border border-white/10 bg-[#16141A] px-3 py-2 text-xs text-[#A099A8] hover:text-[#F5F2EE] cursor-pointer"
                  >
                    Disconnect {watch.name}
                  </button>
                )}

              <label className="flex min-h-[40px] cursor-pointer items-center justify-between rounded-xl border border-white/[0.06] bg-[#16141A] px-3 py-2 text-xs text-[#D3CDD9]">
                <span>Android / Mobile Vibration</span>
                <input
                  type="checkbox"
                  checked={vibrateEnabled}
                  onChange={(e) => onToggleVibrate(e.target.checked)}
                  className="h-4 w-4 accent-[#E85D75]"
                />
              </label>

              <button
                type="button"
                onClick={onTestWatchVibration}
                className="flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#16141A] px-3 py-2 text-xs font-medium text-[#F5F2EE] hover:bg-[#231F2B] cursor-pointer"
              >
                <Waves className="h-3.5 w-3.5 text-[#E85D75]" />
                Test Silent Watch Vibration
              </button>
            </div>

            <p className="mt-3 text-[11px] text-[#8F8898] leading-relaxed">
              {bleStatus ||
                (isWebBluetoothSupported()
                  ? 'Ready to scan nearby BLE watches for vibration-only GATT pulses.'
                  : isMobileVibrateSupported()
                  ? 'Mobile vibration API active; virtual wrist simulator synced.'
                  : 'Virtual wrist haptic simulator active for preview.')}
            </p>
          </div>

          {/* Earbuds Card */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#0D0C0F] p-4">
            <div className="flex items-center gap-2.5">
              <Headphones className="h-5 w-5 text-[#E8C5A5]" />
              <div>
                <h3 className="text-sm font-semibold text-[#F5F2EE]">
                  2. Earbuds · Sounds &amp; Audio
                </h3>
                <p className="text-[11px] text-[#8F8898]">
                  AirPods · Galaxy Buds · Exclusive audio output
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <div className="flex items-center justify-between text-[11px] text-[#A099A8]">
                  <label htmlFor="audio-sink-select">Select Earbud Audio Route</label>
                  <div className="flex items-center gap-2">
                    {canPickAudioOutputDevice() && (
                      <button
                        type="button"
                        onClick={() => {
                          void selectEarbudOutputPrompt().then((picked) => {
                            if (!picked) return;
                            onUpdateEarbud({
                              ...earbud,
                              connected: true,
                              deviceId: picked.deviceId,
                              label: picked.label,
                            });
                            setAudioOutputs((prev) =>
                              prev.some((p) => p.deviceId === picked.deviceId)
                                ? prev
                                : [picked, ...prev]
                            );
                            void onSelectAudioSink(picked.deviceId);
                          });
                        }}
                        className="text-[#E8C5A5] hover:underline cursor-pointer"
                      >
                        Pick Earbuds
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void listAudioOutputDevices().then(setAudioOutputs)}
                      className="inline-flex items-center gap-1 hover:text-[#F5F2EE] cursor-pointer"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Refresh
                    </button>
                  </div>
                </div>
                <select
                  id="audio-sink-select"
                  value={earbud.deviceId}
                  onChange={(e) => {
                    const selected = audioOutputs.find((o) => o.deviceId === e.target.value);
                    onUpdateEarbud({
                      ...earbud,
                      connected: true,
                      deviceId: e.target.value,
                      label: selected?.label || 'Bluetooth Earbuds',
                    });
                    void onSelectAudioSink(e.target.value);
                  }}
                  className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-[#16141A] px-3 text-xs text-[#F5F2EE] focus:border-[#E85D75] focus:outline-none"
                >
                  {audioOutputs.map((opt) => (
                    <option key={opt.deviceId} value={opt.deviceId}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-[11px] text-[#A099A8]">
                  <span>Earbud Stereo Balance</span>
                  <span className="font-mono-tabular">
                    {earbud.balance === 0
                      ? 'Center'
                      : earbud.balance < 0
                      ? `L ${Math.abs(Math.round(earbud.balance * 100))}%`
                      : `R ${Math.round(earbud.balance * 100)}%`}
                  </span>
                </div>
                <input
                  aria-label="Earbud stereo balance"
                  type="range"
                  min={-1}
                  max={1}
                  step={0.1}
                  value={earbud.balance}
                  onChange={(e) =>
                    onUpdateEarbud({ ...earbud, balance: Number(e.target.value) })
                  }
                  className="resona-slider w-full"
                />
              </div>

              <button
                type="button"
                onClick={onTestEarbudAudio}
                className="flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#16141A] px-3 py-2 text-xs font-medium text-[#F5F2EE] hover:bg-[#231F2B] cursor-pointer"
              >
                <Headphones className="h-3.5 w-3.5 text-[#E8C5A5]" />
                Test Earbud Sound Chime
              </button>
            </div>
          </div>
        </div>

        {/* Platform Companion Summary */}
        <div className="mt-4 rounded-2xl border border-white/[0.06] bg-[#0D0C0F] p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#F5F2EE]">
            <Smartphone className="h-4 w-4 text-[#E8C5A5]" />
            <span>
              {getPlatformMeta(platform).label} · {getPlatformMeta(platform).osSpec}
            </span>
          </div>
          <p className="mt-1.5 text-xs text-[#A099A8] leading-relaxed">
            {getPlatformMeta(platform).earbudPath} &mdash; {getPlatformMeta(platform).hapticPath}. Zero speaker sound ever routes to your watch.
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenQr();
            }}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/10 bg-[#0D0C0F] px-4 py-2 text-xs font-medium text-[#F5F2EE] hover:bg-[#231F2B] cursor-pointer"
          >
            <QrCode className="h-4 w-4 text-[#E8C5A5]" />
            QR Code Partner Pairing
          </button>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onTestDualSync}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E85D75]/40 bg-[#E85D75]/12 px-4 py-2 text-xs font-semibold text-[#F5F2EE] hover:bg-[#E85D75]/22 cursor-pointer"
            >
              <Waves className="h-4 w-4 text-[#E85D75]" />
              Test Both (Earbud Audio + Watch Vibration)
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-xl bg-[#25212C] px-5 py-2 text-xs font-semibold text-[#F5F2EE] hover:bg-[#322C3B] cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
