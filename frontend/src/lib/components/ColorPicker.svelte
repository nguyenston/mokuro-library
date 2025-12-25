<script lang="ts">
	let {
		color = '#1e293b',
		onClose,
		onColorChange
	} = $props<{
		color?: string;
		onClose: () => void;
		onColorChange?: (color: string) => void;
	}>();

	let colorPickerRef: HTMLDivElement | undefined = $state();
	let hueSliderRef: HTMLDivElement | undefined = $state();
	let isDragging = $state(false);
	let isDraggingHue = $state(false);

	// Convert hex to HSL
	function hexToHsl(hex: string): { h: number; s: number; l: number } {
		// Handle hex with or without alpha
		const cleanHex = hex.length === 9 ? hex.slice(0, 7) : hex;
		const r = parseInt(cleanHex.slice(1, 3), 16) / 255;
		const g = parseInt(cleanHex.slice(3, 5), 16) / 255;
		const b = parseInt(cleanHex.slice(5, 7), 16) / 255;

		const max = Math.max(r, g, b);
		const min = Math.min(r, g, b);
		let h = 0;
		let s = 0;
		const l = (max + min) / 2;

		if (max !== min) {
			const d = max - min;
			s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
			switch (max) {
				case r:
					h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
					break;
				case g:
					h = ((b - r) / d + 2) / 6;
					break;
				case b:
					h = ((r - g) / d + 4) / 6;
					break;
			}
		}

		return { h: h * 360, s: s * 100, l: l * 100 };
	}

	// Convert HSL to hex
	function hslToHex(h: number, s: number, l: number): string {
		s /= 100;
		l /= 100;
		const c = (1 - Math.abs(2 * l - 1)) * s;
		const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
		const m = l - c / 2;
		let r = 0;
		let g = 0;
		let b = 0;

		if (0 <= h && h < 60) {
			r = c;
			g = x;
			b = 0;
		} else if (60 <= h && h < 120) {
			r = x;
			g = c;
			b = 0;
		} else if (120 <= h && h < 180) {
			r = 0;
			g = c;
			b = x;
		} else if (180 <= h && h < 240) {
			r = 0;
			g = x;
			b = c;
		} else if (240 <= h && h < 300) {
			r = x;
			g = 0;
			b = c;
		} else if (300 <= h && h < 360) {
			r = c;
			g = 0;
			b = x;
		}

		r = Math.round((r + m) * 255);
		g = Math.round((g + m) * 255);
		b = Math.round((b + m) * 255);

		return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
	}

	// Initialize HSL from current color (only once on mount)
	let currentHsl = $state(hexToHsl(color));

	// Update color when HSL changes and notify parent
	$effect(() => {
		const newColor = hslToHex(currentHsl.h, currentHsl.s, currentHsl.l);
		if (newColor !== color && onColorChange) {
			onColorChange(newColor);
		}
	});

	function handleColorPickerClick(e: MouseEvent) {
		if (!colorPickerRef) {
			console.log('ColorPicker: colorPickerRef is not defined');
			return;
		}
		const rect = colorPickerRef.getBoundingClientRect();
		const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
		const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

		console.log('ColorPicker click:', { x, y, h: currentHsl.h, s: x * 100, l: (1 - y) * 100 });

		currentHsl = {
			h: currentHsl.h,
			s: x * 100,
			l: (1 - y) * 100
		};
	}

	function handleColorPickerDrag(e: MouseEvent) {
		if (!isDragging) return;
		handleColorPickerClick(e);
	}

	function handleHueSliderClick(e: MouseEvent) {
		if (!hueSliderRef) {
			console.log('ColorPicker: hueSliderRef is not defined');
			return;
		}
		const rect = hueSliderRef.getBoundingClientRect();
		const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

		console.log('Hue slider click:', { x, newHue: x * 360 });

		currentHsl = {
			...currentHsl,
			h: x * 360
		};
	}

	function handleHueSliderDrag(e: MouseEvent) {
		if (!isDraggingHue) return;
		handleHueSliderClick(e);
	}

	function handleHexInput(e: Event) {
		const value = (e.target as HTMLInputElement).value.replace('#', '');
		if (/^[0-9A-Fa-f]{6}$/.test(value)) {
			const hexColor = `#${value}`;
			currentHsl = hexToHsl(hexColor);
		}
	}

	function handleSet() {
		console.log('handleSet called, current color:', displayColor);
		onClose();
	}

	// Mouse event handlers
	function startDrag() {
		isDragging = true;
	}

	function stopDrag() {
		isDragging = false;
	}

	function startHueDrag() {
		isDraggingHue = true;
	}

	function stopHueDrag() {
		isDraggingHue = false;
	}

	$effect(() => {
		if (typeof window === 'undefined') return;

		const handleMouseMove = (e: MouseEvent) => {
			handleColorPickerDrag(e);
			handleHueSliderDrag(e);
		};

		const handleMouseUp = () => {
			stopDrag();
			stopHueDrag();
		};

		if (isDragging || isDraggingHue) {
			window.addEventListener('mousemove', handleMouseMove);
			window.addEventListener('mouseup', handleMouseUp);
			return () => {
				window.removeEventListener('mousemove', handleMouseMove);
				window.removeEventListener('mouseup', handleMouseUp);
			};
		}
	});

	// Calculate picker position
	const pickerX = $derived((currentHsl.s / 100) * 100);
	const pickerY = $derived((1 - currentHsl.l / 100) * 100);
	const hueX = $derived((currentHsl.h / 360) * 100);

	// Derive current color from HSL
	const displayColor = $derived(hslToHex(currentHsl.h, currentHsl.s, currentHsl.l));

	// Debug: Log when component mounts and when color changes
	$effect(() => {
		console.log('ColorPicker mounted/updated:', {
			color,
			currentHsl,
			displayColor,
			colorPickerRef: !!colorPickerRef,
			hueSliderRef: !!hueSliderRef
		});
	});
</script>

<div
	class="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-0"
	role="dialog"
	aria-modal="true"
>
	<div
		class="absolute inset-0 bg-black/60 backdrop-blur-sm"
		onclick={onClose}
		role="button"
		tabindex="0"
		onkeydown={(e) => e.key === 'Escape' && onClose()}
		aria-label="Close modal"
	></div>

	<div
		class="relative w-full max-w-md transform overflow-hidden rounded-2xl border border-theme-border bg-theme-surface shadow-2xl transition-all flex flex-col"
		onclick={(e) => e.stopPropagation()}
	>
		<!-- Header -->
		<div
			class="flex items-center justify-between px-6 py-4 bg-theme-main border-b border-theme-border flex-shrink-0"
		>
			<div class="flex items-center gap-3">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="text-accent"
				>
					<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
				</svg>
				<h2 class="text-2xl font-bold theme-primary">Color Picker</h2>
			</div>
			<button
				onclick={onClose}
				class="p-2 rounded-lg text-theme-secondary hover:text-theme-primary hover:bg-theme-surface-hover transition-colors"
				aria-label="Close"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</button>
		</div>

		<!-- Content -->
		<div class="p-6 space-y-4">
			<!-- Color Selection Area -->
			<div
				bind:this={colorPickerRef}
				class="relative w-full h-48 rounded-xl overflow-hidden cursor-crosshair border border-theme-border"
				style="background: linear-gradient(to bottom, transparent, black), linear-gradient(to right, white, hsl({currentHsl.h}, 100%, 50%));"
				onclick={(e) => {
					e.stopPropagation();
					handleColorPickerClick(e);
				}}
				onmousedown={(e) => {
					e.stopPropagation();
					startDrag();
					handleColorPickerClick(e);
				}}
				role="button"
				tabindex="0"
				aria-label="Select color saturation and lightness"
			>
				<!-- Picker indicator -->
				<div
					class="absolute w-5 h-5 border-2 border-white rounded-full pointer-events-none shadow-lg"
					style="left: {pickerX}%; top: {pickerY}%; transform: translate(-50%, -50%); box-shadow: 0 0 0 1px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.5);"
				></div>
			</div>

			<!-- Hue Slider -->
			<div
				bind:this={hueSliderRef}
				class="relative w-full h-8 rounded-lg overflow-hidden cursor-pointer border border-theme-border"
				style="background: linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000);"
				onclick={(e) => {
					e.stopPropagation();
					handleHueSliderClick(e);
				}}
				onmousedown={(e) => {
					e.stopPropagation();
					startHueDrag();
					handleHueSliderClick(e);
				}}
				role="slider"
				tabindex="0"
				aria-label="Select hue"
				aria-valuemin="0"
				aria-valuemax="360"
				aria-valuenow={Math.round(currentHsl.h)}
			>
				<!-- Hue indicator -->
				<div
					class="absolute top-0 bottom-0 w-1 bg-white pointer-events-none"
					style="left: {hueX}%; transform: translateX(-50%); box-shadow: 0 0 0 1px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.5);"
				></div>
			</div>

			<!-- Color Preview and HEX Input -->
			<div class="flex items-center gap-3">
				<div
					class="w-12 h-12 rounded-lg border-2 border-theme-border flex-shrink-0 shadow-lg"
					style="background-color: {displayColor};"
					aria-label="Current color preview"
				></div>
				<div class="flex-1">
					<label class="text-xs font-bold text-theme-secondary uppercase tracking-wider block mb-1.5"
						>HEX CODE</label
					>
					<input
						type="text"
						value={displayColor.toUpperCase()}
						oninput={handleHexInput}
						class="w-full px-3 py-2 rounded-lg bg-theme-main border border-theme-border theme-primary font-mono text-sm focus:outline-none focus:border-accent transition-colors"
						placeholder="#1E293B"
					/>
				</div>
			</div>
		</div>

		<!-- Footer -->
		<div class="px-6 py-4 bg-theme-main border-t border-theme-border flex justify-end gap-2 flex-shrink-0">
			<button
				onclick={onClose}
				class="px-4 py-2 rounded-lg border border-theme-border text-theme-primary hover:bg-theme-surface-hover transition-colors"
			>
				Cancel
			</button>
			<button
				onclick={handleSet}
				class="px-6 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/80 shadow-lg shadow-accent/20 transition-all transform active:scale-95 flex items-center gap-2"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<polyline points="20 6 9 17 4 12" />
				</svg>
				Apply
			</button>
		</div>
	</div>
</div>
