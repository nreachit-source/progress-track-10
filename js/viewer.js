// ============================================================
// RECEIPT & CONTRACT VIEWER MODAL ENGINE (VERCEL & CLOUD READY)
// Supports High-Resolution Images & PDFs with Zoom, Rotate, Blob Download
// ============================================================

(function() {
  'use strict';

  let currentScale = 1;
  let currentRotation = 0;
  let activeReceipt = null;
  let activeDocType = 'receipt';

  window.getActiveReceipt = () => activeReceipt;

  // Canonical Receipt URL Resolver
  window.getReceiptUrl = function(filename) {
    if (!filename) return '';
    if (filename.startsWith('data:') || filename.startsWith('http://') || filename.startsWith('https://')) {
      return filename;
    }
    const cleanName = filename.replace(/^receipts[\/\\]/, '');
    return 'receipts/' + cleanName;
  };

  // Canonical Contract URL Resolver
  window.getContractUrl = function(filename) {
    if (!filename) return '';
    if (filename.startsWith('data:') || filename.startsWith('http://') || filename.startsWith('https://')) {
      return filename;
    }
    const cleanName = filename.replace(/^contracts[\/\\]/, '');
    return 'contracts/' + cleanName;
  };

  // Open Receipt Modal
  window.openReceiptModal = function(receiptFile, roomData) {
    activeReceipt = receiptFile;
    activeDocType = 'receipt';
    currentScale = 1;
    currentRotation = 0;

    const modal = document.getElementById('receiptViewerModal');
    const container = document.getElementById('viewerMediaContainer');
    const titleEl = document.getElementById('viewerModalTitle');
    const infoEl = document.getElementById('viewerModalMeta');
    const downloadBtn = document.getElementById('viewerDownloadBtn');

    if (!modal || !container) return;

    const isPdf = receiptFile.toLowerCase().endsWith('.pdf');
    const fileUrl = window.getReceiptUrl(receiptFile);
    const embeddedData = (window.APP_DATA && window.APP_DATA.images) ? window.APP_DATA.images[receiptFile] : null;

    if (titleEl) {
      titleEl.innerHTML = `🧾 معاينة إيصال التحصيل: <strong>${receiptFile}</strong>`;
    }

    if (downloadBtn) {
      downloadBtn.innerHTML = '⬇️ تنزيل إيصال السداد';
      downloadBtn.style.background = '#059669';
      downloadBtn.onclick = function(e) {
        e.preventDefault();
        window.downloadDocument(activeReceipt, 'receipt');
      };
    }

    if (infoEl && roomData) {
      infoEl.innerHTML = `
        <div class="viewer-meta-badge">الغرفة: <strong>${roomData.room || '-'}</strong> (قسم ${roomData.section || '-'})</div>
        <div class="viewer-meta-badge">المستأجر: <strong>${roomData.tenant || '-'}</strong></div>
        <div class="viewer-meta-badge">الإيجار: <strong>${(roomData.effectiveRent || roomData.rent || 0).toLocaleString()} د.إ</strong></div>
        <div class="viewer-meta-badge">المحصل: <strong style="color: #4ade80;">${(roomData.paid || 0).toLocaleString()} د.إ</strong></div>
      `;
    }

    // Display loading state
    container.innerHTML = `
      <div id="viewerLoadingSpinner" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 320px; color: #94a3b8;">
        <div style="width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.1); border-top-color: #10b981; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 12px;"></div>
        <span style="font-size: 13px; font-weight: 600;">جارٍ تحميل مستند الإيصال...</span>
      </div>
    `;

    if (isPdf) {
      document.getElementById('viewerControlsGroup').style.display = 'none';
      const iframe = document.createElement('iframe');
      iframe.className = 'viewer-pdf-frame';
      iframe.src = embeddedData || fileUrl;

      iframe.onload = function() {
        const spinner = document.getElementById('viewerLoadingSpinner');
        if (spinner) spinner.style.display = 'none';
      };

      container.appendChild(iframe);
    } else {
      document.getElementById('viewerControlsGroup').style.display = 'flex';
      const img = document.createElement('img');
      img.id = 'viewerActiveImage';
      img.className = 'viewer-image';
      img.alt = receiptFile;
      img.style.display = 'none';
      img.style.transform = `scale(${currentScale}) rotate(${currentRotation}deg)`;

      img.onload = function() {
        const spinner = document.getElementById('viewerLoadingSpinner');
        if (spinner) spinner.style.display = 'none';
        img.style.display = 'block';
      };

      img.onerror = function() {
        if (embeddedData && img.src !== embeddedData) {
          console.log('Network image failed, falling back to embedded asset:', receiptFile);
          img.src = embeddedData;
          return;
        }

        const spinner = document.getElementById('viewerLoadingSpinner');
        if (spinner) spinner.style.display = 'none';

        container.innerHTML = `
          <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:340px; color:#cbd5e1; text-align:center; padding:24px; background:rgba(239, 68, 68, 0.05); border-radius:12px; border:1px dashed rgba(239, 68, 68, 0.3);">
            <span style="font-size:48px; margin-bottom:12px;">📑</span>
            <span style="font-size:16px; font-weight:700; color:#fca5a5;">تعذر عرض صورة الإيصال</span>
            <span style="font-size:12px; color:#94a3b8; margin:8px 0 16px 0;">اسم الملف: <code>${receiptFile}</code></span>
            <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
              <button class="btn-ctrl" style="background:#2563eb; cursor:pointer;" onclick="window.downloadDocument('${receiptFile}', 'receipt')">⬇️ تنزيل المستند</button>
              <a class="btn-ctrl" style="background:#475569; text-decoration:none; cursor:pointer;" href="${fileUrl}" target="_blank">↗️ فتح الرابط المباشر</a>
            </div>
          </div>
        `;
      };

      img.src = embeddedData || fileUrl;
      container.appendChild(img);
    }

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  // Open Contract Modal
  window.openContractModal = function(contractFile, roomData) {
    activeReceipt = contractFile;
    activeDocType = 'contract';
    currentScale = 1;
    currentRotation = 0;

    const modal = document.getElementById('receiptViewerModal');
    const container = document.getElementById('viewerMediaContainer');
    const titleEl = document.getElementById('viewerModalTitle');
    const infoEl = document.getElementById('viewerModalMeta');
    const downloadBtn = document.getElementById('viewerDownloadBtn');

    if (!modal || !container) return;

    const fileUrl = window.getContractUrl(contractFile);
    const embeddedData = (window.APP_DATA && window.APP_DATA.images) ? window.APP_DATA.images[contractFile] : null;

    if (titleEl) {
      titleEl.innerHTML = `📄 وثيقة عقد الإيجار: <strong>غرفة ${roomData ? roomData.room : contractFile}</strong>`;
    }

    if (downloadBtn) {
      downloadBtn.innerHTML = '⬇️ تنزيل وثيقة العقد (JPG)';
      downloadBtn.style.background = '#2563eb';
      downloadBtn.onclick = function(e) {
        e.preventDefault();
        window.downloadDocument(activeReceipt, 'contract');
      };
    }

    if (infoEl && roomData) {
      const isOutdated = roomData.isContractOutdated;
      const statusBadge = isOutdated 
        ? '<span style="color:#ef4444; font-weight:800; background:rgba(239,68,68,0.15); padding:2px 8px; border-radius:6px;">🚨 عقد منتهي الصلاحية يحتاج لتحديث</span>' 
        : '<span style="color:#10b981; font-weight:800; background:rgba(16,185,129,0.15); padding:2px 8px; border-radius:6px;">✅ عقد سارٍ</span>';

      infoEl.innerHTML = `
        <div class="viewer-meta-badge">الغرفة: <strong>${roomData.room || '-'}</strong> (قسم ${roomData.section || '-'})</div>
        <div class="viewer-meta-badge">المستأجر: <strong>${roomData.tenant || '-'}</strong></div>
        <div class="viewer-meta-badge">قيمة العقد: <strong>${(roomData.contractMonthlyRent || roomData.rent || 0).toLocaleString()} د.إ/شهر</strong></div>
        <div class="viewer-meta-badge">المدة: <strong>${roomData.contractStartDate || '-'} ⬅️ ${roomData.contractEndDate || '-'}</strong></div>
        <div class="viewer-meta-badge">الحالة: ${statusBadge}</div>
      `;
    }

    // Display loading state
    container.innerHTML = `
      <div id="viewerLoadingSpinner" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 320px; color: #94a3b8;">
        <div style="width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.1); border-top-color: #6366f1; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 12px;"></div>
        <span style="font-size: 13px; font-weight: 600;">جارٍ تحميل وثيقة العقد...</span>
      </div>
    `;

    document.getElementById('viewerControlsGroup').style.display = 'flex';
    const img = document.createElement('img');
    img.id = 'viewerActiveImage';
    img.className = 'viewer-image';
    img.alt = contractFile;
    img.style.display = 'none';
    img.style.transform = `scale(${currentScale}) rotate(${currentRotation}deg)`;

    img.onload = function() {
      const spinner = document.getElementById('viewerLoadingSpinner');
      if (spinner) spinner.style.display = 'none';
      img.style.display = 'block';
    };

    img.onerror = function() {
      if (embeddedData && img.src !== embeddedData) {
        console.log('Contract image failed, falling back to embedded asset:', contractFile);
        img.src = embeddedData;
        return;
      }

      const spinner = document.getElementById('viewerLoadingSpinner');
      if (spinner) spinner.style.display = 'none';

      container.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:340px; color:#cbd5e1; text-align:center; padding:24px; background:rgba(239, 68, 68, 0.05); border-radius:12px; border:1px dashed rgba(239, 68, 68, 0.3);">
          <span style="font-size:48px; margin-bottom:12px;">📄</span>
          <span style="font-size:16px; font-weight:700; color:#fca5a5;">تعذر عرض وثيقة العقد</span>
          <span style="font-size:12px; color:#94a3b8; margin:8px 0 16px 0;">اسم الملف: <code>${contractFile}</code></span>
          <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
            <button class="btn-ctrl" style="background:#4f46e5; cursor:pointer;" onclick="window.downloadDocument('${contractFile}', 'contract')">⬇️ تنزيل وثيقة العقد</button>
            <a class="btn-ctrl" style="background:#475569; text-decoration:none; cursor:pointer;" href="${fileUrl}" target="_blank">↗️ فتح الرابط المباشر</a>
          </div>
        </div>
      `;
    };

    img.src = embeddedData || fileUrl;
    container.appendChild(img);

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  window.closeReceiptModal = function() {
    const modal = document.getElementById('receiptViewerModal');
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = '';
  };

  window.viewerZoom = function(delta) {
    const img = document.getElementById('viewerActiveImage');
    if (!img) return;
    currentScale = Math.min(Math.max(0.4, currentScale + delta), 4.0);
    applyViewerTransform(img);
  };

  window.viewerRotate = function(angle) {
    const img = document.getElementById('viewerActiveImage');
    if (!img) return;
    currentRotation = (currentRotation + angle) % 360;
    applyViewerTransform(img);
  };

  window.viewerReset = function() {
    const img = document.getElementById('viewerActiveImage');
    if (!img) return;
    currentScale = 1;
    currentRotation = 0;
    applyViewerTransform(img);
  };

  function applyViewerTransform(img) {
    img.style.transform = `scale(${currentScale}) rotate(${currentRotation}deg)`;
  }

  // ============================================================
  // ROBUST BLOB-BASED DOWNLOAD FUNCTION (RECEIPTS & CONTRACTS)
  // ============================================================
  window.downloadDocument = async function(fileName, type) {
    if (!fileName) fileName = activeReceipt;
    if (!fileName) return;

    const fileUrl = (type === 'contract') ? window.getContractUrl(fileName) : window.getReceiptUrl(fileName);
    const embeddedData = (window.APP_DATA && window.APP_DATA.images) ? window.APP_DATA.images[fileName] : null;

    function saveBlob(blob, name) {
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }, 1000);
    }

    if (embeddedData) {
      try {
        const parts = embeddedData.split(',');
        const mime = parts[0].match(/:(.*?);/)[1];
        const bstr = atob(parts[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], { type: mime });
        saveBlob(blob, fileName);
        return;
      } catch (e) {
        console.warn('Embedded blob download error, trying fetch:', e);
      }
    }

    try {
      const response = await fetch(fileUrl);
      if (response.ok) {
        const blob = await response.blob();
        saveBlob(blob, fileName);
        return;
      }
    } catch (e) {
      console.warn('Fetch download failed, using direct anchor fallback:', e);
    }

    const directLink = document.createElement('a');
    directLink.href = fileUrl;
    directLink.download = fileName;
    directLink.target = '_blank';
    document.body.appendChild(directLink);
    directLink.click();
    setTimeout(() => document.body.removeChild(directLink), 500);
  };

  // Backwards compatibility alias
  window.downloadReceipt = function(fileName) {
    return window.downloadDocument(fileName, activeDocType || 'receipt');
  };

  // Keyboard shortcut listener
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      window.closeReceiptModal();
    }
  });

})();
