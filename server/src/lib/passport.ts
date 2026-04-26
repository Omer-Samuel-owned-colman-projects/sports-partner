import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from '../db/schema.js';

function getGoogleCredentials() {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientID || !clientSecret) {
    return null;
  }
  return { clientID, clientSecret };
}

export function configurePassport() {
  const creds = getGoogleCredentials();
  if (!creds) {
    console.warn('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set — Google OAuth disabled');
    return;
  }

  const callbackURL = process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:3001/api/auth/google/callback';

  passport.use(
    new GoogleStrategy(
      {
        clientID: creds.clientID,
        clientSecret: creds.clientSecret,
        callbackURL,
        scope: ['profile', 'email'],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const googleId = profile.id;
          const email = profile.emails?.[0]?.value;
          const name = profile.displayName;

          if (!email) {
            return done(new Error('Google account has no email'));
          }

          const existingOAuth = await User.findOne({ provider: 'google', providerId: googleId });
          if (existingOAuth) {
            return done(null, existingOAuth);
          }

          const existingEmail = await User.findOne({ email });
          if (existingEmail) {
            return done(new Error('An account with this email already exists. Please log in with your password.'));
          }

          const newUser = await User.create({
            name,
            email,
            provider: 'google',
            providerId: googleId,
          });

          return done(null, newUser);
        } catch (err) {
          return done(err as Error);
        }
      },
    ),
  );
}
