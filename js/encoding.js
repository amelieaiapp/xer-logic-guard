/**
 * XER Logic-Guard – Encoding detection
 * Supports Gulf (Arabic / Windows-1256) and Eastern European (Cyrillic / Windows-1251)
 * programmes so activity and project names are readable, not question marks.
 *
 * UI remains English. This module only affects how XER *files* are read and
 * written so regional text and calendars round-trip correctly.
 */
window.XerEncoding = (function () {

  const CANDIDATES = [
    "utf-8",
    "windows-1252",  // Ordinary P6 Western / UK
    "windows-1251",  // Eastern Europe – Russian, Ukrainian, Bulgarian, etc.
    "windows-1256",  // Gulf / Arabic
    "iso-8859-1",
    "iso-8859-5",    // Cyrillic
    "iso-8859-6"     // Arabic
  ];

  function hasBOM(bytes) {
    if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
      return { encoding: "utf-8", offset: 3 };
    }
    if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
      return { encoding: "utf-16le", offset: 2 };
    }
    if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
      return { encoding: "utf-16be", offset: 2 };
    }
    return null;
  }

  function scoreText(text) {
    if (!text || text.length < 10) return -1e9;
    let score = 0;
    let replacement = 0;
    let control = 0;
    let arabic = 0;
    let cyrillic = 0;
    let latin = 0;
    let xerMarkers = 0;

    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      if (c === 0xFFFD) replacement++;           // replacement character
      else if (c < 32 && c !== 9 && c !== 10 && c !== 13) control++;
      else if (c >= 0x0600 && c <= 0x06FF) arabic++;
      else if (c >= 0x0400 && c <= 0x04FF) cyrillic++;
      else if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122)) latin++;
    }

    // Strong signal: valid XER structure markers
    if (text.indexOf("%T\t") >= 0 || text.indexOf("%T ") >= 0) xerMarkers += 50;
    if (text.indexOf("ERMHDR") >= 0) xerMarkers += 30;
    if (text.indexOf("TASKPRED") >= 0) xerMarkers += 20;
    if (text.indexOf("PROJECT") >= 0) xerMarkers += 10;

    score += xerMarkers;
    score -= replacement * 25;
    score -= control * 5;
    score += Math.min(arabic, 200) * 0.5;
    score += Math.min(cyrillic, 200) * 0.5;
    score += Math.min(latin, 500) * 0.1;

    return score;
  }

  function tryDecode(bytes, encoding, offset) {
    try {
      const slice = offset ? bytes.slice(offset) : bytes;
      const dec = new TextDecoder(encoding, { fatal: false });
      return dec.decode(slice);
    } catch (e) {
      return null;
    }
  }

  /**
   * Detect best encoding for an ArrayBuffer of XER content.
   * Returns { text, encoding, confidence }
   */
  function detectAndDecode(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    const bom = hasBOM(bytes);

    if (bom) {
      const text = tryDecode(bytes, bom.encoding, bom.offset);
      if (text && scoreText(text) > 0) {
        return { text, encoding: bom.encoding + " (BOM)", confidence: "high" };
      }
    }

    let best = { text: null, encoding: "utf-8", score: -1e9 };

    for (const enc of CANDIDATES) {
      const text = tryDecode(bytes, enc, 0);
      if (!text) continue;
      const s = scoreText(text);
      if (s > best.score) {
        best = { text, encoding: enc, score: s };
      }
    }

    // Absolute fallback
    if (!best.text) {
      best.text = tryDecode(bytes, "utf-8", 0) || "";
      best.encoding = "utf-8 (fallback)";
    }

    const confidence = best.score > 80 ? "high" : best.score > 20 ? "medium" : "low";
    return { text: best.text, encoding: best.encoding, confidence };
  }

  async function readFileAsText(file) {
    const buf = await file.arrayBuffer();
    return detectAndDecode(buf);
  }

  return { detectAndDecode, readFileAsText, CANDIDATES };
})();
