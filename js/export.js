// ============================================================
// EXPORT & REPORTING ENGINE
// Native Excel (.xlsx) via SheetJS & Landscape PDF / Print
// ============================================================

(function() {
  'use strict';

  window.openExportModal = function(type) {
    const modal = document.getElementById('exportModal');
    if (!modal) return;
    window.currentExportType = type; // 'excel' or 'pdf'
    
    const titleEl = document.getElementById('exportModalTitle');
    const descEl = document.getElementById('exportModalDesc');
    const actionBtn = document.getElementById('exportConfirmBtn');

    if (type === 'excel') {
      if (titleEl) titleEl.textContent = '📊 تصدير كشف الحسابات بصيغة Excel (.xlsx)';
      if (descEl) descEl.textContent = 'سيتم إنشاء ملف مايكروسوفت إكسيل رسمي ملون ومعتمد يفتح مباشرة بدون أي رسائل تحذير.';
      if (actionBtn) actionBtn.textContent = 'بدء تنزيل ملف الإكسيل';
    } else {
      if (titleEl) titleEl.textContent = '📄 حفظ كـ PDF / طباعة الكشف';
      if (descEl) descEl.textContent = 'سيتم فتح نافذة الطباعة المجهزة بالعرض (Landscape A4) مع ضبط الهوامش وتكرار العناوين.';
      if (actionBtn) actionBtn.textContent = 'فتح نافذة الطباعة / الحفظ PDF';
    }

    modal.classList.add('active');
  };

  window.closeExportModal = function() {
    const modal = document.getElementById('exportModal');
    if (modal) modal.classList.remove('active');
  };

  window.executeExport = function() {
    const scopeRadio = document.querySelector('input[name="exportScope"]:checked');
    const scope = scopeRadio ? scopeRadio.value : 'filtered';
    const type = window.currentExportType || 'excel';

    window.closeExportModal();

    if (type === 'excel') {
      exportToExcel(scope);
    } else {
      exportToPrint(scope);
    }
  };

  function getRoomsForExport(scope) {
    if (scope === 'filtered' && window.getFilteredRooms) {
      return window.getFilteredRooms();
    }
    return window.getAllRooms ? window.getAllRooms() : [];
  }

  function exportToExcel(scope) {
    const rooms = getRoomsForExport(scope);
    if (!rooms || rooms.length === 0) {
      alert('لا توجد بيانات متاحة للتصدير.');
      return;
    }

    if (typeof XLSX === 'undefined') {
      alert('مكتبة SheetJS غير محملة. يرجى التحقق من اتصال الملفات.');
      return;
    }

    // Build data array of arrays (AOA)
    const aoa = [];

    // Title Row
    aoa.push(['منظومة التحصيل والمطابقة العقارية — كشف التحصيل والمطابقة الشامل (أكتوبر 2026)']);
    aoa.push([`تاريخ الاستخراج: 21 أكتوبر 2026 | إجمالي الوحدات المعروضة: ${rooms.length} وحدة`]);
    aoa.push([]);

    // KPI Summary Header
    const totPaid = rooms.reduce((acc, r) => acc + (r.paid || 0), 0);
    const totEffective = rooms.reduce((acc, r) => acc + (r.effectiveRent || 0), 0);
    const totRem = rooms.reduce((acc, r) => acc + (r.remaining || 0), 0);
    const countPaid = rooms.filter(r => r.status === 'تم التحصيل').length;
    const countUnpaid = rooms.filter(r => r.status === 'لم يتم التحصيل').length;
    const countVacant = rooms.filter(r => r.status === 'خالي' || r.statusCode === 'vacant').length;

    aoa.push([
      `المحصل الفعلي: ${totPaid.toLocaleString()} د.إ`,
      `المستهدف التأجيري: ${totEffective.toLocaleString()} د.إ`,
      `المتبقي المطلوب: ${totRem.toLocaleString()} د.إ`,
      `المسددة بالكامل: ${countPaid}`,
      `غير المسددة: ${countUnpaid}`,
      `الشواغر: ${countVacant}`
    ]);
    aoa.push([]);

    // Table Column Headers
    const headers = [
      'م', 'رقم الغرفة', 'القسم', 'اسم المستأجر', 'رقم الهاتف',
      'إيجار العقد', 'الخصم المعتمد', 'الإيجار الفعلي', 'المحصل الفعلي',
      'المتبقي المطلوب', 'حالة السداد', 'تاريخ الاستحقاق', 'حالة الاستحقاق',
      'عدد الإيصالات', 'مستندات الإيصالات', 'ملاحظات التدقيق'
    ];
    aoa.push(headers);

    // Data rows
    let seq = 1;
    let sumContract = 0, sumDiscount = 0, sumEffective = 0, sumPaid = 0, sumRem = 0;

    rooms.forEach(r => {
      const contract = r.contractRent || r.rent || 0;
      const discount = r.hasDiscount ? (r.discountAmount || 0) : 0;
      const effective = r.effectiveRent || (contract - discount);
      const paid = r.paid || 0;
      const rem = r.remaining || 0;

      sumContract += contract;
      sumDiscount += discount;
      sumEffective += effective;
      sumPaid += paid;
      sumRem += rem;

      const dueDayStr = r.dueDay > 0 ? `يوم ${r.dueDay}` : '-';
      const dueStatusStr = r.status === 'تم التحصيل' ? 'مسدد' : (r.isDueUntil16 ? 'مستحق حالياً' : 'قادم');
      const recList = (r.receipts && r.receipts.length > 0) ? r.receipts.join(' | ') : '-';

      aoa.push([
        seq++,
        r.room || '-',
        r.section || '-',
        r.tenant || '-',
        r.phone ? `'${r.phone}` : '-',
        contract,
        discount,
        effective,
        paid,
        rem,
        r.status || '-',
        dueDayStr,
        dueStatusStr,
        r.receipts ? r.receipts.length : 0,
        recList,
        r.auditNote || '-'
      ]);
    });

    // Total Row
    aoa.push([
      'الإجمالي العام', '', '', '', '',
      sumContract, sumDiscount, sumEffective, sumPaid, sumRem,
      '', '', '', '', '', ''
    ]);

    // Create workbook & worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Set RTL
    if (!ws['!views']) ws['!views'] = [];
    ws['!views'].push({ rightToLeft: true });

    // Set Column Widths
    ws['!cols'] = [
      { wch: 6 },  // Seq
      { wch: 12 }, // Room
      { wch: 8 },  // Section
      { wch: 26 }, // Tenant
      { wch: 14 }, // Phone
      { wch: 13 }, // Contract
      { wch: 13 }, // Discount
      { wch: 13 }, // Effective
      { wch: 13 }, // Paid
      { wch: 13 }, // Remaining
      { wch: 14 }, // Status
      { wch: 14 }, // Due Date
      { wch: 14 }, // Due Status
      { wch: 12 }, // Receipt Count
      { wch: 35 }, // Receipts
      { wch: 45 }  // Audit Notes
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'كشف التحصيل أكتوبر 2026');

    const fileName = scope === 'filtered' 
      ? 'كشف_تحصيل_الإيجارات_المحدد_أكتوبر_2026.xlsx'
      : 'كشف_التحصيل_والمطابقة_الشامل_المعتمد_أكتوبر_2026.xlsx';

    XLSX.writeFile(wb, fileName);
  }

  function exportToPrint(scope) {
    const rooms = getRoomsForExport(scope);
    const printArea = document.getElementById('printReportContainer');
    if (!printArea) return;

    let seq = 1;
    let sumContract = 0, sumDiscount = 0, sumEffective = 0, sumPaid = 0, sumRem = 0;
    let countPaid = 0, countUnpaid = 0, countVacant = 0;

    const rowsHtml = rooms.map(r => {
      const contract = r.contractRent || r.rent || 0;
      const discount = r.hasDiscount ? (r.discountAmount || 0) : 0;
      const effective = r.effectiveRent || (contract - discount);
      const paid = r.paid || 0;
      const rem = r.remaining || 0;

      sumContract += contract;
      sumDiscount += discount;
      sumEffective += effective;
      sumPaid += paid;
      sumRem += rem;

      if (r.status === 'تم التحصيل') countPaid++;
      else if (r.status === 'لم يتم التحصيل') countUnpaid++;
      else if (r.status === 'خالي' || r.statusCode === 'vacant') countVacant++;

      const statusClass = r.status === 'تم التحصيل' ? 'print-st-paid' : 
                         (r.status === 'سداد جزئي' ? 'print-st-part' : 
                         (r.status === 'خالي' ? 'print-st-vac' : 'print-st-unpaid'));

      return `
        <tr>
          <td style="text-align:center;">${seq++}</td>
          <td style="text-align:center; font-weight:700;">${r.room}</td>
          <td style="text-align:center;">${r.section}</td>
          <td style="font-weight:600;">${r.tenant}</td>
          <td style="text-align:center; direction:ltr;">${r.phone || '-'}</td>
          <td style="text-align:center;">${contract.toLocaleString()}</td>
          <td style="text-align:center;">${discount > 0 ? discount.toLocaleString() : '-'}</td>
          <td style="text-align:center; font-weight:700;">${effective.toLocaleString()}</td>
          <td style="text-align:center; font-weight:700; color:#166534;">${paid > 0 ? paid.toLocaleString() : '0'}</td>
          <td style="text-align:center; font-weight:700; color:${rem > 0 ? '#991b1b' : '#64748b'};">${rem > 0 ? rem.toLocaleString() : '0'}</td>
          <td style="text-align:center;"><span class="${statusClass}">${r.status}</span></td>
          <td style="text-align:center;">${r.dueDay > 0 ? 'يوم ' + r.dueDay : '-'}</td>
          <td style="font-size:7.5pt;">${(r.receipts && r.receipts.length > 0) ? r.receipts.join('<br>') : '-'}</td>
          <td style="font-size:7.5pt; text-align:right;">${r.auditNote || '-'}</td>
        </tr>
      `;
    }).join('');

    printArea.innerHTML = `
      <div class="print-page">
        <div class="print-header">
          <div class="print-title">منظومة التحصيل والمطابقة العقارية — كشف التحصيل المعتمد</div>
          <div class="print-subtitle">تاريخ الاستخراج: 21 أكتوبر 2026 | الوحدات المعروضة: ${rooms.length} وحدة | مقاس A4 أفقي</div>
        </div>

        <div class="print-kpi-banner">
          <div class="print-kpi-item print-kpi-green">المحصل الفعلي: <strong>${sumPaid.toLocaleString()} د.إ</strong></div>
          <div class="print-kpi-item print-kpi-blue">المستهدف التأجيري: <strong>${sumEffective.toLocaleString()} د.إ</strong></div>
          <div class="print-kpi-item print-kpi-red">المتبقي المطلوب: <strong>${sumRem.toLocaleString()} د.إ</strong></div>
          <div class="print-kpi-item">المسددة: <strong>${countPaid}</strong> | غير المسددة: <strong>${countUnpaid}</strong> | الشواغر: <strong>${countVacant}</strong></div>
        </div>

        <table class="print-table">
          <thead>
            <tr>
              <th>م</th><th>الغرفة</th><th>القسم</th><th>المستأجر</th><th>الهاتف</th>
              <th>العقد</th><th>الخصم</th><th>الفعلي</th><th>المحصل</th><th>المتبقي</th>
              <th>الحالة</th><th>الاستحقاق</th><th>الإيصالات</th><th>الملاحظات</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr class="print-tot-row">
              <td colspan="5" style="text-align:center; font-weight:700;">الإجمالي العام</td>
              <td style="text-align:center;">${sumContract.toLocaleString()}</td>
              <td style="text-align:center;">${sumDiscount.toLocaleString()}</td>
              <td style="text-align:center;">${sumEffective.toLocaleString()}</td>
              <td style="text-align:center;">${sumPaid.toLocaleString()}</td>
              <td style="text-align:center;">${sumRem.toLocaleString()}</td>
              <td colspan="4"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    window.print();
  }

})();
