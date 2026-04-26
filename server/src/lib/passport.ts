import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';

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

          // Check if a user with this Google provider ID already exists
          const [existingOAuth] = await db
            .select()
            .from(users)
            .where(and(eq(users.provider, 'google'), eq(users.providerId, googleId)))
            .limit(1);

          if (existingOAuth) {
            return done(null, existingOAuth);
          }

          // Check if a user with this email already exists (local account)
          const [existingEmail] = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

          if (existingEmail) {
            return done(new Error('An account with this email already exists. Please log in with your password.'));
          }

          // Create a new user
          const [newUser] = await db
            .insert(users)
            .values({
              name,
              email,
              provider: 'google',
              providerId: googleId,
            })
            .returning();

          return done(null, newUser);
        } catch (err) {
          return done(err as Error);
        }
      },
    ),
  );
}
