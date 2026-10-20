export async function GET(request: Request) {
  const key = request.headers
    .get('cookie')
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('blanco_loyalty='))
    ?.slice('blanco_loyalty='.length);
  const valid = typeof key === 'string' && /^[a-f0-9]{64}$/.test(key);
  return new Response(
    JSON.stringify({
      id: '/fidelite',
      name: 'Blanco Club — Ma carte fidélité',
      short_name: 'Blanco Club',
      lang: 'fr',
      description:
        'Vos pauses café, vos petites attentions. Votre carte de fidélité Blanco à Grenoble.',
      start_url: valid ? `/fidelite#cle=${key}` : '/fidelite',
      scope: '/fidelite',
      display: 'standalone',
      theme_color: '#234b3a',
      background_color: '#f8f5ee',
      icons: [
        { src: '/loyalty-icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/loyalty-icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        {
          src: '/loyalty-icons/maskable-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    }),
    {
      headers: {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'private, no-store',
        Vary: 'Cookie',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  );
}
