---
name: lawyer
description: Privacy and legal check before a site or app goes live — what personal data it collects, stores and shares, which US privacy rules apply, then writes the privacy policy and terms pages from what the app really does. Use it, as a recommendation, once the app is finished and before launch, or when the user says privacy, terms, cookies, GDPR or "is this legal". Recommended for anything public that collects data, skipped for pure research, practice or private projects.
---

# Lawyer

Rules this follows: 6 (security), 6.6 (licences and credits), 9.5 (done needs proof), 9.4 (never fake results), 1.1 (short bullets first).

**This is a careful checklist and a first draft, not a real lawyer and not legal advice.** Say that in the report. Laws change and depend on the situation. If the app takes payments, handles health, money or school records, targets children, or has many users, tell the user to have a real lawyer read the pages before launch.

The default audience is **the United States**. Ask once if users are also elsewhere (EU, UK, Canada), because that adds rules.

## When this runs

- **It is a recommendation, never forced.** The user decides.
- Offer it after the app is finished and before launch (it pairs with `pre-deploy-check`).
- **Do not offer it** for pure research, learning exercises, scripts, or a project that stays on the user's own computer and collects nothing from other people. Say in one line why you skipped it.

### The offer (ask exactly once, short)

> 🧑‍⚖️ Before you launch: I have a skill called **lawyer**. It checks what personal information your app collects and stores, tells you which US privacy rules apply and why, and writes your privacy policy and terms pages from what the app really does. Want it? (Skip it for research or private projects.)

If the user says no, drop it. Do not ask again this session.

## Step 1 — Find out what the app really does (read the code, do not guess)

Search the project for, and **never open `.env`** (rule 7). Look at `.env.example` for the names of services.

- Forms and sign-up or login (email, name, password, phone, address, birthday)
- Cookies, `localStorage`, `sessionStorage`, session tokens
- Analytics, ads, pixels, maps, chat widgets, fonts or scripts loaded from other companies
- Payments (Stripe, PayPal) — note: card numbers must stay with the payment company, never in this app
- Uploads (photos, files), comments, reviews, any content other people can post
- Location, camera, microphone, contacts
- Text sent to an AI service, or to any outside API
- Logs that hold IP addresses or user ids; databases and where they are hosted
- Email sending (newsletters, notifications)

Then fill **one table** (this is the core of the whole check):

| Data | Where it is collected | Where it is stored | Who else gets it | Why it is needed | How long kept |
|---|---|---|---|---|---|

Mark anything that is collected but **not needed**. Suggest removing it: the safest data is data you never collect.

## Step 2 — Which rules apply, and why (plain words, US)

Only list the rows that fit this app. Each item says **what**, **why**, **how**.

| If the app… | Rule | What to do |
|---|---|---|
| collects any personal information from the public | California Online Privacy Protection Act (applies to anyone whose site is used by Californians) | Post a privacy policy that is easy to find (footer link) and says what you collect, why, and who gets it |
| has users in states with privacy laws (California, Virginia, Colorado, Texas and others) | State privacy laws such as the CCPA/CPRA | Check the current size thresholds. If you are over them: let people see, delete and correct their data, and say whether you sell or share it |
| is used by, or aimed at, children under 13 | COPPA | Simplest safe choice: do not allow under 13 and say so. Otherwise you need verified parent permission |
| sends marketing or newsletter emails | CAN-SPAM | Real sender name, a working unsubscribe link, your postal address, honour opt-outs quickly |
| uses cookies or trackers and has visitors from the EU or UK | GDPR / ePrivacy | Cookie banner with a real "no" button, a legal reason for each use of data, a way to ask for deletion |
| takes payments | Card-industry rules (PCI) | Use the payment company's own form (Stripe Checkout or similar). Never store card numbers |
| holds health, financial, or school records | HIPAA, GLBA, FERPA | Stop and recommend a real lawyer before launch |
| lets users post content | Takedown rules (DMCA) and your own rules | Terms with content rules, a way to report content, and a contact for copyright complaints |
| uses AI that talks to users or makes decisions | FTC honesty rules | Say clearly that it is AI. Do not claim things the app cannot do |
| has paid reviews, endorsements or "limited time" claims | FTC rules on reviews and dark patterns | Be honest and make cancelling as easy as signing up |
| is a public website | Accessibility (ADA lawsuits are common) | Aim for WCAG 2.1 AA: alt text, contrast, keyboard use, labels |
| keeps accounts | Breach-notification laws | Write down who you would tell, and how, if data leaked |
| uses other people's code, fonts, images | Licences (rule 6.6) | Keep `CREDITS.md` up to date |

If you are not sure a row applies, say **"not sure — ask a lawyer"**. Never guess a legal fact.

## Step 3 — The list for the user

Give **short bullets first** (rule 1.1), ranked:

- 🔴 **Must do before launch** — each with **why** and **how** in one line
- 🟠 **Should do**
- 🟢 **Nice to have**

Then one line: what you will write or change yourself, and what only the user can supply.

## Step 4 — Write the pages from the real app

Ask the user **once, in one batch**, for the facts only they know: the name to show (person, project or company), a contact email for privacy questions, the country or state, and the postal address if emails are sent. Use clear placeholders like `[YOUR CONTACT EMAIL]` for anything still missing, and list them at the end.

Then, in the project's own technology and style:

1. **Privacy policy** (`privacy` page) — built from the table in Step 1. Say only what is **true**. If analytics exist, do not write "we never share your data". Include: what is collected, why, who gets it, how long it is kept, cookies, children, how to ask for access or deletion, contact, date of last update.
2. **Terms of use** (`terms` page) — what the service is, what users may not do, who owns content, no promises of results, limits of responsibility, how accounts can be closed, contact, date.
3. **Footer links** to both pages on every page, and a "I agree to the Terms and Privacy Policy" checkbox on sign-up when there are accounts.
4. **Cookie banner only if needed** (EU/UK visitors with non-essential cookies). Ask before adding one; a banner changes the look of the site.
5. Small code fixes that the check found (remove an unused tracker, add the account-delete path). Do not refactor.

Keep the pages short and in plain English: people actually read them, and short pages are easier to keep true.

## Step 5 — Check, then report

- Open the generated pages and check each claim against the Step 1 table.
- If it is a visual project, take a screenshot of the new pages and the footer (`design-review` skill).
- Run the project's tests and build.
- Report in two layers (rule 1.2): simple bullets first, then the full text. End with: ✅ done, ⚠️ placeholders still to fill, ❓ what only the user can decide, and the line **"This is a first draft, not legal advice."**

## Never

- Never invent a company name, address, registration number, or law that does not exist.
- Never say the app "complies" with a law. Say "covers the usual requirements for…".
- Never put the user's personal email or address into a public page without asking.
- Never open the real `.env` (rule 7).
