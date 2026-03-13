# Security & Performance TODOs

## HIGH Priority - Do Before Public Launch

### 1. Firestore Security Rules 🚨
**Status:** Not implemented
**Risk:** HIGH - Any authenticated user can access other users' schedules

**Implementation:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /schedules/{scheduleId} {
      // Only schedule owner can read/write their own schedules
      allow read, write: if request.auth != null
        && request.auth.uid == resource.data.userId;

      // Only owner can create schedules
      allow create: if request.auth != null
        && request.auth.uid == request.resource.data.userId;

      // Prevent creating more than 10 schedules per user
      allow create: if request.auth != null
        && request.auth.uid == request.resource.data.userId
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.scheduleCount < 10;
    }
  }
}
```

**Steps:**
1. Go to Firebase Console → Firestore Database → Rules
2. Replace rules with the above
3. Test with different users
4. Publish

---

### 2. Email Verification
**Status:** Not implemented
**Risk:** MEDIUM - Fake accounts, spam

**Implementation:**
```typescript
// In src/auth.ts
import { sendEmailVerification } from 'firebase/auth';

export const signUp = async (email: string, password: string) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  await sendEmailVerification(userCredential.user);
  return userCredential;
};
```

**Steps:**
1. Add email verification after signup
2. Update UI to show "Check your email" message
3. Block access until email verified (optional but recommended)

---

### 3. Firebase App Check
**Status:** Not implemented
**Risk:** MEDIUM - API abuse, bot attacks

**Steps:**
1. Go to Firebase Console → App Check
2. Register your app
3. Add reCAPTCHA v3 for web
4. Add enforcement to Firestore

**Documentation:** https://firebase.google.com/docs/app-check

---

### 4. Rate Limiting Per User
**Status:** Not implemented
**Risk:** MEDIUM - Users creating 1000s of schedules

**Limit schedules to 10 per person:**
- Prevents database bloat
- 10 is generous for normal use
- Users can delete old schedules to make room

**Implementation:**
```typescript
// In src/services/scheduleService.ts
export const saveSchedule = async (userId: string, scheduleData: ScheduleData) => {
  // Check existing schedule count
  const schedulesRef = collection(db, 'schedules');
  const q = query(schedulesRef, where('userId', '==', userId));
  const snapshot = await getDocs(q);

  if (snapshot.size >= 10) {
    throw new Error('Maximum 10 schedules per user. Delete old schedules to create new ones.');
  }

  // Continue with save...
};
```

---

## MEDIUM Priority - Do Soon

### 5. Input Sanitization
**Status:** Not implemented
**Risk:** LOW - XSS potential (React escapes by default)

**Implementation:**
```typescript
// Add to src/utils/validation.ts
export const sanitizeInput = (input: string, maxLength = 100): string => {
  return input
    .replace(/<script>/gi, '')
    .replace(/<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .trim()
    .slice(0, maxLength);
};
```

Apply to:
- Schedule names
- Time block labels
- User inputs

---

### 6. CAPTCHA on Sign-Up
**Status:** Not implemented
**Risk:** MEDIUM - Bot registrations

**Options:**
- reCAPTCHA v3 (invisible)
- hCaptcha
- Cloudflare Turnstile (privacy-focused)

---

### 7. Content Security Policy (CSP)
**Status:** Not implemented
**Risk:** LOW

**If using Vercel, add to `vercel.json`:**
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://apis.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.firebaseio.com https://*.googleapis.com"
        }
      ]
    }
  ]
}
```

---

## LOW Priority - Nice to Have

### 8. Session Timeout
**Implementation:**
```typescript
// Auto-logout after 7 days of inactivity
const SESSION_TIMEOUT = 7 * 24 * 60 * 60 * 1000; // 7 days

// Check last activity and logout if expired
```

---

### 9. Account Security Features
- [ ] Password strength indicator on signup
- [ ] 2FA option (Google Authenticator)
- [ ] Account recovery options
- [ ] Login history/active sessions
- [ ] Suspicious activity alerts

---

### 10. Monitoring & Alerts
**Setup in Firebase Console:**
- [ ] Enable Cloud Monitoring
- [ ] Set alerts for:
  - Unusual authentication patterns
  - High read/write rates
  - Error spikes
  - Budget thresholds

---

### 11. Automated Security Scanning
**Run regularly:**
```bash
# Check for vulnerable dependencies
npm audit

# Fix auto-fixable issues
npm audit fix

# For more thorough scanning (install Snyk)
npx snyk test
```

---

### 12. Backup Strategy
**Status:** Not implemented

**Setup:**
1. Enable Firestore automatic backups (paid feature)
2. OR: Create scheduled Cloud Function to export data
3. Store backups in Cloud Storage

---

## Compliance & Legal

### 13. Privacy Policy & Terms of Service
- [ ] Add Privacy Policy page
- [ ] Add Terms of Service page
- [ ] Cookie consent (if needed in your region)
- [ ] GDPR compliance (if EU users)
- [ ] CCPA compliance (if CA users)

---

### 14. Data Export/Deletion
**Status:** Partially implemented (export only)

- [x] Users can export schedules (JSON/CSV)
- [x] Users can delete account
- [ ] Verify all user data is deleted on account deletion
- [ ] Add "Download all my data" option (GDPR requirement)

---

## Testing Checklist

Before launch, test:
- [ ] Unauthorized access attempts (try accessing other users' schedules)
- [ ] XSS attempts (inject `<script>` in inputs)
- [ ] Rate limiting (create many schedules rapidly)
- [ ] SQL injection (not applicable, but test Firestore queries)
- [ ] Authentication bypass attempts
- [ ] CSRF protection (Firebase handles this)
- [ ] Password reset flow security
- [ ] Account deletion completeness

---

## Incident Response Plan

If there's a security breach:
1. **Immediate:** Disable affected features/accounts
2. **Assess:** Determine scope and impact
3. **Notify:** Inform affected users within 72 hours
4. **Fix:** Patch vulnerability
5. **Review:** Post-mortem and prevention strategy

---

## Performance & Cost Optimization

### 15. Database Indexing
- [ ] Add Firestore indexes for common queries
- [ ] Monitor slow queries in Firebase Console

### 16. Caching Strategy
- [ ] Cache user schedules in localStorage
- [ ] Reduce Firestore reads

### 17. Cost Monitoring
- [ ] Set up billing alerts
- [ ] Monitor Firestore read/write counts
- [ ] Optimize queries to reduce costs

---

## Resources

- [Firebase Security Checklist](https://firebase.google.com/support/guides/security-checklist)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Web Security Academy](https://portswigger.net/web-security)
