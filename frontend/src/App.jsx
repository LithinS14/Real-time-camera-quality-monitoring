"use client"

import { useState, useEffect, useRef } from "react"
import "./App.css" // Import the new comprehensive CSS file

function App() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [isPoor, setIsPoor] = useState(false)
  const [scores, setScores] = useState({ cpbd: 0, wavelet: 0, laplacian: 0 })
  const [cameraError, setCameraError] = useState(null)
  const [backendStatus, setBackendStatus] = useState("Connecting...")
  const [isBeepPlaying, setIsBeepPlaying] = useState(false)

  // Function to play a simple beep sound
  function playBeep() {
    if (isBeepPlaying) {
      return
    }
    setIsBeepPlaying(true)

    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.type = "sine"
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime)
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)

      oscillator.start()
      oscillator.stop(audioContext.currentTime + 0.1)

      oscillator.onended = () => {
        setIsBeepPlaying(false)
        audioContext.close()
      }
    } catch (error) {
      console.error("Error playing beep sound:", error)
      setIsBeepPlaying(false)
    }
  }

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }
      } catch (err) {
        console.error("Error accessing camera:", err)
        setCameraError("Failed to access camera. Please ensure it is connected and permissions are granted.")
      }
    }

    startCamera()

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject
        const tracks = stream.getTracks()
        tracks.forEach((track) => track.stop())
      }
    }
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      if (videoRef.current && videoRef.current.readyState === 4) {
        const video = videoRef.current
        const canvas = canvasRef.current
        if (canvas) {
          const context = canvas.getContext("2d")
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          context.drawImage(video, 0, 0, canvas.width, canvas.height)

          const imageData = canvas.toDataURL("image/jpeg", 0.7)

          fetch("http://localhost:3001/detect-blur", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ imageData }),
          })
            .then((response) => {
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
              }
              setBackendStatus("Connected")
              return response.json()
            })
            .then((data) => {
              setIsPoor(data.isPoor)
              setScores({
                cpbd: data.cpbd_score || 0,
                wavelet: data.wavelet_score || 0,
                laplacian: data.laplacian_score || 0,
              })
            })
            .catch((error) => {
              console.error("Error fetching blur data:", error)
              setBackendStatus("Disconnected")
              setScores({ cpbd: 0, wavelet: 0, laplacian: 0 })
            })
        }
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (isPoor) {
      playBeep()
    }
  }, [isPoor])

  return (
    <div className="app-wrapper">
      <div className="main-content-card">
        <header className="header-section">
          <h1 className="app-title">Camera Quality Monitor</h1>
          <p className="app-subtitle">Real-time blur detection for optimal clarity.</p>
        </header>

        {cameraError && <div className="error-message-banner">{cameraError}</div>}

        <div className="status-section">
          <span className="status-label">Backend Status:</span>
          <span
            className={`status-indicator ${backendStatus === "Connected" ? "status-connected" : "status-disconnected"}`}
          >
            {backendStatus}
          </span>
        </div>

        <div className="camera-section">
          <video ref={videoRef} autoPlay playsInline muted className="video-feed"></video>
          {isPoor && (
            <div className="warning-overlay">
              <span className="warning-icon">⚠</span>
              <span className="warning-text"> BLUR DETECTED!</span>
              <span className="warning-subtext">Adjust camera for clarity.</span>
            </div>
          )}
        </div>
        <canvas ref={canvasRef} style={{ display: "none" }}></canvas>

        <div className="scores-section">
          <div className="score-item">
            <h3 className="score-title">CPBD</h3>
            <p className={`score-value ${scores.cpbd < 20 ? "score-bad" : "score-good"}`}>{scores.cpbd.toFixed(2)}</p>
          </div>

          <div className="score-item">
            <h3 className="score-title">Wavelet</h3>
            <p className={`score-value ${scores.wavelet < 4.5 ? "score-bad" : "score-good"}`}>
              {scores.wavelet.toFixed(2)}
            </p>
          </div>

          <div className="score-item">
            <h3 className="score-title">Laplacian</h3>
            <p className={`score-value ${scores.laplacian < 100 ? "score-bad" : "score-good"}`}>
              {scores.laplacian.toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
