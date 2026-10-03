// ============================================================
// AUTHENTICATION GATE ENGINE
// Encrypted SHA-256 Hardcoded Gate for Read-Only Access
// Expected Password: "uae@123xyzfornow"
// SHA-256 Hash: facd967751f9986c720a8fcd29372f5d509d7c1263e8325c131e1ba193a70fe4
// ============================================================

(function() {
  'use strict';

  const TARGET_HASH = 'facd967751f9986c720a8fcd29372f5d509d7c1263e8325c131e1ba193a70fe4';
  const FALLBACK_RAW = 'uae@123xyzfornow';
  const SESSION_KEY = 'realestate_gate_token';

  let failedAttempts = 0;
  let cooldownTimer = null;

  async function sha256(message) {
    if (window.crypto && crypto.subtle && window.TextEncoder) {
      try {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (e) {
        console.warn('Crypto.subtle failed, falling back to direct check:', e);
      }
    }
    return null;
  }

  function showError(msg) {
    const el = document.getElementById('authError');
    const card = document.getElementById('authCard');
    if (el) {
      el.textContent = msg;
      el.classList.add('visible');
    }
    if (card) {
      card.classList.remove('shake');
      void card.offsetWidth; // trigger reflow
      card.classList.add('shake');
    }
  }

  function clearError() {
    const el = document.getElementById('authError');
    if (el) {
      el.textContent = '';
      el.classList.remove('visible');
    }
  }

  window.verifyPassword = async function() {
    if (cooldownTimer) return;

    const pwdInput = document.getElementById('authPassword');
    const entered = (pwdInput ? pwdInput.value : '').trim();

    if (!entered) {
      showError('يرجى إدخال كلمة المرور للمتابعة');
      return;
    }

    const computedHash = await sha256(entered);
    const isMatch = computedHash ? (computedHash === TARGET_HASH) : (entered === FALLBACK_RAW);

    if (isMatch) {
      clearError();
      failedAttempts = 0;
      sessionStorage.setItem(SESSION_KEY, 'unlocked_' + Date.now());
      unlockDashboard();
    } else {
      failedAttempts++;
      if (failedAttempts >= 5) {
        startCooldown(15);
      } else {
        showError(`كلمة المرور غير صحيحة (المحاولات المتبقية: ${5 - failedAttempts})`);
        if (pwdInput) {
          pwdInput.value = '';
          pwdInput.focus();
        }
      }
    }
  };

  function startCooldown(seconds) {
    const btn = document.getElementById('authSubmitBtn');
    let remaining = seconds;
    showError(`تم تجاوز عدد المحاولات. يرجى الانتظار ${remaining} ثانية.`);
    if (btn) btn.disabled = true;

    cooldownTimer = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(cooldownTimer);
        cooldownTimer = null;
        failedAttempts = 0;
        clearError();
        if (btn) btn.disabled = false;
      } else {
        showError(`تم تجاوز عدد المحاولات. يرجى الانتظار ${remaining} ثانية.`);
      }
    }, 1000);
  }

  function unlockDashboard() {
    const overlay = document.getElementById('authGate');
    const mainApp = document.getElementById('mainApp');
    if (overlay) overlay.classList.add('hidden');
    if (mainApp) mainApp.style.display = 'block';

    // Trigger app initialization if not already initialized
    if (window.initApplication) {
      window.initApplication();
    }
  }

  window.lockDashboard = function() {
    sessionStorage.removeItem(SESSION_KEY);
    const overlay = document.getElementById('authGate');
    const mainApp = document.getElementById('mainApp');
    const pwdInput = document.getElementById('authPassword');
    clearError();
    if (pwdInput) pwdInput.value = '';
    if (mainApp) mainApp.style.display = 'none';
    if (overlay) overlay.classList.remove('hidden');
    if (pwdInput) pwdInput.focus();
  };

  window.togglePasswordVisibility = function() {
    const pwd = document.getElementById('authPassword');
    const icon = document.getElementById('pwdToggleIcon');
    if (!pwd) return;
    if (pwd.type === 'password') {
      pwd.type = 'text';
      if (icon) icon.textContent = '🙈';
    } else {
      pwd.type = 'password';
      if (icon) icon.textContent = '👁️';
    }
  };

  // Check existing session on load
  document.addEventListener('DOMContentLoaded', function() {
    const saved = sessionStorage.getItem(SESSION_KEY);
    const pwdInput = document.getElementById('authPassword');

    if (saved && saved.startsWith('unlocked_')) {
      unlockDashboard();
    } else {
      window.lockDashboard();
    }

    if (pwdInput) {
      pwdInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          window.verifyPassword();
        }
      });
    }
  });

})();
