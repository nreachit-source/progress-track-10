// ============================================================
// REAL ESTATE COLLECTION & AUDIT APPLICATION ENGINE
// Read-Only Real Estate Dashboard for GitHub & Offline Deployment
// Enhanced with Dual Contract & Receipt Verification
// ============================================================

(function() {
  'use strict';

  let allRooms = [];
  let allReceipts = [];
  let allContracts = [];
  let filteredRooms = [];

  let currentSection = 'all'; // 'all', 'A', 'B', 'C'
  let currentFilter = 'all';   // 'all', 'paid', 'unpaid', 'partial', 'vacant', 'due', 'receipts', 'discount', 'contract_paid', 'contract_no_receipt', 'contract_outdated', 'no_contract'
  let currentSearch = '';
  let currentView = 'cards';   // 'cards', 'gallery', 'table'
  let currentSort = 'due_asc'; // 'due_asc', 'due_desc', 'room_asc', 'room_desc', 'remaining_desc', 'rent_desc'
  let currentDueDayFilter = 'all'; // 'all' or day number (1..31) or 'vacant'

  const CURRENT_DAY = 1; // Month 10 (October 2026) Collection Cycle

  window.getAllRooms = () => allRooms;
  window.getFilteredRooms = () => filteredRooms;
  window.getAllContracts = () => allContracts;

  window.handleThumbError = function(imgEl, filename, isContract) {
    if (window.APP_DATA && window.APP_DATA.images && window.APP_DATA.images[filename]) {
      imgEl.src = window.APP_DATA.images[filename];
      imgEl.onerror = null;
    } else {
      const isCon = isContract || (filename && filename.includes('-2026.'));
      const label = isCon ? '📄 صورة العقد' : '🧾 صورة الإيصال';
      const bg = isCon ? '%231e3a8a' : '%23064e3b';
      const textCol = isCon ? '%2393c5fd' : '%236ee7b7';
      imgEl.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="95" viewBox="0 0 120 95"><rect width="120" height="95" fill="${bg}"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="12" font-weight="bold" fill="${textCol}" font-family="sans-serif">${label}</text></svg>`;
      imgEl.onerror = null;
    }
  };

  // Initialize Application
  window.initApplication = async function() {
    console.log('Initializing Real Estate Dashboard...');

    // Load data from window.APP_DATA (offline / file://) or fetch (HTTP/GitHub)
    if (window.APP_DATA && window.APP_DATA.rooms && window.APP_DATA.rooms.length > 0) {
      allRooms = window.APP_DATA.rooms;
      allReceipts = window.APP_DATA.receipts || [];
      allContracts = window.APP_DATA.contracts || [];
      console.log(`Loaded ${allRooms.length} rooms and ${allContracts.length} contracts from static bundle.`);
    } else {
      try {
        const res = await fetch('data/rooms.json');
        allRooms = await res.json();
        
        try {
          const resRec = await fetch('data/receipts.json');
          allReceipts = await resRec.json();
        } catch (e) {
          console.warn('Could not fetch receipts.json');
        }

        try {
          const resCon = await fetch('data/contracts.json');
          allContracts = await resCon.json();
        } catch (e) {
          console.warn('Could not fetch contracts.json');
        }

        console.log(`Fetched ${allRooms.length} rooms from data/rooms.json.`);
      } catch (err) {
        console.error('Failed to fetch data, trying window.APP_DATA fallback:', err);
        if (window.APP_DATA) {
          allRooms = window.APP_DATA.rooms || [];
          allReceipts = window.APP_DATA.receipts || [];
          allContracts = window.APP_DATA.contracts || [];
        }
      }
    }

    setupEventListeners();
    renderDueDaysBar();
    applyFilterAndRender();
  };

  function setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('roomSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        currentSearch = e.target.value.trim().toLowerCase();
        applyFilterAndRender();
      });
    }

    // Section tabs
    document.querySelectorAll('.section-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.section-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentSection = btn.dataset.section;
        currentDueDayFilter = 'all'; // Reset day filter on section change
        renderDueDaysBar();
        applyFilterAndRender();
      });
    });

    // Filter pills
    document.querySelectorAll('.filter-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        applyFilterAndRender();
      });
    });

    // Sort order select
    const sortSelect = document.getElementById('sortOrderSelect');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        document.querySelectorAll('.quick-sort-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.sort === currentSort);
        });
        applyFilterAndRender();
      });
    }

    // Quick sort pills
    document.querySelectorAll('.quick-sort-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.quick-sort-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentSort = btn.dataset.sort;
        const sel = document.getElementById('sortOrderSelect');
        if (sel) sel.value = currentSort;
        applyFilterAndRender();
      });
    });

    // View tabs
    document.querySelectorAll('.view-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.view-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentView = btn.dataset.view;
        renderActiveView();
      });
    });
  }

  function renderDueDaysBar() {
    const listEl = document.getElementById('dueDaysList');
    if (!listEl) return;

    // Tally room counts per due day
    const dayCounts = {};
    let vacantCount = 0;
    let totalWithDay = 0;

    allRooms.forEach(r => {
      if (currentSection !== 'all' && r.section !== currentSection) return;
      const d = r.dueDay;
      if (r.statusCode === 'vacant' || r.status === 'خالي' || !d || d <= 0) {
        vacantCount++;
      } else {
        dayCounts[d] = (dayCounts[d] || 0) + 1;
        totalWithDay++;
      }
    });

    const sortedDays = Object.keys(dayCounts).map(Number).sort((a, b) => a - b);

    let html = `
      <button class="due-day-pill-btn ${currentDueDayFilter === 'all' ? 'active' : ''}" data-day="all" title="عرض كافة أيام الشهر مرتبة من 1 إلى 31">
        <span>🗓️ كل الأيام</span> <small>(${totalWithDay})</small>
      </button>
    `;

    sortedDays.forEach(day => {
      const cnt = dayCounts[day];
      const isAct = currentDueDayFilter === String(day);
      html += `
        <button class="due-day-pill-btn ${isAct ? 'active' : ''}" data-day="${day}" title="استحقاق يوم ${day} من الشهر (${cnt} غرفة)">
          <span>يوم ${day}</span> <small>(${cnt})</small>
        </button>
      `;
    });

    if (vacantCount > 0) {
      const isVacAct = currentDueDayFilter === 'vacant';
      html += `
        <button class="due-day-pill-btn ${isVacAct ? 'active' : ''}" data-day="vacant" title="الوحدات الشاغرة ومطبخ الخدمات">
          <span>🚪 شواغر</span> <small>(${vacantCount})</small>
        </button>
      `;
    }

    listEl.innerHTML = html;

    listEl.querySelectorAll('.due-day-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        listEl.querySelectorAll('.due-day-pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentDueDayFilter = btn.dataset.day;
        applyFilterAndRender();
      });
    });
  }

  function applyFilterAndRender() {
    filteredRooms = allRooms.filter(r => {
      // 1. Section Filter
      if (currentSection !== 'all' && r.section !== currentSection) {
        return false;
      }

      // 2. Specific Due Day Filter (from Due Days Navigator)
      if (currentDueDayFilter !== 'all') {
        if (currentDueDayFilter === 'vacant') {
          if (r.status !== 'خالي' && r.statusCode !== 'vacant') return false;
        } else {
          const d = parseInt(currentDueDayFilter, 10);
          if ((r.dueDay || 0) !== d) return false;
        }
      }

      // 3. Status / Category / Contract Filter
      if (currentFilter === 'paid' && r.status !== 'تم التحصيل') return false;
      if (currentFilter === 'unpaid' && r.status !== 'لم يتم التحصيل') return false;
      if (currentFilter === 'partial' && r.status !== 'سداد جزئي') return false;
      if (currentFilter === 'vacant' && (r.status !== 'خالي' && r.statusCode !== 'vacant')) return false;
      if (currentFilter === 'discount' && !r.hasDiscount) return false;
      if (currentFilter === 'receipts' && (!r.receipts || r.receipts.length === 0)) return false;
      if (currentFilter === 'contract_paid' && r.contractStatusCode !== 'contract_paid') return false;
      if (currentFilter === 'contract_no_receipt' && r.contractStatusCode !== 'contract_no_receipt') return false;
      if (currentFilter === 'contract_outdated' && (r.contractStatusCode !== 'contract_outdated' && !r.isContractOutdated)) return false;
      if (currentFilter === 'no_contract' && (r.contractStatusCode !== 'no_contract' && r.contractStatusCode !== 'vacant')) return false;
      if (currentFilter === 'due') {
        if (r.status === 'تم التحصيل' || r.status === 'خالي') return false;
        if ((r.dueDay || 0) > CURRENT_DAY) return false;
      }

      // 4. Search Query
      if (currentSearch) {
        const q = currentSearch;
        const roomMatch = (r.room || '').toLowerCase().includes(q);
        const tenantMatch = (r.tenant || '').toLowerCase().includes(q);
        const phoneMatch = (r.phone || '').includes(q);
        const noteMatch = (r.auditNote || '').toLowerCase().includes(q);
        const commentMatch = (r.auditComment || '').toLowerCase().includes(q);
        const contractStatusMatch = (r.contractStatus || '').toLowerCase().includes(q);
        const contractFileMatch = (r.contractFile || '').toLowerCase().includes(q);
        const recMatch = (r.receipts || []).some(rc => rc.toLowerCase().includes(q));
        if (!roomMatch && !tenantMatch && !phoneMatch && !noteMatch && !commentMatch && !contractStatusMatch && !contractFileMatch && !recMatch) {
          return false;
        }
      }

      return true;
    });

    // 5. Multi-Mode Sorting (Defaults to due date: 1, 2, 3... 31)
    filteredRooms.sort((a, b) => {
      if (currentSort === 'due_asc') {
        const da = (a.dueDay && a.dueDay > 0) ? a.dueDay : 999;
        const db = (b.dueDay && b.dueDay > 0) ? b.dueDay : 999;
        if (da !== db) return da - db;
        return (a.room || '').localeCompare(b.room || '', undefined, { numeric: true, sensitivity: 'base' });
      } else if (currentSort === 'due_desc') {
        const da = (a.dueDay && a.dueDay > 0) ? a.dueDay : -1;
        const db = (b.dueDay && b.dueDay > 0) ? b.dueDay : -1;
        if (da !== db) return db - da;
        return (a.room || '').localeCompare(b.room || '', undefined, { numeric: true, sensitivity: 'base' });
      } else if (currentSort === 'room_asc') {
        return (a.room || '').localeCompare(b.room || '', undefined, { numeric: true, sensitivity: 'base' });
      } else if (currentSort === 'room_desc') {
        return (b.room || '').localeCompare(a.room || '', undefined, { numeric: true, sensitivity: 'base' });
      } else if (currentSort === 'remaining_desc') {
        return (b.remaining || 0) - (a.remaining || 0);
      } else if (currentSort === 'rent_desc') {
        const ra = a.effectiveRent || a.rent || 0;
        const rb = b.effectiveRent || b.rent || 0;
        return rb - ra;
      }
      return 0;
    });

    updateDashboardKPIs();
    renderActiveView();
  }

  function updateDashboardKPIs() {
    let totContract = 0;
    let totTarget = 0;
    let totPaid = 0;
    let totRemaining = 0;

    let cntPaid = 0;
    let cntUnpaid = 0;
    let cntPartial = 0;
    let cntVacant = 0;
    let cntDiscount = 0;
    let cntWithReceipts = 0;
    let cntDueToday = 0;

    let cntContractPaid = 0;
    let cntContractNoReceipt = 0;
    let cntContractOutdated = 0;
    let cntNoContract = 0;

    allRooms.forEach(r => {
      const isVacant = (r.statusCode === 'vacant' || r.status === 'خالي');
      const paid = r.paid || 0;
      const contract = r.contractRent || r.rent || 0;
      const effective = r.effectiveRent || 0;
      const remaining = r.remaining || 0;

      totPaid += paid;

      if (isVacant) {
        cntVacant++;
      } else {
        totContract += contract;
        totTarget += effective;
        totRemaining += remaining;

        if (r.status === 'تم التحصيل') cntPaid++;
        else if (r.status === 'سداد جزئي') cntPartial++;
        else if (r.status === 'لم يتم التحصيل') cntUnpaid++;

        if (r.hasDiscount) cntDiscount++;
        if (remaining > 0 && (r.dueDay || 0) <= CURRENT_DAY) cntDueToday++;
      }

      if (r.receipts && r.receipts.length > 0) cntWithReceipts++;

      // Contract specific counts
      if (r.contractStatusCode === 'contract_paid') cntContractPaid++;
      else if (r.contractStatusCode === 'contract_no_receipt') cntContractNoReceipt++;
      else if (r.contractStatusCode === 'contract_outdated' || r.isContractOutdated) cntContractOutdated++;
      else cntNoContract++;
    });

    const rate = totTarget > 0 ? ((totPaid / totTarget) * 100).toFixed(1) : '0';

    // Update KPI Card Values
    const elTotPaid = document.getElementById('kpiTotalCollected');
    if (elTotPaid) elTotPaid.innerHTML = `${totPaid.toLocaleString()} <span style="font-size: 14px;">د.إ</span>`;

    const elTarget = document.getElementById('kpiTargetRent');
    if (elTarget) elTarget.innerHTML = `${totTarget.toLocaleString()} <span style="font-size: 14px;">د.إ</span>`;

    const elRemaining = document.getElementById('kpiTotalRemaining');
    if (elRemaining) elRemaining.innerHTML = `${totRemaining.toLocaleString()} <span style="font-size: 14px;">د.إ</span>`;

    const elRate = document.getElementById('kpiCollectionRate');
    if (elRate) elRate.innerHTML = `${rate}% <span style="font-size: 13px; font-weight: normal; color: #cbd5e1;">من المستهدف</span>`;

    const elCounts = document.getElementById('kpiCountsSummary');
    if (elCounts) {
      elCounts.innerHTML = `
        <span class="count-badge-green">${cntPaid} مسدد</span>
        <span class="count-badge-red">${cntUnpaid} غير مسدد</span>
        <span class="count-badge-amber">${cntContractNoReceipt} عقد بلا إيصال</span>
        <span class="count-badge-slate">${cntVacant} شاغر</span>
      `;
    }

    // Update Filter Pill Counters
    setCounter('cntAll', allRooms.length);
    setCounter('cntPaid', cntPaid);
    setCounter('cntUnpaid', cntUnpaid);
    setCounter('cntPartial', cntPartial);
    setCounter('cntVacant', cntVacant);
    setCounter('cntDue', cntDueToday);
    setCounter('cntReceipts', cntWithReceipts);
    setCounter('cntDiscount', cntDiscount);

    // Contract filter pill counters
    setCounter('cntContractPaid', cntContractPaid);
    setCounter('cntContractNoReceipt', cntContractNoReceipt);
    setCounter('cntContractOutdated', cntContractOutdated);
    setCounter('cntNoContract', cntNoContract);

    // Filter Result Summary Text
    const elResCount = document.getElementById('filterResultsCount');
    if (elResCount) {
      elResCount.textContent = `عرض ${filteredRooms.length} من أصل ${allRooms.length} وحدة`;
    }
  }

  function setCounter(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function renderActiveView() {
    const cardsContainer = document.getElementById('cardsViewContainer');
    const galleryContainer = document.getElementById('galleryViewContainer');
    const tableContainer = document.getElementById('tableViewContainer');

    if (cardsContainer) cardsContainer.style.display = currentView === 'cards' ? 'grid' : 'none';
    if (galleryContainer) galleryContainer.style.display = currentView === 'gallery' ? 'grid' : 'none';
    if (tableContainer) tableContainer.style.display = currentView === 'table' ? 'block' : 'none';

    if (currentView === 'cards') renderCardsView();
    else if (currentView === 'gallery') renderGalleryView();
    else if (currentView === 'table') renderTableView();
  }

  function renderCardsView() {
    const container = document.getElementById('cardsViewContainer');
    if (!container) return;

    if (filteredRooms.length === 0) {
      container.innerHTML = `
        <div class="empty-state-card">
          <div style="font-size: 48px; margin-bottom: 12px;">🔍</div>
          <div style="font-size: 16px; font-weight: 600; color: #cbd5e1;">لا توجد غرف مطابقة لخيارات البحث أو التصفية الحالية</div>
          <div style="font-size: 13px; color: #94a3b8; margin-top: 6px;">جرب تغيير القسم أو تصفية الحالة أو تفريغ خانة البحث</div>
        </div>
      `;
      return;
    }

    container.innerHTML = filteredRooms.map(r => {
      const isPaid = r.status === 'تم التحصيل';
      const isUnpaid = r.status === 'لم يتم التحصيل';
      const isPartial = r.status === 'سداد جزئي';
      const isVacant = r.status === 'خالي' || r.statusCode === 'vacant';

      let cardClass = 'room-card';
      let statusBadge = '';

      if (isPaid) {
        cardClass += ' card-paid';
        statusBadge = '<span class="st-badge st-paid">تم التحصيل ✅</span>';
      } else if (isPartial) {
        cardClass += ' card-partial';
        statusBadge = '<span class="st-badge st-partial">سداد جزئي ⏳</span>';
      } else if (isUnpaid) {
        cardClass += ' card-unpaid';
        statusBadge = '<span class="st-badge st-unpaid">لم يتم التحصيل ⚠️</span>';
      } else {
        cardClass += ' card-vacant';
        statusBadge = '<span class="st-badge st-vacant">شاغرة ⚪</span>';
      }

      // Contract Status Badge
      let contractBadge = '';
      if (r.contractStatusCode === 'contract_paid') {
        contractBadge = '<span class="st-badge st-contract-paid" title="عقد سارٍ ومسدد بإيصال">عقد سارٍ ومسدد ✅</span>';
      } else if (r.contractStatusCode === 'contract_no_receipt') {
        contractBadge = '<span class="st-badge st-contract-norec" title="يوجد عقد ولا يوجد إيصال">يوجد عقد ولا يوجد إيصال ⚠️</span>';
      } else if (r.contractStatusCode === 'contract_outdated' || r.isContractOutdated) {
        contractBadge = '<span class="st-badge st-contract-outdated" title="عقد منتهي الصلاحية يحتاج لتحديث">عقد يحتاج لتحديث 🚨</span>';
      } else if (r.contractStatusCode === 'vacant') {
        contractBadge = '<span class="st-badge st-vacant">شاغر ⚪</span>';
      } else {
        contractBadge = '<span class="st-badge st-contract-none">لا يوجد عقد ❌</span>';
      }

      const effectiveRent = r.effectiveRent || r.contractRent || r.rent || 0;
      const paidAmt = r.paid || 0;
      const remAmt = r.remaining || 0;

      // Safe JSON for inline onclick
      const safeRoom = JSON.stringify(r).replace(/"/g, '&quot;');

      // 1. Contract Visual Photo Card
      let contractDocHtml = '';
      if (r.contractFile) {
        const contractSrc = window.getContractUrl ? window.getContractUrl(r.contractFile) : ('contracts/' + r.contractFile);
        contractDocHtml = `
          <div class="doc-preview-card doc-contract" onclick='openContractModal("${r.contractFile}", ${safeRoom})' title="معاينة وتكبير صورة العقد">
            <div class="doc-preview-thumb">
              <img src="${contractSrc}" alt="${r.contractFile}" loading="lazy" onerror="window.handleThumbError(this, '${r.contractFile}', true)">
              <div class="doc-preview-overlay">🔍 تكبير العقد</div>
            </div>
            <div class="doc-preview-info">
              <div class="doc-preview-title">📄 وثيقة العقد</div>
              <div class="doc-preview-sub">${(r.contractMonthlyRent || r.rent).toLocaleString()} د.إ/شهر</div>
              <div class="doc-preview-dates">📅 ${r.contractStartDate || '-'} ⬅️ ${r.contractEndDate || '-'}</div>
            </div>
            <div class="doc-preview-footer">
              <span class="doc-status-tag ${r.isContractOutdated ? 'tag-outdated' : 'tag-valid'}">${r.isContractOutdated ? 'يحتاج لتحديث 🚨' : 'سارٍ ✅'}</span>
              <button class="doc-dl-btn" onclick="event.stopPropagation(); window.downloadDocument('${r.contractFile}', 'contract')" title="تحميل صورة العقد للجهاز">⬇️ تحميل</button>
            </div>
          </div>
        `;
      } else {
        contractDocHtml = `
          <div class="doc-preview-card doc-empty">
            <div class="doc-empty-icon">📄</div>
            <div class="doc-empty-text">لا يوجد عقد مسجل</div>
            <div class="doc-empty-sub">${r.statusCode === 'vacant' ? 'الوحدة شاغرة' : 'يلزم إبرام عقد'}</div>
          </div>
        `;
      }

      // 2. Receipt Visual Photo Card
      let receiptDocHtml = '';
      if (r.receipts && r.receipts.length > 0) {
        const firstRec = r.receipts[0];
        const isPdf = firstRec.toLowerCase().endsWith('.pdf');
        const recSrc = (window.APP_DATA && window.APP_DATA.images && window.APP_DATA.images[firstRec]) 
          ? window.APP_DATA.images[firstRec] 
          : (window.getReceiptUrl ? window.getReceiptUrl(firstRec) : ('receipts/' + firstRec));

        receiptDocHtml = `
          <div class="doc-preview-card doc-receipt" onclick='openReceiptModal("${firstRec}", ${safeRoom})' title="معاينة وتكبير إيصال السداد">
            <div class="doc-preview-thumb">
              ${isPdf 
                ? `<div class="doc-pdf-thumb"><span>📑 PDF</span><small>${firstRec}</small></div>` 
                : `<img src="${recSrc}" alt="${firstRec}" loading="lazy" onerror="window.handleThumbError(this, '${firstRec}', false)">`
              }
              <div class="doc-preview-overlay">🔍 تكبير الإيصال</div>
              ${r.receipts.length > 1 ? `<span class="doc-multi-badge">${r.receipts.length} إيصالات</span>` : ''}
            </div>
            <div class="doc-preview-info">
              <div class="doc-preview-title">🧾 إيصال السداد</div>
              <div class="doc-preview-sub" style="color:#34d399;">تم سداد: ${(r.paid || 0).toLocaleString()} د.إ</div>
              <div class="doc-preview-dates">${r.auditNote || 'إيصال مسجل ومطابق'}</div>
            </div>
            <div class="doc-preview-footer">
              <span class="doc-status-tag tag-paid">مسدد بإيصال ✅</span>
              <button class="doc-dl-btn" onclick="event.stopPropagation(); window.downloadDocument('${firstRec}', 'receipt')" title="تحميل صورة الإيصال للجهاز">⬇️ تحميل</button>
            </div>
          </div>
        `;
      } else {
        receiptDocHtml = `
          <div class="doc-preview-card doc-empty">
            <div class="doc-empty-icon">🧾</div>
            <div class="doc-empty-text">لا يوجد إيصال</div>
            <div class="doc-empty-sub">${r.paid > 0 ? 'مسدد بدون إيصال' : 'بانتظار التحصيل'}</div>
          </div>
        `;
      }

      const dualDocsHtml = `
        <div class="card-dual-docs">
          ${contractDocHtml}
          ${receiptDocHtml}
        </div>
      `;

      // Dual Action Buttons: [📄 عرض العقد] and [🧾 عرض الإيصال]
      let contractBtn = '';
      if (r.contractFile) {
        contractBtn = `<button class="btn-card-action btn-action-contract" onclick='openContractModal("${r.contractFile}", ${safeRoom})' title="معاينة وثيقة العقد: ${r.contractFile}">📄 عرض العقد</button>`;
      } else {
        contractBtn = `<button class="btn-card-action btn-action-disabled" disabled title="لا يوجد ملف عقد لهذه الغرفة">📄 لا يوجد عقد</button>`;
      }

      let receiptBtn = '';
      if (r.receipts && r.receipts.length > 0) {
        receiptBtn = `<button class="btn-card-action btn-action-receipt" onclick='openReceiptModal("${r.receipts[0]}", ${safeRoom})' title="معاينة إيصال التحصيل: ${r.receipts[0]}">🧾 عرض الإيصال (${r.receipts.length})</button>`;
      } else {
        receiptBtn = `<button class="btn-card-action btn-action-disabled" disabled title="لا يوجد إيصال مسدد">🧾 لا يوجد إيصال</button>`;
      }

      const dualActionsHtml = `
        <div class="card-dual-actions">
          ${contractBtn}
          ${receiptBtn}
        </div>
      `;

      // Discount tag
      const discountTag = r.hasDiscount 
        ? `<div class="card-discount-tag">خصم معتمد: ${r.discountAmount} د.إ (${r.discountReason || 'مخفض عن العقد'})</div>` 
        : '';

      // Audit Comment Box
      const auditCommentHtml = r.auditComment ? `
        <div class="card-audit-note" style="border-right: 3px solid ${r.isContractOutdated ? '#ef4444' : (r.contractStatusCode === 'contract_paid' ? '#10b981' : '#f59e0b')};">
          <div style="font-weight:700; color:#e2e8f0; margin-bottom:2px;">📌 حالة التدقيق: ${r.contractStatus || r.auditComment}</div>
          ${r.auditNote ? `<div style="color:#94a3b8; font-size:10.5px;">${r.auditNote}</div>` : ''}
        </div>
      ` : '';

      return `
        <div class="${cardClass}">
          <div class="card-header">
            <div class="card-room-number">
              <span class="room-prefix">غرفة</span>
              <strong>${r.room}</strong>
              <span class="sec-badge sec-${(r.section || 'A').toLowerCase()}">قسم ${r.section}</span>
              ${r.dueDay > 0 ? `<span class="card-due-day-chip">📅 يوم ${r.dueDay}</span>` : '<span class="card-due-day-chip chip-vacant">شاغرة</span>'}
            </div>
            <div style="display:flex; gap:6px; align-items:center;">
              ${contractBadge}
              ${statusBadge}
            </div>
          </div>

          <div class="card-tenant-area">
            <div class="tenant-name">${r.tenant || 'شاغرة'}</div>
            ${r.phone ? `<a class="tenant-phone" href="tel:${r.phone}">📞 0${r.phone}</a>` : ''}
          </div>

          <div class="card-financial-grid">
            <div class="fin-col">
              <div class="fin-lbl">الإيجار الفعلي</div>
              <div class="fin-val">${effectiveRent.toLocaleString()} <small>د.إ</small></div>
            </div>
            <div class="fin-col">
              <div class="fin-lbl">المحصل</div>
              <div class="fin-val fin-val-paid">${paidAmt.toLocaleString()} <small>د.إ</small></div>
            </div>
            <div class="fin-col">
              <div class="fin-lbl">المتبقي</div>
              <div class="fin-val fin-val-rem">${remAmt.toLocaleString()} <small>د.إ</small></div>
            </div>
          </div>

          ${discountTag}
          ${dualDocsHtml}

          <div class="card-due-row">
            <span>📅 موعد الاستحقاق:</span>
            <strong>${r.dueDay > 0 ? 'يوم ' + r.dueDay + ' من كل شهر' : 'غير محدد'}</strong>
          </div>

          ${dualActionsHtml}
          ${auditCommentHtml}
        </div>
      `;
    }).join('');
  }

  function renderGalleryView() {
    const container = document.getElementById('galleryViewContainer');
    if (!container) return;

    // Collect all receipts & contracts from filtered rooms
    const galleryItems = [];
    filteredRooms.forEach(r => {
      if (r.receipts && r.receipts.length > 0) {
        r.receipts.forEach(rc => {
          galleryItems.push({ type: 'receipt', file: rc, room: r });
        });
      }
      if (r.contractFile) {
        galleryItems.push({ type: 'contract', file: r.contractFile, room: r });
      }
    });

    if (galleryItems.length === 0) {
      container.innerHTML = `
        <div class="empty-state-card">
          <div style="font-size: 48px; margin-bottom: 12px;">🖼️</div>
          <div style="font-size: 16px; font-weight: 600; color: #cbd5e1;">لا توجد مستندات في النطاق المحدد حالياً</div>
          <div style="font-size: 13px; color: #94a3b8; margin-top: 6px;">اختر تصفية تحتوي على غرف مسددة أو مزودة بعقود وإيصالات</div>
        </div>
      `;
      return;
    }

    container.innerHTML = galleryItems.map(item => {
      const fileName = item.file;
      const r = item.room;
      const isContract = item.type === 'contract';
      const isPdf = fileName.toLowerCase().endsWith('.pdf');
      const safeRoom = JSON.stringify(r).replace(/"/g, '&quot;');

      const relPath = isContract ? ('contracts/' + fileName) : ('receipts/' + fileName);
      const initialSrc = (window.APP_DATA && window.APP_DATA.images && window.APP_DATA.images[fileName]) 
        ? window.APP_DATA.images[fileName] 
        : (isContract ? (window.getContractUrl ? window.getContractUrl(fileName) : relPath) : (window.getReceiptUrl ? window.getReceiptUrl(fileName) : relPath));

      const clickHandler = isContract 
        ? `openContractModal("${fileName}", ${safeRoom})`
        : `openReceiptModal("${fileName}", ${safeRoom})`;

      return `
        <div class="gallery-card">
          <div class="gallery-thumb-wrap" onclick='${clickHandler}'>
            ${isPdf 
              ? `<div class="gallery-pdf-placeholder"><span>📄 PDF</span><small>${fileName}</small></div>`
              : `<img src="${initialSrc}" alt="${fileName}" loading="lazy" onerror="window.handleThumbError(this, '${fileName}', ${isContract})">`
            }
            <div class="gallery-hover-overlay">🔍 معاينة وتكبير</div>
          </div>
          <div class="gallery-card-body">
            <div class="gallery-card-header">
              <span class="gallery-room-badge">غرفة ${r.room}</span>
              <span class="gallery-amt-badge" style="background:${isContract ? 'rgba(79, 70, 229, 0.2); color:#a5b4fc;' : 'rgba(16, 185, 129, 0.2); color:#34d399;'}">
                ${isContract ? '📄 عقد إيجار' : '🧾 إيصال تحصيل'}
              </span>
            </div>
            <div class="gallery-filename" title="${fileName}">${fileName}</div>
            <div class="gallery-tenant">${r.tenant}</div>
            <div class="gallery-actions">
              <button class="btn-gallery-action" onclick='${clickHandler}'>معاينة</button>
              <button class="btn-gallery-action" onclick="window.downloadDocument('${fileName}', '${item.type}')">تنزيل</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderTableView() {
    const container = document.getElementById('tableViewContainer');
    if (!container) return;

    let seq = 1;
    let sumContract = 0, sumDiscount = 0, sumEffective = 0, sumPaid = 0, sumRem = 0;

    const rowsHtml = filteredRooms.map(r => {
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

      const stClass = r.status === 'تم التحصيل' ? 'badge-table-paid' :
                     (r.status === 'سداد جزئي' ? 'badge-table-part' :
                     (r.status === 'خالي' ? 'badge-table-vac' : 'badge-table-unpaid'));

      const safeRoom = JSON.stringify(r).replace(/"/g, '&quot;');

      // Contract status badge for table
      let contractBadgeClass = 'st-contract-none';
      if (r.contractStatusCode === 'contract_paid') contractBadgeClass = 'st-contract-paid';
      else if (r.contractStatusCode === 'contract_no_receipt') contractBadgeClass = 'st-contract-norec';
      else if (r.contractStatusCode === 'contract_outdated' || r.isContractOutdated) contractBadgeClass = 'st-contract-outdated';
      else if (r.contractStatusCode === 'vacant') contractBadgeClass = 'st-vacant';

      // Action Buttons for Table
      let tableContractBtn = r.contractFile 
        ? `<div style="display:inline-flex; gap:4px; align-items:center;">
             <button class="btn-table-action btn-action-contract" onclick='openContractModal("${r.contractFile}", ${safeRoom})' title="معاينة العقد">📄 عقد</button>
             <button class="btn-table-action" style="background:#1e3a8a; color:#93c5fd; border:1px solid #3b82f6; cursor:pointer;" onclick="window.downloadDocument('${r.contractFile}', 'contract')" title="تنزيل صورة العقد مباشرة للجهاز">⬇️</button>
           </div>`
        : `<span style="color:#64748b; font-size:10px;">لا يوجد</span>`;

      let tableReceiptBtn = (r.receipts && r.receipts.length > 0)
        ? `<button class="btn-table-action btn-action-receipt" onclick='openReceiptModal("${r.receipts[0]}", ${safeRoom})' title="معاينة الإيصال">🧾 إيصال (${r.receipts.length})</button>`
        : `<span style="color:#64748b; font-size:10px;">بلا إيصال</span>`;

      return `
        <tr>
          <td style="text-align:center;">${seq++}</td>
          <td style="text-align:center; font-weight:700;">${r.room}</td>
          <td style="text-align:center;">${r.section}</td>
          <td style="text-align:center;">
            ${r.dueDay > 0 ? `<span class="table-due-badge">يوم ${r.dueDay}</span>` : '<span style="color:#64748b; font-size:10px;">-</span>'}
          </td>
          <td style="font-weight:600;">${r.tenant}</td>
          <td style="text-align:center; direction:ltr;">${r.phone ? '0' + r.phone : '-'}</td>
          <td style="text-align:center;">${contract.toLocaleString()}</td>
          <td style="text-align:center; color:#d97706;">${discount > 0 ? discount.toLocaleString() : '-'}</td>
          <td style="text-align:center; font-weight:700;">${effective.toLocaleString()}</td>
          <td style="text-align:center; font-weight:700; color:#16a34a;">${paid.toLocaleString()}</td>
          <td style="text-align:center; font-weight:700; color:${rem > 0 ? '#dc2626' : '#64748b'};">${rem.toLocaleString()}</td>
          <td style="text-align:center;"><span class="${stClass}">${r.status}</span></td>
          <td style="text-align:center;">
            <span class="st-badge ${contractBadgeClass}" style="font-size:10px; display:inline-block; margin-bottom:2px;">${r.contractStatus || '-'}</span>
            ${r.contractEndDate ? `<div style="font-size:9.5px; color:#94a3b8;">ينتهي: ${r.contractEndDate}</div>` : ''}
          </td>
          <td style="text-align:center;">
            <div style="display:flex; justify-content:center; gap:4px; flex-wrap:wrap;">
              ${tableContractBtn}
              ${tableReceiptBtn}
            </div>
          </td>
          <td style="font-size:8.5pt; text-align:right;">
            <div><strong>${r.auditComment || '-'}</strong></div>
            ${r.auditNote ? `<div style="color:#94a3b8; font-size:8pt;">${r.auditNote}</div>` : ''}
          </td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <div class="table-responsive-wrapper">
        <table class="dashboard-table">
          <thead>
            <tr>
              <th>م</th>
              <th>الغرفة</th>
              <th>القسم</th>
              <th>يوم الاستحقاق</th>
              <th>اسم المستأجر</th>
              <th>الهاتف</th>
              <th>إيجار العقد</th>
              <th>الخصم</th>
              <th>الإيجار الفعلي</th>
              <th>المحصل</th>
              <th>المتبقي</th>
              <th>حالة السداد</th>
              <th>حالة العقد والتدقيق</th>
              <th>مستندات (العقد / الإيصال)</th>
              <th>ملاحظات التدقيق المالي</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr class="table-total-row">
              <td colspan="6" style="text-align:center; font-weight:700;">الإجمالي للمجموع المعروض</td>
              <td style="text-align:center;">${sumContract.toLocaleString()}</td>
              <td style="text-align:center; color:#f59e0b;">${sumDiscount.toLocaleString()}</td>
              <td style="text-align:center;">${sumEffective.toLocaleString()}</td>
              <td style="text-align:center; color:#4ade80;">${sumPaid.toLocaleString()}</td>
              <td style="text-align:center; color:#f87171;">${sumRem.toLocaleString()}</td>
              <td colspan="4"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  }

})();
