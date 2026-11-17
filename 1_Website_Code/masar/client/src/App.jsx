import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './auth/ProtectedRoute.jsx';
import { Loading } from './components/States.jsx';
import Home from './pages/Home.jsx';
import { Login, Register } from './pages/Auth.jsx';
import NotFound from './pages/NotFound.jsx';

// Signed-in pages load on demand, so the first visit downloads only the
// landing and sign-in screens. The admin panel is the largest chunk.
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const TrackQuiz = lazy(() => import('./pages/TrackQuiz.jsx'));
const TrackResult = lazy(() => import('./pages/TrackResult.jsx'));
const LevelTest = lazy(() => import('./pages/LevelTest.jsx'));
const LevelResult = lazy(() => import('./pages/LevelResult.jsx'));
const Plan = lazy(() => import('./pages/Plan.jsx'));
const Tasks = lazy(() => import('./pages/Tasks.jsx'));
const Account = lazy(() => import('./pages/Account.jsx'));
const Admin = lazy(() => import('./pages/Admin.jsx'));

const guard = (element, admin) => (
  <ProtectedRoute admin={admin}>
    <Suspense fallback={<Loading />}>{element}</Suspense>
  </ProtectedRoute>
);

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="dashboard" element={guard(<Dashboard />)} />
        <Route path="track-quiz" element={guard(<TrackQuiz />)} />
        <Route path="track-result" element={guard(<TrackResult />)} />
        <Route path="level-test/:track" element={guard(<LevelTest />)} />
        <Route path="level-result/:track" element={guard(<LevelResult />)} />
        <Route path="plan" element={guard(<Plan />)} />
        <Route path="tasks" element={guard(<Tasks />)} />
        <Route path="account" element={guard(<Account />)} />
        <Route path="admin" element={guard(<Admin />, true)} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
