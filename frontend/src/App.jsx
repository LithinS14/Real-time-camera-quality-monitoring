"use client"

import { useState, useEffect, useRef } from "react"
import "./App.css" // Import the CSS file

function App() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [isPoor, setIsPoor] = useState(false)
  const [scores, setScores] = useState({ cpbd: 0, wavelet: 0, lbp: 0 })
  const [cameraError, setCameraError] = useState(null)
  const [backendStatus, setBackendStatus] = useState("Connecting to backend...")
  const [isBeepPlaying, setIsBeepPlaying] = useState(false) // Add this line

  // Function to play a simple beep sound
  function playBeep() {
    // Add this check:
    if (isBeepPlaying) {
      return // Don't play if already playing
    }
    setIsBeepPlaying(true) // Set flag to true when starting to play

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
      oscillator.stop(audioContext.currentTime + 0.1) // Play for 0.1 seconds

      // Add an event listener to reset the flag when the sound finishes
      oscillator.onended = () => {
        setIsBeepPlaying(false)
        audioContext.close() // Close context to free up resources
      }
    } catch (error) {
      console.error("Error playing beep sound:", error)
      setIsBeepPlaying(false) // Reset flag on error too
    }
  }

  useEffect(() => {
    // Request camera access
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

    // Cleanup function to stop camera when component unmounts
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject
        const tracks = stream.getTracks()
        tracks.forEach((track) => track.stop())
      }
    }
  }, [])

  useEffect(() => {
    // Periodically capture frames and send for analysis
    const interval = setInterval(() => {
      if (videoRef.current && videoRef.current.readyState === 4) {
        const video = videoRef.current
        const canvas = canvasRef.current
        if (canvas) {
          const context = canvas.getContext("2d")
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          context.drawImage(video, 0, 0, canvas.width, canvas.height)

          // Get image data as base64
          const imageData = canvas.toDataURL("image/jpeg", 0.7) // Adjust quality as needed

          // Send to backend API
          fetch("http://localhost:3001/detect-blur", {
            // Ensure this matches your backend port
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
                cpbd: data.cpbd_score,
                wavelet: data.wavelet_score,
                lbp: data.lbp_score,
              })
            })
            .catch((error) => {
              console.error("Error fetching blur data:", error)
              setBackendStatus("Backend disconnected or error: " + error.message)
            })
        }
      }
    }, 1000) // Analyze every 1 second

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (isPoor) {
      playBeep()
    }
  }, [isPoor])

  return (
    <div className="container">
      <h1>Real-Time Camera Quality Monitor</h1>
      {cameraError && <div className="error-message">{cameraError}</div>}
      <div className="backend-status">Backend Status: {backendStatus}</div>
      <div className="video-container">
        <video ref={videoRef} autoPlay playsInline muted className="video-feed"></video>
        {isPoor && (
          <div className="warning-overlay">
            <span className="warning-icon">⚠</span> EXTREME CAMERA BLUR DETECTED!
          </div>
        )}
      </div>
      <canvas ref={canvasRef} style={{ display: "none" }}></canvas> {/* Hidden canvas for frame capture */}
      <div className="scores-display">
        <p>
          CPBD: <span className={scores.cpbd < 20 ? "score-bad" : "score-good"}>{scores.cpbd.toFixed(2)}</span>
        </p>
        <p>
          Wavelet:{" "}
          <span className={scores.wavelet < 4.5 ? "score-bad" : "score-good"}>{scores.wavelet.toFixed(2)}</span>
        </p>
        <p>
          LBP STD: <span className={scores.lbp > 25 ? "score-bad" : "score-good"}>{scores.lbp.toFixed(2)}</span>
        </p>
      </div>
    </div>
  )
}

export default App
