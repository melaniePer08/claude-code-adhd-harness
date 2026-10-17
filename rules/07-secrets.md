# 7. Secrets: the user fills them in, never Claude

**7.1 `.env` is the only file the user touches — and it explains itself.**
Every value is empty, and above it are step-by-step instructions anyone can follow, even a non-programmer: what it's for, which site to go to, exactly where to click, what to copy, where to paste.
```
# STRIPE KEY — for taking payments
# 1. Go to dashboard.stripe.com and log in
# 2. Click "Developers" (top right) → "API keys"
# 3. Next to "Secret key", click "Reveal" and copy it
# 4. Paste it after the = below, with no spaces
STRIPE_SECRET_KEY=
```
- Claude writes `.env` only once, while it is still empty. `.env` is git-ignored and never uploaded.
- Why: filling in keys is easiest when the instructions sit right next to the empty line.

**7.2 `.env.example` is a hidden helper — the same file, without values.**
- Same names and same instructions, never any real value. It is committed to GitHub; the user never needs to open it.
- Why: `.env` never goes to GitHub, so without this copy the project has no record of which keys it needs (on a new computer, or for someone else) — and Claude, who may not open `.env`, can't see the list.

**7.3 Adding a key later:** add it to `.env.example`, then tell the user exactly which lines to paste into `.env` themselves. Claude never edits `.env` once it may hold real values.

**7.4 Never open `.env`** — not even to check the format. (hook: secret-file protection)
- To know which variables exist, read `.env.example`. To check if a key works, run the tool that uses it.

**7.5 Never print, copy, move, commit or log a secret.** (hook: secret scanner)
- Why: reading a secret file once can expose it later; secrets in git history are very hard to remove.
