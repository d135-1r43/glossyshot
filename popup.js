import { renderMockup, BACKGROUNDS } from './render.js';

const DEFAULTS = { viewport: '1280x800', scale: '2', theme: 'light', padding: 'm', background: 'grape', autoSave: false };

const $ = (id) => document.getElementById(id);
const preview = $('preview');
const previewImg = $('previewImg');

let settings = { ...DEFAULTS };
let capture = null; // { img, url, title, scale }
let output = null;  // { blob, objectUrl, width, height }

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 1600);
}

function flash(button, text) {
  const label = button.querySelector('.label');
  const original = label.dataset.original ??= label.textContent;
  label.textContent = text;
  button.classList.add('done');
  clearTimeout(button.timer);
  button.timer = setTimeout(() => {
    label.textContent = original;
    button.classList.remove('done');
  }, 1400);
}

function showError(msg) {
  preview.classList.remove('loading', 'ready');
  previewImg.hidden = true;
  $('error').textContent = msg;
  $('error').hidden = false;
  $('meta').textContent = '';
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Captures at a simulated viewport via device emulation, so the page lays out
// as it would in a smaller window — independent of how big the real window is.
async function captureEmulated(tab, width, height, scale) {
  const target = { tabId: tab.id };
  const send = (method, params) => chrome.debugger.sendCommand(target, method, params);
  await chrome.debugger.attach(target, '1.3');
  try {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false });
    // Give responsive layouts, lazy images and resize handlers a moment to settle.
    await new Promise((r) => setTimeout(r, 500));
    const { data } = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    return 'data:image/png;base64,' + data;
  } finally {
    await send('Emulation.clearDeviceMetricsOverride').catch(() => {});
    await chrome.debugger.detach(target).catch(() => {});
  }
}

// Captures run one at a time — two debugger sessions on one tab would collide.
let captureQueue = Promise.resolve();
function takeCapture() {
  captureQueue = captureQueue.then(doCapture, doCapture);
  return captureQueue;
}

async function doCapture() {
  preview.classList.add('loading');
  preview.classList.remove('ready');
  $('error').hidden = true;
  setBusy(true);
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    let dataUrl, scale;
    if (settings.viewport === 'window') {
      dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    } else {
      const [w, h] = settings.viewport.split('x').map(Number);
      scale = Number(settings.scale);
      dataUrl = await captureEmulated(tab, w, h, scale);
    }
    const img = await loadImage(dataUrl);
    capture = { img, url: tab.url || '', title: tab.title || '', scale: scale ?? img.width / tab.width };
  } catch (err) {
    console.error(err);
    showError(/attach|cannot access|chrome:\/\//i.test(err?.message ?? '') || !err?.message
      ? "Chrome doesn't allow capturing this page (e.g. chrome:// pages or the Web Store). Try a regular website!"
      : `Capture failed: ${err.message}`);
    return false;
  }
  await render();
  return true;
}

async function render() {
  if (!capture) return;
  const canvas = renderMockup(capture.img, capture.url, { ...settings, scale: capture.scale });
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  if (output) URL.revokeObjectURL(output.objectUrl);
  output = { blob, objectUrl: URL.createObjectURL(blob), width: canvas.width, height: canvas.height };

  previewImg.hidden = false;
  previewImg.src = output.objectUrl;
  await previewImg.decode().catch(() => {});
  preview.classList.remove('loading');
  preview.classList.add('ready');
  $('meta').textContent = `${output.width} × ${output.height} px · ${(blob.size / 1024 / 1024).toFixed(1)} MB`;
  setBusy(false);
}

function setBusy(busy) {
  $('download').disabled = busy;
  $('copy').disabled = busy;
}

function filename() {
  let host = 'screenshot';
  try { host = new URL(capture.url).hostname.replace(/^www\./, '') || host; } catch { /* keep default */ }
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
  return `${host.replace(/[^a-z0-9.-]/gi, '_')}_${stamp}.png`;
}

async function download() {
  if (!output) return;
  await chrome.downloads.download({ url: output.objectUrl, filename: filename() });
  flash($('download'), 'Saved ✓');
  toast('Saved to Downloads 🎉');
}

async function copy() {
  if (!output) return;
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': output.blob })]);
    flash($('copy'), 'Copied ✓');
    toast('Copied to clipboard ✨');
  } catch (err) {
    console.error(err);
    toast("Couldn't copy — try Download");
  }
}

function syncControls() {
  document.querySelectorAll('.seg').forEach((seg) => {
    seg.querySelectorAll('button').forEach((b) =>
      b.classList.toggle('on', b.dataset.value === String(settings[seg.dataset.key])));
  });
  document.querySelectorAll('#swatches button').forEach((b) =>
    b.classList.toggle('on', b.dataset.value === settings.background));
  $('autoSave').checked = settings.autoSave;
  $('scaleRow').classList.toggle('disabled', settings.viewport === 'window');
}

async function update(key, value) {
  settings[key] = value;
  syncControls();
  chrome.storage.sync.set({ [key]: value });
  if (key === 'viewport' || key === 'scale') await takeCapture();
  else if (key !== 'autoSave') await render();
}

function buildSwatches() {
  const wrap = $('swatches');
  for (const [name, colors] of Object.entries(BACKGROUNDS)) {
    const b = document.createElement('button');
    b.dataset.value = name;
    b.title = name[0].toUpperCase() + name.slice(1);
    if (colors) b.style.background = `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`;
    else b.classList.add('none');
    wrap.append(b);
  }
}

async function init() {
  buildSwatches();
  settings = { ...DEFAULTS, ...(await chrome.storage.sync.get(DEFAULTS)) };
  syncControls();

  document.querySelectorAll('.seg').forEach((seg) =>
    seg.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) update(seg.dataset.key, b.dataset.value);
    }));
  $('swatches').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) update('background', b.dataset.value);
  });
  $('autoSave').addEventListener('change', (e) => update('autoSave', e.target.checked));
  $('download').addEventListener('click', download);
  $('copy').addEventListener('click', copy);
  $('retake').addEventListener('click', takeCapture);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.target.closest('button, input')) download();
    if ((e.metaKey || e.ctrlKey) && e.key === 'c') copy();
  });

  if (await takeCapture() && settings.autoSave) await download();
}

init();
