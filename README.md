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

Uusien luokkahuonepelisuoritusten alkutila tallennetaan PostgreSQL:ään.
`GET /api/games/sessions/current` hakee tallennetun tilan selaimen
`lc_classroom_session`-evästeen perusteella; session ID:tä ei anneta pyynnössä.
Vastaus sisältää `sessionId`, `gameId`, `gameName`, `playerName`, `startedAt`,
`schemaVersion`, `factorySettings`, `initialGameState`, `currentGameState` ja
`stateVersion`. Tunnisteet ja `stateVersion` palautetaan merkkijonoina.
Vastaukset eivät ole välimuistitettavia (`Cache-Control: no-store`).
Puuttuva tai kelpaamaton valtuutus palauttaa `401`; valtuutettu pelisuoritus
ilman tallennettua tilaa palauttaa `404` (`CLASSROOM_STATE_NOT_FOUND`).
Tietokantahäiriössä rajapinta palauttaa `503`.

Frontend hakee uuden luokkahuonepelin alkutilan palautusrajapinnasta heti
liittymisen jälkeen. Jos haku epäonnistuu, liittymislomakkeella voi uusia
tilahaun luomatta uutta pelisuoritusta. Sivun päivitys palauttaa edelleen
paikallisen `sessionStorage`-tilan eikä korvaa etenemistä palvelimen alkutilalla.
Kierrosten tietokantatallennusta ei ole vielä toteutettu.

## Kierrosvahvistuksen vertailutestit

[Jaetut lähtötilat ja päätökset](./shared/test-fixtures/roundConfirmationCases.js)
ja [vertailutulokset](./shared/test-fixtures/roundConfirmationExpected.json)
on tarkoitettu myös tulevan backend-vahvistuksen tarkistamiseen. Vertailutulokset
on otettu nykyisestä ACT-vahvistuksesta. Alkutilan taloushistoria verrataan
kokonaisuudessaan suoraan lähtötilaan eikä kopioida tulosfixtureen.

`knlRatio` on laskentamallin suhdeluku (esimerkiksi `0.684` tarkoittaa
`68,4 %`). `inventoryTurnoverPerYear` on vahvistetun kierroksen nykyinen
yläpalkin mittari: toimitukset / kierroksen loppuvarasto × 4 (kertaa vuodessa);
arvo on `null`, jos mittaria ei voi laskea. Nämä ovat testien vertailuyksiköt,
eivät päätös tietokantaan tallennettavista yksiköistä.
