import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type AuthSession } from '@shipit/api-client';
import { Camera, CheckCircle2, Eraser, LogOut, MapPin, MessageSquare, Navigation, PenLine, Phone, RefreshCw, ScanLine, Upload, Wifi, WifiOff, XCircle } from 'lucide-react';
import {
  deleteQueuedPod,
  listQueuedPods,
  loadTasks as loadCachedTasks,
  saveQueuedPod,
  saveTasks,
  type PodSubmission,
  type QueuedPod,
} from './offline';

interface DeliveryStop {
  id: string;
  orderNumber: string;
  waybillNumber?: string;
  customerName: string;
  phone: string;
  area: string;
  landmark: string;
  items: string;
  codAmountKes: number;
  paymentMethod: 'COD_MPESA' | 'COD_CASH' | 'PREPAID';
  status: 'PENDING' | 'FAILED';
}

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

function ParcelCameraScanner({ onScan }: { onScan: (value: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scannerError, setScannerError] = useState('');

  useEffect(() => {
    let stopped = false;
    let scanning = false;
    let timeout: number | undefined;
    let stream: MediaStream | undefined;

    async function startScanner() {
      const Detector = (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
      if (!Detector) {
        setScannerError('Camera scanning is not supported here. Use a handheld scanner or enter the waybill barcode.');
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setScannerError('Camera access is unavailable. Use a handheld scanner or enter the waybill barcode.');
        return;
      }

      const supportedFormats = await Detector.getSupportedFormats();
      const formats = ['code_128', 'qr_code'].filter((format) => supportedFormats.includes(format));
      if (!formats.length) {
        setScannerError('This camera cannot read Ship It waybills. Use a handheld scanner or enter the barcode.');
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
            onScan(result.rawValue);
            return;
          }
        } catch {
          setScannerError('Could not read a barcode. Adjust the camera and try again, or enter it manually.');
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
        setScannerError(cause instanceof Error
          ? `Camera could not start: ${cause.message}`
          : 'Camera could not start. Check camera permissions or enter the barcode manually.');
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
      <p role="status">{scannerError || 'Point the rear camera at the parcel waybill barcode.'}</p>
    </div>
  );
}

interface RiderTasks {
  rider: { id: string; name: string; phoneNumber: string };
  stops: DeliveryStop[];
  totalCodExpected: number;
}

function SignaturePad({ value, onChange }: { value: string; onChange: (signature: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
      y: ((event.clientY - bounds.top) / bounds.height) * canvas.height,
    };
  }

  function startDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const context = canvas.getContext('2d');
    if (!context) return;
    drawing.current = true;
    canvas.setPointerCapture(event.pointerId);
    const position = point(event);
    context.beginPath();
    context.moveTo(position.x, position.y);
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    const position = point(event);
    context.lineWidth = 3;
    context.lineCap = 'round';
    context.strokeStyle = '#0f172a';
    context.lineTo(position.x, position.y);
    context.stroke();
  }

  function finishDrawing() {
    if (!drawing.current) return;
    drawing.current = false;
    if (canvasRef.current) onChange(canvasRef.current.toDataURL('image/png'));
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    onChange('');
  }

  return (
    <div className="signature-field">
      <div className="signature-heading"><span><PenLine size={14} /> Recipient signature (optional)</span><button type="button" onClick={clearSignature} disabled={!value}><Eraser size={14} /> Clear</button></div>
      <canvas
        ref={canvasRef}
        className="signature-pad"
        width={600}
        height={180}
        aria-label="Recipient signature pad"
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={finishDrawing}
        onPointerCancel={finishDrawing}
      />
    </div>
  );
}

async function compressPhoto(file: File): Promise<string> {
  const image = await createImageBitmap(file);
  try {
    let scale = Math.min(1, 1200 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Photo processing is unavailable in this browser.');
    let result = '';
    while (scale >= 0.35) {
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      result = canvas.toDataURL('image/jpeg', 0.68);
      if (result.length <= 550_000) return result;
      scale *= 0.75;
    }
    throw new Error('Photo is too large to save reliably for offline delivery. Please retake it closer to the parcel.');
  } finally {
    image.close();
  }
}

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(api.session);
  const [tasks, setTasks] = useState<RiderTasks | null>(null);
  const [activeStopId, setActiveStopId] = useState('');
  const [loginError, setLoginError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [paymentChannel, setPaymentChannel] = useState<'CASH' | 'MPESA_STK'>('MPESA_STK');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [stkRequest, setStkRequest] = useState('');
  const [failedStopId, setFailedStopId] = useState('');
  const [failureReason, setFailureReason] = useState('CUSTOMER_UNREACHABLE');
  const [online, setOnline] = useState(navigator.onLine);
  const [queuedPods, setQueuedPods] = useState<QueuedPod[]>([]);
  const [cachedTasksAt, setCachedTasksAt] = useState('');
  const [signatureUrl, setSignatureUrl] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [gps, setGps] = useState<{ lat: number; lng: number }>();
  const [scannedCode, setScannedCode] = useState('');
  const [verifiedStopId, setVerifiedStopId] = useState('');
  const [cameraScanning, setCameraScanning] = useState(false);
  const [stkStatus, setStkStatus] = useState<'IDLE' | 'INITIATED' | 'SUCCEEDED' | 'FAILED'>('IDLE');
  const [stkStatusMessage, setStkStatusMessage] = useState('');
  const [stkPollingPaused, setStkPollingPaused] = useState(false);
  const syncing = useRef(false);

  const loadTasks = useCallback(async () => {
    const userId = session?.user.id;
    if (!userId) return;
    setBusy(true);
    setError('');
    let response: RiderTasks;
    try {
      response = await api.request<RiderTasks>('/riders/me/tasks');
    } catch (cause) {
      try {
        const cached = await loadCachedTasks<RiderTasks>(userId);
        if (cached) {
          setTasks(cached.value);
          setCachedTasksAt(cached.cachedAt);
          setActiveStopId((current) =>
            cached.value.stops.some((stop) => stop.id === current && stop.status === 'PENDING')
              ? current
              : cached.value.stops.find((stop) => stop.status === 'PENDING')?.id ?? '',
          );
          setNotice(`Showing stops saved ${new Date(cached.cachedAt).toLocaleString()}. Refresh when connected before completing new work.`);
        } else {
          setError(cause instanceof Error ? cause.message : 'Could not load your assigned delivery tasks.');
        }
      } catch (storageError) {
        setError(`Could not load live or saved tasks: ${storageError instanceof Error ? storageError.message : 'local storage unavailable'}`);
      }
      setBusy(false);
      return;
    }

    setTasks(response);
    setActiveStopId((current) =>
      response.stops.some((stop) => stop.id === current && stop.status === 'PENDING')
        ? current
        : response.stops.find((stop) => stop.status === 'PENDING')?.id ?? '',
    );
    const cachedAt = new Date().toISOString();
    try {
      await saveTasks(userId, response);
      setCachedTasksAt(cachedAt);
    } catch (cause) {
      setError(`Live stops loaded, but could not save an offline copy: ${cause instanceof Error ? cause.message : 'local storage unavailable'}`);
    } finally {
      setBusy(false);
    }
  }, [session?.user.id]);

  useEffect(() => {
    if (session) void loadTasks();
  }, [session, loadTasks]);

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  const refreshOutbox = useCallback(async () => {
    if (!session) return;
    try {
      setQueuedPods(await listQueuedPods(session.user.id));
    } catch (cause) {
      setError(`Offline delivery storage is unavailable: ${cause instanceof Error ? cause.message : 'unknown storage error'}`);
    }
  }, [session]);

  useEffect(() => {
    void refreshOutbox();
  }, [refreshOutbox]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setLoginError('');
    try {
      const result = await api.login(email, password);
      if (!result.user.roles.includes('RIDER')) {
        await api.logout();
        throw new Error('This account is not assigned the Rider role.');
      }
      setSession(result);
      setPassword('');
    } catch (cause) {
      setLoginError(cause instanceof Error ? cause.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setError('');
    try {
      await api.logout();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign out cleanly.');
    } finally {
      setSession(null);
      setTasks(null);
      setQueuedPods([]);
      setCachedTasksAt('');
    }
  }

  async function sendStkPrompt(stop: DeliveryStop) {
    if (!tasks) return;
    if (!online) {
      setError('M-Pesa STK prompts require an internet connection. Do not record M-Pesa delivery until payment is confirmed.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await api.request<{ checkoutRequestId?: string; message?: string }>(
        '/delivery/mpesa/stk-push',
        { method: 'POST', body: { orderId: stop.id, riderId: tasks.rider.id } },
      );
      if (!response.checkoutRequestId) {
        throw new Error('M-Pesa accepted the request without returning a payment ID. Confirm the customer’s payment before retrying.');
      }
      const requestId = response.checkoutRequestId;
      setStkRequest(requestId);
      setReceiptNumber('');
      setStkStatus('INITIATED');
      setStkStatusMessage(response.message ?? 'Waiting for Safaricom to confirm payment.');
      setStkPollingPaused(false);
      setNotice(response.message ?? 'M-Pesa payment prompt submitted.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'M-Pesa prompt could not be sent.');
    } finally {
      setBusy(false);
    }
  }

  async function checkStkStatus(requestId = stkRequest) {
    if (!requestId) return;
    try {
      const response = await api.request<{
        status: 'INITIATED' | 'SUCCEEDED' | 'FAILED';
        receiptNumber?: string;
        resultDescription?: string;
      }>(`/delivery/mpesa/stk-push/${encodeURIComponent(requestId)}`);
      setStkStatus(response.status);
      setStkStatusMessage(response.status === 'SUCCEEDED'
        ? 'Payment confirmed by Safaricom.'
        : response.status === 'FAILED'
          ? response.resultDescription ?? 'Safaricom could not confirm this payment.'
          : 'Waiting for Safaricom to confirm payment.');
      setStkPollingPaused(response.status !== 'INITIATED');
      if (response.status === 'SUCCEEDED' && response.receiptNumber) {
        setReceiptNumber(response.receiptNumber);
        setError('');
        setNotice('M-Pesa payment confirmed by Safaricom.');
      } else if (response.status === 'FAILED') {
        setError(response.resultDescription ?? 'Safaricom could not confirm this payment. Send a new prompt or choose another payment method.');
      }
    } catch (cause) {
      setError(`Could not check M-Pesa payment status: ${cause instanceof Error ? cause.message : 'payment service unavailable'}`);
    }
  }

  useEffect(() => {
    if (!online || !stkRequest || stkStatus !== 'INITIATED' || stkPollingPaused) return;
    let attempts = 0;
    let checking = false;
    let cancelled = false;
    const poll = async () => {
      if (checking || cancelled) return;
      checking = true;
      try {
        const response = await api.request<{
          status: 'INITIATED' | 'SUCCEEDED' | 'FAILED';
          receiptNumber?: string;
          resultDescription?: string;
        }>(`/delivery/mpesa/stk-push/${encodeURIComponent(stkRequest)}`);
        if (cancelled) return;
        setStkStatus(response.status);
        setStkStatusMessage(response.status === 'SUCCEEDED'
          ? 'Payment confirmed by Safaricom.'
          : response.status === 'FAILED'
            ? response.resultDescription ?? 'Safaricom could not confirm this payment.'
            : 'Waiting for Safaricom to confirm payment.');
        if (response.status === 'SUCCEEDED' && response.receiptNumber) {
          setReceiptNumber(response.receiptNumber);
          setError('');
          setNotice('M-Pesa payment confirmed by Safaricom.');
        } else if (response.status === 'FAILED') {
          setError(response.resultDescription ?? 'Safaricom could not confirm this payment. Send a new prompt or choose another payment method.');
        } else if (++attempts >= 15) {
          setStkPollingPaused(true);
          setStkStatusMessage('Still awaiting confirmation. Check again before recording delivery.');
        }
      } catch (cause) {
        if (!cancelled) {
          setError(`Could not check M-Pesa payment status: ${cause instanceof Error ? cause.message : 'payment service unavailable'}`);
        }
      } finally {
        checking = false;
      }
    };
    void poll();
    const interval = window.setInterval(() => void poll(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [online, stkPollingPaused, stkRequest, stkStatus]);

  async function queuePod(payload: PodSubmission) {
    if (!session) return;
    await saveQueuedPod({
      submissionId: payload.submissionId,
      userId: session.user.id,
      queuedAt: new Date().toISOString(),
      payload,
    });
    await refreshOutbox();
    setNotice(`${payload.orderId} saved on this device. It will sync when the connection is restored.`);
    setRecipientName('');
    setReceiptNumber('');
    setStkRequest('');
    setSignatureUrl('');
    setPhotoUrl('');
    setGps(undefined);
  }

  async function syncOutbox() {
    if (!session || !navigator.onLine || syncing.current) return;
    syncing.current = true;
    try {
      const entries = await listQueuedPods(session.user.id);
      setQueuedPods(entries);
      for (const entry of entries) {
        try {
          await api.request('/delivery/complete', { method: 'POST', body: entry.payload });
          await deleteQueuedPod(entry.submissionId);
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : 'Delivery sync failed.';
          await saveQueuedPod({ ...entry, lastError: message });
          setError(`${entry.payload.orderId} is saved but could not sync: ${message}`);
          break;
        }
      }
      const remaining = await listQueuedPods(session.user.id);
      setQueuedPods(remaining);
      if (entries.length > remaining.length) {
        setNotice(`${entries.length - remaining.length} saved delivery${entries.length - remaining.length === 1 ? '' : 'ies'} synced successfully.`);
        await loadTasks();
      }
    } catch (cause) {
      setError(`Saved deliveries could not be read: ${cause instanceof Error ? cause.message : 'local storage unavailable'}`);
    } finally {
      syncing.current = false;
    }
  }

  useEffect(() => {
    if (!session || !online) return;
    void syncOutbox();
    const onOnline = () => void syncOutbox();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [session, online, loadTasks]);

  async function completeDelivery(event: React.FormEvent<HTMLFormElement>, stop: DeliveryStop) {
    event.preventDefault();
    if (!tasks || !session) return;
    if (verifiedStopId !== stop.id) {
      setError('Scan and verify this parcel’s waybill before recording delivery.');
      return;
    }
    if (!online && tasks && cachedTasksAt && Date.now() - new Date(cachedTasksAt).getTime() > 24 * 60 * 60 * 1000) {
      setError('Saved stop data is more than 24 hours old. Reconnect and refresh before recording a delivery.');
      return;
    }
    const selectedPaymentChannel = stop.paymentMethod === 'PREPAID'
      ? 'PREPAID'
      : stop.paymentMethod === 'COD_CASH'
        ? 'CASH'
        : paymentChannel;
    const isMpesa = selectedPaymentChannel === 'MPESA_STK';
    if (isMpesa && !online) {
      setError('M-Pesa payment cannot be verified offline. Confirm payment online before recording delivery.');
      return;
    }
    if (isMpesa && stkStatus !== 'SUCCEEDED') {
      setError('Wait for Safaricom to confirm M-Pesa payment before recording delivery.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    const payload: PodSubmission = {
      orderId: stop.id,
      riderId: tasks.rider.id,
      submissionId: crypto.randomUUID(),
      recipientName,
      paymentChannel: selectedPaymentChannel,
      amountCollectedKes: stop.paymentMethod === 'PREPAID' ? 0 : stop.codAmountKes,
      ...(isMpesa ? { mpesaReceiptNumber: receiptNumber.trim() } : {}),
      ...(signatureUrl ? { signatureUrl } : {}),
      ...(photoUrl ? { photoUrl } : {}),
      ...(gps ? { gpsLat: gps.lat, gpsLng: gps.lng } : {}),
    };
    try {
      if (!navigator.onLine) {
        await queuePod(payload);
        return;
      }
      await api.request('/delivery/complete', { method: 'POST', body: payload });
      setNotice(`${stop.orderNumber} delivered and proof of delivery recorded.`);
      setRecipientName('');
      setReceiptNumber('');
      setStkRequest('');
      setSignatureUrl('');
      setPhotoUrl('');
      setGps(undefined);
      await loadTasks();
    } catch (cause) {
      if (cause instanceof TypeError || !navigator.onLine) {
        try {
          await queuePod(payload);
          setError('');
        } catch (storageError) {
          setError(`Delivery was not confirmed and could not be queued: ${storageError instanceof Error ? storageError.message : 'local storage unavailable'}`);
        }
      } else {
        setError(cause instanceof Error ? cause.message : 'Delivery could not be completed.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function capturePhoto(file?: File) {
    if (!file) return;
    setError('');
    try {
      setPhotoUrl(await compressPhoto(file));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not process delivery photo.');
    }
  }

  function captureLocation() {
    if (!navigator.geolocation) {
      setError('Location capture is not supported by this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGps({ lat: position.coords.latitude, lng: position.coords.longitude });
        setError('');
      },
      (cause) => setError(`Could not capture delivery location: ${cause.message}`),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  }

  function selectStop(stopId: string) {
    setActiveStopId(stopId);
    setRecipientName('');
    setReceiptNumber('');
    setStkRequest('');
    setSignatureUrl('');
    setPhotoUrl('');
    setGps(undefined);
    setScannedCode('');
    setVerifiedStopId('');
    setCameraScanning(false);
    setStkStatus('IDLE');
    setStkStatusMessage('');
    setStkPollingPaused(false);
  }

  const onBarcodeDetected = useCallback((value: string) => {
    setScannedCode(value);
    setVerifiedStopId('');
    setCameraScanning(false);
  }, []);

  function verifyParcelBarcode(stop: DeliveryStop) {
    const rawValue = scannedCode.trim();
    let scannedValue = rawValue;
    try {
      const payload: unknown = JSON.parse(rawValue);
      if (typeof payload === 'object' && payload !== null && 'trackingNumber' in payload &&
        typeof payload.trackingNumber === 'string') {
        scannedValue = payload.trackingNumber;
      }
    } catch {
      // Code 128 waybills contain a plain tracking number.
    }

    const acceptedCodes = [stop.waybillNumber, stop.orderNumber].filter((code): code is string => !!code);
    if (acceptedCodes.some((code) => code.toLowerCase() === scannedValue.toLowerCase())) {
      setVerifiedStopId(stop.id);
      setError('');
      setNotice(`${stop.orderNumber} parcel barcode verified.`);
      return;
    }
    setVerifiedStopId('');
    setError('That barcode does not match this delivery stop. Check the waybill and scan again.');
  }

  async function reportFailure(stop: DeliveryStop) {
    if (!tasks) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.request('/delivery/fail', {
        method: 'POST',
        body: { orderId: stop.id, riderId: tasks.rider.id, failureReason },
      });
      setFailedStopId('');
      setNotice(`Delivery exception recorded for ${stop.orderNumber}; the operations team has been notified.`);
      await loadTasks();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Delivery exception could not be recorded.');
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <main className="rider-shell auth-shell">
        <section className="auth-card">
          <div className="r-avatar">SI</div>
          <h1>Rider sign in</h1>
          <p>Use your Ship It rider account to load your assigned manifest.</p>
          {loginError && <div className="r-alert error">{loginError}</div>}
          <form onSubmit={handleLogin} className="r-form">
            <label>Email<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
            <button className="r-btn r-btn-deliver" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </form>
        </section>
      </main>
    );
  }

  const pendingStops = tasks?.stops.filter((stop) => stop.status === 'PENDING') ?? [];

  return (
    <div className="rider-shell">
      <header className="rider-header">
        <div className="rider-badge">
          <div className="r-avatar">{tasks?.rider.name.split(' ').map((part) => part[0]).slice(0, 2).join('') ?? '…'}</div>
          <div>
            <h3>{tasks?.rider.name ?? `${session.user.firstName} ${session.user.lastName}`}</h3>
            <span>{tasks ? `Rider ID: ${tasks.rider.id}` : 'Loading route…'}</span>
          </div>
        </div>
        <div className="header-actions">
          <button className="icon-button" onClick={() => void loadTasks()} title="Refresh tasks" aria-label="Refresh assigned stops" disabled={busy}><RefreshCw size={17} /></button>
          <button className="icon-button" onClick={() => void handleLogout()} title="Sign out" aria-label="Sign out"><LogOut size={17} /></button>
        </div>
      </header>

      <main className="stops-scroll">
        <div className={`connection-banner ${online ? 'connection-online' : 'connection-offline'}`} role="status">
          {online ? <Wifi size={16} /> : <WifiOff size={16} />}
          <span>{online ? 'Online' : 'Offline'}{queuedPods.length ? ` · ${queuedPods.length} saved delivery${queuedPods.length === 1 ? '' : 'ies'} waiting to sync` : ''}</span>
          {online && queuedPods.length > 0 && <button type="button" onClick={() => void syncOutbox()} disabled={busy}><Upload size={14} /> Sync</button>}
        </div>
        {!online && cachedTasksAt && <div className="r-alert warning">Using stops saved {new Date(cachedTasksAt).toLocaleString()}. M-Pesa prompts and failed-attempt reports need a connection.</div>}
        {queuedPods.some((entry) => entry.lastError) && <div className="r-alert error">{queuedPods.filter((entry) => entry.lastError).map((entry) => `${entry.payload.orderId}: ${entry.lastError}`).join(' · ')}</div>}
        {error && <div className="r-alert error">{error}</div>}
        {notice && <div className="r-alert success">{notice}</div>}
        {tasks && (
          <>
            <section className="r-stats-bar">
              <div className="r-stat-box"><span>Stops remaining</span><h2>{pendingStops.filter((stop) => !queuedPods.some((entry) => entry.payload.orderId === stop.id)).length} of {tasks.stops.length}</h2></div>
              <div className="r-stat-box"><span>Expected COD on route</span><h2>KES {tasks.totalCodExpected.toLocaleString()}</h2></div>
            </section>
            <div className="section-heading">
              <div><h2>Assigned delivery stops</h2><p>Select a pending stop to open its delivery actions.</p></div>
              <span>{tasks.stops.length} stops</span>
            </div>
            {tasks.stops.length === 0 && <div className="r-empty">No active delivery stops are assigned to your account.</div>}
            {tasks.stops.map((stop) => {
              const selected = stop.id === activeStopId;
              const isQueued = queuedPods.some((entry) => entry.payload.orderId === stop.id);
              return (
                <article className={`stop-card ${selected ? 'active-stop' : ''}`} key={stop.id}>
                  <div className="stop-top">
                    <button className="stop-select" onClick={() => selectStop(stop.id)} disabled={stop.status !== 'PENDING'}>
                      {stop.orderNumber}
                    </button>
                    <span className={`stop-tag ${isQueued ? 'tag-queued' : stop.status === 'PENDING' ? 'tag-active' : 'tag-failed'}`}>{isQueued ? 'SAVED OFFLINE' : stop.status.replace('_', ' ')}</span>
                  </div>
                  <div><div className="stop-cust">{stop.customerName}</div><div className="r-muted">{stop.area}</div></div>
                  <div className="stop-landmark"><MapPin size={15} /> {stop.landmark}</div>
                  <div className="r-muted">{stop.items}</div>
                  <div className="stop-cod"><span>COD expected</span><strong>KES {stop.codAmountKes.toLocaleString()}</strong></div>
                  {isQueued && selected && <div className="r-alert warning">This delivery is saved on this device and cannot be submitted again. Keep this app installed and sync when online.</div>}
                  {selected && stop.status === 'PENDING' && !isQueued && (
                    <div className="stop-actions">
                      <div className="rider-action-row">
                        <a href={`tel:${stop.phone}`} className="r-btn r-btn-call"><Phone size={15} /> Call</a>
                        <a href={`https://wa.me/${stop.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="r-btn r-btn-wa"><MessageSquare size={15} /> WhatsApp</a>
                        <a href={`https://maps.google.com/?q=${encodeURIComponent(`${stop.landmark} ${stop.area}`)}`} target="_blank" rel="noreferrer" className="r-btn r-btn-maps"><Navigation size={15} /> Maps</a>
                      </div>
                      <form className="r-form delivery-form" onSubmit={(event) => void completeDelivery(event, stop)}>
                        <h3>Proof of delivery</h3>
                        <section className="barcode-check" aria-label="Parcel barcode verification">
                          <label>Waybill barcode<input value={scannedCode} onChange={(event) => {
                            setScannedCode(event.target.value);
                            setVerifiedStopId('');
                          }} placeholder={stop.waybillNumber ?? stop.orderNumber} autoComplete="off" autoCapitalize="characters" /></label>
                          <div className="barcode-actions">
                            <button type="button" className="r-btn r-btn-maps" onClick={() => setCameraScanning((open) => !open)}>
                              <ScanLine size={15} /> {cameraScanning ? 'Close camera' : 'Scan with camera'}
                            </button>
                            <button type="button" className="r-btn r-btn-wa" onClick={() => verifyParcelBarcode(stop)} disabled={!scannedCode.trim()}>
                              Verify parcel
                            </button>
                          </div>
                          {cameraScanning && <ParcelCameraScanner onScan={onBarcodeDetected} />}
                          <p className={verifiedStopId === stop.id ? 'barcode-verified' : 'r-muted'} role="status">
                            {verifiedStopId === stop.id
                              ? 'Parcel verified. You can record proof of delivery.'
                              : 'Scan the waybill label or use a handheld scanner before delivery.'}
                          </p>
                        </section>
                        <label>Recipient name<input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} required minLength={2} /></label>
                        <label>Payment channel
                          <select value={stop.paymentMethod === 'PREPAID' ? 'PREPAID' : stop.paymentMethod === 'COD_CASH' ? 'CASH' : paymentChannel} onChange={(event) => setPaymentChannel(event.target.value as 'CASH' | 'MPESA_STK')}>
                            {stop.paymentMethod === 'PREPAID' ? <option value="PREPAID">Prepaid · no collection</option> : stop.paymentMethod === 'COD_CASH' ? <option value="CASH">Cash</option> : <option value="MPESA_STK">M-Pesa</option>}
                          </select>
                        </label>
                        {stop.paymentMethod === 'COD_MPESA' && paymentChannel === 'MPESA_STK' && (
                          <>
                            <button type="button" className="r-btn r-btn-wa" onClick={() => void sendStkPrompt(stop)} disabled={busy}>
                              {busy ? 'Sending…' : 'Send M-Pesa STK prompt'}
                            </button>
                            {stkRequest && (
                              <div className="payment-status" role="status">
                                <p>{stkStatusMessage || 'Waiting for Safaricom to confirm payment.'}</p>
                                {stkStatus === 'INITIATED' && (
                                  <button type="button" className="r-btn r-btn-maps" onClick={() => {
                                    setStkPollingPaused(false);
                                    void checkStkStatus();
                                  }} disabled={!online || busy}>
                                    Check payment status
                                  </button>
                                )}
                              </div>
                            )}
                            <label>M-Pesa receipt number<input value={receiptNumber} readOnly={stkStatus === 'SUCCEEDED'} required /></label>
                          </>
                        )}
                        <SignaturePad value={signatureUrl} onChange={setSignatureUrl} />
                        <label className="photo-picker"><span><Camera size={15} /> Parcel photo (optional)</span><input type="file" accept="image/*" capture="environment" onChange={(event) => void capturePhoto(event.target.files?.[0])} /></label>
                        {photoUrl && <img className="pod-photo-preview" src={photoUrl} alt="Captured parcel proof" />}
                        <button type="button" className="r-btn r-btn-maps" onClick={captureLocation}><MapPin size={15} /> {gps ? `Location captured (${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)})` : 'Capture delivery location'}</button>
                        <button type="submit" className="r-btn r-btn-deliver" disabled={busy || verifiedStopId !== stop.id || (stop.paymentMethod === 'COD_MPESA' && stkStatus !== 'SUCCEEDED')}><CheckCircle2 size={18} /> Record delivery</button>
                      </form>
                      {failedStopId === stop.id ? (
                        <div className="r-form">
                          <label>Failure reason
                            <select value={failureReason} onChange={(event) => setFailureReason(event.target.value)}>
                              <option value="CUSTOMER_UNREACHABLE">Customer unreachable</option>
                              <option value="WRONG_LOCATION">Wrong location</option>
                              <option value="RESCHEDULE_REQUESTED">Reschedule requested</option>
                              <option value="REFUSED_DELIVERY">Refused delivery</option>
                              <option value="CASH_SHORTAGE">Cash shortage</option>
                            </select>
                          </label>
                          <button type="button" className="r-btn r-btn-fail" onClick={() => void reportFailure(stop)} disabled={busy || !online}><XCircle size={16} /> Submit failed attempt</button>
                        </div>
                      ) : (
                        <button className="r-btn r-btn-fail" onClick={() => setFailedStopId(stop.id)} disabled={!online}><XCircle size={16} /> Report failed attempt</button>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </>
        )}
      </main>
    </div>
  );
}
