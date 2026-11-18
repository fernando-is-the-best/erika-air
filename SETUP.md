# Access-code setup (Firebase, free)

The game stays locked until this is done. It takes about 10 minutes, once.

## 1. Create the Firebase project
1. Go to https://console.firebase.google.com and sign in with your Google account.
2. Click **Create a project**, name it `erika-air`, and finish the steps (Google Analytics is not needed).

## 2. Turn on sign-in
1. In the left menu: **Build → Authentication → Get started**.
2. Under **Sign-in method**, enable **Anonymous** (this is how players are recognised) and **Google** (this is how you sign in as admin).
3. Under **Settings → Authorized domains**, click **Add domain** and add `fernando-is-the-best.github.io`.

## 3. Create the database
1. **Build → Firestore Database → Create database**. Pick a location near you and start in **production mode**.
2. Open the **Rules** tab, delete everything, and paste the contents of `firestore.rules` from this repository.
3. In the pasted rules, replace `YOUR_ADMIN_EMAIL` with the Google address you will sign in with as admin. Click **Publish**.

## 4. Connect the game
1. Click the gear icon → **Project settings** → under **Your apps**, click the web icon `</>`, name it `erika-air`, and register it (no hosting needed).
2. Copy the four values `apiKey`, `authDomain`, `projectId` and `appId` from the `firebaseConfig` shown, into `firebase-config.js`. These values are not secret.

## 5. Use it
- Admin page: https://fernando-is-the-best.github.io/erika-air/admin.html — enter the admin code, then sign in with Google.
- Make a code, give it a name, and send it to a player. The first person to enter it owns it; anyone else who tries it is blocked.
- If a player changes device or clears their browser, click **Free up** on their code so they can enter it again.
