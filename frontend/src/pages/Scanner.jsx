import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { 
  Scan, CheckCircle, XCircle, ShieldAlert, ArrowRight, 
  Smartphone, User, Calendar, Award, Copy, Check, X 
} from 'lucide-react';

const Scanner = () => {
  const { token, apiUrl } = useAuth();
  const [scanResult, setScanResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const scannerRef = useRef(null);
  const scannerContainerId = 'qr-reader';

  useEffect(() => {
    // Clear scanner if component unmounts
    return () => {
      stopScanner();
    };
  }, []);

  const stopScanner = () => {
    if (scannerRef.current) {
      try {
        scannerRef.current.clear();
        scannerRef.current = null;
      } catch (err) {
        console.error('Error clearing QR scanner:', err);
      }
    }
    setScanning(false);
  };

  const startScanner = () => {
    setError('');
    setScanResult(null);
    setScanning(true);

    // Wait a brief tick for the container DOM to render
    setTimeout(() => {
      try {
        const scanner = new Html5QrcodeScanner(
          scannerContainerId,
          { 
            fps: 10, 
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0 
          },
          /* verbose= */ false
        );

        scanner.render(
          (decodedText) => {
            // On successful scan
            scanner.clear();
            scannerRef.current = null;
            setScanning(false);
            verifyScannedToken(decodedText);
          },
          (errorMessage) => {
            // Verbose logging of frame scan failures can be ignored
          }
        );

        scannerRef.current = scanner;
      } catch (err) {
        console.error('Failed to initialize QR scanner:', err);
        setError('Failed to start camera scanner. Use the manual entry code box below.');
        setScanning(false);
      }
    }, 100);
  };

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

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualToken) return;
    verifyScannedToken(manualToken.trim());
  };

  const handleCopyToken = () => {
    navigator.clipboard.writeText(user.qrToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
                <div className="w-full relative">
                  <div id={scannerContainerId} className="w-full overflow-hidden"></div>
                  {/* Scan line effect */}
                  <div className="absolute left-0 right-0 h-0.5 bg-indigo-500 shadow-md animate-bounce pointer-events-none"></div>
                </div>
              ) : (
                <div className="p-8 flex flex-col items-center text-center space-y-4">
                  <Scan className="w-12 h-12 text-indigo-500" />
                  <p className="text-xs text-slate-400 max-w-[180px]">
                    Click below to open the camera scanner interface.
                  </p>
                  <button
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
          <form onSubmit={handleManualSubmit} className="mt-6 pt-4 border-t border-slate-850 space-y-2">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Or Paste Scanned Code String (Demo/Test)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Paste signed JWT token string..."
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                disabled={loading}
                className="flex-1 px-3 py-2 text-xs rounded-lg glass-input text-white focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading || !manualToken}
                className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:opacity-50 text-white rounded-lg transition"
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
                          src={scanResult.user.idCardUrl}
                          alt="Government ID"
                          className="w-full h-24 object-contain rounded-xl border border-slate-800 bg-slate-950/60 p-0.5"
                        />
                      </div>
                    </div>
                    <div className="text-center space-y-1">
                      <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block">Webcam Selfie</span>
                      <div className="relative">
                        <img
                          src={scanResult.user.selfieUrl}
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

              {/* Reset scan button */}
              <button
                onClick={() => setScanResult(null)}
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
