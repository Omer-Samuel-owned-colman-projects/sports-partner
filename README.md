# Sports Partner

תשתית Full Stack - Node.js + TypeScript בצד שרת, React + MUI + Vite בצד לקוח.

## מבנה הפרויקט

```
sports-partner/
├── client/          # React + MUI + Vite
├── server/          # Node.js + Express + TypeScript
├── package.json     # סקריפטים משותפים
└── README.md
```

## התקנה

```bash
# התקנת תלויות ברמת הפרויקט
npm install

# התקנת תלויות שרת ולקוח
cd server && npm install
cd ../client && npm install
cd ..
```

## הרצה

### פיתוח (שרת + לקוח במקביל)
```bash
npm run dev
```

- **לקוח**: http://localhost:5173
- **שרת**: http://localhost:3001

### הרצה נפרדת

```bash
# שרת בלבד
npm run dev:server

# לקוח בלבד
npm run dev:client
```

### בנייה והרצה בפרודקשן

```bash
npm run build
npm start
```

## טכנולוגיות

| צד | טכנולוגיות |
|----|-------------|
| שרת | Node.js, Express, TypeScript, CORS |
| לקוח | React 18, MUI (Material-UI), Vite, TypeScript |

## API

- `GET /api/health` - בדיקת תקינות השרת

## Proxy

ה-Vite מוגדר להעביר בקשות ל-`/api` לשרת ב-`http://localhost:3001`.
