# LeanChallenge

Opinnäytetyön pohjaprojekti.

## Rakenne

- frontend/ — käyttöliittymä
- backend/ — palvelin ja API
- shared/ — frontendin ja backendin yhteiset ES-moduulit, kuten laskennan apufunktiot

## Teknologiat

- Frontend: React + Vite
- Backend: Node.js + Express
- Tietokanta: PostgreSQL

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

Kopioi `backend/.env.example` tiedostoksi `backend/.env` ja määritä tietokannan
yhteysasetukset ja salasana. PostgreSQL voi sijaita toisella koneella.

## Luokkahuonepelin tunnistus

Liittyminen luo uuden pelisuorituksen ja selaimelle 30 päivän HttpOnly-evästeen.
Tietokantaan tallennetaan tunnisteesta vain tiiviste. Sivun päivityksessä
pelisuoritus palautetaan selaimen istuntotallennuksesta ja valtuutus tarkistetaan
backendiltä; yhdessä selainprofiilissa on yksi aktiivinen luokkahuonepelin eväste.
Tuotannossa backend on ajettava asetuksella `NODE_ENV=production` HTTPS-yhteyden
takana, jolloin evästeelle asetetaan `Secure`.

Tässä vaiheessa pelitila säilytetään edelleen selaimen `sessionStorage`-tilassa.
Selaimen välilehden sulkemisen jälkeen pelitilaa ei välttämättä voi palauttaa,
vaikka eväste olisi voimassa. Kierrosten tietokantatallennusta ei ole vielä toteutettu.
