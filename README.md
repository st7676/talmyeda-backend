# Talmyeda Backend

Backend של Talmyeda — פלטפורמת SaaS גנרית, רב-דיירותית (multi-tenant), לניהול מוסדות חינוך.
בנוי עם [NestJS](https://nestjs.com/) + MongoDB (Mongoose).

- אפיון מלא: `SPEC.md.DOC`
- מצב התקדמות: [`PROGRESS.md`](PROGRESS.md)
- תיעוד מורחב: [`docs/README.md`](docs/README.md)
- Frontend: ריפו נפרד — [`talmyeda-frontend`](../talmyeda-frontend)

## דרישות מוקדמות

- Node.js
- MongoDB (מקומי, או דרך Docker)
- קובץ `.env` (ראו `.env.example`): `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`, `NODE_ENV`

## התקנה והרצה

```bash
npm install
npm run start:dev
```

השרת עולה על הפורט שמוגדר ב-`.env` (בד"כ 3000), עם hot-reload.

### הרצה עם Docker (שרת + Mongo אמיתיים)

```bash
docker compose up
```

מתאים לבדיקה ידנית / manual QA בלי צורך להתקין תלויות מקומית.

## בדיקות

```bash
npm test                  # unit tests
npm run test:e2e          # בדיקת "עולה בלי לקרוס" (בלי DB אמיתי)
npm run test:integration  # טסטים אמיתיים מול MongoDB (mongodb-memory-server)
```

יש להריץ `npm run test:integration` לפני push של שינויים בסכימות/שאילתות.

## בנייה ולינט

```bash
npm run build
npm run lint
```

## עקרונות מרכזיים

- **Multi-tenant:** כל שאילתה עסקית מסוננת לפי `institutionId`, שמגיע אך ורק מה-JWT של המשתמש המאומת — לעולם לא מגוף הבקשה.
- **הפרדת אימות/דאטה עסקית:** `User` משמש לאימות בלבד; `Participant`/`Staff` הם ישויות הדאטה העסקית.
- **סכימה דינמית:** שדות מותאמים אישית נשמרים כ-`customFields: [{ k, v }]` (Attribute Pattern).

לפירוט מלא ראו את `CLAUDE.md` ו-[`docs/README.md`](docs/README.md).
