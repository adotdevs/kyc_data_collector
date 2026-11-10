"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

const COUNTRY_LIST = [
  "Afghanistan", "Albania", "Algeria", "American Samoa", "Andorra", "Angola", "Anguilla",
  "Antarctica", "Antigua & Barbuda", "Argentina", "Armenia", "Aruba", "Ascension Island",
  "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados",
  "Belarus", "Belgium", "Belize", "Benin", "Bermuda", "Bhutan", "Bolivia",
  "Bosnia and Herzegovina", "Botswana", "Bouvet Island", "Brazil", "British Indian Ocean Territory",
  "British Virgin Islands", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde",
  "Cambodia", "Cameroon", "Canada", "Caribbean Netherlands", "Cayman Islands",
  "Central African Republic", "Chad", "Chile", "China", "Christmas Island", "Cocos Islands",
  "Colombia", "Comoros", "Congo, Democratic Republic of the", "Congo, Republic of the",
  "Cook Islands", "Costa Rica", "Croatia", "Cuba", "Curaçao", "Cyprus", "Czechia",
  "Côte d'Ivoire", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador",
  "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia",
  "Falkland Islands", "Faroe Islands", "Fiji", "Finland", "France", "French Guiana",
  "French Polynesia", "French South Territories", "Gabon", "Gambia", "Georgia", "Germany",
  "Ghana", "Gibraltar", "Greece", "Greenland", "Grenada", "Guadeloupe", "Guam", "Guatemala",
  "Guernsey", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Heard Island And Mcdonald Island",
  "Honduras", "Hong Kong SAR China", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq",
  "Ireland", "Isle of Man", "Israel", "Italy", "Jamaica", "Japan", "Jersey", "Jordan",
  "Kazakhstan", "Kenya", "Kiribati", "Kosovo", "Kuwait", "Kyrgyzstan",
  "Lao People's Democratic Republic", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya",
  "Liechtenstein", "Lithuania", "Luxembourg", "Macao SAR China", "Madagascar", "Malawi",
  "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Martinique", "Mauritania",
  "Mauritius", "Mayotte", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro",
  "Montserrat", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands",
  "New Caledonia", "New Zealand", "Nicaragua", "Niger", "Nigeria", "Niue", "Norfolk Island",
  "North Korea", "North Macedonia", "Northern Mariana Islands", "Norway", "Oman", "Pakistan",
  "Palau", "Palestinian Territories", "Panama", "Papua New Guinea", "Paraguay", "Peru",
  "Philippines", "Pitcairn Islands", "Poland", "Portugal", "Puerto Rico", "Qatar", "Romania",
  "Russia", "Rwanda", "Réunion", "Saint Helena", "Saint Kitts and Nevis", "Saint Lucia",
  "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Saudi Arabia", "Senegal", "Serbia",
  "Seychelles", "Sierra Leone", "Singapore", "Sint Maarten", "Slovakia", "Slovenia",
  "Solomon Islands", "Somalia", "South Africa", "South Georgia and South Sandwich",
  "South Korea", "South Sudan", "Spain", "Sri Lanka", "St. Barthélemy", "St. Martin",
  "St. Pierre & Miquelon", "Sudan", "Suriname", "Svalbard and Jan Mayen", "Sweden",
  "Switzerland", "Syria", "São Tomé & Príncipe", "Taiwan", "Tajikistan", "Tanzania", "Thailand",
  "Timor-Leste", "Togo", "Tokelau", "Tonga", "Trinidad & Tobago", "Tunisia", "Turkey",
  "Turkmenistan", "Turks & Caicos Islands", "Tuvalu", "U.S. Virgin Islands",
  "US Minor Outlying Islands", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom",
  "United States of America (USA)", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City",
  "Venezuela", "Vietnam", "Wallis And Futuna Islands", "Western Sahara", "Yemen", "Zambia",
  "Zimbabwe",
];

export default function GetStartedClientInteractions() {
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      const dashboardHref =
        user.role === "superadmin" ||
        user.role === "admin" ||
        user.role === "subadmin"
          ? "/admin"
          : "/documents";
      document.querySelectorAll('a[href="/login"]').forEach((el) => {
        el.setAttribute("href", dashboardHref);
        el.textContent = "Dashboard";
      });
    }
  }, [user]);

  useEffect(() => {
    const modal = document.getElementById("signature-modal");
    const modalCanvas = document.getElementById(
      "signature-pad"
    ) as HTMLCanvasElement | null;
    const previewCanvas = document.getElementById(
      "signature-preview"
    ) as HTMLCanvasElement | null;
    const previewBtn = document.getElementById("open-signature-modal");
    const clearBtn = document.getElementById("clear-signature");
    const modalClearBtn = document.getElementById("modal-clear-signature");
    const applyBtn = document.getElementById("apply-signature");
    const cancelBtn = document.getElementById("cancel-signature");
    const closeBtn = document.getElementById("close-signature-modal");
    const backdrop = document.getElementById("signature-modal-backdrop");
    const signatureInput = document.getElementById(
      "signature-data"
    ) as HTMLInputElement | null;
    const signatureGroup = document.getElementById("signature-group");
    const form = document.getElementById("start-form") as HTMLFormElement | null;
    const submitBtn = document.getElementById(
      "submit-btn"
    ) as HTMLButtonElement | null;
    const resultModal = document.getElementById("result-modal");
    const resultModalIcon = document.getElementById("result-modal-icon");
    const resultModalTitle = document.getElementById("result-modal-title");
    const resultModalText = document.getElementById("result-modal-text");
    const resultModalClose = document.getElementById("result-modal-close");
    const resultModalBackdrop = document.getElementById(
      "result-modal-backdrop"
    );
    const helpWithGroup = document.getElementById("help-with-group");
    const evidenceInput = document.getElementById(
      "evidence-files"
    ) as HTMLInputElement | null;
    const fileList = document.getElementById("file-list");
    const fileUploadWrap = document.getElementById("file-upload-wrap");
    const evidenceGroup = document.getElementById("evidence-group");
    const countrySelect = document.getElementById(
      "country"
    ) as HTMLSelectElement | null;

    if (
      !modal ||
      !modalCanvas ||
      !previewCanvas ||
      !previewBtn ||
      !clearBtn ||
      !modalClearBtn ||
      !applyBtn ||
      !cancelBtn ||
      !closeBtn ||
      !backdrop ||
      !signatureInput ||
      !signatureGroup ||
      !form ||
      !submitBtn ||
      !resultModal ||
      !resultModalIcon ||
      !resultModalTitle ||
      !resultModalText ||
      !resultModalClose ||
      !resultModalBackdrop ||
      !helpWithGroup ||
      !evidenceInput ||
      !fileList ||
      !fileUploadWrap ||
      !evidenceGroup
    ) {
      return;
    }

    const MAX_FILE_SIZE = 8 * 1024 * 1024;

    if (countrySelect && countrySelect.options.length <= 1) {
      COUNTRY_LIST.forEach((country) => {
        const option = document.createElement("option");
        option.value = country;
        option.textContent = country;
        countrySelect.appendChild(option);
      });
    }

    function formatFileSize(bytes: number) {
      if (bytes < 1024) return bytes + " B";
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
      return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    }

    function renderFileList() {
      if (!fileList || !evidenceInput) return;
      fileList.innerHTML = "";
      const files = evidenceInput.files;
      if (!files) return;
      for (let i = 0; i < files.length; i++) {
        const li = document.createElement("li");
        li.innerHTML =
          "<span>" +
          files[i].name +
          '</span><span class="file-size">' +
          formatFileSize(files[i].size) +
          "</span>";
        fileList.appendChild(li);
      }
    }

    function validateFileSizes() {
      if (!evidenceInput || !evidenceInput.files) return true;
      const files = evidenceInput.files;
      for (let i = 0; i < files.length; i++) {
        if (files[i].size > MAX_FILE_SIZE) return false;
      }
      return true;
    }

    const onEvidenceChange = () => {
      evidenceGroup.classList.remove("has-error");
      renderFileList();
    };
    evidenceInput.addEventListener("change", onEvidenceChange);

    const onDragOver = (event: Event) => {
      event.preventDefault();
      fileUploadWrap.classList.add("is-dragover");
    };
    const onDragLeave = (event: Event) => {
      event.preventDefault();
      fileUploadWrap.classList.remove("is-dragover");
    };

    fileUploadWrap.addEventListener("dragenter", onDragOver);
    fileUploadWrap.addEventListener("dragover", onDragOver);
    fileUploadWrap.addEventListener("dragleave", onDragLeave);
    fileUploadWrap.addEventListener("drop", onDragLeave);

    helpWithGroup
      .querySelectorAll('input[type="checkbox"]')
      .forEach((box) => {
        box.addEventListener("change", () => {
          helpWithGroup.classList.remove("has-error");
        });
      });

    let hasSignature = false;

    function createPad(canvas: HTMLCanvasElement, interactive: boolean) {
      const ctx = canvas.getContext("2d")!;
      let drawing = false;
      let points: { x: number; y: number; time: number }[] = [];
      let lastPoint: { x: number; y: number; time: number } | null = null;
      let lastWidth = 2.8;
      let hasStroke = false;
      let loadToken = 0;
      let ratio = 1;
      let logicalWidth = 0;
      let logicalHeight = 0;
      let layoutWidth = 0;
      let layoutHeight = 0;

      function setupContext() {
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#03112E";
      }

      function paintImage(dataUrl: string, token: number) {
        const img = new Image();
        img.onload = function () {
          if (token !== loadToken) return;
          ctx.clearRect(0, 0, logicalWidth, logicalHeight);
          ctx.drawImage(img, 0, 0, logicalWidth, logicalHeight);
        };
        img.src = dataUrl;
      }

      function ensureSize() {
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;

        const newRatio = Math.max(window.devicePixelRatio || 1, 1);
        const sizeChanged =
          Math.abs(rect.width - layoutWidth) > 0.5 ||
          Math.abs(rect.height - layoutHeight) > 0.5 ||
          newRatio !== ratio ||
          logicalWidth === 0;

        if (!sizeChanged) return true;

        let snapshot = "";
        if (hasStroke && logicalWidth > 0) {
          snapshot = canvas.toDataURL("image/png");
        }

        ratio = newRatio;
        logicalWidth = rect.width;
        logicalHeight = rect.height;
        layoutWidth = rect.width;
        layoutHeight = rect.height;
        canvas.width = Math.floor(logicalWidth * ratio);
        canvas.height = Math.floor(logicalHeight * ratio);
        setupContext();

        if (snapshot) {
          loadToken++;
          paintImage(snapshot, loadToken);
        } else {
          ctx.clearRect(0, 0, logicalWidth, logicalHeight);
        }

        return true;
      }

      function resize(preserve: boolean) {
        if (!ensureSize()) return;
        if (preserve && hasStroke) {
          loadToken++;
          paintImage(canvas.toDataURL("image/png"), loadToken);
        }
      }

      function getPoint(event: any) {
        const rect = canvas.getBoundingClientRect();
        const source =
          (event.touches && event.touches[0]) ||
          (event.changedTouches && event.changedTouches[0]) ||
          event;
        return {
          x: source.clientX - rect.left,
          y: source.clientY - rect.top,
          time: performance.now(),
        };
      }

      function getLineWidth(
        point: { x: number; y: number; time: number },
        previous: { x: number; y: number; time: number } | null
      ) {
        if (!previous) return 2.8;
        const dx = point.x - previous.x;
        const dy = point.y - previous.y;
        const velocity =
          Math.sqrt(dx * dx + dy * dy) / Math.max(point.time - previous.time, 1);
        const target = Math.max(1.6, Math.min(4, 5 - velocity * 14));
        return lastWidth + (target - lastWidth) * 0.35;
      }

      function drawSmoothSegment(
        p1: { x: number; y: number },
        p2: { x: number; y: number },
        p3: { x: number; y: number },
        width: number
      ) {
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo((p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
        ctx.quadraticCurveTo(p2.x, p2.y, (p2.x + p3.x) / 2, (p2.y + p3.y) / 2);
        ctx.stroke();
      }

      function startDrawing(event: Event) {
        if (!interactive) return;
        event.preventDefault();
        if (!ensureSize()) return;
        drawing = true;
        points = [];
        lastPoint = getPoint(event);
        points.push(lastPoint);
        lastWidth = 2.8;
      }

      function draw(event: Event) {
        if (!interactive || !drawing) return;
        event.preventDefault();

        const point = getPoint(event);
        const width = getLineWidth(point, lastPoint);
        points.push(point);

        if (points.length >= 3) {
          const len = points.length;
          drawSmoothSegment(
            points[len - 3],
            points[len - 2],
            points[len - 1],
            lastWidth
          );
        } else if (points.length === 2) {
          ctx.lineWidth = width;
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          ctx.lineTo(points[1].x, points[1].y);
          ctx.stroke();
        }

        lastWidth = width;
        lastPoint = point;
        hasStroke = true;
      }

      function stopDrawing(event: Event) {
        if (!interactive || !drawing) return;
        event.preventDefault();
        drawing = false;

        if (points.length >= 2) {
          const last = points[points.length - 1];
          const prev = points[points.length - 2];
          ctx.lineWidth = lastWidth;
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(last.x, last.y);
          ctx.stroke();
        }

        points = [];
        lastPoint = null;
      }

      function clear() {
        loadToken++;
        drawing = false;
        points = [];
        lastPoint = null;
        hasStroke = false;
        if (logicalWidth > 0 && logicalHeight > 0) {
          ctx.clearRect(0, 0, logicalWidth, logicalHeight);
        }
      }

      function loadDataURL(dataUrl: string) {
        loadToken++;
        if (!dataUrl) {
          clear();
          return;
        }
        hasStroke = true;
        if (!ensureSize()) return;
        paintImage(dataUrl, loadToken);
      }

      function getDataURL() {
        if (!hasStroke || logicalWidth === 0) return "";
        return canvas.toDataURL("image/png");
      }

      function bindEvents() {
        if (!interactive) return;
        canvas.addEventListener("mousedown", startDrawing);
        canvas.addEventListener("mousemove", draw);
        canvas.addEventListener("mouseup", stopDrawing);
        canvas.addEventListener("mouseleave", stopDrawing);
        canvas.addEventListener("touchstart", startDrawing, { passive: false });
        canvas.addEventListener("touchmove", draw, { passive: false });
        canvas.addEventListener("touchend", stopDrawing, { passive: false });
        canvas.addEventListener("touchcancel", stopDrawing, { passive: false });
      }

      return {
        resize,
        clear,
        loadDataURL,
        getDataURL,
        bindEvents,
        hasStroke: () => hasStroke,
      };
    }

    const modalPad = createPad(modalCanvas, true);
    const previewPad = createPad(previewCanvas, false);
    modalPad.bindEvents();

    function updatePreviewState() {
      previewBtn?.classList.toggle("has-signature", hasSignature);
    }

    function syncPreviewFromData(dataUrl: string) {
      if (dataUrl) {
        previewPad.loadDataURL(dataUrl);
        hasSignature = true;
      } else {
        previewPad.clear();
        hasSignature = false;
      }
      if (signatureInput) signatureInput.value = dataUrl || "";
      updatePreviewState();
      signatureGroup?.classList.remove("has-error");
    }

    function updateBodyScrollLock() {
      const anyOpen =
        modal?.classList.contains("is-open") ||
        resultModal?.classList.contains("is-open");
      document.body.classList.toggle("signature-modal-open", Boolean(anyOpen));
    }

    function openModal() {
      if (!modal || modal.classList.contains("is-open")) return;
      const snapshot = signatureInput?.value || "";
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      updateBodyScrollLock();

      requestAnimationFrame(() => {
        modalPad.clear();
        if (snapshot) {
          modalPad.loadDataURL(snapshot);
        }
      });
    }

    function closeModal() {
      if (!modal || !modal.classList.contains("is-open")) return;
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      modalPad.clear();
      updateBodyScrollLock();
    }

    function applySignature() {
      if (!modalPad.hasStroke()) {
        signatureGroup?.classList.add("has-error");
        return;
      }
      syncPreviewFromData(modalPad.getDataURL());
      closeModal();
    }

    previewBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openModal();
    });
    clearBtn.addEventListener("click", (e) => {
      e.preventDefault();
      syncPreviewFromData("");
    });
    modalClearBtn.addEventListener("click", (e) => {
      e.preventDefault();
      modalPad.clear();
    });
    applyBtn.addEventListener("click", (e) => {
      e.preventDefault();
      applySignature();
    });
    cancelBtn.addEventListener("click", (e) => {
      e.preventDefault();
      closeModal();
    });
    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      closeModal();
    });
    backdrop.addEventListener("click", closeModal);

    function showResultModal(type: string, title: string, text: string) {
      if (!resultModal || !resultModalIcon || !resultModalTitle || !resultModalText)
        return;
      resultModal.className = "result-modal is-open " + type;
      resultModal.setAttribute("aria-hidden", "false");
      resultModalIcon.textContent = type === "success" ? "✓" : "!";
      resultModalTitle.textContent = title;
      resultModalText.textContent = text;
      updateBodyScrollLock();
    }

    function closeResultModal() {
      if (!resultModal) return;
      resultModal.classList.remove("is-open");
      resultModal.setAttribute("aria-hidden", "true");
      updateBodyScrollLock();
    }

    resultModalClose.addEventListener("click", closeResultModal);
    resultModalBackdrop.addEventListener("click", closeResultModal);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (resultModal.classList.contains("is-open")) {
        closeResultModal();
      } else if (modal.classList.contains("is-open")) {
        closeModal();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    const onResize = () => {
      if (modal.classList.contains("is-open")) {
        modalPad.resize(true);
      }
      if (hasSignature && signatureInput.value) {
        previewPad.loadDataURL(signatureInput.value);
      } else {
        previewPad.clear();
      }
    };
    window.addEventListener("resize", onResize);

    previewPad.resize(false);

    const onFormSubmit = (event: Event) => {
      event.preventDefault();
      let valid = true;

      form.querySelectorAll(".form-group").forEach((group) => {
        if (group.id === "help-with-group" || group.id === "evidence-group")
          return;
        const input = group.querySelector<
          HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >('input:not([type="checkbox"]):not([type="radio"]), textarea, select');
        if (!input) return;
        const isValid = input.checkValidity();
        group.classList.toggle("has-error", !isValid);
        if (!isValid) valid = false;
      });

      const helpChecked =
        form.querySelectorAll('input[name="help_with[]"]:checked').length > 0;
      helpWithGroup.classList.toggle("has-error", !helpChecked);
      if (!helpChecked) valid = false;

      if (
        evidenceInput.files &&
        evidenceInput.files.length > 0 &&
        !validateFileSizes()
      ) {
        evidenceGroup.classList.add("has-error");
        valid = false;
      }

      if (!hasSignature) {
        signatureGroup.classList.add("has-error");
        valid = false;
      }

      const termsRow = document.getElementById("terms-row");
      const agreeTerms = document.getElementById(
        "agree-terms"
      ) as HTMLInputElement | null;
      if (!agreeTerms || !agreeTerms.checked) {
        termsRow?.classList.add("has-error");
        valid = false;
      } else {
        termsRow?.classList.remove("has-error");
      }

      if (!valid) {
        showResultModal(
          "error",
          "Incomplete Form",
          !hasSignature
            ? "Your handwritten signature is required. Please click 'Draw Signature' to sign the agreement before submitting."
            : !(agreeTermsEl as HTMLInputElement)?.checked
            ? "Please confirm the legal agreement checkbox before submitting."
            : "Please review and complete all required fields highlighted in red before submitting."
        );
        const firstError = form.querySelector(".has-error");
        if (firstError) {
          firstError.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return;
      }

      const formData = new FormData(form);
      if (hasSignature && signatureInput.value) {
        formData.set("signature", signatureInput.value);
      }

      submitBtn.disabled = true;
      submitBtn.classList.add("is-loading");
      submitBtn.textContent = "Submitting Agreement...";

      fetch("/api/submit-agreement", {
        method: "POST",
        body: formData,
      })
        .then((response) =>
          response
            .json()
            .catch(() => ({}))
            .then((data) => ({ ok: response.ok, data }))
        )
        .then((result) => {
          if (result.ok && result.data.success) {
            showResultModal(
              "success",
              "Agreement Submitted Successfully!",
              result.data.message ||
                "Thank you! Your onboarding agreement, handwritten signature, and evidence files have been securely received. Our compliance team has been notified and will be in touch with you shortly."
            );
            // Insert top persistent banner above form
            let topBanner = document.getElementById("form-success-banner");
            if (!topBanner) {
              topBanner = document.createElement("div");
              topBanner.id = "form-success-banner";
              topBanner.style.cssText =
                "margin-bottom: 24px; padding: 18px 24px; border-radius: 14px; background: rgba(0, 209, 255, 0.12); border: 1px solid rgba(0, 209, 255, 0.35); color: #EEF3FA; font-size: 14px; line-height: 1.6; display: flex; align-items: flex-start; gap: 14px;";
              form.parentNode?.insertBefore(topBanner, form);
            }
            topBanner.innerHTML = `
              <div style="width: 28px; height: 28px; border-radius: 50%; background: #00D1FF; color: #03112E; font-weight: 800; font-size: 16px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px;">✓</div>
              <div>
                <strong style="color: #00D1FF; font-size: 15px; display: block; margin-bottom: 4px;">Agreement Submitted Successfully</strong>
                Your onboarding agreement and signature were delivered to our compliance team. A confirmation record has been logged.
              </div>
            `;
            form.reset();
            syncPreviewFromData("");
            renderFileList();
            helpWithGroup.classList.remove("has-error");
            evidenceGroup.classList.remove("has-error");
            termsRow?.classList.remove("has-error");
            topBanner.scrollIntoView({ behavior: "smooth", block: "center" });
          } else {
            showResultModal(
              "error",
              "Submission Failed",
              result.data?.message || "Something went wrong while submitting. Please try again."
            );
          }
        })
        .catch(() => {
          showResultModal(
            "error",
            "Connection Error",
            "Unable to reach the server. Please check your internet connection and try again."
          );
        })
        .finally(() => {
          submitBtn.disabled = false;
          submitBtn.classList.remove("is-loading");
          submitBtn.textContent = "Submit Agreement";
        });
    };

    form.addEventListener("submit", onFormSubmit);

    form.querySelectorAll("input, textarea, select").forEach((input) => {
      input.addEventListener("input", () => {
        input.closest(".form-group")?.classList.remove("has-error");
      });
      input.addEventListener("change", () => {
        input.closest(".form-group")?.classList.remove("has-error");
      });
    });

    const agreeTermsEl = document.getElementById("agree-terms");
    const onAgreeChange = () => {
      document.getElementById("terms-row")?.classList.remove("has-error");
    };
    agreeTermsEl?.addEventListener("change", onAgreeChange);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      form.removeEventListener("submit", onFormSubmit);
      evidenceInput.removeEventListener("change", onEvidenceChange);
      agreeTermsEl?.removeEventListener("change", onAgreeChange);
      document.body.classList.remove("signature-modal-open");
    };
  }, []);

  return null;
}

