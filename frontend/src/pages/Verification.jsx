import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as faceapi from '@vladmandic/face-api';
import { createWorker } from 'tesseract.js';
import confetti from 'canvas-confetti';
import { 
  ShieldCheck, Upload, Camera, FileText, CheckCircle2, 
  User, Calendar, AlertTriangle, RefreshCw, ChevronRight, X
} from 'lucide-react';

const Verification = () => {
  const { token, refreshUser, apiUrl } = useAuth();
  const navigate = useNavigate();

  // Verification steps: 1 = Upload ID, 2 = Capture Selfie, 3 = Review & Submit
  const [step, setStep] = useState(1);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('Initializing AI engines...');

  // Files & Images State
  const [idType, setIdType] = useState('aadhaar'); // 'aadhaar', 'pan', 'passport', 'license'
  const [idCardFile, setIdCardFile] = useState(null);
  const [idCardPreview, setIdCardPreview] = useState('');
  const [selfieFile, setSelfieFile] = useState(null);
  const [selfiePreview, setSelfiePreview] = useState('');
  const [isUnderage, setIsUnderage] = useState(false);

  const calculateAge = (dobString) => {
    if (!dobString) return 0;
    const today = new Date();
    const birthDate = new Date(dobString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const loadPdfJS = () => {
    return new Promise((resolve, reject) => {
      if (window.pdfjsLib) {
        resolve(window.pdfjsLib);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      };
      script.onerror = () => reject(new Error('Failed to load PDF.js engine.'));
      document.body.appendChild(script);
    });
  };

  const compressImage = (file, max_size = 800, quality = 0.3) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > max_size) {
              height *= max_size / width;
              width = max_size;
            }
          } else {
            if (height > max_size) {
              width *= max_size / height;
              height = max_size;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob((blob) => {
            const compressed = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: 'image/jpeg' });
            resolve({
              file: compressed,
              preview: canvas.toDataURL('image/jpeg', quality)
            });
          }, 'image/jpeg', quality);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  };


  const handleProceedToSelfie = () => {
    setError('');
    if (!dob) {
      setError('Please enter or confirm your date of birth before proceeding.');
      return;
    }
    if (!fullName.trim()) {
      setError('Please enter or confirm your full name before proceeding.');
      return;
    }
    const age = calculateAge(dob);
    if (age < 18) {
      setIsUnderage(true);
      return;
    }
    setStep(2);
  };

  // OCR & Face Match State
  const [ocrLoading, setOcrLoading] = useState(false);
  const [extractedName, setExtractedName] = useState('');
  const [extractedDob, setExtractedDob] = useState('');
  const [faceMatchConfidence, setFaceMatchConfidence] = useState(0);
  const [isFaceMatching, setIsFaceMatching] = useState(false);

  // Form State (Confirming Details)
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');

  // UI state
  const [webcamActive, setWebcamActive] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Load face-api models on mount
  useEffect(() => {
    const loadModels = async () => {
      try {
        setLoadingMsg('Loading Face Detection Models...');
        // Load tinyFaceDetector (faster for mobile) and faceLandmark/recognition
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
        setModelsLoaded(true);
      } catch (err) {
        console.error('Error loading face-api models:', err);
        setError('Failed to load face detection models. Ensure models are downloaded in /models directory.');
      }
    };
    loadModels();

    // Clean up webcam stream if active
    return () => {
      stopWebcam();
    };
  }, []);

  // Stop Webcam utility
  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setWebcamActive(false);
  };

  // OCR Parser logic
  const runOCR = async (file) => {
    setOcrLoading(true);
    setError('');
    try {
      const worker = await createWorker();
      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      const { data: { text } } = await worker.recognize(file);
      await worker.terminate();

      console.log('OCR Extracted Text:', text);

      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      let dobFound = '';
      let nameFound = '';

      // --- 1. DOB PARSING ---
      // Search lines for common birth labels
      for (const line of lines) {
        const cleanLine = line.toLowerCase();
        if (cleanLine.includes('dob') || cleanLine.includes('birth') || cleanLine.includes('d.o.b') || cleanLine.includes('date of')) {
          const match = line.match(/\b\d{2}[\/\-]\d{2}[\/\-]\d{4}\b/);
          if (match) {
            const parts = match[0].split(/[\/\-]/);
            if (parts[0].length === 4) {
              dobFound = match[0];
            } else {
              dobFound = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
            break;
          }
          const ymdMatch = line.match(/\b\d{4}[\/\-]\d{2}[\/\-]\d{2}\b/);
          if (ymdMatch) {
            dobFound = ymdMatch[0];
            break;
          }
        }
      }

      // General fallback check for any DD/MM/YYYY date pattern if not found near labels
      if (!dobFound) {
        const matches = text.match(/\b\d{2}[\/\-]\d{2}[\/\-]\d{4}\b/g);
        if (matches && matches.length > 0) {
          const parts = matches[0].split(/[\/\-]/);
          dobFound = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }

      // Year of Birth fallback for Aadhaar card
      if (!dobFound) {
        const yobRegex = /(?:Year of Birth|YOB|Birth|Year)\s*:\s*(\d{4})/i;
        const yobMatch = text.match(yobRegex);
        if (yobMatch && yobMatch[1]) {
          dobFound = `${yobMatch[1]}-01-01`;
        }
      }

      // --- 2. NAME PARSING BY DOCUMENT TYPE ---
      if (idType === 'aadhaar') {
        // Aadhaar: Name is typically right above the gender / YOB / DOB line
        for (let i = 0; i < lines.length; i++) {
          const cleanLine = lines[i].toLowerCase();
          if (cleanLine.includes('dob') || cleanLine.includes('birth') || cleanLine.includes('yob') || cleanLine.includes('male') || cleanLine.includes('female')) {
            if (i > 0) {
              let candidate = lines[i - 1].replace(/[^a-zA-Z\s]/g, '').trim();
              if (candidate.length > 3 && !candidate.toLowerCase().includes('government') && !candidate.toLowerCase().includes('unique')) {
                nameFound = candidate;
                break;
              }
            }
          }
        }
      } else if (idType === 'pan') {
        // PAN Card: Filter generic headers; name is the first clean alphabetical uppercase line
        const genericWords = ['income', 'tax', 'department', 'govt', 'india', 'permanent', 'account', 'number', 'card', 'father', 'signature'];
        for (const line of lines) {
          const cleanLine = line.toLowerCase();
          const isGeneric = genericWords.some(w => cleanLine.includes(w));
          if (!isGeneric && line.replace(/[^a-zA-Z]/g, '').length > 5) {
            if (/^[A-Z\s\.]+$/.test(line.trim())) {
              nameFound = line.trim();
              break;
            }
          }
        }
      } else if (idType === 'license') {
        // Driver's License: Look for line with "Name"
        for (let i = 0; i < lines.length; i++) {
          const cleanLine = lines[i].toLowerCase();
          if (cleanLine.includes('name') || cleanLine.includes('fn') || cleanLine.includes('ln')) {
            let match = lines[i].replace(/^(?:name|fn|ln|full name)\s*[\:\-\=]?\s*/i, '').replace(/[^a-zA-Z\s]/g, '').trim();
            if (match.length > 3) {
              nameFound = match;
              break;
            } else if (i < lines.length - 1) {
              let candidate = lines[i + 1].replace(/[^a-zA-Z\s]/g, '').trim();
              if (candidate.length > 3 && !candidate.toLowerCase().includes('licence') && !candidate.toLowerCase().includes('address')) {
                nameFound = candidate;
                break;
              }
            }
          }
        }
      } else if (idType === 'passport') {
        // Passport: Look for Given Name / Surname labels
        for (let i = 0; i < lines.length; i++) {
          const cleanLine = lines[i].toLowerCase();
          if (cleanLine.includes('given name') || cleanLine.includes('sur name') || cleanLine.includes('surname')) {
            let match = lines[i].replace(/^(?:given name|surname|sur name|name)\s*[\:\-\=]?\s*/i, '').replace(/[^a-zA-Z\s]/g, '').trim();
            if (match.length > 3) {
              nameFound = match;
              break;
            } else if (i < lines.length - 1) {
              let candidate = lines[i + 1].replace(/[^a-zA-Z\s]/g, '').trim();
              if (candidate.length > 3) {
                nameFound = candidate;
                break;
              }
            }
          }
        }
      }

      // Generic fallback parser if document-specific name extraction yielded nothing
      if (!nameFound) {
        for (const line of lines) {
          const cleanLine = line.toLowerCase();
          const genericWords = ['government', 'india', 'unique', 'tax', 'department', 'card', 'licence', 'license', 'passport', 'republic', 'birth'];
          const isGeneric = genericWords.some(w => cleanLine.includes(w));
          if (!isGeneric && line.replace(/[^a-zA-Z]/g, '').length > 6) {
            nameFound = line.replace(/[^a-zA-Z\s]/g, '').trim();
            break;
          }
        }
      }

      if (dobFound) {
        setExtractedDob(dobFound);
        setDob(dobFound);
      }
      if (nameFound) {
        setExtractedName(nameFound);
        setFullName(nameFound);
      }
    } catch (err) {
      console.error('OCR Processing Error:', err);
      setError('OCR extraction failed to read documents. You can still input details manually.');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleIdCardUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setOcrLoading(true);
    setError('');

    try {
      if (file.type === 'application/pdf') {
        setLoadingMsg('Parsing Aadhaar PDF...');
        const pdfjs = await loadPdfJS();
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const arrayBuffer = event.target.result;
            const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
            const page = await pdf.getPage(1);
            
            // Limit PDF rendering scale for low storage size, ensuring sharp text for OCR
            const max_size = 800;
            const unscaledViewport = page.getViewport({ scale: 1.0 });
            const calculatedScale = max_size / Math.max(unscaledViewport.width, unscaledViewport.height);
            const viewport = page.getViewport({ scale: Math.max(calculatedScale, 1.5) });
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            await page.render({ canvasContext: context, viewport: viewport }).promise;
            
            canvas.toBlob(async (blob) => {
              const compressedFile = new File([blob], 'aadhaar_id.jpg', { type: 'image/jpeg' });
              setIdCardFile(compressedFile);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.3); // 30% quality for minimum footprint
              setIdCardPreview(dataUrl);
              
              runOCR(compressedFile);
            }, 'image/jpeg', 0.3);
          } catch (err) {
            console.error('PDF page render error:', err);
            setError('Failed to extract image from PDF. Please make sure the PDF is not password-protected.');
            setOcrLoading(false);
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        setLoadingMsg('Compressing image for storage...');
        const compressedData = await compressImage(file, 800, 0.3); // 800px max, 30% quality
        setIdCardFile(compressedData.file);
        setIdCardPreview(compressedData.preview);
        
        runOCR(compressedData.file);
      }
    } catch (err) {
      console.error('File process error:', err);
      setError('Failed to process file.');
      setOcrLoading(false);
    }
  };

  // Turn on Webcam for step 2
  const startWebcam = async () => {
    setError('');
    setWebcamActive(true);
    try {
      const constraints = { video: { width: 640, height: 480, facingMode: 'user' } };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Webcam access error:', err);
      setError('Could not access your camera. Please ensure permissions are granted or upload a selfie file instead.');
      setWebcamActive(false);
    }
  };

  // Perform client-side face recognition between ID Card and Live Selfie
  const performFaceMatch = async (idCardImgSrc, selfieImgSrc) => {
    setIsFaceMatching(true);
    try {
      // 1. Create HTML Image elements for face-api
      const idImg = new Image();
      idImg.src = idCardImgSrc;
      await idImg.decode();

      const selfieImg = new Image();
      selfieImg.src = selfieImgSrc;
      await selfieImg.decode();

      // 2. Detect face and extract descriptor from ID Card
      const idResult = await faceapi
        .detectSingleFace(idImg, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      // 3. Detect face and extract descriptor from Selfie
      const selfieResult = await faceapi
        .detectSingleFace(selfieImg, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!idResult) {
        throw new Error('Could not detect any face in the uploaded ID card image. Make sure the face is clearly visible.');
      }

      if (!selfieResult) {
        throw new Error('Could not detect any face in your selfie. Keep your head straight and ensure good lighting.');
      }

      // 4. Compute Euclidean distance between descriptors
      const distance = faceapi.euclideanDistance(idResult.descriptor, selfieResult.descriptor);
      
      // Translate distance to confidence percentage:
      // Distance close to 0 means identical faces.
      // Threshold 0.6 represents standard matched face limit.
      const matchScore = Math.max(0, Math.min(100, Math.round((1 - distance) * 100)));
      setFaceMatchConfidence(matchScore);
      
      console.log(`Euclidean Distance: ${distance}, Computed Match Confidence: ${matchScore}%`);
      setStep(3); // Advance to confirmation review step
    } catch (err) {
      console.error('Face match failed:', err);
      setError(err.message || 'Face comparison failed. You can proceed, but manual admin verification will be required.');
      setFaceMatchConfidence(0);
      setStep(3); // Advance anyway to let them submit for manual review
    } finally {
      setIsFaceMatching(false);
    }
  };

  const captureSelfie = async () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    
    // Resize webcam selfie capture to max size 480px for minimal storage occupancy
    const max_selfie_size = 480;
    let width = video.videoWidth;
    let height = video.videoHeight;
    if (width > height) {
      if (width > max_selfie_size) {
        height *= max_selfie_size / width;
        width = max_selfie_size;
      }
    } else {
      if (height > max_selfie_size) {
        width *= max_selfie_size / height;
        height = max_selfie_size;
      }
    }
    
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, width, height);

    // Save image blob and URL preview with 30% compression quality for least storage occupancy
    canvas.toBlob(async (blob) => {
      const file = new File([blob], 'selfie.jpg', { type: 'image/jpeg' });
      setSelfieFile(file);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.3);
      setSelfiePreview(dataUrl);

      // Stop video feed
      stopWebcam();

      // Run Face Match
      performFaceMatch(idCardPreview, dataUrl);
    }, 'image/jpeg', 0.3);
  };

  // Fallback for upload of selfie in case camera doesn't work
  const handleSelfieUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoadingMsg('Compressing selfie for storage...');
    const compressedData = await compressImage(file, 480, 0.3); // 480px max, 30% quality
    setSelfieFile(compressedData.file);
    setSelfiePreview(compressedData.preview);
    performFaceMatch(idCardPreview, compressedData.preview);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullName || !dob) {
      setError('Please fill in your name and date of birth');
      return;
    }

    const age = calculateAge(dob);
    if (age < 18) {
      setError('Access Denied: You must be 18 years or older to register.');
      return;
    }

    setSubmitting(true);
    setError('');

    const formData = new FormData();
    formData.append('name', fullName);
    formData.append('dob', dob);
    formData.append('faceMatchConfidence', faceMatchConfidence);
    formData.append('idCard', idCardFile);
    formData.append('selfie', selfieFile);

    try {
      const response = await fetch(`${apiUrl}/api/verify/submit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();
      setSubmitting(false);

      if (data.success) {
        if (data.status === 'verified') {
          // Play confetti for success!
          confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 }
          });
        }
        await refreshUser();
        navigate('/');
      } else {
        setError(data.message || 'Submission failed');
      }
    } catch (err) {
      console.error('Submit error:', err);
      setError('Network error. Failed to submit verification data.');
      setSubmitting(false);
    }
  };

  if (!modelsLoaded) {
    return (
      <div className="w-full max-w-md glass-panel rounded-3xl p-8 flex flex-col items-center justify-center min-h-[300px]">
        <div className="relative w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-300 font-medium">{loadingMsg}</p>
        {error && (
          <p className="text-xs text-red-400 mt-4 border border-red-500/10 p-2.5 rounded bg-red-500/5 text-center">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (isUnderage) {
    return (
      <div className="w-full max-w-md glass-panel rounded-3xl p-8 flex flex-col items-center justify-center text-center space-y-6 border-red-500/30">
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-center animate-bounce">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-black text-red-400 tracking-wide">ACCESS RESTRICTED</h2>
        
        {/* Curvy Slang Section */}
        <div className="p-5 bg-black/40 border border-amber-500/20 rounded-2xl">
          <p className="font-cursive text-3xl text-gradient leading-relaxed">
            Yo, kids don't go to clubs! 🚷
          </p>
          <p className="font-cursive text-2xl text-gradient mt-3 leading-relaxed">
            Try after u become older...
          </p>
          <p className="font-cursive text-xl text-amber-500 mt-4 font-bold">
            Go home & grab some juice! 🧃✨
          </p>
        </div>

        <p className="text-[10px] text-slate-500 leading-normal max-w-xs">
          AgeVault has detected that your birth details classify you as underage. Gate entry is prohibited.
        </p>
        
        <button
          onClick={() => {
            setIsUnderage(false);
            setIdCardFile(null);
            setIdCardPreview('');
            setDob('');
            setFullName('');
            setStep(1);
          }}
          className="w-full py-2.5 rounded-xl border border-slate-700 hover:border-slate-500 text-xs font-semibold text-slate-300 hover:text-white transition"
        >
          Reset and Try Another ID
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl">
      {/* Steps Indicator Progress */}
      <div className="flex items-center justify-center gap-2 mb-8 max-w-md mx-auto">
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition duration-300 ${step === 1 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' : 'bg-slate-800 text-slate-400'}`}>
          <FileText className="w-4 h-4" />
          ID Upload
        </div>
        <ChevronRight className="w-4 h-4 text-slate-600" />
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition duration-300 ${step === 2 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' : 'bg-slate-800 text-slate-400'}`}>
          <Camera className="w-4 h-4" />
          Live Selfie
        </div>
        <ChevronRight className="w-4 h-4 text-slate-600" />
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition duration-300 ${step === 3 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' : 'bg-slate-800 text-slate-400'}`}>
          <ShieldCheck className="w-4 h-4" />
          Confirm & Save
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-200 text-xs rounded-xl flex items-start justify-between gap-2">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {isFaceMatching && (
        <div className="fixed inset-0 bg-dark-900/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
          <div className="relative w-20 h-20 mb-6 flex items-center justify-center">
            <div className="absolute inset-0 border-4 border-t-indigo-500 border-r-indigo-500 border-l-transparent border-b-transparent rounded-full animate-spin"></div>
            <ShieldCheck className="w-10 h-10 text-indigo-400 animate-pulse" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Analyzing Face Similarity</h3>
          <p className="text-sm text-indigo-300 animate-pulse text-center">
            Comparing ID card face descriptor to live selfie...
          </p>
        </div>
      )}

      <div className="glass-panel rounded-3xl p-6 md:p-8">
        
        {/* STEP 1: Upload ID Card */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center md:text-left">
              <h2 className="text-2xl font-bold text-white">Select and Upload Government ID</h2>
              <p className="text-sm text-slate-400 mt-1">
                Please select your ID type and upload a clear, high-resolution front-facing image or PDF document.
              </p>
              <div className="inline-flex items-center gap-1.5 mt-2.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-[10px] font-extrabold rounded-full uppercase tracking-wider">
                Google ML Kit OCR Engine Active
              </div>
            </div>

            {/* ID Type Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Identity Document Type
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                  type="button"
                  onClick={() => { setIdType('aadhaar'); setIdCardFile(null); setIdCardPreview(''); }}
                  className={`py-3 rounded-xl border text-xs font-bold transition duration-300 ${
                    idType === 'aadhaar'
                      ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400 shadow-lg shadow-indigo-500/5'
                      : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  Aadhaar Card
                </button>
                <button
                  type="button"
                  onClick={() => { setIdType('pan'); setIdCardFile(null); setIdCardPreview(''); }}
                  className={`py-3 rounded-xl border text-xs font-bold transition duration-300 ${
                    idType === 'pan'
                      ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400 shadow-lg shadow-indigo-500/5'
                      : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  PAN Card
                </button>
                <button
                  type="button"
                  onClick={() => { setIdType('passport'); setIdCardFile(null); setIdCardPreview(''); }}
                  className={`py-3 rounded-xl border text-xs font-bold transition duration-300 ${
                    idType === 'passport'
                      ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400 shadow-lg shadow-indigo-500/5'
                      : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  Passport
                </button>
                <button
                  type="button"
                  onClick={() => { setIdType('license'); setIdCardFile(null); setIdCardPreview(''); }}
                  className={`py-3 rounded-xl border text-xs font-bold transition duration-300 ${
                    idType === 'license'
                      ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400 shadow-lg shadow-indigo-500/5'
                      : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  Driver's License
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 items-center">
              <div>
                {!idCardPreview ? (
                  <label className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer bg-slate-900/30 transition-all duration-300 min-h-[220px]">
                    <Upload className="w-10 h-10 text-indigo-500 mb-3 animate-bounce" />
                    <span className="text-sm font-semibold text-slate-300">Upload {idType.toUpperCase()} (Image or PDF)</span>
                    <span className="text-xs text-slate-500 mt-1">PNG, JPG, JPEG or PDF up to 10MB</span>
                    <input 
                      type="file" 
                      accept="image/*,application/pdf" 
                      onChange={handleIdCardUpload} 
                      className="hidden" 
                    />
                  </label>
                ) : (
                  <div className="relative group rounded-2xl overflow-hidden border border-slate-800 bg-slate-950/40">
                    <img 
                      src={idCardPreview} 
                      alt="ID Card Preview" 
                      className="w-full h-auto object-contain max-h-[220px] mx-auto p-2"
                    />
                    <button 
                      onClick={() => { setIdCardFile(null); setIdCardPreview(''); }}
                      className="absolute top-2 right-2 p-1.5 bg-dark-900/80 hover:bg-red-500 text-slate-300 hover:text-white rounded-lg transition duration-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="bg-slate-900/40 rounded-2xl p-5 border border-slate-800">
                  <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-3 text-left">
                    OCR Text Recognition & Details
                  </h3>
                  
                  {ocrLoading ? (
                    <div className="flex items-center gap-3 text-slate-300">
                      <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                      <span className="text-xs font-medium">Extracting details from document...</span>
                    </div>
                  ) : idCardFile ? (
                    <div className="space-y-4 text-left">
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs py-1.5 border-b border-slate-800/40">
                          <span className="text-slate-400">Extracted DOB:</span>
                          <span className="text-white font-semibold font-mono">{extractedDob ? extractedDob : 'Not found'}</span>
                        </div>
                        <div className="flex justify-between text-xs py-1.5 border-b border-slate-800/40">
                          <span className="text-slate-400">Extracted Name:</span>
                          <span className="text-white font-semibold">{extractedName ? extractedName : 'Not found'}</span>
                        </div>
                      </div>

                      {/* Manual Confirmation Inputs in Step 1 */}
                      <div className="space-y-3.5 pt-3.5 border-t border-slate-800/40">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                            Verify/Enter Date of Birth
                          </label>
                          <input
                            type="date"
                            required
                            value={dob}
                            onChange={(e) => {
                              setDob(e.target.value);
                              setError('');
                            }}
                            className="w-full px-3.5 py-2.5 rounded-xl glass-input text-white text-xs focus:outline-none font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                            Verify/Enter Full Name
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="As printed on ID card"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl glass-input text-white text-xs focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic text-left">
                      Upload an ID card to begin automatic text extraction.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={!idCardFile || ocrLoading || !dob || !fullName}
                onClick={handleProceedToSelfie}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition duration-300 shadow-md shadow-indigo-600/10 flex items-center gap-1.5"
              >
                Proceed to Selfie capture
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Live Selfie Capture */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center md:text-left">
              <h2 className="text-2xl font-bold text-white">Live Selfie Verification</h2>
              <p className="text-sm text-slate-400 mt-1">
                We'll run real-time face matching to compare your live selfie face against your uploaded ID card.
              </p>
              <div className="inline-flex items-center gap-1.5 mt-2.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-[10px] font-extrabold rounded-full uppercase tracking-wider">
                Google MediaPipe & TFJS Face Matcher Active
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 items-center">
              {/* Webcam stream */}
              <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 flex flex-col items-center justify-center min-h-[260px]">
                {webcamActive ? (
                  <div className="relative w-full h-full">
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      muted 
                      className="w-full h-[260px] object-cover"
                    />
                    <div className="absolute inset-0 border border-indigo-500/30 pointer-events-none rounded-2xl flex items-center justify-center">
                      {/* Interactive scanning frame */}
                      <div className="w-48 h-48 border-2 border-indigo-400/50 rounded-full animate-pulse relative">
                        <div className="absolute inset-0 rounded-full border border-indigo-500/20 animate-ping"></div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 flex flex-col items-center text-center space-y-4">
                    <Camera className="w-12 h-12 text-indigo-500 animate-pulse" />
                    <button
                      onClick={startWebcam}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold rounded-lg text-white transition duration-200"
                    >
                      Start Front Camera
                    </button>
                  </div>
                )}
              </div>

              {/* Upload fallback and guidelines */}
              <div className="space-y-4">
                <div className="bg-slate-900/40 rounded-2xl p-5 border border-slate-800">
                  <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-3">
                    Photo Guidelines
                  </h3>
                  <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside">
                    <li>Ensure good lighting on your face.</li>
                    <li>Keep a neutral facial expression.</li>
                    <li>Remove glasses, hats, or masks.</li>
                    <li>Align your face in the camera circle.</li>
                  </ul>
                </div>

                <div className="bg-slate-900/20 border border-slate-800 rounded-2xl p-4 flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Camera not working?
                  </label>
                  <label className="border border-slate-700 hover:border-slate-500 rounded-xl p-2.5 text-center text-xs font-medium cursor-pointer text-slate-300 hover:text-white transition duration-200">
                    Upload Selfie File Instead
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleSelfieUpload} 
                      className="hidden" 
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => { stopWebcam(); setStep(1); }}
                className="px-5 py-3 border border-slate-700 hover:border-slate-500 text-xs font-semibold text-slate-300 hover:text-white rounded-xl transition duration-200"
              >
                Back to ID Card
              </button>

              {webcamActive && (
                <button
                  onClick={captureSelfie}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold rounded-xl text-white transition duration-300 flex items-center gap-1.5 shadow-md shadow-emerald-600/10"
                >
                  <Camera className="w-4 h-4" />
                  Capture Photo & Match
                </button>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: Confirm Details & Submit */}
        {step === 3 && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Review Extracted Details</h2>
              <p className="text-sm text-slate-400 mt-1">
                Please verify that the details match your government identity document.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Photo comparisons and face matching confidence */}
              <div className="space-y-4">
                <div className="bg-slate-900/40 rounded-2xl p-4 border border-slate-800 flex justify-around items-center">
                  <div className="text-center">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1.5">ID Card</p>
                    <img 
                      src={idCardPreview} 
                      alt="ID crop" 
                      className="w-20 h-20 object-cover rounded-xl border border-slate-800"
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1.5">Selfie</p>
                    <img 
                      src={selfiePreview} 
                      alt="Selfie crop" 
                      className="w-20 h-20 object-cover rounded-xl border border-slate-800"
                    />
                  </div>
                </div>

                <div className="bg-slate-900/40 rounded-2xl p-5 border border-slate-800 text-center">
                  <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold block mb-1">
                    AI Face-Match Score
                  </span>
                  <div className={`text-4xl font-extrabold tracking-tight ${faceMatchConfidence >= 30 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {faceMatchConfidence}%
                  </div>
                  <div className="mt-2.5 flex items-center justify-center gap-1">
                    <span className={`w-2.5 h-2.5 rounded-full ${faceMatchConfidence >= 30 ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {faceMatchConfidence >= 30 
                        ? 'Confidence Match (Eligible for Auto-Verification)' 
                        : 'Face mismatch or low resolution. Pending manual admin approval.'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Confirmation fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Full Name (As in ID Card)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="Enter full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      disabled={submitting}
                      className="w-full pl-10 pr-4 py-3 rounded-xl glass-input text-white text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Date of Birth (DOB)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <input
                      type="date"
                      required
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      disabled={submitting}
                      className="w-full pl-10 pr-4 py-3 rounded-xl glass-input text-white text-sm font-mono"
                    />
                  </div>
                </div>

                {faceMatchConfidence < 30 && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-200 text-[10px] rounded-xl flex items-start gap-2 leading-relaxed">
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <span>
                      Since the match score is below 30%, your request will be queued in the **Pending Admin Review Queue**. Club admins can manually override and verify you shortly.
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={submitting}
                className="px-5 py-3 border border-slate-700 hover:border-slate-500 text-xs font-semibold text-slate-300 hover:text-white rounded-xl transition duration-200"
              >
                Back to Selfie Capture
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition duration-300 flex items-center gap-1.5 shadow-md shadow-indigo-600/15"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Submitting verification...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    Submit Verification Request
                  </>
                )}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};

export default Verification;
