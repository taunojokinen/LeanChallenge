# LeanChallenge

Opinnäytetyön pohjaprojekti.

## Rakenne

- frontend/ — käyttöliittymä
- backend/ — palvelin ja API

## Teknologiat

- Frontend: React + Vite
- Backend: Node.js + Express
- Tietokanta: MongoDB + Mongoose

## Käynnistys

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
npm install
npm run dev
```

## Ympäristömuuttujat

Luo backend-kansioon `.env`-tiedosto esimerkiksi näin:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/leanchallenge
```
