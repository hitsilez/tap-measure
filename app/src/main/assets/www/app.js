/**
 * Tape Measure Explorer - Core Canvas Engine & Interactive Logic
 * 100% Offline, Zero External Dependencies, 60fps Precision
 */

(function () {
  'use strict';

  // --- Constants ---
  const CM_TO_INCH = 1 / 2.54;
  const INCH_TO_CM = 2.54;
  const MIN_ZOOM = 1.0;     // Computed dynamically based on tape length
  const MAX_ZOOM = 140.0;   // 140 px per cm (super high detail)
  const CASE_WIDTH = 95;    // Width of tape case on left (px)
  const TAPE_HEIGHT = 160;  // Height of the yellow tape blade (px)

  // --- State ---
  const state = {
    tapeLengthCm: 500,     // Default 5m tape (500 cm)
    pinnedCm: 25.4,        // Starts at 25.4 cm = 10 inches exactly
    hoverCm: null,
    zoom: 35.0,            // px per cm
    scrollOffsetPx: 60,    // horizontal scroll offset
    isDragging: false,
    dragStartX: 0,
    dragStartOffset: 0,
    lastDragX: 0,
    dragVelocityX: 0,
    isPinching: false,
    pinchStartDist: 0,
    pinchStartZoom: 35.0,
    pinchCenterCanvasX: 0,
    animFrameId: null,
    targetScrollOffset: null,
    targetZoom: null,
    animStartTime: 0,
    animDuration: 400,
    startScrollOffset: 0,
    startZoom: 35.0
  };

  // --- DOM Elements ---
  const canvas = document.getElementById('tape-canvas');
  const ctx = canvas.getContext('2d');
  const container = document.getElementById('canvas-container');
  const floatingFlag = document.getElementById('canvas-floating-flag');
  const flagMetricTxt = document.getElementById('flag-metric-txt');
  const flagImperialTxt = document.getElementById('flag-imperial-txt');

  const posSlider = document.getElementById('pos-slider');
  const posReadout = document.getElementById('pos-slider-readout');
  const zoomSlider = document.getElementById('zoom-slider');
  const zoomReadout = document.getElementById('zoom-slider-readout');

  const zoomInBtn = document.getElementById('zoom-in-btn');
  const zoomOutBtn = document.getElementById('zoom-out-btn');
  const fitTapeBtn = document.getElementById('fit-tape-btn');
  const centerPinBtn = document.getElementById('center-pin-btn');

  // Readout card elements
  const cardMetricCm = document.getElementById('card-metric-cm');
  const cardMetricMm = document.getElementById('card-metric-mm');
  const cardMetricMeter = document.getElementById('card-metric-meter');
  const cardMetricMeterBox = document.getElementById('card-metric-meter-box');

  const cardImperialFraction = document.getElementById('card-imperial-fraction');
  const cardImperialFeet = document.getElementById('card-imperial-feet');
  const cardImperialDecimal = document.getElementById('card-imperial-decimal');
  const cardImperialBadge = document.getElementById('card-imperial-badge');
  const fractionStepName = document.getElementById('fraction-step-name');
  const fractionBar = document.getElementById('fraction-bar');

  // Say it in words card elements
  const wordsCard = document.getElementById('words-card');
  const showWordsToggle = document.getElementById('show-words-toggle');
  const readAloudBtn = document.getElementById('read-aloud-btn');
  const wordsContent = document.getElementById('words-content');
  const wordsMetricLong = document.getElementById('words-metric-long');
  const wordsMetricDecimal = document.getElementById('words-metric-decimal');
  const wordsImperialInches = document.getElementById('words-imperial-inches');
  const wordsImperialFeet = document.getElementById('words-imperial-feet');

  let currentMetricSpeech = '';
  let currentImperialSpeech = '';

  // Jump to
  const jumpForm = document.getElementById('jump-form');
  const jumpValInput = document.getElementById('jump-val-input');
  const jumpUnitSelect = document.getElementById('jump-unit-select');
  const jumpFeedback = document.getElementById('jump-feedback');

  // Length presets & custom
  const presetBtns = document.querySelectorAll('.preset-btn');
  const lengthEquivBadge = document.getElementById('length-equivalent-badge');
  const customLengthInput = document.getElementById('custom-length-input');
  const customLengthUnit = document.getElementById('custom-length-unit');
  const setCustomLengthBtn = document.getElementById('set-custom-length-btn');

  // Theme & Offline
  const themeToggle = document.getElementById('theme-toggle');
  const offlineStatus = document.getElementById('offline-status');
  const guideModalBtn = document.getElementById('guide-modal-btn');

  // Check prefers-reduced-motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- Fraction Visualizer Grid Setup ---
  function initFractionBar() {
    fractionBar.innerHTML = '';
    for (let i = 0; i < 16; i++) {
      const seg = document.createElement('div');
      seg.className = 'fraction-segment';
      seg.dataset.index = i;
      seg.title = `${i}/16 inch`;
      fractionBar.appendChild(seg);
    }
  }

  // --- Canvas Resizing & Retina Handling ---
  let canvasWidth = 800;
  let canvasHeight = 280;
  let dpr = window.devicePixelRatio || 1;

  function resizeCanvas() {
    const rect = container.getBoundingClientRect();
    canvasWidth = Math.max(rect.width, 320);
    canvasHeight = Math.max(rect.height, 200);
    dpr = window.devicePixelRatio || 1;

    canvas.width = Math.floor(canvasWidth * dpr);
    canvas.height = Math.floor(canvasHeight * dpr);

    ctx.scale(dpr, dpr);
    clampOffsets();
    updateSliders();
    drawTape();
  }

  window.addEventListener('resize', resizeCanvas);

  // --- Math & Coordinate Helpers ---
  function cmToScreenX(cm) {
    return CASE_WIDTH + state.scrollOffsetPx + cm * state.zoom;
  }

  function screenXToCm(screenX) {
    return (screenX - CASE_WIDTH - state.scrollOffsetPx) / state.zoom;
  }

  function getMinZoom() {
    // Zoom that fits the full tape plus a 40px margin
    const availableW = Math.max(canvasWidth - CASE_WIDTH - 60, 100);
    return Math.max(availableW / state.tapeLengthCm, 0.05);
  }

  function clampOffsets() {
    const minZoom = getMinZoom();
    state.zoom = Math.max(minZoom, Math.min(MAX_ZOOM, state.zoom));

    // Keep tape reasonably in view
    const tapeTotalPx = state.tapeLengthCm * state.zoom;
    const maxOffset = canvasWidth - CASE_WIDTH - 40;
    const minOffset = -tapeTotalPx + 40;

    state.scrollOffsetPx = Math.max(minOffset, Math.min(maxOffset, state.scrollOffsetPx));
  }

  function centerOnCm(cm, animate = true) {
    const targetX = (canvasWidth + CASE_WIDTH) / 2;
    const targetOffset = targetX - CASE_WIDTH - cm * state.zoom;

    if (!animate || prefersReducedMotion) {
      state.scrollOffsetPx = targetOffset;
      clampOffsets();
      updateSliders();
      drawTape();
    } else {
      animateTo(targetOffset, state.zoom);
    }
  }

  function fitWholeTape(animate = true) {
    const targetZoom = getMinZoom();
    const targetOffset = 20;

    if (!animate || prefersReducedMotion) {
      state.zoom = targetZoom;
      state.scrollOffsetPx = targetOffset;
      clampOffsets();
      updateSliders();
      drawTape();
    } else {
      animateTo(targetOffset, targetZoom);
    }
  }

  // --- Smooth Animation Helper ---
  function animateTo(targetOffset, targetZoom, duration = 350) {
    state.targetScrollOffset = targetOffset;
    state.targetZoom = targetZoom;
    state.startScrollOffset = state.scrollOffsetPx;
    state.startZoom = state.zoom;
    state.animStartTime = performance.now();
    state.animDuration = duration;

    function step(now) {
      const elapsed = now - state.animStartTime;
      const progress = Math.min(elapsed / state.animDuration, 1.0);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);

      state.scrollOffsetPx = state.startScrollOffset + (state.targetScrollOffset - state.startScrollOffset) * ease;
      state.zoom = state.startZoom + (state.targetZoom - state.startZoom) * ease;

      clampOffsets();
      updateSliders();
      drawTape();

      if (progress < 1.0) {
        requestAnimationFrame(step);
      } else {
        state.targetScrollOffset = null;
        state.targetZoom = null;
      }
    }

    requestAnimationFrame(step);
  }

  // --- Zoom With Focus Center ---
  function zoomAt(focalScreenX, factor) {
    const cmAtFocal = screenXToCm(focalScreenX);
    const oldZoom = state.zoom;
    const minZ = getMinZoom();
    const newZoom = Math.max(minZ, Math.min(MAX_ZOOM, oldZoom * factor));

    if (newZoom === oldZoom) return;

    state.zoom = newZoom;
    // Keep cmAtFocal fixed under the cursor
    state.scrollOffsetPx = focalScreenX - CASE_WIDTH - cmAtFocal * newZoom;
    clampOffsets();
    updateSliders();
    drawTape();
  }

  // --- Number Step Picker (prevents label overlap) ---
  function getMetricNumberStep(zoom) {
    // Labels need ~36px spacing to not collide
    const steps = [1, 2, 5, 10, 20, 50, 100, 200, 500];
    for (const step of steps) {
      if (step * zoom >= 38) {
        return step;
      }
    }
    return 1000;
  }

  function getImperialNumberStep(zoom) {
    const pxPerInch = zoom * INCH_TO_CM;
    const steps = [1, 2, 3, 6, 12, 24, 60, 120];
    for (const step of steps) {
      if (step * pxPerInch >= 38) {
        return step;
      }
    }
    return 240;
  }

  // --- Fraction Reduction ---
  function simplifyFraction(numerator, denominator) {
    function gcd(a, b) {
      return b === 0 ? a : gcd(b, a % b);
    }
    const g = gcd(numerator, denominator);
    return { num: numerator / g, den: denominator / g };
  }

  function formatImperial(cm) {
    const totalInches = cm * CM_TO_INCH;
    let wholeInches = Math.floor(totalInches);
    const remainder = totalInches - wholeInches;
    let sixteenths = Math.round(remainder * 16);

    if (sixteenths === 16) {
      wholeInches += 1;
      sixteenths = 0;
    }

    let fracStr = '';
    if (sixteenths > 0) {
      const reduced = simplifyFraction(sixteenths, 16);
      fracStr = `${reduced.num}/${reduced.den}`;
    }

    let displayFraction = '';
    if (wholeInches === 0 && fracStr) {
      displayFraction = `${fracStr} in`;
    } else if (wholeInches > 0 && fracStr) {
      displayFraction = `${wholeInches} ${fracStr} in`;
    } else {
      displayFraction = `${wholeInches} in`;
    }

    // Feet + Inches
    const feet = Math.floor(wholeInches / 12);
    const remInches = wholeInches % 12;
    let feetStr = `${feet} ft `;
    if (remInches === 0 && !fracStr) {
      feetStr += '0 in';
    } else {
      feetStr += remInches > 0 ? (fracStr ? `${remInches} ${fracStr} in` : `${remInches} in`) : `${fracStr} in`;
    }

    // Exactness difference
    const nearestValue = wholeInches + sixteenths / 16;
    const diff = totalInches - nearestValue;
    const isExact = Math.abs(diff) < 0.0006;

    return {
      totalInches,
      wholeInches,
      sixteenths,
      fracStr,
      displayFraction,
      feetStr,
      decimalStr: `${totalInches.toFixed(3)}″`,
      isExact,
      diff
    };
  }

  // --- Number to Words Converter (0 to 30,000) ---
  function numberToWords(n) {
    if (n === 0) return 'zero';
    if (n < 0) return 'minus ' + numberToWords(-n);

    const units = [
      '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
      'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
      'seventeen', 'eighteen', 'nineteen'
    ];
    const tens = [
      '', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'
    ];

    function convertBelow100(val) {
      if (val < 20) return units[val];
      const rem = val % 10;
      return tens[Math.floor(val / 10)] + (rem > 0 ? '-' + units[rem] : '');
    }

    function convertBelow1000(val) {
      if (val < 100) return convertBelow100(val);
      const hundreds = Math.floor(val / 100);
      const rem = val % 100;
      const hundredsPart = units[hundreds] + ' hundred';
      return rem > 0 ? hundredsPart + ' and ' + convertBelow100(rem) : hundredsPart;
    }

    if (n < 1000) {
      return convertBelow1000(n);
    }

    const thousands = Math.floor(n / 1000);
    const rem = n % 1000;
    const thousandsPart = convertBelow1000(thousands) + ' thousand';

    if (rem === 0) {
      return thousandsPart;
    }
    if (rem < 100) {
      return thousandsPart + ' and ' + convertBelow100(rem);
    }
    return thousandsPart + ', ' + convertBelow1000(rem);
  }

  const digitWords = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

  // --- Say Metric Words in British Spelling ---
  function sayMetricWords(cm) {
    const totalMm = Math.round(cm * 10);

    if (totalMm === 0) {
      return {
        longForm: 'Zero millimetres',
        decimalForm: 'or: zero millimetres'
      };
    }

    // 1. Long form: e.g. "One metre, thirty-seven centimetres and four millimetres"
    const m = Math.floor(totalMm / 1000);
    const remMm = totalMm % 1000;
    const cmPart = Math.floor(remMm / 10);
    const mmPart = remMm % 10;

    const parts = [];
    if (m > 0) {
      parts.push(m === 1 ? 'one metre' : `${numberToWords(m)} metres`);
    }
    if (cmPart > 0) {
      parts.push(cmPart === 1 ? 'one centimetre' : `${numberToWords(cmPart)} centimetres`);
    }
    if (mmPart > 0) {
      parts.push(mmPart === 1 ? 'one millimetre' : `${numberToWords(mmPart)} millimetres`);
    }

    let longText = '';
    if (parts.length === 3) {
      longText = `${parts[0]}, ${parts[1]} and ${parts[2]}`;
    } else if (parts.length === 2) {
      longText = `${parts[0]} and ${parts[1]}`;
    } else if (parts.length === 1) {
      longText = parts[0];
    } else {
      longText = 'zero millimetres';
    }

    const capitalizedLong = longText.charAt(0).toUpperCase() + longText.slice(1);

    // 2. Decimal form: shown below as "or: ..."
    // - Over 1 m: "one point three seven four metres"
    // - Under 1 m: "thirty-seven point four centimetres"
    let decimalBody = '';
    if (totalMm >= 1000) {
      if (totalMm === 1000) {
        decimalBody = 'one metre';
      } else {
        const valInM = totalMm / 1000;
        const [intStr, decStr] = valInM.toString().split('.');
        const intNum = parseInt(intStr, 10);
        const intWords = numberToWords(intNum);
        if (decStr && decStr.length > 0) {
          const decWords = decStr.split('').map((d) => digitWords[parseInt(d, 10)]).join(' ');
          decimalBody = `${intWords} point ${decWords} metres`;
        } else {
          decimalBody = intNum === 1 ? 'one metre' : `${intWords} metres`;
        }
      }
    } else {
      // Under 1 m
      if (totalMm === 10) {
        decimalBody = 'one centimetre';
      } else {
        const valInCm = totalMm / 10;
        const [intStr, decStr] = valInCm.toString().split('.');
        const intNum = parseInt(intStr, 10);
        const intWords = numberToWords(intNum);
        if (decStr && decStr.length > 0) {
          const decWords = decStr.split('').map((d) => digitWords[parseInt(d, 10)]).join(' ');
          decimalBody = `${intWords} point ${decWords} centimetres`;
        } else {
          decimalBody = intNum === 1 ? 'one centimetre' : `${intWords} centimetres`;
        }
      }
    }

    return {
      longForm: capitalizedLong,
      decimalForm: `or: ${decimalBody}`
    };
  }

  // --- Fraction Words Helper ---
  function fractionToWords(num, den) {
    if (den === 2 && num === 1) return 'one half';
    if (den === 4) {
      if (num === 1) return 'one quarter';
      if (num === 3) return 'three quarters';
    }
    if (den === 8) {
      const eights = { 1: 'one eighth', 3: 'three eighths', 5: 'five eighths', 7: 'seven eighths' };
      return eights[num] || '';
    }
    if (den === 16) {
      const sixteenthsMap = {
        1: 'one sixteenth',
        3: 'three sixteenths',
        5: 'five sixteenths',
        7: 'seven sixteenths',
        9: 'nine sixteenths',
        11: 'eleven sixteenths',
        13: 'thirteen sixteenths',
        15: 'fifteen sixteenths'
      };
      return sixteenthsMap[num] || '';
    }
    return '';
  }

  // --- Say Imperial Words in Inches and Feet ---
  function sayImperialWords(cm) {
    const imp = formatImperial(cm);
    const wholeInches = imp.wholeInches;
    const sixteenths = imp.sixteenths;
    const isExact = imp.isExact;

    let fracWords = '';
    if (sixteenths > 0) {
      const reduced = simplifyFraction(sixteenths, 16);
      fracWords = fractionToWords(reduced.num, reduced.den);
    }

    // Inches: "Fourteen and eleven sixteenths inches".
    // With no whole number: "three quarters of an inch". For exactly 1: "one inch".
    let inchBase = '';
    if (wholeInches === 0) {
      if (fracWords) {
        inchBase = `${fracWords} of an inch`;
      } else {
        inchBase = 'zero inches';
      }
    } else if (wholeInches === 1) {
      if (fracWords) {
        inchBase = `one and ${fracWords} inches`;
      } else {
        inchBase = 'one inch';
      }
    } else {
      if (fracWords) {
        inchBase = `${numberToWords(wholeInches)} and ${fracWords} inches`;
      } else {
        inchBase = `${numberToWords(wholeInches)} inches`;
      }
    }

    // If spot falls between 1/16 lines, start with "about"
    const inchTextWithAbout = isExact ? inchBase : `about ${inchBase}`;
    const capitalizedInches = inchTextWithAbout.charAt(0).toUpperCase() + inchTextWithAbout.slice(1);

    // Feet and inches: "one foot, two and eleven sixteenths inches".
    // If inches part is zero, say only the feet, such as "two feet".
    const feet = Math.floor(wholeInches / 12);
    const remInches = wholeInches % 12;

    let feetAndInchesBase = '';
    if (feet === 0) {
      feetAndInchesBase = inchTextWithAbout;
    } else {
      const feetWord = feet === 1 ? 'one foot' : `${numberToWords(feet)} feet`;
      if (remInches === 0 && !fracWords) {
        feetAndInchesBase = isExact ? feetWord : `about ${feetWord}`;
      } else {
        let remText = '';
        if (remInches === 0 && fracWords) {
          remText = `${fracWords} of an inch`;
        } else if (remInches === 1 && !fracWords) {
          remText = 'one inch';
        } else if (remInches === 1 && fracWords) {
          remText = `one and ${fracWords} inches`;
        } else if (remInches > 1 && !fracWords) {
          remText = `${numberToWords(remInches)} inches`;
        } else if (remInches > 1 && fracWords) {
          remText = `${numberToWords(remInches)} and ${fracWords} inches`;
        }

        const combined = `${feetWord}, ${remText}`;
        feetAndInchesBase = isExact ? combined : `about ${combined}`;
      }
    }

    return {
      inchesForm: capitalizedInches,
      feetForm: `or: ${feetAndInchesBase}`,
      speechInches: capitalizedInches
    };
  }

  // --- Update Readouts ---
  function updateReadoutCards(targetCm) {
    const cm = targetCm !== undefined ? targetCm : state.pinnedCm;

    // 1. Metric Card
    cardMetricCm.textContent = cm.toFixed(1);
    cardMetricMm.textContent = `${Math.round(cm * 10)} mm`;

    if (cm >= 100) {
      cardMetricMeterBox.style.display = 'flex';
      const m = Math.floor(cm / 100);
      const remCm = (cm % 100).toFixed(1);
      cardMetricMeter.textContent = `${m} m ${remCm} cm`;
    } else {
      cardMetricMeterBox.style.display = 'flex';
      cardMetricMeter.textContent = `${(cm / 100).toFixed(3)} m`;
    }

    // 2. Imperial Card
    const imp = formatImperial(cm);
    cardImperialFraction.textContent = imp.displayFraction;
    cardImperialFeet.textContent = imp.feetStr;
    cardImperialDecimal.textContent = imp.decimalStr;

    if (imp.isExact) {
      cardImperialBadge.className = 'accuracy-badge exact';
      cardImperialBadge.textContent = 'Exact 1/16″';
    } else {
      cardImperialBadge.className = 'accuracy-badge approx';
      const sign = imp.diff > 0 ? '+' : '';
      cardImperialBadge.textContent = `Nearest 1/16″ (${sign}${imp.diff.toFixed(3)}″)`;
    }

    // 3. Fraction Segment Breakdown
    const segments = fractionBar.querySelectorAll('.fraction-segment');
    segments.forEach((seg, idx) => {
      seg.classList.toggle('active', idx === imp.sixteenths);
    });

    if (imp.sixteenths === 0) {
      fractionStepName.textContent = '0/16 (Exact Whole Inch)';
    } else {
      const red = simplifyFraction(imp.sixteenths, 16);
      fractionStepName.textContent = `${imp.sixteenths}/16 = ${red.num}/${red.den}″`;
    }

    // 4. Say it in words Card
    const metricWords = sayMetricWords(cm);
    const imperialWords = sayImperialWords(cm);

    if (wordsMetricLong) wordsMetricLong.textContent = metricWords.longForm;
    if (wordsMetricDecimal) wordsMetricDecimal.textContent = metricWords.decimalForm;
    if (wordsImperialInches) wordsImperialInches.textContent = imperialWords.inchesForm;
    if (wordsImperialFeet) wordsImperialFeet.textContent = imperialWords.feetForm;

    currentMetricSpeech = metricWords.longForm;
    currentImperialSpeech = imperialWords.speechInches;

    // 5. Update Sliders (only when targetCm matches pinnedCm)
    if (targetCm === undefined || targetCm === state.pinnedCm) {
      posSlider.value = cm;
      posReadout.textContent = `${cm.toFixed(1)} cm`;
    }
  }

  function updateSliders() {
    posSlider.max = state.tapeLengthCm;
    posSlider.value = state.pinnedCm;
    posReadout.textContent = `${state.pinnedCm.toFixed(1)} cm`;

    // Map zoom to 0-100 logarithmic slider
    const minZ = getMinZoom();
    const logMin = Math.log(minZ);
    const logMax = Math.log(MAX_ZOOM);
    const logVal = Math.log(state.zoom);
    const sliderPercent = ((logVal - logMin) / (logMax - logMin)) * 100;

    zoomSlider.value = Math.max(0, Math.min(100, sliderPercent));
    zoomReadout.textContent = `${Math.round(state.zoom)} px/cm`;
  }

  // --- DRAWING THE REALISTIC TWO-SIDED TAPE MEASURE ---
  function drawTape() {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

    // 1. Draw workshop background behind tape
    ctx.fillStyle = isDark ? '#0b1120' : '#e2e8f0';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Subtle background guidelines
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)';
    ctx.lineWidth = 1;
    for (let y = 20; y < canvasHeight; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasWidth, y);
      ctx.stroke();
    }

    const tapeTop = Math.floor((canvasHeight - TAPE_HEIGHT) / 2);
    const tapeBottom = tapeTop + TAPE_HEIGHT;
    const startX = cmToScreenX(0);
    const endX = cmToScreenX(state.tapeLengthCm);

    // Visible range in cm
    const visibleMinCm = Math.max(0, screenXToCm(CASE_WIDTH));
    const visibleMaxCm = Math.min(state.tapeLengthCm, screenXToCm(canvasWidth + 20));

    // 2. Draw Yellow Metal Blade
    if (endX > startX) {
      const bladeW = Math.max(0, endX - startX);
      ctx.save();
      ctx.beginPath();
      ctx.rect(startX, tapeTop, bladeW, TAPE_HEIGHT);
      ctx.clip();

      // Blade 3D curved metallic gradient (curved concave tape profile)
      const grad = ctx.createLinearGradient(0, tapeTop, 0, tapeBottom);
      grad.addColorStop(0.00, '#eab308'); // Top edge
      grad.addColorStop(0.12, '#fde047');
      grad.addColorStop(0.40, '#fef08a'); // Highlight reflection curve
      grad.addColorStop(0.50, '#ffffff'); // Glint ridge
      grad.addColorStop(0.60, '#fef08a');
      grad.addColorStop(0.88, '#facc15');
      grad.addColorStop(1.00, '#ca8a04'); // Bottom edge shadow

      ctx.fillStyle = grad;
      ctx.fillRect(startX, tapeTop, bladeW, TAPE_HEIGHT);

      // Dark subtle borders along top and bottom edges of metal blade
      ctx.fillStyle = '#713f12';
      ctx.fillRect(startX, tapeTop, bladeW, 1.5);
      ctx.fillRect(startX, tapeBottom - 1.5, bladeW, 1.5);

      // 3. Sticky Guide Tag: "cm ▲ inch ▼" near beginning of blade
      const tagCm = 1.6;
      const tagX = cmToScreenX(tagCm);
      if (tagX > startX && tagX < canvasWidth) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.strokeStyle = '#ca8a04';
        ctx.lineWidth = 1;
        const tagW = 74;
        const tagH = 24;
        const tagY = tapeTop + (TAPE_HEIGHT - tagH) / 2;
        ctx.beginPath();
        ctx.roundRect(tagX, tagY, tagW, tagH, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 11px var(--font-tape)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('cm ▲  inch ▼', tagX + tagW / 2, tagY + tagH / 2);
        ctx.restore();
      }

      // ----------------------------------------------------
      // TOP EDGE: METRIC (mm, 5mm, cm, 5cm, 10cm, meters)
      // ----------------------------------------------------
      const pxPerMm = state.zoom / 10;
      const draw1mm = pxPerMm >= 3.0;
      const draw5mm = pxPerMm * 5 >= 3.0;
      const numStepMetric = getMetricNumberStep(state.zoom);

      ctx.save();
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#0f172a';

      // Loop through visible centimeters
      const cmStartInt = Math.floor(visibleMinCm);
      const cmEndInt = Math.ceil(visibleMaxCm);

      for (let c = cmStartInt; c <= cmEndInt; c++) {
        const xCm = cmToScreenX(c);

        // Millimeter ticks inside this cm (1..9)
        if (c < state.tapeLengthCm) {
          for (let m = 1; m < 10; m++) {
            const is5mm = m === 5;
            if (is5mm ? draw5mm : draw1mm) {
              const xMm = xCm + m * pxPerMm;
              if (xMm >= startX && xMm <= endX && xMm >= CASE_WIDTH && xMm <= canvasWidth) {
                const tickLen = is5mm ? 22 : 13;
                ctx.lineWidth = is5mm ? 1.5 : 1.0;
                ctx.beginPath();
                ctx.moveTo(xMm, tapeTop);
                ctx.lineTo(xMm, tapeTop + tickLen);
                ctx.stroke();
              }
            }
          }
        }

        // Full Centimeter tick
        if (xCm >= startX && xCm <= endX && xCm >= CASE_WIDTH - 20 && xCm <= canvasWidth + 20) {
          const is100cm = c > 0 && c % 100 === 0;
          const is10cm = c > 0 && c % 10 === 0;
          const is5cm = c % 5 === 0;

          let tickLen = 28;
          let lineWidth = 1.5;

          if (is100cm) {
            tickLen = 48;
            lineWidth = 2.5;
            ctx.strokeStyle = '#dc2626';
          } else if (is10cm) {
            tickLen = 42;
            lineWidth = 2.2;
            ctx.strokeStyle = '#dc2626';
          } else if (is5cm) {
            tickLen = 34;
            lineWidth = 1.8;
            ctx.strokeStyle = '#0f172a';
          } else {
            ctx.strokeStyle = '#0f172a';
          }

          ctx.lineWidth = lineWidth;
          ctx.beginPath();
          ctx.moveTo(xCm, tapeTop);
          ctx.lineTo(xCm, tapeTop + tickLen);
          ctx.stroke();

          // Centimeter Labels (adaptive so they never collide)
          if (c > 0 && c % numStepMetric === 0) {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';

            if (is100cm) {
              // Meter badge
              const meterVal = c / 100;
              const badgeText = `${meterVal} m`;
              ctx.font = 'bold 15px var(--font-tape)';
              const txtW = ctx.measureText(badgeText).width + 10;
              ctx.fillStyle = '#dc2626';
              ctx.beginPath();
              ctx.roundRect(xCm - txtW / 2, tapeTop + tickLen + 3, txtW, 20, 4);
              ctx.fill();

              ctx.fillStyle = '#ffffff';
              ctx.fillText(badgeText, xCm, tapeTop + tickLen + 6);
            } else if (is10cm) {
              // 10cm bold red number
              ctx.fillStyle = '#dc2626';
              ctx.font = 'bold 16px var(--font-tape)';
              ctx.fillText(c.toString(), xCm, tapeTop + tickLen + 4);
            } else {
              // Standard black cm number
              ctx.fillStyle = '#0f172a';
              ctx.font = '600 13px var(--font-tape)';
              ctx.fillText(c.toString(), xCm, tapeTop + tickLen + 4);
            }
          }
        }
      }
      ctx.restore();

      // ----------------------------------------------------
      // BOTTOM EDGE: IMPERIAL (1/16, 1/8, 1/4, 1/2, 1 in, feet, stud diamonds)
      // ----------------------------------------------------
      const pxPerInch = state.zoom * INCH_TO_CM;
      const pxPer16th = pxPerInch / 16;
      const draw16th = pxPer16th >= 3.0;
      const draw8th = pxPer16th * 2 >= 3.0;
      const draw4th = pxPer16th * 4 >= 3.0;
      const drawHalf = pxPer16th * 8 >= 3.0;
      const numStepImperial = getImperialNumberStep(state.zoom);

      const totalInchesOnTape = state.tapeLengthCm * CM_TO_INCH;
      const inchStartInt = Math.floor(visibleMinCm * CM_TO_INCH);
      const inchEndInt = Math.ceil(visibleMaxCm * CM_TO_INCH);

      ctx.save();
      for (let inch = inchStartInt; inch <= inchEndInt; inch++) {
        const xInch = cmToScreenX(inch * INCH_TO_CM);

        // 16th fractional ticks inside this inch
        if (inch < totalInchesOnTape) {
          for (let s = 1; s < 16; s++) {
            let shouldDraw = false;
            let tickH = 11;
            let lw = 1.0;

            if (s === 8) {
              // Half inch
              shouldDraw = drawHalf;
              tickH = 34;
              lw = 1.8;
            } else if (s === 4 || s === 12) {
              // Quarter inch
              shouldDraw = draw4th;
              tickH = 26;
              lw = 1.5;
            } else if (s % 2 === 0) {
              // Eighth inch
              shouldDraw = draw8th;
              tickH = 18;
              lw = 1.2;
            } else {
              // Sixteenth inch
              shouldDraw = draw16th;
              tickH = 11;
              lw = 0.9;
            }

            if (shouldDraw) {
              const xFrac = xInch + s * pxPer16th;
              if (xFrac >= startX && xFrac <= endX && xFrac >= CASE_WIDTH && xFrac <= canvasWidth) {
                ctx.lineWidth = lw;
                ctx.strokeStyle = '#0f172a';
                ctx.beginPath();
                ctx.moveTo(xFrac, tapeBottom);
                ctx.lineTo(xFrac, tapeBottom - tickH);
                ctx.stroke();
              }
            }
          }
        }

        // Full inch tick
        if (xInch >= startX && xInch <= endX && xInch >= CASE_WIDTH - 20 && xInch <= canvasWidth + 20) {
          const isFoot = inch > 0 && inch % 12 === 0;
          const isStud = inch > 0 && inch % 16 === 0;

          const tickLen = isFoot ? 48 : 42;
          ctx.lineWidth = isFoot ? 2.5 : 2.0;
          ctx.strokeStyle = isFoot ? '#dc2626' : '#0f172a';

          ctx.beginPath();
          ctx.moveTo(xInch, tapeBottom);
          ctx.lineTo(xInch, tapeBottom - tickLen);
          ctx.stroke();

          // Red Stud Diamond every 16 inches (♦)
          if (isStud) {
            const diamondY = tapeBottom - tickLen - 12;
            const dSize = 6;
            ctx.fillStyle = '#dc2626';
            ctx.beginPath();
            ctx.moveTo(xInch, diamondY - dSize);
            ctx.lineTo(xInch + dSize, diamondY);
            ctx.lineTo(xInch, diamondY + dSize);
            ctx.lineTo(xInch - dSize, diamondY);
            ctx.closePath();
            ctx.fill();
          }

          // Inch Numbers
          if (inch > 0 && inch % numStepImperial === 0) {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';

            if (isFoot) {
              // Foot mark badge + red number
              const footNum = inch / 12;
              const badgeTxt = `${footNum} ft`;
              ctx.font = 'bold 15px var(--font-tape)';
              const bWidth = ctx.measureText(badgeTxt).width + 10;

              ctx.fillStyle = '#dc2626';
              ctx.beginPath();
              ctx.roundRect(xInch - bWidth / 2, tapeBottom - tickLen - 26, bWidth, 20, 4);
              ctx.fill();

              ctx.fillStyle = '#ffffff';
              ctx.fillText(badgeTxt, xInch, tapeBottom - tickLen - 8);

              // Also red inch number below badge
              ctx.fillStyle = '#dc2626';
              ctx.font = 'bold 16px var(--font-tape)';
              ctx.fillText(inch.toString(), xInch, tapeBottom - tickLen - 30);
            } else {
              // Standard black inch number
              ctx.fillStyle = '#0f172a';
              ctx.font = 'bold 15px var(--font-tape)';
              ctx.fillText(inch.toString(), xInch, tapeBottom - tickLen - 4);
            }
          }
        }
      }
      ctx.restore();

      // Blade end stop
      if (endX < canvasWidth) {
        ctx.fillStyle = '#78350f';
        ctx.fillRect(endX - 2, tapeTop, 4, TAPE_HEIGHT);
        // Back of tape texture
        ctx.fillStyle = isDark ? '#1e293b' : '#cbd5e1';
        ctx.fillRect(endX + 2, tapeTop + 20, 30, TAPE_HEIGHT - 40);
      }

      ctx.restore();
    }

    // 4. Draw Metal Hook at cm = 0
    if (startX > -40 && startX < canvasWidth + 40) {
      drawHook(startX, tapeTop, TAPE_HEIGHT);
    }

    // 5. Draw Tape Housing Case on Left
    drawCase(CASE_WIDTH, tapeTop, TAPE_HEIGHT, isDark);

    // 6. Draw Hover Preview Line
    if (state.hoverCm !== null && state.hoverCm >= 0 && state.hoverCm <= state.tapeLengthCm && !state.isDragging) {
      const hx = cmToScreenX(state.hoverCm);
      if (hx >= CASE_WIDTH && hx <= canvasWidth) {
        ctx.save();
        ctx.strokeStyle = '#06b6d4';
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(hx, 0);
        ctx.lineTo(hx, canvasHeight);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 7. Draw Pinned Cyan Measurement Indicator
    if (state.pinnedCm >= 0 && state.pinnedCm <= state.tapeLengthCm) {
      const px = cmToScreenX(state.pinnedCm);
      if (px >= CASE_WIDTH - 20 && px <= canvasWidth + 20) {
        drawPin(px, tapeTop, tapeBottom);
      }
    }

    // 8. Update Floating Flag Position
    const pinX = cmToScreenX(state.pinnedCm);
    if (pinX >= CASE_WIDTH && pinX <= canvasWidth) {
      floatingFlag.style.display = 'flex';
      floatingFlag.style.left = `${pinX}px`;
      floatingFlag.style.top = `${tapeTop - 28}px`;
      flagMetricTxt.textContent = `${state.pinnedCm.toFixed(1)} cm`;
      const imp = formatImperial(state.pinnedCm);
      flagImperialTxt.textContent = imp.displayFraction;
    } else {
      floatingFlag.style.display = 'none';
    }
  }

  // --- Draw Realistic Metal Hook ---
  function drawHook(x, y, h) {
    ctx.save();
    const hookW = 12;
    const lipH = 22;

    // Hook shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(x - hookW - 2, y - 6, hookW + 4, h + 12);

    // Silver metallic gradient
    const hookGrad = ctx.createLinearGradient(x - hookW, y, x, y);
    hookGrad.addColorStop(0.0, '#94a3b8');
    hookGrad.addColorStop(0.3, '#f1f5f9');
    hookGrad.addColorStop(0.7, '#cbd5e1');
    hookGrad.addColorStop(1.0, '#64748b');

    ctx.fillStyle = hookGrad;
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;

    // L-shaped hook bracket
    ctx.beginPath();
    ctx.roundRect(x - hookW, y - 6, hookW, h + 12, [3, 0, 0, 3]);
    ctx.fill();
    ctx.stroke();

    // Rivets (2 brass rivets)
    drawRivet(x - hookW / 2, y + h * 0.25);
    drawRivet(x - hookW / 2, y + h * 0.75);

    // Slotted nail grab hole in the center
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(x - hookW + 3, y + h / 2 - 8, 6, 16, 2);
    ctx.fill();

    ctx.restore();
  }

  function drawRivet(rx, ry) {
    ctx.save();
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.arc(rx, ry, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(rx - 0.8, ry - 0.8, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // --- Draw Tape Housing Case ---
  function drawCase(w, tapeY, tapeH, isDark) {
    ctx.save();

    // Drop shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 4;

    // Dark case body
    const caseGrad = ctx.createLinearGradient(0, 0, w, 0);
    caseGrad.addColorStop(0.0, '#0f172a');
    caseGrad.addColorStop(0.7, '#1e293b');
    caseGrad.addColorStop(1.0, '#334155');

    ctx.fillStyle = caseGrad;
    ctx.fillRect(0, 0, w, canvasHeight);
    ctx.shadowColor = 'transparent';

    // Red rubberized accent stripe
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(w - 22, 0, 6, canvasHeight);

    // Case bezel edge
    ctx.fillStyle = '#475569';
    ctx.fillRect(w - 3, 0, 3, canvasHeight);

    // Tape throat exit slot
    ctx.fillStyle = '#020617';
    ctx.fillRect(w - 14, tapeY - 4, 14, tapeH + 8);

    // Case Length Label
    ctx.save();
    ctx.translate(w / 2 - 8, canvasHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 15px var(--font-tape)';
    const meters = (state.tapeLengthCm / 100).toFixed(0);
    const feet = (state.tapeLengthCm * CM_TO_INCH / 12).toFixed(1);
    ctx.fillText(`${meters} m / ${feet} ft`, 0, -4);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 10px var(--font-tape)';
    ctx.fillText('HEAVY DUTY', 0, 11);
    ctx.restore();

    ctx.restore();
  }

  // --- Draw Pinned Line & Pointers ---
  function drawPin(x, tapeTop, tapeBottom) {
    ctx.save();

    // Glowing cyan line
    ctx.strokeStyle = '#06b6d4';
    ctx.shadowColor = 'rgba(6, 182, 212, 0.6)';
    ctx.shadowBlur = 8;
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.moveTo(x, tapeTop - 14);
    ctx.lineTo(x, tapeBottom + 14);
    ctx.stroke();

    // Top Pointer Arrow
    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();
    ctx.moveTo(x - 7, tapeTop - 14);
    ctx.lineTo(x + 7, tapeTop - 14);
    ctx.lineTo(x, tapeTop);
    ctx.closePath();
    ctx.fill();

    // Bottom Pointer Arrow
    ctx.beginPath();
    ctx.moveTo(x - 7, tapeBottom + 14);
    ctx.lineTo(x + 7, tapeBottom + 14);
    ctx.lineTo(x, tapeBottom);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // --- Pointer & Touch Interactions ---
  let activePointers = new Map();

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return; // Left click only
    container.setPointerCapture(e.pointerId);
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.size === 1) {
      state.isDragging = true;
      state.dragStartX = e.clientX;
      state.lastDragX = e.clientX;
      state.dragStartOffset = state.scrollOffsetPx;
      state.dragVelocityX = 0;
    } else if (activePointers.size === 2) {
      // Start 2-finger pinch
      state.isDragging = false;
      state.isPinching = true;
      const pts = Array.from(activePointers.values());
      state.pinchStartDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      state.pinchStartZoom = state.zoom;
      const rect = container.getBoundingClientRect();
      state.pinchCenterCanvasX = ((pts[0].x + pts[1].x) / 2) - rect.left;
    }
  }

  function onPointerMove(e) {
    if (activePointers.has(e.pointerId)) {
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    const rect = container.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;

    if (state.isPinching && activePointers.size === 2) {
      const pts = Array.from(activePointers.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (state.pinchStartDist > 0) {
        const factor = dist / state.pinchStartDist;
        const targetZ = state.pinchStartZoom * factor;
        zoomAt(state.pinchCenterCanvasX, targetZ / state.zoom);
      }
      return;
    }

    if (state.isDragging) {
      const dx = e.clientX - state.dragStartX;
      state.dragVelocityX = e.clientX - state.lastDragX;
      state.lastDragX = e.clientX;
      state.scrollOffsetPx = state.dragStartOffset + dx;
      clampOffsets();
      updateSliders();
      drawTape();
    } else {
      // Hover tracking
      const cm = screenXToCm(canvasX);
      if (cm >= 0 && cm <= state.tapeLengthCm && canvasX >= CASE_WIDTH) {
        state.hoverCm = Math.round(cm * 10) / 10;
        updateReadoutCards(state.hoverCm);
      } else {
        if (state.hoverCm !== null) {
          state.hoverCm = null;
          updateReadoutCards(state.pinnedCm);
        }
      }
      drawTape();
    }
  }

  function onPointerUp(e) {
    if (activePointers.has(e.pointerId)) {
      activePointers.delete(e.pointerId);
    }

    if (activePointers.size === 0) {
      if (state.isDragging) {
        state.isDragging = false;

        const totalDist = Math.abs(e.clientX - state.dragStartX);
        // If movement was tiny (< 5px), treat as tap/click to pin!
        if (totalDist < 5) {
          const rect = container.getBoundingClientRect();
          const canvasX = e.clientX - rect.left;
          pinAtCanvasX(canvasX);
        } else if (Math.abs(state.dragVelocityX) > 2) {
          // Momentum / Inertia glide
          startInertia(state.dragVelocityX);
        }
      }
      state.isPinching = false;
    } else if (activePointers.size === 1) {
      // Revert to single finger drag
      state.isPinching = false;
      state.isDragging = true;
      const pt = Array.from(activePointers.values())[0];
      state.dragStartX = pt.x;
      state.lastDragX = pt.x;
      state.dragStartOffset = state.scrollOffsetPx;
      state.dragVelocityX = 0;
    }
  }

  function startInertia(initialVx) {
    let vx = initialVx * 1.2;
    function inertiaStep() {
      if (state.isDragging || state.isPinching) return;
      vx *= 0.91;
      state.scrollOffsetPx += vx;
      clampOffsets();
      updateSliders();
      drawTape();

      if (Math.abs(vx) > 0.3) {
        requestAnimationFrame(inertiaStep);
      }
    }
    requestAnimationFrame(inertiaStep);
  }

  // --- Snap & Pin at Clicked Canvas X ---
  function pinAtCanvasX(canvasX) {
    if (canvasX < CASE_WIDTH) return;
    const rawCm = screenXToCm(canvasX);
    // Snap to nearest 1 mm (0.1 cm)
    const snappedCm = Math.max(0, Math.min(state.tapeLengthCm, Math.round(rawCm * 10) / 10));

    state.pinnedCm = snappedCm;
    updateReadoutCards();
    drawTape();
  }

  // --- Wheel Zooming ---
  function onWheel(e) {
    e.preventDefault();
    const rect = container.getBoundingClientRect();
    const focalX = e.clientX - rect.left;
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    zoomAt(focalX, factor);
  }

  container.addEventListener('pointerdown', onPointerDown);
  container.addEventListener('pointermove', onPointerMove);
  container.addEventListener('pointerup', onPointerUp);
  container.addEventListener('pointercancel', onPointerUp);
  container.addEventListener('wheel', onWheel, { passive: false });
  container.addEventListener('pointerleave', () => {
    if (state.hoverCm !== null) {
      state.hoverCm = null;
      updateReadoutCards(state.pinnedCm);
      drawTape();
    }
  });

  // --- Speech Synthesis & Show Words Toggle ---
  function handleReadAloud() {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    // Metric long form, then "In inches:" and the inch words
    const speechText = `${currentMetricSpeech}. In inches: ${currentImperialSpeech}.`;
    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = 'en-GB';
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  }

  if (readAloudBtn) {
    if (!('speechSynthesis' in window)) {
      readAloudBtn.style.display = 'none';
    } else {
      readAloudBtn.addEventListener('click', handleReadAloud);
    }
  }

  if (showWordsToggle && wordsContent) {
    showWordsToggle.addEventListener('change', () => {
      wordsContent.style.display = showWordsToggle.checked ? 'flex' : 'none';
    });
  }

  // --- Slider Controls ---
  posSlider.addEventListener('input', (e) => {
    state.pinnedCm = parseFloat(e.target.value);
    centerOnCm(state.pinnedCm, false);
    updateReadoutCards();
  });

  zoomSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    const minZ = getMinZoom();
    const logMin = Math.log(minZ);
    const logMax = Math.log(MAX_ZOOM);
    const targetZ = Math.exp(logMin + (val / 100) * (logMax - logMin));

    const centerX = (canvasWidth + CASE_WIDTH) / 2;
    zoomAt(centerX, targetZ / state.zoom);
  });

  // Buttons
  zoomInBtn.addEventListener('click', () => {
    const centerX = (canvasWidth + CASE_WIDTH) / 2;
    zoomAt(centerX, 1.3);
  });

  zoomOutBtn.addEventListener('click', () => {
    const centerX = (canvasWidth + CASE_WIDTH) / 2;
    zoomAt(centerX, 0.77);
  });

  fitTapeBtn.addEventListener('click', () => {
    fitWholeTape(true);
  });

  centerPinBtn.addEventListener('click', () => {
    centerOnCm(state.pinnedCm, true);
  });

  // Keyboard Navigation
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

    if (e.key === 'ArrowLeft') {
      state.scrollOffsetPx += 40;
      clampOffsets();
      updateSliders();
      drawTape();
    } else if (e.key === 'ArrowRight') {
      state.scrollOffsetPx -= 40;
      clampOffsets();
      updateSliders();
      drawTape();
    } else if (e.key === '+' || e.key === '=') {
      zoomAt((canvasWidth + CASE_WIDTH) / 2, 1.25);
    } else if (e.key === '-' || e.key === '_') {
      zoomAt((canvasWidth + CASE_WIDTH) / 2, 0.8);
    } else if (e.key === 'Home') {
      fitWholeTape(true);
    }
  });

  // --- Jump To Parser ---
  function parseMeasurement(str, defaultUnit) {
    const clean = str.trim().toLowerCase();
    if (!clean) return null;

    // Mixed fraction regex: e.g. "5 3/8" or "14 11/16"
    const mixedMatch = clean.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
    if (mixedMatch) {
      const whole = parseInt(mixedMatch[1], 10);
      const num = parseInt(mixedMatch[2], 10);
      const den = parseInt(mixedMatch[3], 10);
      if (den === 0) return null;
      return { val: whole + num / den, unit: defaultUnit };
    }

    // Pure fraction regex: e.g. "3/8" or "7/16"
    const fracMatch = clean.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (fracMatch) {
      const num = parseInt(fracMatch[1], 10);
      const den = parseInt(fracMatch[2], 10);
      if (den === 0) return null;
      return { val: num / den, unit: defaultUnit };
    }

    // Decimal with optional trailing unit: e.g. "25.4 cm" or "10 in" or "1.5"
    const decMatch = clean.match(/^([0-9]*\.?[0-9]+)\s*([a-z]*)$/);
    if (decMatch) {
      const num = parseFloat(decMatch[1]);
      if (isNaN(num)) return null;
      const unit = decMatch[2] || defaultUnit;
      return { val: num, unit: unit };
    }

    return null;
  }

  function handleJump() {
    const rawVal = jumpValInput.value;
    const unit = jumpUnitSelect.value;
    const parsed = parseMeasurement(rawVal, unit);

    if (!parsed) {
      jumpFeedback.className = 'feedback-msg error';
      jumpFeedback.textContent = '❌ Try entering a number like: 25.4, 5 3/8, 120, or 1.5';
      return;
    }

    // Convert to CM
    let targetCm = 0;
    switch (parsed.unit) {
      case 'cm': targetCm = parsed.val; break;
      case 'mm': targetCm = parsed.val / 10; break;
      case 'm': targetCm = parsed.val * 100; break;
      case 'in': targetCm = parsed.val * INCH_TO_CM; break;
      case 'ft': targetCm = parsed.val * 12 * INCH_TO_CM; break;
      default: targetCm = parsed.val; break;
    }

    if (targetCm < 0) {
      jumpFeedback.className = 'feedback-msg error';
      jumpFeedback.textContent = '❌ Measurement cannot be negative!';
      return;
    }

    if (targetCm > state.tapeLengthCm) {
      jumpFeedback.className = 'feedback-msg error';
      const mLen = (state.tapeLengthCm / 100).toFixed(0);
      jumpFeedback.textContent = `⚠️ Past the end of this ${mLen} m tape! Pick a longer tape or enter a value under ${mLen} m.`;
      return;
    }

    // Valid: snap to 1 mm, zoom in to at least 34 px/cm, center and pin!
    const snappedCm = Math.round(targetCm * 10) / 10;
    state.pinnedCm = snappedCm;
    updateReadoutCards();

    // Ensure zoom is high enough to see details clearly
    const targetZ = Math.max(state.zoom, 38.0);
    const targetX = (canvasWidth + CASE_WIDTH) / 2;
    const targetOffset = targetX - CASE_WIDTH - snappedCm * targetZ;

    animateTo(targetOffset, targetZ);

    jumpFeedback.className = 'feedback-msg success';
    const imp = formatImperial(snappedCm);
    jumpFeedback.textContent = `📍 Found ${snappedCm.toFixed(1)} cm (${imp.displayFraction})!`;
  }

  jumpForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleJump();
  });

  // --- Tape Length Presets & Custom ---
  function setTapeLength(meters) {
    const clampedMeters = Math.max(0.3, Math.min(30.0, meters));
    state.tapeLengthCm = Math.round(clampedMeters * 100);

    // Update equivalence badge
    const ftEquiv = (state.tapeLengthCm * CM_TO_INCH / 12).toFixed(1);
    lengthEquivBadge.textContent = `${clampedMeters.toFixed(1)} m = ${ftEquiv} ft`;

    // Clamp pinned value if it was past new length
    if (state.pinnedCm > state.tapeLengthCm) {
      state.pinnedCm = state.tapeLengthCm;
      updateReadoutCards();
    }

    clampOffsets();
    updateSliders();
    drawTape();
  }

  presetBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      presetBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      if (btn.dataset.m) {
        setTapeLength(parseFloat(btn.dataset.m));
      } else if (btn.dataset.ft) {
        const ft = parseFloat(btn.dataset.ft);
        setTapeLength((ft * 12 * INCH_TO_CM) / 100);
      }
    });
  });

  setCustomLengthBtn.addEventListener('click', () => {
    const val = parseFloat(customLengthInput.value);
    if (isNaN(val) || val <= 0) return;
    const unit = customLengthUnit.value;
    presetBtns.forEach((b) => b.classList.remove('active'));

    if (unit === 'm') {
      setTapeLength(val);
    } else {
      setTapeLength((val * 12 * INCH_TO_CM) / 100);
    }
  });

  // --- Theme Switching ---
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('tape_measure_theme', theme);
    drawTape();
  }

  const savedTheme = localStorage.getItem('tape_measure_theme') ||
    (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  applyTheme(savedTheme);

  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'light' ? 'dark' : 'light');
  });

  // --- Scroll to Tips ---
  guideModalBtn.addEventListener('click', () => {
    const guide = document.getElementById('learning-guide');
    if (guide) {
      guide.scrollIntoView({ behavior: 'smooth' });
    }
  });

  // --- Offline Service Worker Registration ---
  function initServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => {
          if (reg.installing) {
            offlineStatus.className = 'offline-badge pending';
            offlineStatus.querySelector('.text').textContent = 'Caching app...';
          } else if (reg.active) {
            offlineStatus.className = 'offline-badge offline-active';
            offlineStatus.querySelector('.text').textContent = '✓ Ready offline';
          }

          reg.addEventListener('updatefound', () => {
            const installingWorker = reg.installing;
            installingWorker.addEventListener('statechange', () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                offlineStatus.className = 'offline-badge offline-active';
                offlineStatus.querySelector('.text').textContent = '✓ Ready offline';
              }
            });
          });
        })
        .catch((err) => {
          // If running locally without service worker support (e.g. file:// protocol)
          offlineStatus.className = 'offline-badge offline-active';
          offlineStatus.querySelector('.text').textContent = 'Offline Ready';
        });

      navigator.serviceWorker.ready.then(() => {
        offlineStatus.className = 'offline-badge offline-active';
        offlineStatus.querySelector('.text').textContent = '✓ Ready offline';
      });
    } else {
      offlineStatus.className = 'offline-badge offline-active';
      offlineStatus.querySelector('.text').textContent = 'Local Mode';
    }
  }

  // --- Initial Start ---
  initFractionBar();
  resizeCanvas();
  updateReadoutCards();
  centerOnCm(state.pinnedCm, false);
  initServiceWorker();

})();
