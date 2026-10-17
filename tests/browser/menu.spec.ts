import { test, expect } from '@playwright/test';
test('customer menu contains all original products, supports search, and fits a phone',async({page})=>{
  await page.setViewportSize({width:390,height:844}); await page.goto('/');
  await expect(page.locator('.product-card')).toHaveCount(52);
  await page.getByRole('textbox',{name:'Rechercher un produit'}).fill('Syrian');
  await expect(page.locator('.product-card')).toHaveCount(2);
  await expect(page.locator('.product-card').first()).toContainText('4,00');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.locator('.product-card').first().click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Fermer',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('TV keeps original artwork and persists device orientation and rotation',async({page})=>{
  await page.setViewportSize({width:1080,height:1920});await page.goto('/tv');
  const stage=page.locator('.tv-stage');await expect(stage).toHaveAttribute('data-orientation','portrait');
  await expect(page.locator('svg [data-product][data-field="name"]')).toHaveCount(52);
  await expect(page.locator('svg [data-product="hot-1"][data-field="price"]')).toContainText('1.80€');
  await page.getByRole('button',{name:'إعدادات الشاشة / Réglages de l’écran',exact:true}).click();
  await page.getByLabel('اتجاه الشاشة / Orientation').selectOption('landscape');await page.getByLabel('تدوير / Rotation').selectOption('90');
  await expect(stage).toHaveAttribute('data-orientation','landscape');await expect(stage).toHaveAttribute('data-rotation','90');
  await page.reload();await expect(stage).toHaveAttribute('data-orientation','landscape');await expect(stage).toHaveAttribute('data-rotation','90');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth===window.innerWidth)).toBe(true);
});
test('admin preview edits drafts, switches languages, and previews center advertisements',async({page})=>{
  await page.goto('/admin');await expect(page.getByText('معاينة فقط — اربط Supabase لتفعيل الحفظ وتسجيل الدخول.')).toBeVisible();
  await page.getByRole('navigation').getByRole('button',{name:'المنتجات والأسعار',exact:true}).click();await page.locator('.admin-product-row').first().getByRole('button',{name:'تعديل',exact:true}).click();
  await page.getByLabel('السعر باليورو').fill('2.20');await page.getByRole('button',{name:'حفظ في المسودة',exact:true}).click();
  await expect(page.locator('.admin-product-row').first()).toContainText('2,20');await expect(page.getByRole('button',{name:'نشر التعديلات',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'الإعلانات',exact:true}).click();await page.getByRole('button',{name:'جرّب الإعلان',exact:true}).click();await expect(page.locator('.promotion-card')).toBeVisible();await page.getByRole('button',{name:'Fermer / إغلاق'}).click();
  await page.getByRole('button',{name:'FR',exact:true}).click();await expect(page.getByRole('button',{name:'Produits & prix',exact:true})).toBeVisible();
});
test('TV reflows added and hidden products without dropping the price or breaking SVG',async({page})=>{
  await page.goto('/tv');
  const result=await page.evaluate(async()=>{
    const {renderTvSvg}=await import('/src/TVMenu.tsx');const {initialMenu}=await import('/src/lib.ts');const next=structuredClone(initialMenu);next.products[0].available=false;next.products.push({id:'new-coffee',categoryId:'hot',name:'Nouveau café',priceCents:450,image:'/images/coffee.jpg',available:true,order:99});const output=renderTvSvg(next);return {output,invalid:new DOMParser().parseFromString(output,'image/svg+xml').querySelectorAll('parsererror').length};
  });expect(result.invalid).toBe(0);expect(result.output).toContain('Nouveau café');expect(result.output).toContain('4.50€');expect(result.output).not.toContain('>Espresso<');
});
test('advertisement starts after its interval, disappears after five seconds, and rotates products',async({page})=>{
  await page.clock.install();await page.goto('/tv');await page.waitForSelector('.tv-stage');
  await page.evaluate(async()=>{
    const React=await import('react');const {createRoot}=await import('react-dom/client');const {Promotion}=await import('/src/components.tsx');const {initialMenu}=await import('/src/lib.ts');
    const host=document.createElement('div');host.id='ad-timing-fixture';document.body.append(host);const settings={...initialMenu.settings,adsEnabled:true,promotionIds:['hot-1','hot-2']};createRoot(host).render(React.createElement(Promotion,{products:initialMenu.products,settings}));
  });
  await page.waitForTimeout(100);await page.clock.fastForward(59000);await expect(page.locator('#ad-timing-fixture .promotion-card')).toHaveCount(0);
  await page.clock.fastForward(1000);await expect(page.locator('#ad-timing-fixture .promotion-card h2')).toHaveText('Espresso');
  await page.clock.fastForward(5000);await expect(page.locator('#ad-timing-fixture .promotion-card')).toHaveCount(0);
  await page.clock.fastForward(55000);await expect(page.locator('#ad-timing-fixture .promotion-card h2')).toHaveText('Ristretto');
});
