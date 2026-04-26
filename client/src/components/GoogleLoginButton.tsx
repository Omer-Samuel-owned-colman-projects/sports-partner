import { Button } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';

export function GoogleLoginButton() {
  const handleClick = () => {
    window.location.href = '/api/auth/google';
  };

  return (
    <Button
      variant="outlined"
      fullWidth
      startIcon={<GoogleIcon />}
      onClick={handleClick}
    >
      Continue with Google
    </Button>
  );
}
