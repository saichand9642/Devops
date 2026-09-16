# Access list

`allowed-emails.ts` decides who can open the DevOps Learning Hub.

## Adding somebody

1. Open [`allowed-emails.ts`](./allowed-emails.ts).
2. Add their address to the `allowedEmails` array, in quotes, with a trailing comma.
3. Commit and deploy. They can then sign in with that address.

```ts
export const allowedEmails: readonly string[] = [
  'saichand.kanimeraka@tenetic.com',
  'teammate@tenetic.com',
]
```

An entry beginning with `@` matches every address on that domain:

```ts
export const allowedEmails: readonly string[] = ['@tenetic.com']
```

## Removing somebody

Delete their line and deploy. They are locked out the next time the app loads,
even if they were already signed in — the stored sign-in is re-checked against
this list on every start.

Their progress is not deleted by removing them. It stays in their own browser
under their own key, and it comes back if they are added again.

## Per-person progress

Each signed-in address gets its own progress record in that browser's
local storage, under `devops-learning-hub.progress.user.<email>`. Two people
sharing one laptop therefore keep separate lesson completions, practice
history, exam attempts and study streaks; signing out and back in as somebody
else swaps the whole record over.

Progress still never leaves the device it was made on. Signing in with the same
address on a second device shows an empty record there — use **Export** and
**Import** on the Progress page to move it deliberately.

## What this is not

The app is a static site with no backend. This list is compiled into the
JavaScript bundle, so it is readable by anyone who opens developer tools, and
there is no password to verify that somebody owns the address they typed. It
keeps the app to the intended group and keeps their progress apart. It is not a
security boundary, so do not put confidential material behind it.
