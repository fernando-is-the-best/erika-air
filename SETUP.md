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
- Make a code: give it a name, pick the **Games** it opens (one or more: tap each game to turn it on or off) and the **Type**:
- **Codes for more than one game:** the player types the code once; the other games on the code open by themselves in the same browser. Click **Games** on a code to add or remove games later (its first game always stays). In **Manage**, pick which game's credits and items to change. Unlocking works straight away. For the desk to see credits and items from the extra games, paste the updated `codes` block and the `okStatus` function below it from `firestore.rules` into **Firestore Database → Rules** and click **Publish** (keep your admin email in place).
  - **35-character code**: the first person to enter it owns it and stays unlocked on their browser; anyone else who tries it is blocked.
  - **10-digit one-time code**: unlocks one visit, then it is used up (it can be typed with a space, e.g. `12345 67890`). **Free up** makes it usable once more.
- Codes made before games were separate count as Erika Air codes.
- If a player changes device or clears their browser, click **Free up** on their code so they can enter it again.
- **Shared code alerts:** when someone tries a code that already belongs to another player, an alert appears at the top of the admin desk (with a chime, and a desktop notification once you click **Turn on desktop alerts**). The Admin button in the game shows a red count while alerts are unread. From the alert you can **Turn off code**.
  - This needs the `alerts` block from `firestore.rules`. If you set up the rules before it existed, open **Firestore Database → Rules**, paste the `match /alerts/{alertId} { ... }` block from `firestore.rules` just above the last two closing braces, and click **Publish** (keep your admin email in place).
  - Notifications arrive while the admin desk or the game is open in a browser where you are signed in as admin. Alerts that happen while nothing is open wait on the desk until you next open it.
- **Planes flown:** click **Show planes flown** above the code list to see which aircraft each player has flown and how many times. The game counts every flight started with a code.
  - This needs the third `allow update` part in the `codes` block of `firestore.rules` (the one about `'fleet'`). Paste the updated `codes` block into **Firestore Database → Rules** and click **Publish** (keep your admin email in place).
- **Manage players** (the Manage button on each code, or *Everyone at once*): give, take away or set credits, give or take away planes, cars and boats, and block items. Changes reach the player the next time they play (straight away if they are playing). To see each player's credits and items on the desk, the games report them back: this needs the fourth `allow update` part in the `codes` block of `firestore.rules` (the one about `'status'`). Paste the updated `codes` block into **Firestore Database → Rules** and click **Publish** (keep your admin email in place). Giving and taking work without it.
- **Messages:** players can ask you for a code on the enter-code page, and message you from inside each game. You see them under **Messages** at the top of the desk.
  - To switch it on (once):
    1. Open the rules page: https://console.firebase.google.com/project/erika-air/firestore/databases/-default-/rules
    2. Copy the `match /messages/{msgId} { ... }` block from https://github.com/fernando-is-the-best/erika-air/blob/main/firestore.rules
    3. Paste it just above the last two `}` at the bottom of the rules. Don't change anything else.
    4. Click **Publish**.
