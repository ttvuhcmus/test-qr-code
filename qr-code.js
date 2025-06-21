/**
 * QR Code
 */

"use strict";

function getBankingInfo(decodedText) {
  $.ajax({
    url: $("#qr-container").attr("get"),
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
    // this.qrScanner = new Html5Qrcode(scanContainerId);

    this.bindEvents();
  }

  bindEvents() {
    this.startButton.addEventListener("click", (event) =>
      this.handleStartScan(event)
    );
    // this.stopButton.addEventListener("click", () => {
    //   this.hideScanUI();
    //   this.qrScanner.stop();
    // });
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
    const video = document.createElement("video");
    const canvasElement = document.getElementById("canvas");
    const canvas = canvasElement.getContext("2d", { willReadFrequently: true });
    const outputContainer = document.getElementById("output");

    function drawLine(begin, end, color) {
      canvas.beginPath();
      canvas.moveTo(begin.x, begin.y);
      canvas.lineTo(end.x, end.y);
      canvas.lineWidth = 4;
      canvas.strokeStyle = color;
      canvas.stroke();
    }

    // Use facingMode: environment to attemt to get the front camera on phones
    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      })
      .then(function (stream) {
        video.srcObject = stream;
        video.setAttribute("playsinline", true); // required to tell iOS safari we don't want fullscreen
        video.play();
        requestAnimationFrame(tick);
      });

    function tick() {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvasElement.hidden = false;
        outputContainer.hidden = false;

        canvasElement.width = 300;
        canvasElement.height = 200;

        const videoAspectRatio = video.videoWidth / video.videoHeight;
        const canvasAspectRatio = canvasElement.width / canvasElement.height;

        let renderWidth, renderHeight, xOffset, yOffset;

        if (videoAspectRatio > canvasAspectRatio) {
          renderHeight = canvasElement.height;
          renderWidth = renderHeight * videoAspectRatio;
          xOffset = (canvasElement.width - renderWidth) / 2;
          yOffset = 0;
        } else {
          renderWidth = canvasElement.width;
          renderHeight = renderWidth / videoAspectRatio;
          xOffset = 0;
          yOffset = (canvasElement.height - renderHeight) / 2;
        }

        canvas.clearRect(0, 0, canvasElement.width, canvasElement.height);
        canvas.drawImage(video, xOffset, yOffset, renderWidth, renderHeight);

        const imageData = canvas.getImageData(
          0,
          0,
          canvasElement.width,
          canvasElement.height
        );
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (code) {
          drawLine(
            code.location.topLeftCorner,
            code.location.topRightCorner,
            "#FF3B58"
          );
          drawLine(
            code.location.topRightCorner,
            code.location.bottomRightCorner,
            "#FF3B58"
          );
          drawLine(
            code.location.bottomRightCorner,
            code.location.bottomLeftCorner,
            "#FF3B58"
          );
          drawLine(
            code.location.bottomLeftCorner,
            code.location.topLeftCorner,
            "#FF3B58"
          );
          alert(code.data);
        }
      }
      requestAnimationFrame(tick);
    }

    // event.stopPropagation();

    // try {
    //   const hasCamera = await this.checkCameraAvailable();
    //   if (!hasCamera) throw new Error('No camera found on this device');

    //   const hasPermission = await this.checkCameraPermission();
    //   if (!hasPermission) {
    //     await navigator.mediaDevices.getUserMedia({ video: true });
    //   }

    //   this.showScanUI()

    //   await this.qrScanner.start(
    //     { facingMode: { exact: "environment" } },
    //     {
    //       fps: 10,
    //       qrbox: 150,
    //       aspectRatio: 3 / 2,
    //       videoConstraints: {
    //         facingMode: "environment",
    //       },
    //     },
    //     (decodedText) => {
    //       this.onScan(decodedText);
    //       this.hideScanUI();
    //       this.qrScanner.stop();
    //     }
    //   );
    // } catch (error) {
    //   Swal.fire({
    //     title: 'Error!',
    //     text: error.message,
    //     icon: 'error',
    //     customClass: {
    //       confirmButton: 'btn btn-primary waves-effect waves-light'
    //     },
    //     buttonsStyling: false
    //   });
    // }
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

new CameraQrScanner({
  scanContainerId: "reader",
  startButtonId: "btn-start-scan",
  stopButtonId: "btn-stop-scan",
  qrContainerId: "qr-container",
  onScan: getBankingInfo,
});
