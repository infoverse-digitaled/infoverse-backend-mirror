import passport from 'passport';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';

let initialized = false;

/**
 * Initialize Google OAuth strategy
 * Called after MongoDB connection is established
 */
export const initializeGoogleOAuth = (User: any, backendUrl: string) => {
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
        callbackURL: `${backendUrl}/api/v1/auth/google/callback`,
        scope: ['profile', 'email'],
      },
      async (_accessToken, _refreshToken, profile: Profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;

          if (!email) {
            return done(new Error('No email found in Google profile'), undefined);
          }

          // Check if user already exists
          let user = await User.findOne({ email: email.toLowerCase() });

          if (user) {
            // User exists - check if they need a trial reset
            // If user has no active subscription and no trial, give them a fresh trial
            const needsTrial = !user.subscription ||
              (user.subscription.status !== 'active' && user.subscription.status !== 'trialing');

            if (needsTrial) {
              // Reset to fresh 14-day trial for returning users without active subscription
              const trialEndsAt = new Date();
              trialEndsAt.setDate(trialEndsAt.getDate() + 14);

              user.subscription = {
                plan: 'premium',
                status: 'trialing',
                trialEndsAt,
              };
              await user.save();
              console.log(`[OAuth] Reset trial for existing user: ${user.email}`);
            }

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
