// exif.js
// A lightweight script to scan image array buffers for EXIF/Metadata tags common in AI generators.

function scanForAiMetadata(buffer) {
  try {
    const view = new DataView(buffer);
    
    // Check if valid JPEG (FF D8)
    if (view.getUint16(0) !== 0xFFD8) return { found: false };
    
    let offset = 2;
    while (offset < view.byteLength) {
      if (view.getUint16(offset) === 0xFFE1) { // APP1 Marker (EXIF)
        const length = view.getUint16(offset + 2);
        const exifData = new Uint8Array(buffer, offset + 4, length - 2);
        const exifString = new TextDecoder().decode(exifData).toLowerCase();
        
        // Known AI signatures in EXIF/Metadata
        const aiSignatures = [
          'midjourney',
          'stable diffusion',
          'dall-e',
          'firefly',
          'flux',
          'comfyui',
          'novelai',
          'leonardo',
          'ai generated',
          'generative ai'
        ];
        
        for (const sig of aiSignatures) {
          if (exifString.includes(sig)) {
            return { found: true, generator: sig };
          }
        }
      }
      // Move to next marker
      offset += 2 + view.getUint16(offset + 2);
    }
    
    // Also check for PNG metadata (tEXt/iTXt chunks)
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if (view.getUint32(0) === 0x89504E47 && view.getUint32(4) === 0x0D0A1A0A) {
       const pngString = new TextDecoder().decode(new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 131072))).toLowerCase();
       const aiSignatures = ['midjourney', 'stable diffusion', 'dall-e', 'firefly', 'flux', 'comfyui', 'novelai', 'leonardo'];
       for (const sig of aiSignatures) {
         if (pngString.includes(sig)) {
           return { found: true, generator: sig };
         }
       }
    }
  } catch (e) {
    console.error("EXIF parsing error:", e);
  }
  
  return { found: false };
}
