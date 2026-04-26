import { Outlet, useNavigate, useLocation, matchPath } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Avatar,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

type NavItem = {
  label: string;
  path: string;
  end?: boolean;/*`false` = stay active on nested routes (e.g. `/games` when viewing `/games/3`). Default: exact match only. */
};

const isNavItemActive = (pathname: string, item: NavItem): boolean => !!matchPath({ path: item.path, end: item.end ?? true }, pathname);

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const navItems: NavItem[] = [
    { label: 'Games', path: '/' },
    { label: 'Assistant', path: '/assistant' },
    { label: 'Create game', path: '/games/new' },
    { label: 'My Profile', path: '/profile' },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography
            variant="h6"
            sx={{ cursor: 'pointer', mr: 3 }}
            onClick={() => navigate('/')}
          >
            Sports Partner
          </Typography>

          <Box sx={{ flexGrow: 1, display: 'flex', gap: 1 }}>
            {navItems.map((item) => (
              <Button
                key={item.path}
                color="inherit"
                onClick={() => navigate(item.path)}
                sx={{
                  borderRadius: 0,
                  ...(isNavItemActive(pathname, item) && { borderBottom: '2px solid white' }),
                }}
              >
                {item.label}
              </Button>
            ))}
          </Box>

          {user && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar src={user.profileImageUrl ?? undefined} sx={{ width: 32, height: 32 }}>
                {user.name.charAt(0).toUpperCase()}
              </Avatar>
              <Typography variant="body2">{user.name}</Typography>
              <Button color="inherit" variant="outlined" size="small" onClick={logout}>
                Logout
              </Button>
            </Box>
          )}
        </Toolbar>
      </AppBar>

      <Box component="main" sx={{ flexGrow: 1 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
