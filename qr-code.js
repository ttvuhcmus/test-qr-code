/**
 * QR Code
 */

"use strict";

import QrScanner from "./qr-scanner.min.js";

function getBankingInfo(decodedText) {
  $.ajax({
    url: "/qrpay/banking_decode",
    method: "GET",
    data: {
      text: decodedText,
    },
    success: function (data) {
      const bankCode = $("#bank-code"),
        accountNo = $("#account-no"),
        accountName = $("#account-name"),
        bankingAmount = $("#banking-amount"),
        bankingMessage = $("#banking-message");

      bankCode.val(data.bankCode).trigger("change");

      accountNo.val(data.accountNo);
      accountNo.focus();
      requestAnimationFrame(() => {
        accountNo.blur();
        accountName.focus();
      });

      bankingAmount.val(data.amount);
      new Cleave(bankingAmount, {
        numeral: true,
        numeralThousandsGroupStyle: "thousand",
      });

      bankingMessage.val(data.memo);
    },
  });
}

console.log("===", document.querySelectorAll("#reader"));

class CameraQrScanner {
  constructor({
    scanContainerId,
    startButtonId,
    stopButtonId,
    qrContainerId,
    onScan,
  }) {
    this.scanContainer = document.getElementById(scanContainerId);
    this.startButton = document.getElementById(startButtonId);
    this.stopButton = document.getElementById(stopButtonId);
    this.qrContainer = document.getElementById(qrContainerId);
    this.onScan = onScan;
    this.qrScanner = new Html5Qrcode(scanContainerId);

    this.bindEvents();
  }

  bindEvents() {
    this.startButton.addEventListener("click", (event) =>
      this.handleStartScan(event)
    );
    this.stopButton.addEventListener("click", () => {
      this.hideScanUI();
      this.qrScanner.stop();
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

      const hasPermission = await this.checkCameraPermission();
      if (!hasPermission) {
        await navigator.mediaDevices.getUserMedia({ video: true });
      }

      this.showScanUI();

      await this.qrScanner.start(
        { facingMode: { exact: "environment" } },
        {
          fps: 10,
          qrbox: 150,
          rememberLastUsedCamera: true,
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
          videoConstraints: {
            width: { min: 150 },
            height: { max: 150 },
            // facingMode: { exact: "environment" },
          },
        },
        (decodedText) => {
          this.onScan(decodedText);
          this.hideScanUI();
          this.qrScanner.stop();
        }
      );
    } catch (error) {
      console.error(error.message);
    }
  }

  showScanUI() {
    this.scanContainer.style.display = "block";
    this.stopButton.style.setProperty("display", "inline-flex", "important");
    this.qrContainer.style.display = "none";
  }

  hideScanUI() {
    this.scanContainer.style.display = "none";
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
      const decodedText = await QrScanner.scanImage(file);
      this.onScan(decodedText);
    } catch (error) {
      console.error("Unable to detect any QR code. Please try another image!");
    }
  }
}

new CameraQrScanner({
  scanContainerId: "reader",
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
