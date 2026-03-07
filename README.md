# Sports Partner

אפליקציה חברתית למציאת שותפים למשחקי ספורט. משתמשים יכולים לפרסם משחקים קרובים, לחפש משחקים פתוחים ולהירשם כמשתתפים.

## טכנולוגיות

| צד | טכנולוגיות |
|----|-------------|
| שרת | Node.js, Express, TypeScript, Drizzle ORM, PostgreSQL |
| לקוח | React 18, MUI (Material-UI), Vite, TypeScript |
| תשתית | Docker (PostgreSQL), JWT |

## מבנה הפרויקט

```
sports-partner/
├── client/              # React + MUI + Vite
├── server/
│   ├── src/
│   │   ├── db/
│   │   │   ├── schema.ts      # Drizzle schema (all tables)
│   │   │   ├── client.ts      # DB connection
│   │   │   ├── seed.ts        # Seed sports & venues
│   │   │   └── migrations/    # Generated SQL migrations
│   │   └── index.ts           # Express entry point
│   ├── drizzle.config.ts
│   └── .env.example
├── docker-compose.yml   # PostgreSQL
└── package.json         # Shared scripts
```

## דרישות מקדימות

- [Node.js](https://nodejs.org/) v20+
- [Docker](https://www.docker.com/) (להרצת PostgreSQL מקומית)

## התקנה

```bash
# 1. שכפול הפרויקט
git clone https://github.com/Omer-Samuel-owned-colman-projects/sports-partner.git
cd sports-partner

# 2. התקנת תלויות
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..

# 3. הגדרת משתני סביבה
cp server/.env.example server/.env
# ערוך את server/.env לפי הצורך
```

## מסד נתונים

```bash
# הפעלת PostgreSQL עם Docker
npm run db:up

# דחיפת הסכמה למסד הנתונים
cd server && npm run db:push

# זריעת נתוני ברירת מחדל (ספורטים ומגרשים)
npm run db:seed
```

### סקריפטים למסד הנתונים (מתוך תיקיית server/)

| סקריפט | תיאור |
|---------|-------|
| `npm run db:push` | דחיפת הסכמה ישירות למסד הנתונים (מומלץ לפיתוח) |
| `npm run db:generate` | יצירת קובץ migration חדש |
| `npm run db:migrate` | הרצת migrations ממתינים |
| `npm run db:studio` | פתיחת Drizzle Studio (ממשק גרפי למסד הנתונים) |
| `npm run db:seed` | זריעת ספורטים ומגרשים |

### סקריפטי Docker (מתוך שורש הפרויקט)

| סקריפט | תיאור |
|---------|-------|
| `npm run db:up` | הפעלת PostgreSQL ברקע |
| `npm run db:down` | עצירת הקונטיינר (הנתונים נשמרים) |
| `npm run db:reset` | מחיקת הנתונים והפעלה מחדש |

## הרצה

```bash
# פיתוח — שרת ולקוח במקביל
npm run dev
```

- **לקוח**: http://localhost:5173
- **שרת**: http://localhost:3001

```bash
# הרצה נפרדת
npm run dev:server
npm run dev:client
```

## בנייה ופרודקשן

```bash
npm run build
npm start
```

## API

| Method | Route | תיאור |
|--------|-------|-------|
| `GET` | `/api/health` | בדיקת תקינות השרת |

## משתני סביבה

ראה `server/.env.example`:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/sports_partner
PORT=3001
```
