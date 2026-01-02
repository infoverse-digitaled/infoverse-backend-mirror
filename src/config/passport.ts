import passport from 'passport';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import User from '../models/User';
import config from './index';

let initialized = false;

// Initialize Google OAuth strategy - called after app setup
export const initializeGoogleOAuth = () => {
  if (initialized) return;
  initialized = true;

  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!googleClientId || !googleClientSecret) {
    console.log('⚠️ Google OAuth credentials not provided - Google sign-in disabled');
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: googleClientId,
        clientSecret: googleClientSecret,
        callbackURL: `${config.backendUrl || 'http://localhost:3000'}/api/v1/auth/google/callback`,
        scope: ['profile', 'email'],
      },
      async (accessToken, refreshToken, profile: Profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;

          if (!email) {
            return done(new Error('No email found in Google profile'), undefined);
          }

          // Check if user already exists
          let user = await User.findOne({ email: email.toLowerCase() });

          if (user) {
            // User exists - return them
            return done(null, user);
          }

          // Create new user with Google profile
          const trialEndsAt = new Date();
          trialEndsAt.setDate(trialEndsAt.getDate() + 14);

          user = await User.create({
            email: email.toLowerCase(),
            name: profile.displayName || `${profile.name?.givenName || ''} ${profile.name?.familyName || ''}`.trim(),
            passwordHash: '', // No password for OAuth users
            role: 'student',
            subscription: {
              plan: 'premium',
              status: 'trialing',
              trialEndsAt,
            },
          });

          return done(null, user);
        } catch (error) {
          return done(error as Error, undefined);
        }
      }
    )
  );

  // Serialize user for session
  passport.serializeUser((user: any, done) => {
    done(null, user._id || user.id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });

  console.log('✅ Google OAuth strategy registered');
};

export default passport;
