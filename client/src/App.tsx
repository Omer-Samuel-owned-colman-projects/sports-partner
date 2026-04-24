import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { GamesPage } from './pages/GamesPage';
import { GameDetailPage } from './pages/GameDetailPage';
import { ProfilePage } from './pages/ProfilePage';
import { GameCommentsPage } from './pages/GameCommentsPage';
import { CreateGamePage } from './pages/CreateGamePage';
import { EditGamePage } from './pages/EditGamePage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/AppLayout';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<GamesPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/games/new" element={<CreateGamePage />} />
        <Route path="/games/:id/edit" element={<EditGamePage />} />
        <Route path="/games/:id" element={<GameDetailPage />} />
        <Route path="/games/:id/comments" element={<GameCommentsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
