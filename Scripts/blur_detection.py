import cv2
import numpy as np
import pywt
import sys
import json
import base64

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
        print(json.dumps({"error": f"Wavelet decomposition failed due to image dimensions: {e}"}), file=sys.stderr)
        return 0

def variance_of_laplacian(gray):
    """Compute the variance of the Laplacian to estimate blur.
    A higher variance indicates more edges and thus less blur.
    """
    return cv2.Laplacian(gray, cv2.CV_64F).var()

def is_extremely_blurry(frame, cpbd_thresh=20, wavelet_thresh=4.5, laplacian_thresh=100):
    """Determines if a frame is extremely blurry based on multiple metrics."""
    if frame is None or frame.size == 0:
        print(json.dumps({"error": "Received empty or invalid frame."}), file=sys.stderr)
        return False, 0, 0, 0

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    cpbd_score = cpbd_blur_metric(gray)
    wavelet_score = wavelet_blur_metric(gray)
    laplacian_score = variance_of_laplacian(gray) # Using Variance of Laplacian

    poor_quality_count = sum([
        cpbd_score < cpbd_thresh,
        wavelet_score < wavelet_thresh,
        laplacian_score < laplacian_thresh # Lower Laplacian score means more blur
    ])
    is_poor = poor_quality_count >= 2
    return is_poor, cpbd_score, wavelet_score, laplacian_score

if __name__ == "__main__":
    try:
        base64_image_data = sys.stdin.read()
        if "," in base64_image_data:
            base64_image_data = base64_image_data.split(",")[1]

        img_bytes = base64.b64decode(base64_image_data)
        np_arr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    except Exception as e:
        print(json.dumps({"error": f"Failed to decode image data: {e}"}), file=sys.stderr)
        sys.exit(1)

    if frame is None:
        print(json.dumps({"error": "Could not load image. Check base64 data."}), file=sys.stderr)
        sys.exit(1)

    is_poor, cpbd_score, wavelet_score, laplacian_score = is_extremely_blurry(frame)

    results = {
        "isPoor": bool(is_poor),
        "cpbd_score": float(cpbd_score),
        "wavelet_score": float(wavelet_score),
        "laplacian_score": float(laplacian_score) # Changed key to laplacian_score
    }
    print(json.dumps(results))
