import type { AudioOutputOption, WatchDeviceState } from '../types.ts';

interface BleCharacteristicLike {
  uuid: string;
  readValue(): Promise<DataView>;
  writeValueWithoutResponse(value: BufferSource): Promise<void>;
}

interface BleServiceLike {
  getCharacteristic(uuid: string): Promise<BleCharacteristicLike>;
}

interface BleGattServerLike {
  connected: boolean;
  connect(): Promise<BleGattServerLike>;
  disconnect(): void;
  getPrimaryService(uuid: string): Promise<BleServiceLike>;
}

interface BleDeviceLike {
  name?: string;
  gatt?: BleGattServerLike;
}

interface NavigatorWithBluetooth extends Navigator {
  bluetooth?: {
    requestDevice(options: {
      acceptAllDevices?: boolean;
      optionalServices?: string[];
    }): Promise<BleDeviceLike>;
  };
}

interface BleSession {
  device: BleDeviceLike | null;
  writableChar: BleCharacteristicLike | null;
  lastWriteMs: number;
}

const NORDIC_UART_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const NORDIC_UART_RX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

const bleSession: BleSession = {
  device: null,
  writableChar: null,
  lastWriteMs: 0,
};

let qrPulseSender: ((intensity: number, frequencyHz: number) => void) | null = null;

export function setWatchQrPulseSender(
  sender: ((intensity: number, frequencyHz: number) => void) | null
): void {
  qrPulseSender = sender;
}

export function isWebBluetoothSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    Boolean((navigator as NavigatorWithBluetooth).bluetooth)
  );
}

export function isMobileVibrateSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

export async function scanAndPairSmartwatch(): Promise<WatchDeviceState> {
  const nav = navigator as NavigatorWithBluetooth;
  if (!nav.bluetooth) {
    throw new Error(
      'Web Bluetooth is unavailable in this browser context. Using Virtual Wrist & Mobile Haptic Bridge.'
    );
  }

  const device = await nav.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [
      'heart_rate',
      'battery_service',
      'immediate_alert',
      'generic_access',
      NORDIC_UART_SERVICE,
    ],
  });

  let writableChar: BleCharacteristicLike | null = null;
  let batteryLevel: number | null = null;
  let firmwareNote = 'Vibration Only · BLE GATT';

  if (device.gatt) {
    const server = await device.gatt.connect();

    try {
      const batteryService = await server.getPrimaryService('battery_service');
      const batteryChar = await batteryService.getCharacteristic('battery_level');
      const val = await batteryChar.readValue();
      batteryLevel = val.getUint8(0);
    } catch {
      batteryLevel = null;
    }

    try {
      const uart = await server.getPrimaryService(NORDIC_UART_SERVICE);
      writableChar = await uart.getCharacteristic(NORDIC_UART_RX);
      firmwareNote = 'Vibration Only · BLE UART';
    } catch {
      try {
        const alertSvc = await server.getPrimaryService('immediate_alert');
        writableChar = await alertSvc.getCharacteristic('alert_level');
        firmwareNote = 'Vibration Only · BLE Haptics';
      } catch {
        firmwareNote = 'Vibration Only · BLE Watch Bridge';
      }
    }
  }

  bleSession.device = device;
  bleSession.writableChar = writableChar;

  return {
    connected: true,
    name: device.name || 'Generic BLE Smartwatch',
    platformBridge: 'ble-gatt',
    batteryLevel,
    firmwareNote,
  };
}

export function disconnectSmartwatch(): void {
  if (bleSession.device?.gatt?.connected) {
    bleSession.device.gatt.disconnect();
  }
  bleSession.device = null;
  bleSession.writableChar = null;
}

export function dispatchWatchHaptic(
  intensity: number,
  frequencyHz: number,
  bridgeMode: WatchDeviceState['platformBridge'],
  vibrateEnabled: boolean
): void {
  const clampedIntensity = Math.max(0, Math.min(100, Math.round(intensity)));
  const now = performance.now();

  if (now - bleSession.lastWriteMs < 75) {
    return;
  }
  bleSession.lastWriteMs = now;

  // 1. Real BLE GATT write if smartwatch exposes a writable haptic/UART characteristic
  if (bridgeMode === 'ble-gatt' && bleSession.writableChar) {
    try {
      if (bleSession.writableChar.uuid === NORDIC_UART_RX) {
        const cmd = new TextEncoder().encode(
          `V:${clampedIntensity}:${Math.round(frequencyHz)};`
        );
        void bleSession.writableChar.writeValueWithoutResponse(cmd);
      } else {
        const level = clampedIntensity > 65 ? 2 : clampedIntensity > 20 ? 1 : 0;
        void bleSession.writableChar.writeValueWithoutResponse(new Uint8Array([level]));
      }
    } catch {
      // Ignore transient GATT busy errors
    }
  }

  // 2. QR-linked Smartwatch WebSocket relay (Vibration Only · Zero Audio)
  if (bridgeMode === 'qr-watch-link' && qrPulseSender) {
    try {
      qrPulseSender(clampedIntensity, Math.round(frequencyHz));
    } catch {
      // Ignore transient socket send error
    }
  }

  // 3. Native Android / Mobile Haptics fallback
  if (vibrateEnabled && isMobileVibrateSupported()) {
    if (clampedIntensity > 12) {
      const pulseMs = Math.max(12, Math.min(65, Math.round((clampedIntensity / 100) * 60)));
      navigator.vibrate(pulseMs);
    }
  }
}

export async function listAudioOutputDevices(): Promise<AudioOutputOption[]> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.enumerateDevices !== 'function'
  ) {
    return [{ deviceId: 'default', label: 'System Audio / Earbuds (Default)' }];
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const outputs = devices
      .filter((d) => d.kind === 'audiooutput')
      .map((d, idx) => ({
        deviceId: d.deviceId || `output-${idx}`,
        label: d.label || (idx === 0 ? 'Default Earbuds / Speakers' : `Bluetooth Audio ${idx + 1}`),
      }));

    if (outputs.length === 0) {
      return [{ deviceId: 'default', label: 'System Audio / Earbuds (Default)' }];
    }
    return outputs;
  } catch {
    return [{ deviceId: 'default', label: 'System Audio / Earbuds (Default)' }];
  }
}
