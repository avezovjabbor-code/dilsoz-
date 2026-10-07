/**
 * Dilsoz Calculator - Core Engine & Interactive Logic
 * Features: High-precision evaluation, Scientific mode (Deg/Rad), 
 * Synthesized Web Audio feedback, History storage, Theme switcher, Keyboard support.
 */

class DilsozCalculator {
  constructor() {
    this.primaryDisplay = document.getElementById('primaryDisplay');
    this.expressionDisplay = document.getElementById('expressionDisplay');
    this.angleModeDisplay = document.getElementById('angleModeDisplay');
    this.angleUnitBtn = document.getElementById('angleUnitBtn');
    this.modeToggleBtn = document.getElementById('modeToggleBtn');
    this.themeToggleBtn = document.getElementById('themeToggleBtn');
    this.soundToggleBtn = document.getElementById('soundToggleBtn');
    this.historyToggleBtn = document.getElementById('historyToggleBtn');
    this.closeHistoryBtn = document.getElementById('closeHistoryBtn');
    this.clearHistoryBtn = document.getElementById('clearHistoryBtn');
    this.historyDrawer = document.getElementById('historyDrawer');
    this.drawerOverlay = document.getElementById('drawerOverlay');
    this.historyList = document.getElementById('historyList');
    this.copyBtn = document.getElementById('copyBtn');
    this.toast = document.getElementById('toast');
    this.appWrapper = document.querySelector('.app-wrapper');

    // Calculator State
    this.currentInput = '0';
    this.expression = '';
    this.isResultShown = false;
    this.isDegreeMode = true; // true = DEG, false = RAD
    this.soundEnabled = true;
    this.isScientific = false;

    // Audio Context
    this.audioCtx = null;

    // History array
    this.history = JSON.parse(localStorage.getItem('dilsoz_history') || '[]');

    this.init();
  }

  init() {
    this.bindEvents();
    this.loadPreferences();
    this.renderHistory();
    this.updateDisplay();
  }

  // =========================================================================
  // Audio Feedback (Synthesized via Web Audio API)
  // =========================================================================
  initAudio() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  playTone(freq = 440, type = 'sine', duration = 0.05, gainValue = 0.08) {
    if (!this.soundEnabled) return;
    try {
      this.initAudio();
      if (!this.audioCtx) return;

      const osc = this.audioCtx.createOscillator();
      const gainNode = this.audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

      gainNode.gain.setValueAtTime(gainValue, this.audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + duration);

      osc.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {
      // Audio might be blocked until user gesture
    }
  }

  playKeySound(type = 'num') {
    switch (type) {
      case 'num':
        this.playTone(520, 'sine', 0.04, 0.05);
        break;
      case 'op':
        this.playTone(660, 'triangle', 0.06, 0.07);
        break;
      case 'equals':
        this.playTone(880, 'sine', 0.12, 0.1);
        setTimeout(() => this.playTone(1100, 'sine', 0.15, 0.08), 60);
        break;
      case 'clear':
        this.playTone(320, 'sine', 0.08, 0.06);
        break;
      case 'func':
        this.playTone(740, 'triangle', 0.05, 0.06);
        break;
      default:
        this.playTone(480, 'sine', 0.04, 0.05);
    }
  }

  // =========================================================================
  // Event Listeners & Binding
  // =========================================================================
  bindEvents() {
    // Keypad Click Event Delegation
    document.querySelectorAll('.key').forEach(button => {
      button.addEventListener('click', (e) => {
        const target = e.currentTarget;
        const action = target.dataset.action;
        const value = target.dataset.value;
        this.handleKeyAction(action, value);
        this.addPressEffect(target);
      });
    });

    // Header Controls
    this.soundToggleBtn.addEventListener('click', () => this.toggleSound());
    this.modeToggleBtn.addEventListener('click', () => this.toggleMode());
    this.themeToggleBtn.addEventListener('click', () => this.toggleTheme());
    this.historyToggleBtn.addEventListener('click', () => this.openHistory());
    this.closeHistoryBtn.addEventListener('click', () => this.closeHistory());
    this.drawerOverlay.addEventListener('click', () => this.closeHistory());
    this.clearHistoryBtn.addEventListener('click', () => this.clearHistory());
    this.copyBtn.addEventListener('click', () => this.copyToClipboard());

    // Angle Unit Toggle (Deg / Rad)
    if (this.angleUnitBtn) {
      this.angleUnitBtn.addEventListener('click', () => this.toggleAngleMode());
    }

    // Keyboard support
    window.addEventListener('keydown', (e) => this.handleKeyboardInput(e));
  }

  addPressEffect(elem) {
    elem.classList.add('pressed');
    setTimeout(() => elem.classList.remove('pressed'), 120);
  }

  // =========================================================================
  // Calculator Operations
  // =========================================================================
  handleKeyAction(action, value) {
    switch (action) {
      case 'num':
        this.playKeySound('num');
        this.inputDigit(value);
        break;
      case 'dot':
        this.playKeySound('num');
        this.inputDecimal();
        break;
      case 'op':
        this.playKeySound('op');
        this.handleOperator(value);
        break;
      case 'calculate':
        this.playKeySound('equals');
        this.calculate();
        break;
      case 'clear-all':
        this.playKeySound('clear');
        this.clearAll();
        break;
      case 'backspace':
        this.playKeySound('clear');
        this.backspace();
        break;
      case 'toggle-sign':
        this.playKeySound('num');
        this.toggleSign();
        break;
      case 'insert':
        this.playKeySound('func');
        this.insertToken(value);
        break;
      case 'func':
        this.playKeySound('func');
        this.handleFunction(value);
        break;
      case 'toggle-angle':
        this.toggleAngleMode();
        break;
    }
  }

  inputDigit(digit) {
    if (this.isResultShown) {
      this.currentInput = digit;
      this.expression = '';
      this.isResultShown = false;
    } else {
      if (this.currentInput === '0') {
        this.currentInput = digit;
      } else {
        if (this.currentInput.length < 18) {
          this.currentInput += digit;
        }
      }
    }
    this.updateDisplay();
  }

  inputDecimal() {
    if (this.isResultShown) {
      this.currentInput = '0.';
      this.expression = '';
      this.isResultShown = false;
    } else {
      if (!this.currentInput.includes('.')) {
        this.currentInput += '.';
      }
    }
    this.updateDisplay();
  }

  handleOperator(op) {
    if (this.isResultShown) {
      this.isResultShown = false;
      this.expression = `${this.currentInput} ${op} `;
      this.currentInput = '0';
    } else {
      if (this.currentInput !== '0' || this.expression === '') {
        this.expression += `${this.currentInput} ${op} `;
        this.currentInput = '0';
      } else if (this.expression.length > 0) {
        // Replace last operator if already ended with operator
        this.expression = this.expression.replace(/[\+\-×÷\^%]\s*$/, `${op} `);
      }
    }
    this.updateDisplay();
  }

  insertToken(token) {
    if (this.isResultShown) {
      this.currentInput = token === 'π' ? String(Math.PI) : token === 'e' ? String(Math.E) : '0';
      this.expression = '';
      this.isResultShown = false;
    } else {
      if (token === 'π') {
        this.currentInput = String(Math.PI);
      } else if (token === 'e') {
        this.currentInput = String(Math.E);
      } else if (token === '(' || token === ')') {
        if (this.currentInput === '0') {
          this.expression += `${token} `;
        } else {
          this.expression += `${this.currentInput} ${token} `;
          this.currentInput = '0';
        }
      }
    }
    this.updateDisplay();
  }

  handleFunction(fn) {
    const val = parseFloat(this.currentInput);
    if (isNaN(val)) return;

    let res = 0;
    const toRad = (deg) => (deg * Math.PI) / 180;

    switch (fn) {
      case 'sin':
        res = this.isDegreeMode ? Math.sin(toRad(val)) : Math.sin(val);
        break;
      case 'cos':
        res = this.isDegreeMode ? Math.cos(toRad(val)) : Math.cos(val);
        break;
      case 'tan':
        res = this.isDegreeMode ? Math.tan(toRad(val)) : Math.tan(val);
        break;
      case 'log':
        if (val <= 0) return this.showError('Musbat son kiriting');
        res = Math.log10(val);
        break;
      case 'ln':
        if (val <= 0) return this.showError('Musbat son kiriting');
        res = Math.log(val);
        break;
      case 'sqrt':
        if (val < 0) return this.showError('Ildiz ostida manfiy son bo\'lmaydi');
        res = Math.sqrt(val);
        break;
      case 'sqr':
        res = Math.pow(val, 2);
        break;
      case 'fact':
        if (val < 0 || !Number.isInteger(val)) return this.showError('Faqat butun musbat son');
        if (val > 170) return this.showError('Juda katta son');
        res = this.factorial(val);
        break;
      case 'inv':
        if (val === 0) return this.showError('Nolga bo\'lib bo\'lmaydi');
        res = 1 / val;
        break;
      case 'abs':
        res = Math.abs(val);
        break;
      default:
        return;
    }

    this.expression = `${fn}(${this.currentInput}) = `;
    this.currentInput = this.formatNumber(res);
    this.isResultShown = true;
    this.saveToHistory(this.expression.slice(0, -3), this.currentInput);
    this.updateDisplay();
  }

  factorial(n) {
    if (n === 0 || n === 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
  }

  toggleSign() {
    if (this.currentInput === '0') return;
    if (this.currentInput.startsWith('-')) {
      this.currentInput = this.currentInput.substring(1);
    } else {
      this.currentInput = '-' + this.currentInput;
    }
    this.updateDisplay();
  }

  backspace() {
    if (this.isResultShown) {
      this.clearAll();
      return;
    }
    if (this.currentInput.length > 1) {
      this.currentInput = this.currentInput.slice(0, -1);
      if (this.currentInput === '-') this.currentInput = '0';
    } else {
      this.currentInput = '0';
    }
    this.updateDisplay();
  }

  clearAll() {
    this.currentInput = '0';
    this.expression = '';
    this.isResultShown = false;
    this.updateDisplay();
  }

  calculate() {
    if (this.isResultShown) return;

    let fullExpr = (this.expression + this.currentInput).trim();
    if (!fullExpr) return;

    // Prepare expression for safe evaluation
    let sanitized = fullExpr
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-')
      .replace(/\^/g, '**')
      .replace(/%/g, '/100');

    try {
      // Validate characters
      if (/[^0-9\+\-\*\/\.\(\)\s\*\*%]/.test(sanitized)) {
        throw new Error('Noto\'g\'ri ifoda');
      }

      // Safe mathematical evaluate
      const evalFn = new Function(`return (${sanitized})`);
      const rawResult = evalFn();

      if (rawResult === undefined || isNaN(rawResult)) {
        throw new Error('Xatolik');
      }
      if (!isFinite(rawResult)) {
        this.showError('Nolga bo\'lib bo\'lmaydi');
        return;
      }

      const formattedResult = this.formatNumber(rawResult);
      this.saveToHistory(fullExpr, formattedResult);

      this.expression = fullExpr + ' =';
      this.currentInput = formattedResult;
      this.isResultShown = true;
    } catch (e) {
      this.showError('Xatolik');
    }
    this.updateDisplay();
  }

  formatNumber(num) {
    if (typeof num !== 'number') num = parseFloat(num);
    // Fix floating point issues like 0.1 + 0.2 = 0.30000000000000004
    const rounded = Math.round(num * 1e12) / 1e12;
    if (Math.abs(rounded) > 1e14 || (Math.abs(rounded) < 1e-6 && rounded !== 0)) {
      return rounded.toExponential(6);
    }
    return String(rounded);
  }

  showError(msg = 'Xatolik') {
    this.primaryDisplay.textContent = msg;
    this.currentInput = '0';
    this.expression = '';
    this.isResultShown = true;
    this.showToast(msg);
  }

  updateDisplay() {
    this.primaryDisplay.textContent = this.currentInput;
    this.expressionDisplay.textContent = this.expression;

    // Adjust font size dynamically if input gets long
    const len = this.currentInput.length;
    if (len > 14) {
      this.primaryDisplay.style.fontSize = '1.75rem';
    } else if (len > 10) {
      this.primaryDisplay.style.fontSize = '2.1rem';
    } else {
      this.primaryDisplay.style.fontSize = '';
    }
  }

  // =========================================================================
  // Settings & Modes
  // =========================================================================
  toggleAngleMode() {
    this.isDegreeMode = !this.isDegreeMode;
    const mode = this.isDegreeMode ? 'DEG' : 'RAD';
    this.angleModeDisplay.textContent = mode;
    if (this.angleUnitBtn) {
      this.angleUnitBtn.textContent = mode;
    }
    this.showToast(`Burchak o'lchovi: ${mode}`);
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    const iconOn = document.getElementById('soundIconOn');
    const iconOff = document.getElementById('soundIconOff');

    if (this.soundEnabled) {
      iconOn.classList.remove('hidden');
      iconOff.classList.add('hidden');
      this.soundToggleBtn.classList.add('active-state');
      this.showToast('Tugma ovozi yoqildi');
      this.playTone(600, 'sine', 0.08, 0.08);
    } else {
      iconOn.classList.add('hidden');
      iconOff.classList.remove('hidden');
      this.soundToggleBtn.classList.remove('active-state');
      this.showToast('Tugma ovozi o\'chirildi');
    }
    localStorage.setItem('dilsoz_sound', this.soundEnabled);
  }

  toggleMode() {
    this.isScientific = !this.isScientific;
    if (this.isScientific) {
      this.appWrapper.classList.add('scientific-active');
      this.modeToggleBtn.classList.add('active');
      this.modeToggleBtn.querySelector('.mode-text').textContent = 'Oddiy';
    } else {
      this.appWrapper.classList.remove('scientific-active');
      this.modeToggleBtn.classList.remove('active');
      this.modeToggleBtn.querySelector('.mode-text').textContent = 'Muhandislik';
    }
    localStorage.setItem('dilsoz_scientific', this.isScientific);
  }

  toggleTheme() {
    const isLight = document.body.classList.toggle('light-theme');
    document.body.classList.toggle('dark-theme', !isLight);

    const moonIcon = document.getElementById('themeMoonIcon');
    const sunIcon = document.getElementById('themeSunIcon');

    if (isLight) {
      moonIcon.classList.add('hidden');
      sunIcon.classList.remove('hidden');
      localStorage.setItem('dilsoz_theme', 'light');
    } else {
      moonIcon.classList.remove('hidden');
      sunIcon.classList.add('hidden');
      localStorage.setItem('dilsoz_theme', 'dark');
    }
  }

  loadPreferences() {
    // Sound
    const savedSound = localStorage.getItem('dilsoz_sound');
    if (savedSound !== null) {
      this.soundEnabled = savedSound === 'true';
      if (!this.soundEnabled) {
        document.getElementById('soundIconOn').classList.add('hidden');
        document.getElementById('soundIconOff').classList.remove('hidden');
        this.soundToggleBtn.classList.remove('active-state');
      }
    }

    // Theme
    const savedTheme = localStorage.getItem('dilsoz_theme');
    if (savedTheme === 'light') {
      this.toggleTheme();
    }

    // Scientific Mode
    const savedScientific = localStorage.getItem('dilsoz_scientific');
    if (savedScientific === 'true') {
      this.toggleMode();
    }
  }

  // =========================================================================
  // History Drawer Management
  // =========================================================================
  saveToHistory(expr, result) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    this.history.unshift({ expr, result, time });
    if (this.history.length > 40) this.history.pop();
    localStorage.setItem('dilsoz_history', JSON.stringify(this.history));
    this.renderHistory();
  }

  renderHistory() {
    if (this.history.length === 0) {
      this.historyList.innerHTML = `<div class="empty-history">Hozircha hisoblar tarixi bo'sh</div>`;
      return;
    }

    this.historyList.innerHTML = this.history.map((item, index) => `
      <div class="history-item" data-index="${index}">
        <div class="hist-expr">${this.escapeHtml(item.expr)} =</div>
        <div class="hist-res">${this.escapeHtml(item.result)}</div>
        <div class="hist-time">${item.time}</div>
      </div>
    `).join('');

    // Click to recall
    this.historyList.querySelectorAll('.history-item').forEach(elem => {
      elem.addEventListener('click', () => {
        const idx = parseInt(elem.dataset.index, 10);
        const item = this.history[idx];
        if (item) {
          this.currentInput = item.result;
          this.expression = item.expr + ' =';
          this.isResultShown = true;
          this.updateDisplay();
          this.closeHistory();
          this.showToast('Natija kiritildi');
        }
      });
    });
  }

  openHistory() {
    this.historyDrawer.classList.add('open');
    this.drawerOverlay.classList.add('active');
  }

  closeHistory() {
    this.historyDrawer.classList.remove('open');
    this.drawerOverlay.classList.remove('active');
  }

  clearHistory() {
    this.history = [];
    localStorage.removeItem('dilsoz_history');
    this.renderHistory();
    this.showToast('Tarix tozalandi');
  }

  // =========================================================================
  // Utilities
  // =========================================================================
  copyToClipboard() {
    const textToCopy = this.currentInput;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        this.showToast(`Nusxalandi: ${textToCopy}`);
      }).catch(() => {
        this.fallbackCopy(textToCopy);
      });
    } else {
      this.fallbackCopy(textToCopy);
    }
  }

  fallbackCopy(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      this.showToast(`Nusxalandi: ${text}`);
    } catch (err) {
      this.showToast('Nusxalash imkoni bo\'lmadi');
    }
    document.body.removeChild(textArea);
  }

  showToast(msg) {
    if (!this.toast) return;
    this.toast.textContent = msg;
    this.toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toast.classList.remove('show');
    }, 2200);
  }

  escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // =========================================================================
  // Keyboard Support
  // =========================================================================
  handleKeyboardInput(e) {
    // If modal or input active, don't capture
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const key = e.key;

    if (key >= '0' && key <= '9') {
      e.preventDefault();
      this.handleKeyAction('num', key);
    } else if (key === '.' || key === ',') {
      e.preventDefault();
      this.handleKeyAction('dot', '.');
    } else if (key === '+') {
      e.preventDefault();
      this.handleKeyAction('op', '+');
    } else if (key === '-') {
      e.preventDefault();
      this.handleKeyAction('op', '-');
    } else if (key === '*') {
      e.preventDefault();
      this.handleKeyAction('op', '×');
    } else if (key === '/') {
      e.preventDefault();
      this.handleKeyAction('op', '÷');
    } else if (key === '%') {
      e.preventDefault();
      this.handleKeyAction('op', '%');
    } else if (key === '^') {
      e.preventDefault();
      this.handleKeyAction('op', '^');
    } else if (key === '(' || key === ')') {
      e.preventDefault();
      this.handleKeyAction('insert', key);
    } else if (key === 'Enter' || key === '=') {
      e.preventDefault();
      this.handleKeyAction('calculate');
    } else if (key === 'Backspace') {
      e.preventDefault();
      this.handleKeyAction('backspace');
    } else if (key === 'Escape') {
      e.preventDefault();
      this.handleKeyAction('clear-all');
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.dilsozCalc = new DilsozCalculator();
});
