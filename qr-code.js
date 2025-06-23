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
    this.draw = this.draw.bind(this);

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
      Swal.fire({
        title: "Error!",
        text: error.message,
        icon: "error",
        customClass: {
          confirmButton: "btn btn-primary waves-effect waves-light",
        },
        buttonsStyling: false,
      });
    }
  }

  tick() {
    if (!this.scanning) return;

    if (this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
      this.canvas.width = 360;
      this.canvas.height = 200;

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
      this.draw();

      const size = 170;
      const centerX = this.canvas.width / 2;
      const centerY = this.canvas.height / 2;

      const startX = Math.floor(centerX - size / 2);
      const startY = Math.floor(centerY - size / 2);

      const imageData = this.ctx.getImageData(startX, startY, size, size);

      // const imageData = this.ctx.getImageData(
      //   0,
      //   0,
      //   this.canvas.width,
      //   this.canvas.height
      // );
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

  draw() {
    const ctx = this.ctx;
    const canvas = this.canvas;

    const qrBoxWidth = 170;
    const qrBoxHeight = 170;
    const cornerLength = 30;
    const cornerRadius = 16;

    const qrX = (canvas.width - qrBoxWidth) / 2;
    const qrY = (canvas.height - qrBoxHeight) / 2;

    // === 1. Vẽ vùng phủ đen mờ, giữ lại vùng giữa ===
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height); // toàn màn

    // Tạo lỗ vùng QR ở giữa bằng đường bo góc
    ctx.moveTo(qrX + cornerRadius, qrY);
    ctx.lineTo(qrX + qrBoxWidth - cornerRadius, qrY);
    ctx.quadraticCurveTo(
      qrX + qrBoxWidth,
      qrY,
      qrX + qrBoxWidth,
      qrY + cornerRadius
    );
    ctx.lineTo(qrX + qrBoxWidth, qrY + qrBoxHeight - cornerRadius);
    ctx.quadraticCurveTo(
      qrX + qrBoxWidth,
      qrY + qrBoxHeight,
      qrX + qrBoxWidth - cornerRadius,
      qrY + qrBoxHeight
    );
    ctx.lineTo(qrX + cornerRadius, qrY + qrBoxHeight);
    ctx.quadraticCurveTo(
      qrX,
      qrY + qrBoxHeight,
      qrX,
      qrY + qrBoxHeight - cornerRadius
    );
    ctx.lineTo(qrX, qrY + cornerRadius);
    ctx.quadraticCurveTo(qrX, qrY, qrX + cornerRadius, qrY);
    ctx.closePath();

    // Dùng evenodd để loại trừ vùng giữa
    ctx.fill("evenodd");
    ctx.restore();

    // === 2. Vẽ 4 góc trắng ===
    const drawCorner = (drawLine) => {
      ctx.save();
      ctx.strokeStyle = "white";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      drawLine();
      ctx.stroke();
      ctx.restore();
    };

    // Top-Left
    drawCorner(() => {
      ctx.beginPath();
      ctx.moveTo(qrX, qrY + cornerLength);
      ctx.lineTo(qrX, qrY);
      ctx.lineTo(qrX + cornerLength, qrY);
    });

    // Top-Right
    drawCorner(() => {
      ctx.beginPath();
      ctx.moveTo(qrX + qrBoxWidth - cornerLength, qrY);
      ctx.lineTo(qrX + qrBoxWidth, qrY);
      ctx.lineTo(qrX + qrBoxWidth, qrY + cornerLength);
    });

    // Bottom-Left
    drawCorner(() => {
      ctx.beginPath();
      ctx.moveTo(qrX, qrY + qrBoxHeight - cornerLength);
      ctx.lineTo(qrX, qrY + qrBoxHeight);
      ctx.lineTo(qrX + cornerLength, qrY + qrBoxHeight);
    });

    // Bottom-Right
    drawCorner(() => {
      ctx.beginPath();
      ctx.moveTo(qrX + qrBoxWidth - cornerLength, qrY + qrBoxHeight);
      ctx.lineTo(qrX + qrBoxWidth, qrY + qrBoxHeight);
      ctx.lineTo(qrX + qrBoxWidth, qrY + qrBoxHeight - cornerLength);
    });
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
      Swal.fire({
        title: "Error!",
        text: "Unable to detect any QR code. Please try another image!",
        icon: "error",
        customClass: {
          confirmButton: "btn btn-primary waves-effect waves-light",
        },
        buttonsStyling: false,
      });
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
