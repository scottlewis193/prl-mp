import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { enhancedImages } from '@sveltejs/enhanced-img';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { resolve } from 'path';

export default defineConfig({
	plugins: [
		enhancedImages(),
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			strategies: 'injectManifest',
			srcDir: 'src',
			filename: 'custom-sw-src.js',
			devOptions: {
				enabled: true
			},

			workbox: {
				globPatterns: ['**/*.{js,css,html,ico,png,svg}']
			},
			manifest: {
				name: 'Pokemon Racing League',
				short_name: 'PRL',
				start_url: '/',
				display: 'standalone',
				background_color: '#000000',
				icons: [
					{
						src: '/logo-512.png',
						sizes: 'any',
						type: 'image/png'
					}
				]
			}
		})
	]
});
