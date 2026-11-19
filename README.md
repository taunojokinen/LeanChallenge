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
Frontend vahvistaa kierrokset edelleen paikallisesti.

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
ja rajapinnan vastausyksiköt.

[Yhteinen kierrosvahvistuksen laskentafunktio](./shared/game-round/confirmRound.js)
saa syötteenä asetukset, nykytilan ja kierroksen päätökset, ei asiakkaan laskemaa
tulosta. Se palauttaa seuraavan pelitilan, historiarivin, tunnusluvut ja
mahdollisen päättymistiedon. Backendin vastaavuustestit käyttävät yllä olevia
ACT-vertailutuloksia.

## Luokkahuonepelin kierrosvahvistus (backend)

`POST /api/games/sessions/current/rounds/confirm` vaatii voimassa olevan
`lc_classroom_session`-evästeen ja otsakkeen
`X-Requested-With: XMLHttpRequest`. JSON-pyyntö sisältää `sessionId` ja
`expectedStateVersion` positiivisina BIGINT-desimaalimerkkijonoina sekä
`roundNumber`-kentän kokonaislukuna (1–12).

`decisions` sisältää seuraavat päätökset:

| Kenttä | Sisältö |
| --- | --- |
| `actDecision` (pakollinen) | `price`, `productionQuantity`, `addedVariations`, `useFinishedGoodsInventoryForDeliveries` |
| `checkStaffingDecision` | `staffing: { assembly, shipping }` |
| `checkProductionDecision` | `batchSize` |
| `fiveSDecision` | `investedHours: { machining, assembly, shipping }` |
| `projectsDecision` | `selections: [{ department, method, investedHours }]` |
| `investmentsDecision` | `investments: [{ type, quantity }]` |

Valinnaisen päätöksen voi jättää pois tai antaa arvona `null`. Palvelin
liittää päätöksiin ylätason kierrosnumeron. Selaimen tuloksia, pelitilaa tai
päätösmetatietoja (`round`, `savedAt`) ei hyväksytä.

`200` palauttaa `sessionId`, `confirmedRound`, `stateVersion`, `currentGameState`,
`metrics` ja `completion` (päättymistieto tai `null`). `400` tarkoittaa
virheellistä syötettä, `401` evästevaltuutuksen epäonnistumista, `403` puuttuvaa
käyttöoikeutta tai CSRF-otsaketta ja `409` ristiriitaa (esimerkiksi vanhentunut
versio tai jo vahvistettu kierros). Jos tallennuksen tulosta ei voi varmistaa
(`503` tai yhteys katkeaa), tarkista palvelimen tila `GET`-rajapinnasta ennen
uutta vahvistusyritystä.

Päätökset, raporttirivi ja nykytila tallennetaan samassa transaktiossa. KNL
tallennetaan prosentteina (`0.684` → `68.40`) ja varaston kierto kertoina
vuodessa. PostgreSQL:n raporttisarakkeiden tarkkuus ei pyöristä pelitilaa.
Pelin päättyessä myös pelisuorituksen lopetusaika ja syy tallennetaan
samassa transaktiossa. Kierrosraja on tietokannassa `completed`, pelitilassa
ja vastauksessa `round-limit`.

Rajapinta ei tallenna kierroksia nykyisessä skeemassa: pelisuorituksen
palvelimen hallinnoiman `server_round_confirmation_enabled`-merkinnän
puuttuminen tai arvo muu kuin `true` estää vahvistuksen. Käyttöönotossa
merkintä annetaan vain uusille palvelinvahvistukseen tarkoitetuille
pelisuorituksille, kun frontend tukee sitä. Vanhoja pelisuorituksia ei
merkitä jälkikäteen.

### PostgreSQL-integraatiotesti Pedasuksessa

Kirjoittava testi on erillinen tavallisista testeistä. Ota ensin tuore,
palautettavissa oleva varmuuskopio Pedasuksen `leanchallenge`-kannasta.
Käynnistä testi vasta erikseen hyväksytyllä ajolla vuorovaikutteisessa päätteessä:

```powershell
npm --prefix backend run test:round-pg
```

Komento näyttää kohteen ja pyytää kirjoittamaan ajokohtaisen vahvistuslauseen
`VARMUUSKOPIO OTETTU LC-ROUND-IT-<UUID>`. Älä vahvista, jos kohde tai varmuuskopio
ei ole varmistettu. Testi ei lue sovelluksen `.env`-tiedostoa.

| Ympäristömuuttujat | Arvo |
| --- | --- |
| `LC_IT_CONNECTION_MODE` | `direct` (oletus) tai `ssh-tunnel`. Tietokannan nimi on aina `leanchallenge`. |
| `LC_IT_PEDASUS_IPV4`, `LC_IT_PORT` | Suorassa tilassa Pedasuksen PostgreSQL-IPv4-osoite ja portti. Poista molemmat ympäristömuuttujat tunnelitilassa. |
| `LC_IT_APP_USER`, `LC_IT_APP_PASSWORD` | Rajattu testisovellusrooli ja sen salasana. |
| `LC_IT_FIXTURE_USER`, `LC_IT_FIXTURE_PASSWORD` | Erillinen aineistorooli ja sen salasana. |
| `LC_IT_TEACHER_ID`, `LC_IT_SETUP_ID` | Vain testikäyttöön tarkoitettujen olemassa olevien `teachers`- ja `setup`-rivien tunnisteet. Testi ei muuta eikä poista niitä. |

Tunnelitilassa avaa Windowsissa erillinen SSH-tunneli osoitteesta
`127.0.0.1:15432` Pedasuksen osoitteeseen `127.0.0.1:5432`. Varmista Pedasuksen
SSH-isäntäavain ennakolta ja käytä `StrictHostKeyChecking=yes` ja
`ExitOnForwardFailure=yes`. PostgreSQL:n ilmoittama loopback-osoite ei yksin
tunnista Pedasusta. Testi ei avaa tunnelia eikä yritä suoraa yhteyttä sen
sijaan. Tunnelitilan roolit ovat `lc_round_it_app` ja `lc_round_it_fixture`.

Anna salasanat vain testiprosessin ympäristössä. Aja luotetun yhteyden yli.
Älä käytä ylläpitäjää tai sovelluksen kaikkivoipaista omistajaa. Roolit tarvitsevat
`CONNECT`-oikeuden, `USAGE`-oikeuden `public`-skeemaan ja seuraavat oikeudet:

- Sovellusrooli: `SELECT` viiteen testitauluun (`games`, `game_sessions`,
  `classroom_game_states`, `round_decisions`, `round_results`), `INSERT` kahteen
  kierrostauluun sekä vain kierrospalvelun tarvitsemat `UPDATE`-sarakkeet:
  `game_sessions(finished_at, completion_reason)` ja
  `classroom_game_states(current_game_state, state_version, updated_at)`.
  Ei `DELETE`- tai `TRUNCATE`-oikeuksia eikä oikeutta muuttaa
  `server_round_confirmation_enabled`-saraketta.
- Aineistorooli: `SELECT`, `INSERT` ja `DELETE` viiteen testitauluun, vain
  rivilukituksen edellyttämä `UPDATE` sarakkeisiin `games.name` ja
  `game_sessions.player_name` sekä `SELECT` testin viiteriveihin
  (`teachers.id`, `setup.id`). Anna rooleille tarvittaessa `USAGE` vain niiden
  lisäyksissä käyttämiin sekvensseihin. Aineistoroolin on voitava kutsua
  `pg_blocking_pids`-funktiota rinnakkaisuustestissä.

Testi tarkistaa yhteyden osoitteen, portin, kannan ja kirjautumisroolin sekä
tarvittavan skeeman ja käyttöoikeudet ennen ensimmäistä lisäystä. HTTP-palvelu
kuuntelee vain paikallisessa satunnaisessa portissa ja hyväksyy vain ajon
luomat pelisuoritukset. Testi ei ota palvelinvahvistusta käyttöön vanhoille
pelisuorituksille. Rollback pakotetaan yhden testisuorituksen BIGINT-ylivuodolla,
ei skeemamuutoksella.

`LC-ROUND-IT-<UUID>` merkitään synteettisten pelien ja pelaajien nimiin.
Testi tulostaa paikallisen `fixtures.jsonl`-ajoluettelon sijainnin ja kirjaa
luodut tunnisteet ennen luontitransaktion vahvistamista. Siivous tarkistaa
tunnisteet, täsmälliset merkinnät ja viitteet ennen rajattuja poistoja. Jos
prosessi keskeytyy tai siivous ei onnistu, säilytä ajoluettelo: tarkista
sen tarkat peli- ja suoritustunnisteet ja ajomerkintä ennen erikseen
hyväksyttävää siivousta. Älä poista rivejä pelkän nimietuliitteen perusteella.
