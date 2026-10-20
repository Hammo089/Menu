import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { MenuProvider } from './store';
import CustomerMenu from './CustomerMenu';
import './styles.css';
const Admin = lazy(() => import('./Admin'));
const TVMenu = lazy(() => import('./TVMenu'));
const CustomerLoyalty = lazy(() => import('./loyalty/Customer'));
const LoyaltyAdmin = lazy(() => import('./loyalty/Admin'));
const path = window.location.pathname.replace(/\/$/, '') || '/';
function App() {
  if (['/fidelite', '/fidelite/confidentialite', '/admin/fidelite'].includes(path))
    return (
      <Suspense
        fallback={
          <div className="loading-screen">
            Blanco<span>Un petit instant…</span>
          </div>
        }
      >
        {path === '/admin/fidelite' ? <LoyaltyAdmin /> : <CustomerLoyalty />}
      </Suspense>
    );
  if (!['/', '/menu', '/tv', '/admin'].includes(path))
    return (
      <main className="not-found">
        <h1>Cette page prend une pause.</h1>
        <a className="button dark" href="/">
          Retour chez Blanco
        </a>
      </main>
    );
  return (
    <MenuProvider>
      <Suspense
        fallback={
          <div className="loading-screen">
            Blanco<span>Un petit instant…</span>
          </div>
        }
      >
        {path === '/admin' ? <Admin /> : path === '/tv' ? <TVMenu /> : <CustomerMenu />}
      </Suspense>
    </MenuProvider>
  );
}
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
