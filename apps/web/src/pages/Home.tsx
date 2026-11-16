import { lazy, Suspense } from 'react';
import { Link } from '../router';

const HomeScene = lazy(() => import('../three/Previews').then((m) => ({ default: m.HomeScene })));

export function Home() {
  return (
    <div className="home">
      <div className="home-canvas" aria-hidden>
        <Suspense fallback={null}>
          <HomeScene />
        </Suspense>
      </div>
      <div className="home-content">
        <div className="home-card">
          <h1 className="logo">PODIEPANIKK!</h1>
          <p className="tagline">Gameshowet der kunnskap, fart og bløtkaker avgjør. 2–12 spillere · TV eller mobil</p>
          <div className="home-actions">
            <Link className="btn big" to="/opprett">
              🎬 Start et nytt show
            </Link>
            <Link className="btn big pink" to="/bli-med">
              📱 Bli med i et spill
            </Link>
            <Link className="btn big cyan" to="/alene">
              🎮 Spill alene
            </Link>
          </div>
          <nav className="home-links" aria-label="Mer">
            <Link className="btn ghost small" to="/profil">
              👤 Profil
            </Link>
            <Link className="btn ghost small" to="/toppliste">
              🏆 Toppliste
            </Link>
            <Link className="btn ghost small" to="/innstillinger">
              ⚙️ Innstillinger
            </Link>
          </nav>
        </div>
      </div>
    </div>
  );
}
