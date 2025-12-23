import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { QRCodeSVG } from 'qrcode.react';
import { createClient } from '@supabase/supabase-js';
import './App.css';   // ✅ CSS 파일 불러오기


const supabase = createClient(
  'https://otqdndicdtqbsfpjrxst.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90cWRuZGljZHRxYnNmcGpyeHN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMzQ4MzUsImV4cCI6MjA3ODgxMDgzNX0.J66xcdL_wb3GORONh8PtzU-8gtwG0THBVBYhP06uw8Y'
);

function App() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [photos, setPhotos] = useState([]);
  const [photoCount, setPhotoCount] = useState(0);
  const [selected, setSelected] = useState([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [qrUrl, setQrUrl] = useState(null);
  const [step, setStep] = useState('idle');
  const [isUploading, setIsUploading] = useState(false);
  const [flash, setFlash] = useState(false);
  const [showQrOnly, setShowQrOnly] = useState(false);

  const FRAME_WIDTH = 603;
  const FRAME_HEIGHT = 1800;
  const PHOTO_WIDTH = 508;
  const PHOTO_HEIGHT = 409;

  const positions = [
    { x: 48, y: 99 },
    { x: 48, y: 514 },
    { x: 48, y: 929 },
    { x: 48, y: 1344 },
  ];

  const doShutterFlash = () => {
    setFlash(true);
    setTimeout(() => setFlash(false), 150);
  };

  const startCapture = () => {
    if (isCapturing) return;
    setPhotos([]);
    setSelected([]);
    setPhotoCount(0);
    setIsCapturing(true);
    setStep('preparing');

    let prep = 3;
    setCountdown(prep);
    const prepTimer = setInterval(() => {
      prep -= 1;
      setCountdown(prep);
      if (prep === 0) {
        clearInterval(prepTimer);
        setStep('capturing');

        let count = 0;
        let countdownValue = 5;
        setCountdown(countdownValue);

        const interval = setInterval(() => {
          countdownValue -= 1;
          setCountdown(countdownValue);

          if (countdownValue === 0) {
            if (webcamRef.current && webcamRef.current.getScreenshot) {
              const imageSrc = webcamRef.current.getScreenshot();
              if (imageSrc) {
                setPhotos(prev => [...prev, imageSrc]);
                setPhotoCount(prev => prev + 1);
                doShutterFlash();
              }
            }

            count++;
            if (count === 8) {
              clearInterval(interval);
              setIsCapturing(false);
              setCountdown(null);
              setStep('selecting');
            } else {
              countdownValue = 5;
              setCountdown(countdownValue);
            }
          }
        }, 1000);
      }
    }, 1000);
  };

  const toggleSelect = (photo) => {
    if (selected.includes(photo)) {
      setSelected(selected.filter(p => p !== photo));
    } else {
      if (selected.length < 4) {
        setSelected([...selected, photo]);
      }
    }
  };

  useEffect(() => {
    if (step !== 'selecting') return;
    const handleKey = (e) => {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= photos.length) {
        const photo = photos[n - 1];
        setSelected(prev => {
          if (prev.includes(photo)) return prev.filter(p => p !== photo);
          if (prev.length >= 4) return prev;
          return [...prev, photo];
        });
      }
      if (e.key === 'Enter' && selected.length > 0) {
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [step, photos, selected]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const frameImg = new Image();
    frameImg.src = '/frame.png';
    frameImg.onload = () => {
      canvas.width = FRAME_WIDTH;
      canvas.height = FRAME_HEIGHT;
      ctx.drawImage(frameImg, 0, 0);

      selected.forEach((photo, index) => {
        if (index >= positions.length) return;
        const img = new Image();
        img.src = photo;
        img.onload = () => {
          const { x, y } = positions[index];
          ctx.drawImage(img, x, y, PHOTO_WIDTH, PHOTO_HEIGHT);
        };
      });
    };
  };

  useEffect(() => {
    if (canvasRef.current && frameLoaded && photos.length === 8) {
      drawCanvas();
    }
  }, [photos, selected, frameLoaded]);
  useEffect(() => {
  if (step !== 'idle') return;
  const handleKey = (e) => {
    if (e.key === 'Enter') {
      startCapture();
    }
  };
  window.addEventListener('keydown', handleKey);
  return () => window.removeEventListener('keydown', handleKey);
  }, [step]);
  useEffect(() => {
  if (step !== 'qr') return;
  const handleKey = (e) => {
    if (e.key === 'Enter') {
      goHome();
    }
  };
  window.addEventListener('keydown', handleKey);
  return () => window.removeEventListener('keydown', handleKey);
  }, [step]);
  useEffect(() => {
    const preload = new Image();
    preload.src = '/frame.png';
    preload.onload = () => setFrameLoaded(true);
  }, []);

    const uploadImageToSupabase = async (base64) => {
    const fileName = `photo-${Date.now()}.png`;
    const base64Data = base64.split(',')[1];
    const blob = new Blob([Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))], {
      type: 'image/png'
    });

    const { error } = await supabase.storage
      .from('photos')
      .upload(fileName, blob, {
        contentType: 'image/png',
        upsert: true
      });

    if (error) {
      console.error('Upload error:', error);
      return null;
    }

    const { data: files } = await supabase.storage.from('photos').list();
    const validFiles = files.filter(f => f.name !== '.emptyFolderPlaceholder');

    if (validFiles.length > 10) {
      const oldest = validFiles.sort((a, b) => a.name.localeCompare(b.name))[0];
      await supabase.storage.from('photos').remove([oldest.name]);
      console.log(`Deleted oldest file: ${oldest.name}`);
    }

    const { data: urlData } = supabase.storage
      .from('photos')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  };

  const handleSave = async () => {
    if (isUploading) return;
    setIsUploading(true);
    const canvas = canvasRef.current;
    const base64 = canvas.toDataURL('image/png');
    const url = await uploadImageToSupabase(base64);
    setQrUrl(url);
    setShowQrOnly(true);
    setStep('qr');
    setIsUploading(false);
  };

  const goHome = () => {
    setShowQrOnly(false);
    setQrUrl(null);
    setPhotos([]);
    setSelected([]);
    setStep('idle');
  };

  return (
    <div className="app-container">
      {step === 'idle' && (
        <div className="idle-screen">
          <h1>📸 외고네컷</h1>
          <button onClick={startCapture} className="btn-primary">
            사진 찍기(Enter)
          </button>
          <h2>사진은 서버에 저장되지 않습니다.</h2>
        </div>
      )}

      {(step === 'capturing' || step === 'preparing') && (
        <div className="capture-screen">
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            width={640}
            height={480}
            videoConstraints={{ facingMode: "user" }}
            mirrored={true}
          />
          {flash && <div className="flash-overlay" />}
          <h2 className="countdown-text">
            {step === 'preparing'
              ? `잠시 후 촬영이 시작됩니다 (${countdown})`
              : `다음 사진까지 ${countdown}초`}
          </h2>
          <p className="countdown-text">
            {photoCount}/8 장 촬영 중
          </p>
        </div>
      )}

      {step === 'selecting' && (
        <div className="select-screen">
          <div className="preview-frame">
            <h2>프레임 미리보기</h2>
            <canvas ref={canvasRef} className="preview-canvas" />
            <button
              onClick={handleSave}
              disabled={selected.length === 0 || isUploading}
              className="btn-primary"
            >
              {isUploading ? "저장 중..." : "이미지 저장하기 (Enter)"}
            </button>
          </div>

          <div className="photo-grid">
            <p className="hint-text">숫자키(1–8)로 선택, 최대 4장. 다시 누르면 해제.</p>
            <div className="photo-list">
              {photos.map((photo, index) => {
                const isSelected = selected.includes(photo);
                const order = selected.indexOf(photo) + 1;
                return (
                  <div key={index} className={`photo-item ${isSelected ? 'selected' : ''}`}>
                    <img
                      src={photo}
                      alt={`photo-${index}`}
                      onClick={() => toggleSelect(photo)}
                    />
                    <div className={`photo-number ${isSelected ? 'selected' : ''}`}>
                      {index + 1}
                    </div>
                    {isSelected && (
                      <div className="photo-order">{order}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {step === 'qr' && showQrOnly && (
        <div className="qr-section">
          <h2>📱 스마트폰으로 사진 받기</h2>
          {qrUrl && <QRCodeSVG value={qrUrl} size={360} />}
          <p className="qr-hint">QR 코드를 스캔해서 사진을 저장하세요</p>
          <button onClick={goHome} className="btn-primary home-btn">
            🏠 홈으로 돌아가기(Enter)
          </button>
        </div>
      )}
    </div>
  );
}

export default App;