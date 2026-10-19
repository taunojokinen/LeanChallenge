# Lean Challenge – vaatimusmäärittely

## 1. Projektin tavoite

Lean Challenge on yrityspelimäinen oppimispeli, jonka tavoitteena on opettaa Lean-johtamisen menetelmien tehokasta käyttöä.

Pelaaja johtaa virtuaalista tehdasta 12 kierroksen ajan. Jokainen kierros muodostaa PDCA-syklin.

Pelin keskeinen oppimistavoite on ymmärtää Lean-toimenpiteiden vaikutus:
- tuotannon KNL/OEE-mittareihin
- kapasiteettiin
- pullonkauloihin
- toimituskykyyn
- kustannuksiin
- kannattavuuteen
- yrityksen taloudelliseen tulokseen

Pelaajan käytettävissä olevat resurssit ovat rajallisia. Kaikkia parannuksia ei voida toteuttaa samalla kierroksella.

### Sovelluksen nimi ja pelin aloitus

Yhteiset nimet ja iskulause määritellään tiedostossa
`src/config/appConfig.js`: pelin nimi on Lean Challenge ja johtamisnäkymän
nimi Lean Cockpit. Vasemman navigaation Cockpit-teksti säilyy ennallaan.

Uuden Quest- tai opettajan testipelin ensimmäinen Cockpit-näkymä avaa
pelin tavoitteet modaalisessa aloitusikkunassa. Aloita peli ja Escape
sulkevat ikkunan muuttamatta pelitilaa tai kierrosta. Sivunvaihto tai
tallennetun pelin jatkaminen ei avaa sitä automaattisesti uudelleen.
Cockpitin Pelin tavoitteet -painike avaa ikkunan aina tarvittaessa.

Älä näytä enää -valinta tallentuu heti localStorageen avaimella
`lean-challenge-hide-game-intro`. Valinnan voi myös poistaa samasta
ikkunasta. Tallennusvirhe näytetään ikkunassa eikä estä sen sulkemista.
Asetus on erillinen pelisessioista ja opettajan asetussnapshotista.
Ikkuna tukee näppäimistökäyttöä, pitää kohdistuksen modaalissa,
palauttaa sen suljettaessa ja vierittää sisältöä pienissä näkymissä.

---

# 2. Tehdas

Tehtaassa on kolme peräkkäistä työvaihetta:

1. Koneistus
2. Koonta
3. Lähettämö

Tuotanto virtaa:

Koneistus → Koonta → Lähettämö → Asiakas

Jokaisella osastolla on oma kapasiteettinsa ja suorituskykynsä.

Koko tehtaan valmistuskapasiteetin määrää tuotantoketjun pullonkaula.

---

# 3. KNL-mittarit

Tuotannon suorituskykyä seurataan KNL-mittarilla (OEE).

KNL muodostuu kolmesta osatekijästä:

## Käytettävyys (K)

Kuvaa sitä osuutta suunnitellusta tuotantoajasta, jolloin tuotantolaite tai prosessi on käytettävissä tuotantoon.

Käytettävyyttä heikentävät esimerkiksi:
- konehäiriöt
- asetukset
- tuotannonvaihdot
- odottamattomat seisokit

## Nopeus (N)

Kuvaa toteutuneen tuotantonopeuden suhdetta tavoite- tai ideaalinopeuteen.

Nopeutta heikentävät esimerkiksi:
- pienet pysähdykset
- odottaminen
- materiaalien etsiminen
- huono työjärjestys
- koneen alentunut nopeus

## Laatu (L)

Kuvaa hyväksyttyjen tuotteiden osuutta kaikista valmistetuista tuotteista.

Laatua heikentävät esimerkiksi:
- vialliset tuotteet
- uudelleentyöstö
- prosessivirheet

KNL:

KNL = Käytettävyys × Nopeus × Laatu

### Cockpitin lähtöhistoria ja yläpalkki

Cockpitin päänäkymä näyttää kolme tehtaan kokonaismittaria tummina
kortteina ja osastojen nykyiset KNL-arvot vertailukelpoisina 0–100 %
palkkeina. Kokoonpano on näkymän esitysnimi mallin assembly-osastolle.
Näytä osastojen tarkemmat tiedot avaa yhden modaalin, jossa ovat kaikkien
kolmen osaston alkuperäiset mittarivertailut. Sarakkeiden kierrokset
seuraavat vahvistettua pelihistoriaa (aluksi −1 ja 0).
Sulje ja Escape sulkevat ikkunan muuttamatta pelitilaa ja palauttavat
kohdistuksen avauspainikkeeseen. Pienissä näkymissä taulukot ovat
allekkain ja ikkuna vierittyy pystysuunnassa. Pelin tavoitteet säilyy
erillisenä aloitusikkunan avaavana painikkeena.

Kierros 0 lasketaan pelimoottorilla pelin omasta tehdasasetusten snapshotista.
Kierros −1 johdetaan tästä yhteisellä `buildInitialKnlHistory`-funktiolla.
Pelin alussa arvotaan kerran `crypto.getRandomValues`-siemen (`gameState.historySeed`).
Quest ja opettajan testipeli tallentavat siemenen, asetussnapshotin ja pelitilan
sessionStorageen. Päivitys ja PDCA-vaiheen vaihtaminen eivät arvo historiaa uudelleen.
Uusi peli vaihtaa siemenen; vanha siemenetön sessio käyttää vakaata siementä 0.

K-, N- ja L-osatekijöiden suhteellinen vaihtelu on ±0,2 %, ja arvot rajataan
välille 0–100 %. Koneistuksessa vaihdot ja käytettävyys kerrotaan edelleen
keskenään K-tekijäksi. KNL lasketaan tekijöiden tulona, ei erillisellä arvonnalla.
Neljän tekijän pahin poikkeama on alle 0,81 % myös käänteisessä vertailussa.
Tehtaan aggregointi säilyttää kierroksen 0 kapasiteettipainot, joten sama raja
pätee myös tehtaan KNL:ään.

Yläpalkki vertaa kahta viimeistä vahvistettua kierrosta (aluksi −1 ja 0).
KNL käyttää samaa historiaa kuin Cockpit. Tuotantomäärä on kierroksen
`actualProduction`, liikevaihto ja tulos ovat kierroksen tuloslaskelmasta.
Lähtökierrosten taloustiedot tulevat yhteisestä laskennallisesta taloushistoriasta,
myöhemmät tiedot vahvistetusta pelihistoriasta.
Varaston kiertonopeus on kierroksen toimitukset jaettuna saman kierroksen
fyysisellä loppuvarastolla; sen muutos esitetään absoluuttisena, esimerkiksi `+0,2x`.
Muut muutokset ovat `(nykyinen − edellinen) / abs(edellinen) * 100`.
Puuttuva tai ei-äärellinen vertailuarvo ja nollanimittäjä tuottavat merkin `—`.
Negatiivisten tulosten vertailussa käytetään edellisen tuloksen itseisarvoa.

Validointi: `node --test`, muutettujen JavaScript/JSX-tiedostojen ESLint ja
`npm run build`.

### Tehdastilan laskenta ja investoinnit

Investoinnit ja tuotantoennuste käyttävät samaa `calculateFactorySpace`-funktiota.
Käytetty tila muodostuu koneiden tilasta, kokoonpanon työntekijöiden tilasta,
lähettämön kiinteästä tilasta, toimistoista ja valmistuotevarastosta.
Varaston pinta-ala käyttää fyysisen määrän ja eräkoon vaatiman minimivaraston
suurempaa arvoa; niitä ei lasketa yhteen, koska minimivarasto on osa fyysistä
varastoa. Käytettyyn tilaan lisätään jokainen erä vain kerran.

Investointinäkymän nykytila lasketaan aktiivisesta pelitilasta ja kyseisen pelin
asetussnapshotista, ei katalogin tehdasesimerkkiriveistä. Ennusteeseen lisätään
valitut koneet ja laajennukset kerran. CHECK erottaa nykytilan ja DO-investointien
jälkeisen ennusteen omiksi sarakkeikseen. Tehdastilan yhteenveto näyttää näiden
tilojen osastokohtaiset ja yhteiset pinta-alat.

### Opettajan asetukset ja uusien pelien lähtöarvot

Opettajan asetussivu käyttää etusivun ja kirjautumissivun tummansinistä
Lean Cockpit -ilmettä ja turkooseja korostuksia. Leveällä näytöllä ylärivillä
ovat Tulos, Tase ja Kehittäminen. Niiden alla Tuotanto sisältää neljä
rinnakkaista parametrikorttia ja asiakkuuksien osio kaksi. Keskikokoisilla
näytöillä käytetään tarvittaessa kahta palstaa, mobiilissa yhtä.
Kaikki yhdeksän säädettävää parametria säilyvät näkyvissä; kiinteitä
lähtöarvoja ei esitellä sivulla, mutta ne säilyvät pelimallissa ennallaan.
Erillistä yhteenvetopaneelia ei ole. Testipelin käynnistys,
tilaviestit ja selainkohtaisen tallennuksen huomautus ovat korttien alla.

Vähintään 1280 pikselin levyisillä näkymillä pystysuuntaiset välit ovat
tiiviimmät ilman fonttikokojen pienentämistä. Sivun korkeus määräytyy
sisällöstä: lyhyemmissä näkymissä ja validointiviestien lisätessä sisältöä
sivua voi vierittää normaalisti. Mobiilin väljempi asettelu säilyy ennallaan.

Opettaja voi rajata muuttuvia asetuksia seuraavien sallittujen minimien ja
maksimien välille:

| Asetus | Minimi | Maksimi |
|---|---:|---:|
| Kiinteät kustannukset | 400 000 €/neljännesvuosi | 1 000 000 €/neljännesvuosi |
| Oma pääoma | 2 000 000 € | 4 000 000 € |
| Asetusaika | 40 h | 80 h |
| Alkueräkoko | 10 kpl | 20 kpl |
| Tehtaan kokonaispinta-ala | 4 000 m² | 5 000 m² |
| KNL-puoliintumisaika | 300 kehitystuntia | 600 kehitystuntia |
| Hyvän laadun raja | 75 % | 80 % |
| Erinomaisen laadun raja | 80 % | 85 % |

Jokainen uusi Quest- ja opettajan testipeli alkaa neljällä koneella,
12 tunnin koneistusajalla yksikköä kohti ja 20 tuotevariaatiolla. Opettaja ei
voi muuttaa näitä lähtöarvoja, mutta pelaaja voi edelleen hankkia koneita
investoinneilla pelin aikana. Muuttuvien asetusten testipeli saa oman
asetussnapshotin, joten suosikkiasetusten myöhempi muuttaminen ei muuta jo
aloitettua peliä.

Opettajan asetusten tallennusversio 4 tuo vanhat version 2 ja 3 suosikit uusiin
rajoihin: version 2 kiinteät kustannukset muunnetaan vuositasolta
neljännesvuositasolle, arvot rajataan sallittuun vaihteluväliin ja asetukset
pyöristetään käytössä oleviin askeliin. Poistetut kone-, koneistusaika- ja
variaatioasetukset ohitetaan. Virheellinen tai tuntematon asetustallenne
palautuu turvallisiin oletuksiin. Jo käynnissä olevien pelien snapshotteja ei
muuteta.

Poistojen per kierros -laskenta pysyy ennallaan: koneille 5 % ja
tehdaslaajennuksille 2,5 % menojäännöksestä. Tehdasasetuksissa pelikierros on
kolme kuukautta; Investoinnit-näkymä ilmoittaa vastaavat vuositasot 20 % ja 10 %.

---

# 4. Pelin rakenne

Peli kestää 12 kierrosta.

Jokainen kierros toteuttaa PDCA-rakenteen:

PLAN → DO → CHECK → ACT → seuraava kierros

---

# 5. PLAN

## Tarkoitus

PLAN-vaiheessa pelaaja analysoi edellisen kierroksen toteutuneet tulokset ja päättää, mitä seuraavalla kierroksella tulisi kehittää.

## Näytettävät tiedot

PLAN-vaiheessa esitetään ainakin:

- tuotantomäärät
- myyntimäärät
- kysyntä
- toimitusvarmuus
- varastot
- KNL-mittarit
- osastojen kapasiteetit
- pullonkaula
- tuloslaskelma
- tase
- kassatilanne
- lainat
- aikaisempien päätösten toteutuneet vaikutukset

Pelaaja voi asettaa kierrokselle tavoitteita.

Esimerkiksi:
- Koneistuksen käytettävyys ≥ 80 %
- Koneistuksen KNL ≥ 70 %
- Tehtaan kapasiteetti ≥ 850 kpl
- Toimitusvarmuus ≥ 95 %

---

# 6. DO

## Tarkoitus

DO-vaiheessa pelaaja valitsee Lean-kehitystoimenpiteet.

Jokaisella kierroksella voidaan toteuttaa vain rajallinen määrä toimenpiteitä.

Toimenpiteet maksavat rahaa ja/tai kuluttavat kehitysresursseja.

## Lean-menetelmiä

Pelissä voidaan käyttää esimerkiksi:

- 5S
- käyttäjäkunnossapito
- SMED
- standardoitu työ
- visuaalinen johtaminen
- työpisteiden tasapainotus
- Poka-Yoke

Toimenpiteet vaikuttavat eri tavoin KNL:n osatekijöihin.

Esimerkiksi:

SMED
→ asetusaika pienenee
→ käytettävyys paranee
→ kapasiteetti kasvaa

Käyttäjäkunnossapito
→ häiriöt vähenevät
→ käytettävyys paranee

5S
→ etsiminen ja turha liike vähenevät
→ nopeus paranee

Poka-Yoke
→ virheet vähenevät
→ laatu paranee

---

# 7. CHECK

## Tarkoitus

CHECK-sivulla arvioidaan DO-vaiheessa suunniteltujen Lean-toimenpiteiden vaikutuksia ennen niiden lopullista hyväksymistä.

CHECK opettaa pelaajalle Lean-toimenpiteiden, KNL:n ja kapasiteetin välisiä syy-seuraussuhteita.

## Näytettävät tiedot

### Valitut Lean-toimenpiteet

Näytetään:
- valitut toimenpiteet
- osasto
- kustannukset

### KNL-ennuste

KNL näytetään osastoittain:

Nykytila → Ennuste

Näytetään erikseen:
- Käytettävyys
- Nopeus
- Laatu
- KNL yhteensä

### Valmistuskapasiteetin ennuste

Näytetään jokaiselle osastolle:

Nykyinen kapasiteetti → Ennustettu kapasiteetti

Esimerkiksi:

Koneistus: 720 → 850 kpl
Koonta: 900 → 920 kpl
Lähettämö: 1000 → 1000 kpl

### Tehtaan valmistuskapasiteetti

Koko tehtaan kapasiteetti määräytyy pienimmän osastokapasiteetin perusteella.

Esimerkki:

Tehtaan valmistuskapasiteetti:
720 → 850 kpl / kierros

Pullonkaula:
Koneistus

### Tavoitevertailu

CHECK vertaa ennustetta PLAN-vaiheessa asetettuihin tavoitteisiin.

Esimerkiksi:

Tavoite:
Koneistuksen käytettävyys ≥ 80 %

Ennuste:
81 %

Tavoite saavutetaan.

### Selitys

Pelin tulee kertoa lyhyesti, miksi tulokset muuttuvat.

Esimerkiksi:

"SMED lyhentää asetusaikoja, jolloin koneen käytettävyys paranee."

## CHECK-vaiheen luonne

CHECK näyttää ennusteen.

Todelliset vaikutukset toteutuvat vasta seuraavalla kierroksella ja näkyvät seuraavan PLAN-vaiheen toteutuneissa tuloksissa.

---

# 8. ACT

## Tarkoitus

ACT-vaiheessa pelaaja tekee seuraavan kierroksen kaupalliset päätökset ja hyväksyy kehityssuunnitelman.

ACT yhdistää Lean-kehittämisen liiketoiminnan kysyntään ja kannattavuuteen.

---

## 8.1 Myyntihinta

Pelaaja määrittää myyntihinnan liukusäätimellä.

Esimerkiksi:

100 € ───────── ● ───────── 160 €
               135 €

Liukusäätimen muuttaminen päivittää ennusteet reaaliaikaisesti.

Näytetään:
- myyntihinta
- ennustettu kysyntä
- kate / tuote
- ennustettu liikevaihto
- ennustettu tulos

Periaate:

Hinta laskee
→ kysyntä kasvaa
→ yksikkökate pienenee

Hinta nousee
→ kysyntä pienenee
→ yksikkökate kasvaa

---

## 8.2 Kysyntä vs. kapasiteetti

ACT vertaa ennustettua kysyntää CHECK-vaiheessa laskettuun valmistuskapasiteettiin.

Esimerkiksi:

Ennustettu kysyntä: 920 kpl
Valmistuskapasiteetti: 850 kpl

Kapasiteettivaje: 70 kpl

Kapasiteetin ylittävä kysyntä ei automaattisesti muutu myynniksi.

Pelaajan tulee löytää sopiva tasapaino hinnan, kysynnän ja tuotantokapasiteetin välillä.

---

# 9. Tuotevariaatiot

ACT-vaiheessa pelaaja voi lisätä uusia tuotevariaatioita.

Uusi tuotevariaatio:
- kasvattaa kysyntää
- kasvattaa tuotannonvaihtojen määrää
- kasvattaa asetusaikaa
- voi heikentää koneistuksen käytettävyyttä
- voi pienentää valmistuskapasiteettia

Esimerkiksi:

Uusi variaatio:

Kysyntä +12 %
Tuotannonvaihdot +25 %
Asetusaika +18 h
Käytettävyys -3 %-yks.
Kapasiteetti -35 kpl

Lean-toimenpiteet vaikuttavat variaatioiden aiheuttamiin haittoihin.

Esimerkiksi SMED:

enemmän tuotannonvaihtoja
→ asetusaikojen kasvu

mutta

SMED
→ lyhyemmät asetukset
→ variaatioiden aiheuttama kapasiteettihäviö pienenee

Tämä muodostaa yhden pelin keskeisistä oppimismekanismeista.

---

# 10. ACT-päätös

ACT-vaiheen lopuksi pelaaja voi:

## Palaa DO-vaiheeseen

Pelaaja voi muuttaa Lean-toimenpiteitä, jos esimerkiksi:
- kapasiteetti ei riitä
- tavoite ei täyty
- suunnitelma ei ole kannattava

## Hyväksy päätökset

Hyväksyttäviä päätöksiä ovat:
- Lean-toimenpiteet
- myyntihinta
- tuotevariaatioiden määrä

Hyväksymisen jälkeen siirrytään seuraavalle kierrokselle.

---

# 11. Investoinnit

Investoinnit ovat vaihtoehto Lean-kehittämiselle.

Pelin tulee kuitenkin ohjata ymmärtämään, ettei uuden kapasiteetin ostaminen ole automaattisesti paras ratkaisu.

Investointikohteita ovat uusi tuotantokone ja tehdaslaajennus.

## Tehdaslaajennus

Laajennusyksikkö:

1 000 m²

Hinta:

1 000 000 € / 1 000 m²

Investointi voidaan rahoittaa:
- kassasta
- lainalla

## Uusi tuotantokone

Uusi peli alkaa neljällä koneella. Opettaja ei voi muuttaa lähtömäärää.

Uuden koneen hinta:

500 000 € / kone

Koneita voidaan ostaa rajattomasti, jos tuotantotilaa on riittävästi.

Yhden koneen tilavaatimus:

250 m²

## ---

# 12. Tehtaan tilankäyttö

Tehtaan kokonaispinta-ala on uudessa pelissä oletuksena 4 000 m². Opettajan
asetuksissa sen rajat ovat 4 000–5 000 m².

Kiinteät tilat:

Toimistot ja sosiaalitilat: 200 m²

Lähettämö: 250 m²

Muuttuvat tilavaatimukset:

Koneistus: 250 m² / kone

Kokoonpano:
25 m² / työntekijä

Valmistuotevarasto: 15 m² / fyysinen tuote. Minimitasona käytetään lisäksi
eräkoon perusteella laskettua varastoa; sitä ei lasketa fyysisen varaston päälle
toisena erillisenä varastona.

Investointi voidaan toteuttaa vain, jos tarvittava tila on käytettävissä.

---

# 13. Rahoitus

Investoinnit voidaan maksaa:
- kassasta
- lainarahalla

Jos kassassa ei ole riittävästi rahaa, pelaaja voi ottaa lainaa.

Laina:
- kasvattaa taseen velkaa
- aiheuttaa korkokuluja
- aiheuttaa lyhennyksiä tulevilla kierroksilla
- vaikuttaa kassavirtaan ja tulokseen

---

# 14. Keskeinen pelimekaniikka

Pelin päätöksentekoketju on:

Lean-toimenpide
→ KNL
→ kapasiteetti
→ pullonkaula
→ tuotantomäärä
→ toimituskyky
→ myynti
→ tulos
→ tase ja kassavirta

Kaupallinen päätöksentekoketju on:

Hinta
→ kysyntä
→ tuotantomäärä
→ myynti
→ kannattavuus

Tuotevalikoiman ketju on:

Tuotevariaatiot
→ kysyntä kasvaa
→ tuotannonvaihdot kasvavat
→ asetusaika kasvaa
→ käytettävyys laskee
→ kapasiteetti pienenee

SMED ja muut Lean-menetelmät voivat muuttaa tätä riippuvuutta.

---

# 15. Pelin keskeinen oppimisidea

Pelin ei tule palkita automaattisesti:
- suurinta tuotantomäärää
- suurinta kapasiteettia
- suurinta kysyntää
- korkeinta KNL-arvoa
- suurinta investointimäärää

Pelaajan tavoitteena on johtaa koko tuotantojärjestelmää kannattavasti.

Erityisesti pelin tulee opettaa:

1. Kehitä pullonkaulaa.
2. Poista hukkaa ennen uuden kapasiteetin ostamista.
3. Korkea paikallinen tehokkuus ei välttämättä paranna koko tehtaan suorituskykyä.
4. Kysyntä ja kapasiteetti tulee tasapainottaa.
5. Tuotevalikoiman kasvattamisella on sekä hyötyjä että kustannuksia.
6. Lean-toimenpiteiden vaikutuksia tulee mitata.
7. PDCA on jatkuva kehittämisen sykli.

---

# 16. Agentille annettavat toteutusperiaatteet

Tämä tiedosto toimii Lean Cockpit -projektin toiminnallisena vaatimusmäärittelynä.

Kun toteutat uusia ominaisuuksia:

1. Tutki ensin projektin olemassa oleva rakenne.
2. Säilytä olemassa oleva arkkitehtuuri ja käyttöliittymän visuaalinen tyyli.
3. Älä muuta pelilogiikan parametreja ilman erillistä pyyntöä.
4. Pidä pelilogiikka mahdollisuuksien mukaan erillään käyttöliittymäkomponenteista.
5. Käytä samoja käsitteitä koko sovelluksessa:
   - PLAN
   - DO
   - CHECK
   - ACT
   - Käytettävyys (K)
   - Nopeus (N)
   - Laatu (L)
   - KNL
   - kapasiteetti
   - kysyntä
   - pullonkaula
6. Tee muutokset vaiheittain ja vältä tarpeettomia muutoksia toimivaan koodiin.
7. Ennen merkittävän uuden toiminnallisuuden toteuttamista kerro lyhyesti, mitä tiedostoja aiot muuttaa.