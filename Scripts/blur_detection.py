import cv2
import numpy as np
import pywt
import sys
import json
import base64

# Function to log messages to stderr
def log_stderr(message):
    sys.stderr.write(json.dumps({"log": message}) + "\n")
    sys.stderr.flush()

def cpbd_blur_metric(gray):
    """Simulated CPBD-like blur detection using Sobel edge strength"""
    sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
    sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
    edges = np.hypot(sobelx, sobely)
    edge_pixels = edges > 10  # edge threshold
    if np.sum(edge_pixels) == 0:
        return 0
    return np.mean(edges[edge_pixels])

def wavelet_blur_metric(gray):
    """Wavelet-based high-frequency detail energy loss"""
    try:
        coeffs = pywt.wavedec2(gray, 'db1', level=2)
        LH, HL, HH = coeffs[1]  # Level 1 details
        detail_energy = np.mean(np.abs(LH)) + np.mean(np.abs(HL)) + np.mean(np.abs(HH))
        return detail_energy
    except ValueError as e:
        log_stderr(f"Wavelet decomposition failed due to image dimensions: {e}")
        return 0

def variance_of_laplacian(gray):
    """Compute the variance of the Laplacian to estimate blur.
    A higher variance indicates more edges and thus less blur.
    """
    # The Laplacian is a second-order derivative mask
    # It highlights regions of rapid intensity change (edges)
    return cv2.Laplacian(gray, cv2.CV_64F).var()

def is_extremely_blurry(frame, cpbd_thresh=20, wavelet_thresh=4.5, laplacian_thresh=100):
    """Determines if a frame is extremely blurry based on multiple metrics."""
    if frame is None or frame.size == 0:
        log_stderr("Received empty or invalid frame in is_extremely_blurry.")
        return False, 0, 0, 0

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    log_stderr(f"Converted to grayscale. Gray image shape: {gray.shape}")

    cpbd_score = cpbd_blur_metric(gray)
    wavelet_score = wavelet_blur_metric(gray)
    laplacian_score = variance_of_laplacian(gray) # Using Variance of Laplacian

    log_stderr(f"Calculated scores: CPBD={cpbd_score:.2f}, Wavelet={wavelet_score:.2f}, Laplacian={laplacian_score:.2f}")

    poor_quality_count = sum([
        cpbd_score < cpbd_thresh,
        wavelet_score < wavelet_thresh,
        laplacian_score < laplacian_thresh # Lower Laplacian score means more blur
    ])
    is_poor = poor_quality_count >= 2
    return is_poor, cpbd_score, wavelet_score, laplacian_score

if __name__ == "__main__":
    log_stderr("Python script started.")
    try:
        base64_image_data = sys.stdin.read()
        log_stderr(f"Received base64 data. Length: {len(base64_image_data)} characters.")

        if "," in base64_image_data:
            base64_image_data = base64_image_data.split(",")[1]
            log_stderr("Removed data URI prefix.")

        img_bytes = base64.b64decode(base64_image_data)
        log_stderr(f"Decoded base64 to bytes. Length: {len(img_bytes)} bytes.")

        np_arr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        log_stderr(f"Decoded image with OpenCV. Frame is None: {frame is None}")

    except Exception as e:
        log_stderr(f"Failed to decode image data: {e}")
        print(json.dumps({"error": f"Failed to decode image data: {e}"}), file=sys.stderr)
        sys.exit(1)

    if frame is None:
        log_stderr("Could not load image. Frame is None after imdecode.")
        print(json.dumps({"error": "Could not load image. Check base64 data."}), file=sys.stderr)
        sys.exit(1)

    is_poor, cpbd_score, wavelet_score, laplacian_score = is_extremely_blurry(frame)

    results = {
        "isPoor": bool(is_poor),
        "cpbd_score": float(cpbd_score),
        "wavelet_score": float(wavelet_score),
        "laplacian_score": float(laplacian_score) # Changed key to laplacian_score
    }
    log_stderr(f"Final results: {results}")
    print(json.dumps(results))
    log_stderr("Python script finished and printed JSON to stdout.")
