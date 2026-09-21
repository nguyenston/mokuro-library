<script lang="ts">
  let { backgroundImage, floatingElements } = $props<{
    backgroundImage: string;
    floatingElements: { id: number; delay: number; duration: number; x: number; y: number }[];
  }>();
</script>

<div
  class="absolute inset-0 bg-cover bg-center md:bg-[length:100%_100%] bg-no-repeat transition-all duration-700"
  style="background-image: url('{backgroundImage}');
	       background-size: cover;
	       background-position: center;"
>
  <div class="absolute inset-0 bg-gradient-to-br from-black/50 via-black/40 to-purple-900/30"></div>

  {#each floatingElements as element (element.id)}
    <div
      class="floating-element absolute w-20 h-20 opacity-10"
      style="
				left: {element.x}%;
				top: {element.y}%;
				animation-delay: {element.delay}s;
				animation-duration: {element.duration}s;
			"
    >
      <div
        class="w-full h-full bg-white/5 backdrop-blur-sm rounded-lg rotate-12 border border-white/10"
      ></div>
    </div>
  {/each}
</div>
