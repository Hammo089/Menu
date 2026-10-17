import { createRoot } from 'react-dom/client';
import { Promotion } from '../../src/components';
import { initialMenu } from '../../src/lib';
export function mountAdFixture() {
  const host = document.createElement('div');
  host.id = 'ad-timing-fixture';
  document.body.append(host);
  const settings = { ...initialMenu.settings, adsEnabled: true, promotionIds: ['hot-1', 'hot-2'] };
  createRoot(host).render(<Promotion products={initialMenu.products} settings={settings} />);
}
