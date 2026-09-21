<script lang="ts">
  import { onMount } from 'svelte';
  import { SvelteDate } from 'svelte/reactivity';

  let {
    data,
    color = '#6366f1',
    height = 200
  }: {
    data: Array<{ date: string; value: number }>;
    color?: string;
    height?: number;
  } = $props();

  let canvas = $state<HTMLCanvasElement | null>(null);

  function drawChart() {
    if (!canvas || !data.length) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    ctx.scale(dpr, dpr);

    const width = rect.width;
    const chartHeight = rect.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, chartHeight);

    // Padding
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const innerHeight = chartHeight - padding.top - padding.bottom;

    // Find min/max values
    const values = data.map((d) => d.value);
    const maxValue = Math.max(...values, 1);
    const minValue = Math.min(...values, 0);
    const range = maxValue - minValue || 1;

    // Draw grid lines
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (innerHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartWidth, y);
      ctx.stroke();

      // Y-axis labels
      const value = Math.round(maxValue - (range / 5) * i);
      ctx.fillStyle = '#6b7280';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(value.toString(), padding.left - 10, y + 4);
    }

    // Calculate points
    const points = data.map((d, i) => ({
      x: padding.left + (chartWidth / (data.length - 1 || 1)) * i,
      y: padding.top + innerHeight - ((d.value - minValue) / range) * innerHeight
    }));

    // Draw line
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((point, i) => {
      if (i === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.stroke();

    // Draw points
    ctx.fillStyle = color;
    points.forEach((point) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // X-axis labels (show every nth label to avoid crowding)
    const labelInterval = Math.ceil(data.length / 7);
    ctx.fillStyle = '#6b7280';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    data.forEach((d, i) => {
      if (i % labelInterval === 0 || i === data.length - 1) {
        const date = new SvelteDate(d.date);
        const label = `${date.getMonth() + 1}/${date.getDate()}`;
        ctx.fillText(label, points[i].x, chartHeight - 10);
      }
    });
  }

  $effect(() => {
    drawChart();
  });

  onMount(() => {
    const resizeObserver = new ResizeObserver(() => drawChart());
    if (canvas) resizeObserver.observe(canvas);
    return () => resizeObserver.disconnect();
  });
</script>

<div class="relative w-full" style="height: {height}px">
  <canvas bind:this={canvas} class="w-full h-full"></canvas>
  {#if data.length === 0}
    <div class="absolute inset-0 flex items-center justify-center text-theme-secondary text-sm">
      No data available
    </div>
  {/if}
</div>
