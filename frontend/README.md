# Lean Cockpit – vaatimusmäärittely

## 1. Projektin tavoite

Lean Cockpit on yrityspelimäinen oppimispeli, jonka tavoitteena on opettaa Lean-johtamisen menetelmien tehokasta käyttöä.

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

Investointikohteita on kolme.

## Tehdaslaajennus

Alkutilanteessa:

Tehtaan pinta-ala = 2000 m²

Laajennusyksikkö:

500 m²

Hinta:

1 000 000 € / 500 m²

Investointi voidaan rahoittaa:
- kassasta
- lainalla

## Uusi tuotantokone

Alkutilanteessa koneita on:

2 kpl

Uuden koneen hinta:

250 000 € / kone

Koneita voidaan ostaa rajattomasti, jos tuotantotilaa on riittävästi.

Yhden koneen tilavaatimus:

250 m²

## Tuotannonvaihtoautomaatti

Koneistuskoneeseen voidaan hankkia tuotannonvaihtoautomaatti.

Hinta:

150 000 € / kone

Vaikutus:

tuotannonvaihtoaika pienenee
→ asetusaika pienenee
→ käytettävyys kasvaa
→ kapasiteetti kasvaa

---

# 12. Tehtaan tilankäyttö

Tehtaan kokonaispinta-ala alkutilanteessa:

2000 m²

Kiinteät tilat:

Sosiaali- ja toimistotilat:
200 m²

Lähettämö:
250 m²

Muuttuvat tilavaatimukset:

Kone:
250 m² / kone

Kokoonpano:
25 m² / työntekijä

Valmistuotevarasto:
50 m² / toimittamaton toimituserä

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