import { readerState } from '$lib/states/reader/ReaderState.svelte';

/**
 * Replaces predetermined sequences with their combined character
 * for correct vertical text display.
 */
export const ligaturize = (text: string): string => {
  const ellipsis = '\u2026'; // vertically centered 1.5em variant: '．\ufe01．\ufe01．\ufe01'
  const doubleExcl = '\u203C';
  const exclQuest = '\u2049';

  const regexes = new Map<RegExp, string>();
  regexes.set(/[.．。]{2,}/g, ellipsis);
  regexes.set(/[!！]{2,}/g, doubleExcl);
  regexes.set(/[!！][?？]/g, exclQuest);

  let s = text;
  for (const [reg, pattern] of regexes) {
    s = s.replaceAll(reg, pattern);
  }
  return s;
};

/**
 * Gets the scale ratio of rendered pixels to image pixels.
 */
export const getScaleRatios = (
  containerElement: HTMLElement,
  imgWidth: number,
  imgHeight: number
) => {
  if (!containerElement.parentElement) {
    return { scaleRatioX: 1, scaleRatioY: 1 };
  }
  // This rect is the size of the image container as rendered
  const rect = containerElement.parentElement.getBoundingClientRect();

  // page.img_width is the original image file width
  const scaleRatioX = imgWidth / rect.width;
  const scaleRatioY = imgHeight / rect.height;

  return { scaleRatioX, scaleRatioY };
};

/**
 * Gets the real image pixel coordinates from a mouse click event,
 * accounting for current panzoom scale and offset.
 */
export const getRelativeCoords = (
  event: MouseEvent,
  containerElement: HTMLElement,
  imgWidth: number,
  imgHeight: number
) => {
  if (!containerElement.parentElement) {
    return { imgX: 0, imgY: 0 };
  }

  const { scaleRatioX, scaleRatioY } = getScaleRatios(containerElement, imgWidth, imgHeight);

  // rect is the page's bounding box, *including* pan and zoom
  const rect = containerElement.parentElement.getBoundingClientRect();

  // 1. Get click position relative to the panned, zoomed container
  const relativeX = event.clientX - rect.left;
  const relativeY = event.clientY - rect.top;

  // 2. Convert container-relative pixels to image-absolute pixels
  const imgX = relativeX * scaleRatioX;
  const imgY = relativeY * scaleRatioY;

  return { imgX, imgY };
};

/**
 * Gets the real image pixel deltas from a mouse move event,
 * accounting for the current panzoom scale.
 */
export const getImageDeltas = (
  moveEvent: { movementX: number; movementY: number },
  containerElement: HTMLElement,
  imgWidth: number,
  imgHeight: number
) => {
  const { scaleRatioX, scaleRatioY } = getScaleRatios(containerElement, imgWidth, imgHeight);

  // 1. Get mouse movement delta (browser handles zoom natively in movementX/Y usually,
  // but we apply the ratio to map to image space)
  const relativeDeltaX = moveEvent.movementX;
  const relativeDeltaY = moveEvent.movementY;

  // 2. Convert container-relative delta to image-absolute delta
  const imageDeltaX = relativeDeltaX * scaleRatioX;
  const imageDeltaY = relativeDeltaY * scaleRatioY;

  return { imageDeltaX, imageDeltaY };
};

/**
 * Automatically set the font of the current block such that
 * the text fits snug to the current line's box.
 * @param block The block data (mutated)
 * @param lineElement The DOM element containing the text
 * @param imgWidth Original image width (for max bounds)
 * @param fontScale Current visual scale factor
 */

// 1. Singleton sandbox outside the panzoom/transform tree
let sandbox: HTMLElement | null = null;

function getSandbox() {
  if (sandbox) return sandbox;
  sandbox = document.createElement('div');
  Object.assign(sandbox.style, {
    position: 'fixed',
    top: '-9999px',
    left: '-9999px',
    visibility: 'hidden',
    whiteSpace: 'nowrap',
    // Critical: Ensure no transforms are inherited
    transform: 'none',
    willChange: 'font-size'
  });
  document.body.appendChild(sandbox);
  return sandbox;
}

export function computeSmartFont(
  [pageIdx, blockIdx]: [number, number],
  lineElement: HTMLElement,
  imgWidth: number,
  fontScale: number
) {
  const block = readerState.mokuroStagingData?.pages[pageIdx]?.blocks[blockIdx];
  if (!block || !lineElement) return;

  const isVertical = block.vertical ?? false;
  const sb = getSandbox();

  // 2. Sync Styles (including any vertical writing modes)
  const sourceStyle = window.getComputedStyle(lineElement);
  sb.style.fontFamily = sourceStyle.fontFamily;
  sb.style.fontWeight = sourceStyle.fontWeight;
  sb.style.letterSpacing = sourceStyle.letterSpacing;
  sb.style.writingMode = sourceStyle.writingMode;
  sb.textContent = lineElement.textContent;

  // 3. Get the "Natural" Target Dimension
  // Since parent is under panzoom, we use offsetWidth/Height
  // to get dimensions WITHOUT the CSS transform scale.
  const parent = lineElement.parentElement!;
  const targetMeasure = isVertical ? parent.offsetHeight : parent.offsetWidth;

  // 4. Measuring Function
  const measure = (size: number): number => {
    // Standardize the font size calculation
    const fontSize = (fontScale / window.devicePixelRatio) * size;
    sb.style.fontSize = `${fontSize}px`;
    const m = isVertical ? sb.offsetHeight : sb.offsetWidth;

    // Using offsetHeight/Width is faster in Firefox than getBoundingClientRect
    // because it avoids the coordinate projection logic.
    return m;
  };

  // 5. Binary Search with Linear Interpolation
  let min = 8;
  let max = imgWidth / 2;
  let minMeasure = measure(min);
  let maxMeasure = measure(max);

  if (Math.abs(maxMeasure - minMeasure) < 0.1) return min;

  let guess = min + ((targetMeasure - minMeasure) / (maxMeasure - minMeasure)) * (max - min);
  let bestGuess = guess;

  // Reduced to 12 iterations; usually converges for text in 4-6
  for (let i = 0; i < 12; i++) {
    const guessMeasure = measure(guess);
    const delta = targetMeasure - guessMeasure;

    if (delta > 0) {
      min = guess;
      minMeasure = guessMeasure;
      bestGuess = guess;
    } else {
      max = guess;
      maxMeasure = guessMeasure;
    }

    if (max - min < 0.05 || Math.abs(delta) < 0.1) break;

    const denom = maxMeasure - minMeasure;
    guess = denom === 0 ? min : min + ((targetMeasure - minMeasure) / denom) * (max - min);
  }

  return +bestGuess.toFixed(3);
}
