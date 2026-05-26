import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  Scan, CheckCircle, XCircle, ShieldAlert, ArrowRight, 
  Smartphone, User, Calendar, Award, Copy, Check, X 
} from 'lucide-react';

const Scanner = () => {
  const { token, apiUrl } = useAuth();
  const [scanResult, setScanResult] = useState(null);
  const [scanning, setScanning] = useState(true);
  const [manualToken, setManualToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const scannerRef = useRef(null);
  const qrDecoderRef = useRef(null);
  const startTimeoutRef = useRef(null);
  const isStartingRef = useRef(false);
  const shouldStopRef = useRef(false);
  const scannerContainerId = 'qr-reader';

  const stopScanner = async () => {
    shouldStopRef.current = true;
    if (startTimeoutRef.current) {
      clearTimeout(startTimeoutRef.current);
    }
    if (isStartingRef.current) {
      console.log('Scanner is starting. Flagging for stop.');
      return;
    }
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const stopScannerAndVerify = async (decodedText) => {
    shouldStopRef.current = true;
    if (startTimeoutRef.current) {
      clearTimeout(startTimeoutRef.current);
    }
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
      } catch (err) {
        console.error('Error stopping scanner on success:', err);
      }
      scannerRef.current = null;
    }
    setScanning(false);
    verifyScannedToken(decodedText);
  };

  const scanCurrentFrame = async () => {
    try {
      setLoading(true);
      setError('');
      
      const video = document.querySelector(`#${scannerContainerId} video`);
      if (!video) {
        throw new Error('Video stream element not found. Make sure the camera is started.');
      }

      // Initialize the static/dedicated QR decoder instance on a hidden DOM element if not already present.
      // This is run independently of the live camera stream instance (scannerRef.current)
      // to cleanly bypass "Cannot start file scan - ongoing camera scan" lockouts!
      if (!qrDecoderRef.current) {
        let dummyContainer = document.getElementById('qr-decoder-dummy');
        if (!dummyContainer) {
          dummyContainer = document.createElement('div');
          dummyContainer.id = 'qr-decoder-dummy';
          dummyContainer.style.position = 'absolute';
          dummyContainer.style.width = '1px';
          dummyContainer.style.height = '1px';
          dummyContainer.style.opacity = '0';
          dummyContainer.style.pointerEvents = 'none';
          document.body.appendChild(dummyContainer);
        }
        qrDecoderRef.current = new Html5Qrcode('qr-decoder-dummy');
      }

      let maxAttempts = 5;
      let attempt = 0;
      let decodedText = null;

      // Promise helper to capture the video frame, crop to viewfinder box, apply robust filters, and decode
      const tryCaptureAndDecode = (attemptIndex) => {
        return new Promise((resolve, reject) => {
          if (!video) {
            reject(new Error('Video feed element not found.'));
            return;
          }

          const videoWidth = video.videoWidth || video.offsetWidth || 640;
          const videoHeight = video.videoHeight || video.offsetHeight || 480;
          
          const minEdge = Math.min(videoWidth, videoHeight);
          const qrboxSize = Math.floor(minEdge * 0.75); // 75% size to allow easier focus
          
          const sx = (videoWidth - qrboxSize) / 2;
          const sy = (videoHeight - qrboxSize) / 2;
          
          const canvas = document.createElement('canvas');
          
          // Crop to viewfinder center region for attempts 0, 1, 2 to remove background noise.
          // Fallback to full frame for attempts 3, 4 just in case.
          const useCrop = attemptIndex < 3;
          
          if (useCrop) {
            canvas.width = qrboxSize;
            canvas.height = qrboxSize;
          } else {
            canvas.width = videoWidth;
            canvas.height = videoHeight;
          }
          
          const ctx = canvas.getContext('2d');
          
          if (useCrop) {
            ctx.drawImage(video, sx, sy, qrboxSize, qrboxSize, 0, 0, qrboxSize, qrboxSize);
          } else {
            ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
          }
          
          // Apply pre-processing filters based on attempt index to handle glare, reflections, and contrast issues
          if (attemptIndex === 1) {
            // Attempt 2: Slight contrast enhancement
            ctx.filter = 'contrast(1.25)';
            ctx.drawImage(canvas, 0, 0);
          } else if (attemptIndex === 2) {
            // Attempt 3: Grayscale and contrast boost
            ctx.filter = 'grayscale(1) contrast(1.4)';
            ctx.drawImage(canvas, 0, 0);
          } else if (attemptIndex === 4) {
            // Attempt 5: Full frame grayscale
            ctx.filter = 'grayscale(1)';
            ctx.drawImage(canvas, 0, 0);
          }

          canvas.toBlob(async (blob) => {
            if (!blob) {
              reject(new Error('Failed to capture blob.'));
              return;
            }
            const file = new File([blob], 'frame.jpg', { type: 'image/jpeg' });
            try {
              if (!qrDecoderRef.current) {
                reject(new Error('Decoder instance is missing.'));
                return;
              }
              const text = await qrDecoderRef.current.scanFile(file, false);
              resolve(text);
            } catch (err) {
              reject(err);
            }
          }, 'image/jpeg', 0.95);
        });
      };

      // Run up to 5 attempts in a rapid 1-second burst to handle autofocus and motion blur
      const runBurstAttempts = async () => {
        while (attempt < maxAttempts) {
          attempt++;
          console.log(`Scan attempt ${attempt}/${maxAttempts} in progress...`);
          try {
            decodedText = await tryCaptureAndDecode(attempt - 1);
            if (decodedText) {
              console.log('Successfully decoded QR code in attempt:', attempt);
              break;
            }
          } catch (err) {
            console.log(`Attempt ${attempt} failed to decode:`, err.message || err);
            if (attempt < maxAttempts) {
              await new Promise(r => setTimeout(r, 180)); // 180ms delay between burst snapshots
            }
          }
        }

        if (decodedText) {
          // Success: Stop the live camera feed and verify the token
          await stopScanner();
          verifyScannedToken(decodedText);
        } else {
          // Failure feedback to user
          setError('Failed to scan QR code. Please hold it steady in front of the camera and try again.');
          setLoading(false);
        }
      };

      runBurstAttempts();

    } catch (err) {
      console.error('Frame capture error:', err);
      setError(err.message || 'Failed to capture and scan video frame.');
      setLoading(false);
    }
  };

  const startScanner = () => {
    setError('');
    setScanResult(null);
    setScanning(true);
    shouldStopRef.current = false;

    if (startTimeoutRef.current) {
      clearTimeout(startTimeoutRef.current);
    }

    startTimeoutRef.current = setTimeout(async () => {
      if (shouldStopRef.current) return;

      try {
        const container = document.getElementById(scannerContainerId);
        if (!container) {
          console.warn('Scanner container not found in DOM yet. Retrying...');
          return;
        }

        // Clean up any existing running scanner before starting a new one
        if (scannerRef.current) {
          try {
            if (scannerRef.current.isScanning) {
              await scannerRef.current.stop();
            }
          } catch (e) {
            console.warn('Error stopping previous scanner instance:', e);
          }
          scannerRef.current = null;
        }

        if (shouldStopRef.current) return;

        isStartingRef.current = true;

        const config = { 
          fps: 15, // Efficient scan frequency (15 scans/sec) prevents main thread lagging/freezing
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const qrboxSize = Math.floor(minEdge * 0.75); // 75% size to allow easier focus
            return { width: qrboxSize, height: qrboxSize };
          },
          aspectRatio: 1.0
        };

        const cameraConstraints = {
          facingMode: 'environment',
          frameRate: { ideal: 60 } // Request buttery smooth high-speed video capture
        };

        try {
          const html5QrCode = new Html5Qrcode(scannerContainerId);
          scannerRef.current = html5QrCode;

          try {
            await html5QrCode.start(
              cameraConstraints,
              config,
              (decodedText) => {
                stopScannerAndVerify(decodedText);
              },
              () => {}
            );
          } catch (envErr) {
            console.warn('Environment camera failed, trying user camera...', envErr);
            if (shouldStopRef.current) return;

            // Fresh instance for user fallback to cleanly avoid "Cannot transition to a new state" machine locks
            const fallbackQrCode = new Html5Qrcode(scannerContainerId);
            scannerRef.current = fallbackQrCode;

            await fallbackQrCode.start(
              { facingMode: 'user', frameRate: { ideal: 60 } },
              config,
              (decodedText) => {
                stopScannerAndVerify(decodedText);
              },
              () => {}
            );
          }

          if (shouldStopRef.current) {
            await stopScanner();
          }
        } finally {
          isStartingRef.current = false;
        }
      } catch (err) {
        console.error('All camera attempts failed:', err);
        
        let customMessage = 'Failed to start camera. Please verify permissions are granted and camera is available.';
        
        // Premium diagnostics to pinpoint camera access failures
        if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
          customMessage = '🔒 Security Block: Camera access is disabled on insecure HTTP connections. Please run on localhost or connect via HTTPS.';
        } else if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          customMessage = '🚫 Browser Block: Your browser or in-app view does not support camera capture streams.';
        } else if (err) {
          // Normalize string errors vs object errors case-insensitively
          const errMsg = typeof err === 'string' ? err : (err.message || '');
          const errName = typeof err === 'string' ? '' : (err.name || '');
          const combinedError = `${errName} ${errMsg}`.toLowerCase();
          
          if (combinedError.includes('allowed') || combinedError.includes('permission') || combinedError.includes('denied')) {
            customMessage = '🔑 Permission Denied: Camera access was blocked. Please check your browser address bar and grant camera permissions.';
          } else if (combinedError.includes('readable') || combinedError.includes('start') || combinedError.includes('use') || combinedError.includes('active') || combinedError.includes('locked')) {
            customMessage = '📷 Camera Lockout: The webcam is locked by another tab or program (e.g., Zoom, Teams). Close other video apps and retry.';
          } else if (combinedError.includes('notfound') || combinedError.includes('device') || combinedError.includes('missing')) {
            customMessage = '🔌 Webcam Missing: No video input hardware detected. Please connect a camera and try again.';
          } else if (combinedError.includes('constraint')) {
            customMessage = '⚙️ Configuration Error: High-speed video constraints are not supported by your camera hardware.';
          } else {
            customMessage = `⚠️ Hardware Error: ${typeof err === 'string' ? err : (errMsg || errName || 'Unknown camera stream exception occurred.')}`;
          }
        }
        
        setError(customMessage);
        setScanning(false);
        scannerRef.current = null;
      }
    }, 200); // 200ms debounce ensures StrictMode double mounts are fully resolved
  };

  // Automatically start scanner on mount, and cleanly stop on unmount
  useEffect(() => {
    startScanner();
    return () => {
      stopScanner();
    };
  }, []);

  const verifyScannedToken = async (qrTokenToVerify) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${apiUrl}/api/verify/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ qrToken: qrTokenToVerify }),
      });

      const data = await response.json();
      setLoading(false);

      if (data.success) {
        setScanResult(data);
      } else {
        setError(data.message || 'Verification failed. The scanned code might be forged or expired.');
      }
    } catch (err) {
      console.error('Verification scan request error:', err);
      setError('Network error. Failed to reach verification server.');
      setLoading(false);
    }
  };

  const handleOverrideAccess = async (userId, action) => {
    if (!userId) {
      setError('User ID is missing. Cannot override access.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${apiUrl}/api/verify/access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId, action }),
      });

      const data = await response.json();
      setLoading(false);

      if (data.success) {
        setScanResult(data);
      } else {
        setError(data.message || 'Failed to update access status.');
      }
    } catch (err) {
      console.error('Access override error:', err);
      setError('Network error. Failed to reach verification server.');
      setLoading(false);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualToken) return;
    verifyScannedToken(manualToken.trim());
  };

  // Copy utility removed (unused in view)

  return (
    <div className="w-full max-w-2xl space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-white">Club Entry Gate Scanner</h1>
        <p className="text-xs text-slate-400 mt-1">
          Scan age verification passes to check eligibility instantly and securely.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 items-start">
        {/* Left Hand Column: Scanning Feed */}
        <div className="glass-panel rounded-3xl p-6 border-slate-800/80 min-h-[300px] flex flex-col justify-between">
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">QR Code Reader</h2>
            
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-200 text-xs rounded-xl flex items-start gap-1.5 leading-normal">
                <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="relative rounded-2xl overflow-hidden bg-slate-950/40 border border-slate-800 flex flex-col items-center justify-center min-h-[220px]">
              {scanning ? (
                <div className="w-full relative p-2 flex flex-col items-center">
                  <div id={scannerContainerId} className="w-full overflow-hidden rounded-xl"></div>
                  {/* Scan line effect */}
                  <div className="absolute left-0 right-0 h-0.5 bg-indigo-500 shadow-md animate-bounce pointer-events-none"></div>
                  
                  {/* Action buttons */}
                  <div className="flex gap-2 w-full mt-3">
                    <button
                      type="button"
                      onClick={scanCurrentFrame}
                      disabled={loading}
                      className="flex-1 px-4.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-bold rounded-lg transition duration-200 flex items-center justify-center gap-1.5"
                    >
                      <Scan className="w-4 h-4" />
                      Scan & Verify QR
                    </button>
                    <button
                      type="button"
                      onClick={stopScanner}
                      disabled={loading}
                      className="px-4.5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg transition duration-200"
                    >
                      Stop Camera
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-8 flex flex-col items-center text-center space-y-4">
                  <Scan className="w-12 h-12 text-indigo-500" />
                  <p className="text-xs text-slate-400 max-w-[180px]">
                    Click below to open the camera scanner interface.
                  </p>
                  <button
                    type="button"
                    onClick={startScanner}
                    disabled={loading}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold rounded-lg text-white transition duration-200"
                  >
                    Open Gate Camera
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Manual Entry Fallback */}
          <form onSubmit={handleManualSubmit} className="mt-6 pt-4 border-t border-slate-800 space-y-2">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Or Enter Customer 8-Digit PIN / Access Code
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. 12345678 or JWT..."
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                disabled={loading}
                className="flex-1 px-3 py-2 text-xs rounded-lg glass-input text-white focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading || !manualToken}
                className="p-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:bg-slate-800 disabled:opacity-50 text-white rounded-lg transition"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>

        {/* Right Hand Column: Verification Results */}
        <div className="glass-panel rounded-3xl p-6 border-slate-800/80 min-h-[300px] flex flex-col justify-center">
          {loading ? (
            <div className="flex flex-col items-center py-10">
              <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
              <p className="text-xs text-indigo-400 mt-4 animate-pulse">Decrypting QR token signatures...</p>
            </div>
          ) : scanResult ? (
            <div className="space-y-6 text-center animate-fade-in">
              {/* STATUS INDICATORS */}
              {scanResult.verified ? (
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/25 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/10">
                    <CheckCircle className="w-10 h-10 text-emerald-500" />
                  </div>
                  <h3 className="text-2xl font-extrabold text-emerald-400 tracking-wide">ACCESS GRANTED</h3>
                  <p className="text-xs text-slate-400 mt-1">Age Verification Confirmed</p>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-[10px] font-extrabold rounded-full uppercase tracking-wider mt-2.5">
                    Event: {scanResult.eventTitle || 'General Admission'}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-red-500/10 border border-red-500/25 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-red-500/10">
                    <XCircle className="w-10 h-10 text-red-500" />
                  </div>
                  <h3 className="text-2xl font-extrabold text-red-500 tracking-wide">ACCESS DENIED</h3>
                  <p className="text-xs text-slate-400 mt-1">{scanResult.message}</p>
                </div>
              )}

              {/* User Bio Details Panel */}
              <div className="bg-slate-950/40 border border-slate-850 rounded-2xl p-4 text-left text-xs text-slate-300 space-y-3">
                {scanResult.user.selfieUrl && (
                  <div className="grid grid-cols-2 gap-3 mb-4 pb-4 border-b border-slate-900/60">
                    <div className="text-center space-y-1">
                      <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block">ID Card Photo</span>
                      <div className="relative">
                        <img
                          src={scanResult.user.idCardUrl.startsWith('http') ? scanResult.user.idCardUrl : `${apiUrl}${scanResult.user.idCardUrl}`}
                          alt="Government ID"
                          className="w-full h-24 object-contain rounded-xl border border-slate-800 bg-slate-950/60 p-0.5"
                        />
                      </div>
                    </div>
                    <div className="text-center space-y-1">
                      <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block">Webcam Selfie</span>
                      <div className="relative">
                        <img
                          src={scanResult.user.selfieUrl.startsWith('http') ? scanResult.user.selfieUrl : `${apiUrl}${scanResult.user.selfieUrl}`}
                          alt="Live Selfie"
                          className={`w-full h-24 object-cover rounded-xl border ${
                            scanResult.verified 
                              ? 'border-emerald-500/40' 
                              : 'border-rose-500/40'
                          }`}
                        />
                        <div className={`absolute -bottom-1.5 -right-1.5 text-white rounded-full p-0.5 border border-slate-950 ${
                          scanResult.verified ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}>
                          {scanResult.verified ? (
                            <Check className="w-2.5 h-2.5" />
                          ) : (
                            <X className="w-2.5 h-2.5" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center py-1 border-b border-slate-900">
                  <span className="text-slate-500 flex items-center gap-1">
                    <User className="w-3.5 h-3.5" /> Name:
                  </span>
                  <span className="text-white font-semibold">{scanResult.user.name || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-900">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> Date of Birth:
                  </span>
                  <span className="text-white font-mono">
                    {scanResult.user.dob ? new Date(scanResult.user.dob).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-900">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> Extracted Age:
                  </span>
                  <span className="text-white font-extrabold font-mono text-sm">
                    {scanResult.user.age ? `${scanResult.user.age} Years` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-900">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Smartphone className="w-3.5 h-3.5" /> Masked Phone:
                  </span>
                  <span className="text-white font-mono">{scanResult.user.phone}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Award className="w-3.5 h-3.5" /> Face Match Liveness:
                  </span>
                  <span className={`font-bold ${scanResult.user.faceMatchConfidence >= 40 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {scanResult.user.faceMatchConfidence}%
                  </span>
                </div>
              </div>
              
              {/* Manual Override Actions for gate staff */}
              <div className="grid grid-cols-2 gap-3 mt-4 mb-2">
                <button
                  onClick={() => handleOverrideAccess(scanResult.user?.id, 'grant')}
                  disabled={loading}
                  className="py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition duration-200 flex items-center justify-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  Grant Access
                </button>
                <button
                  onClick={() => handleOverrideAccess(scanResult.user?.id, 'revoke')}
                  disabled={loading}
                  className="py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition duration-200 flex items-center justify-center gap-1.5"
                >
                  <XCircle className="w-4 h-4" />
                  Revoke Access
                </button>
              </div>

              {/* Reset scan button */}
              <button
                onClick={() => { setScanResult(null); startScanner(); }}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition duration-200"
              >
                Scan Next Customer
              </button>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 space-y-3">
              <Scan className="w-12 h-12 mx-auto text-slate-700 animate-pulse" />
              <p className="text-xs">
                Awaiting scan payload. Scan a QR code or paste a token to verify the customer.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Scanner;
