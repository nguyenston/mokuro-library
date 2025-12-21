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

	let colorPickerRef: HTMLDivElement;
	let hueSliderRef: HTMLDivElement;
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

	// Initialize HSL from current color
	let currentHsl = $state(hexToHsl(color));
	let isInitialized = $state(false);

	// Initialize from prop when it changes externally
	$effect(() => {
		if (!isInitialized) {
			currentHsl = hexToHsl(color);
			isInitialized = true;
		} else {
			// Only update if color changed externally (not from our HSL changes)
			const newHsl = hexToHsl(color);
			const currentColor = hslToHex(currentHsl.h, currentHsl.s, currentHsl.l);
			if (currentColor !== color) {
				currentHsl = newHsl;
			}
		}
	});

	// Update color when HSL changes and notify parent
	$effect(() => {
		if (isInitialized) {
			const newColor = hslToHex(currentHsl.h, currentHsl.s, currentHsl.l);
			if (newColor !== color && onColorChange) {
				onColorChange(newColor);
			}
		}
	});

	function handleColorPickerClick(e: MouseEvent) {
		if (!colorPickerRef) return;
		const rect = colorPickerRef.getBoundingClientRect();
		const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
		const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

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
		if (!hueSliderRef) return;
		const rect = hueSliderRef.getBoundingClientRect();
		const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
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
			color = `#${value}`;
		}
	}

	function handleSet() {
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
</script>

<div
	class="fixed inset-0 z-[60] flex items-center justify-center p-4"
	onclick={(e) => {
		if (e.target === e.currentTarget) onClose();
	}}
>
	<div
		class="rounded-2xl bg-black/30 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] p-6 max-w-md w-full"
		onclick={(e) => e.stopPropagation()}
	>
		<!-- Color Selection Area -->
		<div
			bind:this={colorPickerRef}
			class="relative w-full h-48 rounded-xl overflow-hidden cursor-crosshair mb-4 border border-white/10"
			style="background: linear-gradient(to bottom, hsl({currentHsl.h}, 100%, 50%), transparent), linear-gradient(to right, white, transparent), black;"
			onmousedown={(e) => {
				startDrag();
				handleColorPickerClick(e);
			}}
		>
			<!-- Picker indicator -->
			<div
				class="absolute w-4 h-4 border-2 border-white rounded-full pointer-events-none shadow-lg"
				style="left: {pickerX}%; top: {pickerY}%; transform: translate(-50%, -50%);"
			></div>
		</div>

		<!-- Hue Slider -->
		<div
			bind:this={hueSliderRef}
			class="relative w-full h-6 rounded-lg overflow-hidden cursor-pointer mb-4 border border-white/10"
			style="background: linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000);"
			onmousedown={(e) => {
				startHueDrag();
				handleHueSliderClick(e);
			}}
		>
			<!-- Hue indicator -->
			<div
				class="absolute top-0 bottom-0 w-1 bg-white border border-black/20 pointer-events-none shadow-lg"
				style="left: {hueX}%; transform: translateX(-50%);"
			></div>
		</div>

		<!-- HEX Code Input -->
		<div class="flex items-center gap-3">
			<label class="text-xs font-bold text-gray-400 uppercase tracking-wider">HEX CODE</label>
			<input
				type="text"
				value={color.toUpperCase()}
				oninput={handleHexInput}
				class="flex-1 px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-accent"
				placeholder="#1E293B"
			/>
			<button
				onclick={handleSet}
				class="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white font-medium flex items-center gap-2 transition-colors"
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
				Set
			</button>
		</div>
	</div>
</div>
