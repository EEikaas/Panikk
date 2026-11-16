import { lazy, Suspense } from 'react';
import { usePath } from './router';
import { Home } from './pages/Home';
import { CreatePage } from './pages/Create';
import { JoinPage } from './pages/Join';
import { SoloPage } from './pages/Solo';
import { Toasts } from './components/Toasts';

const RoomPage = lazy(() => import('./pages/RoomPage'));
const ProfilePage = lazy(() => import('./pages/Profile'));
const LeaderboardPage = lazy(() => import('./pages/Leaderboard'));
const AdminPage = lazy(() => import('./pages/Admin'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

function Loading() {
  return (
    <div className="center-screen">
      <div className="spinner" aria-label="Laster" />
    </div>
  );
}

export function App() {
  const path = usePath();
  let page: JSX.Element;
  const room = path.match(/^\/rom\/([A-Za-z0-9]{5})\/?$/);
  const invite = path.match(/^\/r\/([A-Za-z0-9]{5})\/?$/);
  if (room) page = <RoomPage code={room[1].toUpperCase()} />;
  else if (invite) page = <JoinPage initialCode={invite[1].toUpperCase()} />;
  else if (path === '/opprett') page = <CreatePage />;
  else if (path === '/alene') page = <SoloPage />;
  else if (path === '/bli-med') page = <JoinPage />;
  else if (path === '/profil') page = <ProfilePage />;
  else if (path === '/toppliste') page = <LeaderboardPage />;
  else if (path === '/admin') page = <AdminPage />;
  else if (path === '/innstillinger') page = <SettingsPage />;
  else page = <Home />;
  return (
    <>
      <Suspense fallback={<Loading />}>{page}</Suspense>
      <Toasts />
    </>
  );
}
