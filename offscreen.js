// offscreen.js

import { pipeline, env } from './transformers.min.js';

// Configure transformers.js to use WebGPU and download models locally
env.allowLocalModels = false; 
env.allowRemoteModels = true; 
env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('/');

let classifier = null;
let isInitializing = false;

async function initModel() {
  if (classifier) return classifier;
  if (isInitializing) {
      // wait until initialized
      while(isInitializing) {
          await new Promise(r => setTimeout(r, 100));
      }
      if (classifier) return classifier;
      // If classifier is still null, the previous initialization failed.
      // We will fall through and try to initialize again!
  }
  
  isInitializing = true;
  try {
    try {
      // Try WebGPU first
      classifier = await pipeline('image-classification', 'onnx-community/ai-image-detect-distilled-ONNX', {
        device: 'webgpu'
      });
    } catch (e) {
      console.warn("WebGPU failed, falling back to WASM/CPU:", e);
      classifier = await pipeline('image-classification', 'onnx-community/ai-image-detect-distilled-ONNX', {
        device: 'wasm'
      });
    }
  } catch (err) {
    console.error("Failed to initialize Transformers.js model:", err);
    throw err;
  } finally {
    isInitializing = false;
  }
  
  return classifier;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'OFFSCREEN_INIT') {
    initModel().then(() => sendResponse({ status: 'ready' }));
    return true;
  }

  if (request.type === 'OFFSCREEN_SCAN') {
    handleScan(request.imageUrl).then(sendResponse).catch(err => {
      console.error(err);
      sendResponse({ error: err.message });
    });
    return true;
  }
});

async function handleScan(imageUrl) {
  // 1. Fetch image buffer (first 128KB is enough for EXIF)
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  const buffer = await blob.arrayBuffer();

  // 2. Fast EXIF check
  const exifResult = scanForAiMetadata(buffer);
  if (exifResult.found) {
    return {
      score: 1.0,
      label: 'Surely AI',
      source: 'metadata',
      generator: exifResult.generator
    };
  }

  // 3. Fallback to Local AI Model (Transformers.js)
  const model = await initModel();
  
  // We need to convert the blob to an ImageBitmap or URL for transformers.js
  const objectUrl = URL.createObjectURL(blob);
  
  const results = await model(objectUrl);
  URL.revokeObjectURL(objectUrl);

  // Expected output format: [{ label: 'fake', score: 0.8 }, { label: 'real', score: 0.2 }]
  let fakeScore = 0;
  for (const r of results) {
    if (r.label.toLowerCase().includes('fake') || r.label.toLowerCase().includes('ai')) {
      fakeScore = r.score;
    }
  }

  // Map to our labels
  let label = 'Not AI';
  if (fakeScore >= 0.8) label = 'Surely AI';
  else if (fakeScore >= 0.5) label = 'Likely AI';
  else if (fakeScore >= 0.25) label = 'Possibly AI';

  return {
    score: fakeScore,
    label: label,
    source: 'local-model'
  };
}
