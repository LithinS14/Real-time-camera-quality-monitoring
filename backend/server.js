const express = require("express")
const cors = require("cors")
const bodyParser = require("body-parser")
const { spawn } = require("child_process")
const path = require("path")

const app = express()
const port = 3001 // Choose a port for your backend

// Middleware
app.use(cors()) // Enable CORS for all origins (for development)
app.use(bodyParser.json({ limit: "50mb" })) // Increase limit for image data

// Define the path to your Python script
const pythonScriptPath = path.join(__dirname, "../scripts/blur_detection.py")

app.post("/detect-blur", (req, res) => {
  const { imageData } = req.body

  if (!imageData) {
    return res.status(400).json({ error: "No imageData provided" })
  }

  // Spawn a Python child process
  const pythonProcess = spawn("python", [pythonScriptPath])

  let pythonOutput = ""
  let pythonError = ""

  // Listen for data from Python's stdout
  pythonProcess.stdout.on("data", (data) => {
    pythonOutput += data.toString()
  })

  // Listen for data from Python's stderr (for errors/warnings)
  pythonProcess.stderr.on("data", (data) => {
    pythonError += data.toString()
    console.error(`Python Error: ${data.toString()}`)
  })

  // Handle process exit
  pythonProcess.on("close", (code) => {
    if (code !== 0) {
      console.error(`Python script exited with code ${code}`)
      console.error(`Python stderr: ${pythonError}`)
      return res.status(500).json({ error: "Python script failed", details: pythonError })
    }

    try {
      const result = JSON.parse(pythonOutput)
      res.json(result)
    } catch (e) {
      console.error("Failed to parse Python output:", pythonOutput)
      console.error("Parsing error:", e)
      res.status(500).json({ error: "Failed to parse Python script output", details: pythonOutput })
    }
  })

  // Handle process errors (e.g., python not found)
  pythonProcess.on("error", (err) => {
    console.error("Failed to start Python process:", err)
    res.status(500).json({ error: "Failed to start Python process", details: err.message })
  })

  // Write the base64 image data to Python's stdin
  pythonProcess.stdin.write(imageData)
  pythonProcess.stdin.end() // Close stdin to signal end of input
})

app.listen(port, () => {
  console.log(`Node.js backend listening at http://localhost:${port}`)
})
