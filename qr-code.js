/**
 * QR Code
 */

"use strict";

function getBankingInfo(decodedText) {
  console.log(decodedText);
}

class CameraQrScanner {
  constructor({ startButtonId, stopButtonId, qrContainerId, onScan }) {
    this.startButton = document.getElementById(startButtonId);
    this.stopButton = document.getElementById(stopButtonId);
    this.qrContainer = document.getElementById(qrContainerId);
    this.onScan = onScan;

    this.stream = null;
    this.video = null;
    this.canvas = document.getElementById("canvas");
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    this.scanning = false;
    this.rafId = null;

    this.tick = this.tick.bind(this);

    this.bindEvents();
  }

  bindEvents() {
    this.startButton.addEventListener("click", (event) =>
      this.handleStartScan(event)
    );
    this.stopButton.addEventListener("click", () => {
      this.hideScanUI();
      this.handleStopScan();
    });
  }

  async checkCameraPermission() {
    if (!navigator.permissions || !navigator.permissions.query) return true;

    const status = await navigator.permissions.query({ name: "camera" });
    return status.state === "granted" || status.state === "prompt";
  }

  async checkCameraAvailable() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.some((device) => device.kind === "videoinput");
  }

  async handleStartScan(event) {
    event.stopPropagation();

    try {
      const hasCamera = await this.checkCameraAvailable();
      if (!hasCamera) throw new Error("No camera found on this device");

      const hasCameraPermission = await this.checkCameraPermission();
      if (!hasCameraPermission) {
        throw new Error(
          "Camera access was denied. Please grant permission to continue."
        );
      }

      const constraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      };
      this.stream = await new Promise((resolve) => {
        navigator.mediaDevices
          .getUserMedia(constraints)
          .then(resolve)
          .catch(console.error);
      });

      this.showScanUI();

      this.video = document.createElement("video");
      this.video.srcObject = this.stream;
      this.video.setAttribute("playsinline", true); // required to tell iOS safari we don't want fullscreen
      await this.video.play();

      this.scanning = true;
      this.tick();
    } catch (error) {
      console.error(error);
    }
  }

  tick() {
    if (!this.scanning) return;

    if (this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
      this.canvas.width = 360;
      this.canvas.height = 500;

      const videoAspectRatio = this.video.videoWidth / this.video.videoHeight;
      const canvasAspectRatio = this.canvas.width / this.canvas.height;

      let renderWidth, renderHeight, xOffset, yOffset;

      if (videoAspectRatio > canvasAspectRatio) {
        renderHeight = this.canvas.height;
        renderWidth = renderHeight * videoAspectRatio;
        xOffset = (this.canvas.width - renderWidth) / 2;
        yOffset = 0;
      } else {
        renderWidth = this.canvas.width;
        renderHeight = renderWidth / videoAspectRatio;
        xOffset = 0;
        yOffset = (this.canvas.height - renderHeight) / 2;
      }

      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(
        this.video,
        xOffset,
        yOffset,
        renderWidth,
        renderHeight
      );

      const imageData = this.ctx.getImageData(
        0,
        0,
        this.canvas.width,
        this.canvas.height
      );
      const result = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (result) {
        this.onScan(result.data);
        this.hideScanUI();
        this.handleStopScan();
        return;
      }
    }

    this.rafId = requestAnimationFrame(this.tick);
  }

  handleStopScan() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
      this.video = null;
    }
    this.scanning = false;
  }

  showScanUI() {
    this.canvas.style.display = "block";
    this.stopButton.style.setProperty("display", "inline-flex", "important");
    this.qrContainer.style.display = "none";
  }

  hideScanUI() {
    this.canvas.style.display = "none";
    this.stopButton.style.setProperty("display", "none", "important");
    this.qrContainer.style.display = "flex";
  }
}

class UploadQrScanner {
  constructor({ uploadButtonId, fileInputId, qrContainerId, onScan }) {
    this.uploadButton = document.getElementById(uploadButtonId);
    this.fileInput = document.getElementById(fileInputId);
    this.qrContainer = document.getElementById(qrContainerId);
    this.onScan = onScan;

    this.bindEvents();
  }

  bindEvents() {
    this.uploadButton.addEventListener("click", (event) =>
      this.handleUploadClick(event)
    );

    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      this.qrContainer.addEventListener(eventName, (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
    });

    this.qrContainer.addEventListener("drop", (event) =>
      this.handleDrop(event)
    );
    this.fileInput.addEventListener("change", (event) =>
      this.handleFileInput(event)
    );
  }

  handleUploadClick(event) {
    event.stopPropagation();
    this.fileInput.click();
  }

  handleDrop(event) {
    const files = event.dataTransfer.files;
    this.fileInput.files = files;

    const changeEvent = new Event("change", { bubbles: true });
    this.fileInput.dispatchEvent(changeEvent);
  }

  handleFileInput(event) {
    const file = event.target.files[0];
    if (!file) return;

    this.scanImage(file);
  }

  async scanImage(file) {
    try {
      const bitmap = await createImageBitmap(file);

      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(bitmap, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(imageData.data, canvas.width, canvas.height);

      this.onScan(result.data);
    } catch (error) {
      console.error(error);
    }
  }
}

new CameraQrScanner({
  startButtonId: "btn-start-scan",
  stopButtonId: "btn-stop-scan",
  qrContainerId: "qr-container",
  onScan: getBankingInfo,
});

new UploadQrScanner({
  uploadButtonId: "btn-upload-file",
  fileInputId: "qr-file-input",
  qrContainerId: "qr-container",
  onScan: getBankingInfo,
});
