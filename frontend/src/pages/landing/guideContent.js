export const LANDING_GUIDES = [
  {
    id: 'lean-basics',
    title: 'Lean-perusteet',
    summary: 'Lean on tapa kehittää toimintaa asiakkaalle syntyvän arvon näkökulmasta. Tavoitteena on sujuva virtaus ja hukan vähentäminen ilman, että laatu tai turvallisuus heikkenee. Parantaminen perustuu nykytilan ymmärtämiseen, kokeiluihin ja oppimiseen – ei yksittäiseen pikaratkaisuun.',
    inGame: 'Johdat kolmen osaston tehdasta ja tasapainotat tuotantoa, laatua, toimituksia ja taloutta. Valitse toimenpiteet pullonkaulojen ja kierroksilla näkyvien tulosten perusteella. Peli laskee päätösten seuraukset, mutta Lean-ajattelu auttaa valitsemaan, mihin kannattaa keskittyä.',
  },
  {
    id: 'pdca',
    title: 'PDCA-sykli',
    summary: 'PDCA tarkoittaa jatkuvan parantamisen vaiheita Plan, Do, Check ja Act. Suunnittele tavoite ja kokeilu, toteuta se, tarkista tulos suhteessa lähtötilanteeseen ja päätä, mitä opitun perusteella tehdään seuraavaksi.',
    inGame: 'PLANissa tarkastelet kierrosten tietoja ja asetat tavoitteita. DOssa kohdistat kehitystunteja ja valitset investointeja. CHECKissä vertailet ennusteita ja lähtötilannetta. ACTissa päätät tuotannosta ja markkinoista sekä vahvistat kierroksen. Vahvistus vie tulokset seuraavan kierroksen lähtötiedoiksi.',
  },
  {
    id: 'oee-knl',
    title: 'OEE ja KNL',
    summary: 'OEE eli KNL kuvaa laitteiston kokonaistehokkuutta kolmella tekijällä: käytettävyys (K), nopeus (N) ja laatu (L). Mittarit ovat prosenttiosuuksia, ja kokonaisarvo saadaan kertomalla tekijöiden osuudet: KNL = K × N × L. Esimerkiksi 80 % × 90 % × 95 % = 68,4 %.',
    inGame: 'CHECK ja Cockpit näyttävät osastojen sekä tehtaan K-, N-, L- ja KNL-arvoja. Koneistuksen K muodostuu koneistuksen käytettävyyden ja vaihtojen vaikutuksesta yhdessä. Kehitystunnit vaikuttavat pelin mallin mukaisiin tekijöihin, joten kokonais-KNL ei ole erikseen arvottu tai asetettava luku.',
  },
  {
    id: 'five-s',
    title: '5S',
    summary: '5S auttaa pitämään työympäristön järjestyksessä: erottele tarpeellinen, järjestä, siivoa, vakioi ja ylläpidä. Tavoite on tehdä poikkeamat ja turha etsiminen näkyviksi sekä helpottaa sovitun työtavan säilymistä arjessa.',
    inGame: 'DOssa kohdistat 5S-kehitystunteja koneistukseen, kokoonpanoon tai lähettämöön. Pelimallissa kertyneet 5S-tunnit jaetaan kyseisen osaston K-, N- ja L-kehitykseen. Jos uutta panostusta ei tehdä, 5S:n efektiiviset tunnit vähenevät kierrosten välillä mallin mukaisesti.',
  },
  {
    id: 'smed',
    title: 'SMED',
    summary: 'SMED kehittää asetusten vaihtamista niin, että tuotteen tai työvaiheen vaihtoon kuluva aika lyhenee. Käytännössä työ erotellaan ja vakioidaan siten, että vaihto voidaan tehdä sujuvammin ja pienemmällä tuotantokatkolla.',
    inGame: 'Koneistuksessa SMED-kehitystunnit pienentävät pelin asetusaikakäyrän mukaista vaihtoaikaa. Vaihtojen määrä määräytyy tuotantomäärän ja eräkoon perusteella. Lyhyempi asetusaika vähentää vaihtojen viemää käytettävissä olevaa koneaikaa ja vaikuttaa siten koneistuksen K-tekijään ja kapasiteettiin.',
  },
  {
    id: 'tpm',
    title: 'TPM',
    summary: 'TPM eli kokonaisvaltainen tuottava kunnossapito pyrkii ehkäisemään vikoja ja palauttamaan laitteiden toimintakyvyn järjestelmällisesti. Kunnossapito on yhteinen käytäntö: laitteiden kuntoa seurataan ja poikkeamiin puututaan ennen kuin ne kasvavat häiriöiksi.',
    inGame: 'TPM-kehitystunnit kytkeytyvät pelimallissa osastokohtaiseen K-kehitykseen. Ne eivät lisää kapasiteettia irrallisena bonuksena, vaan vaikuttavat KNL-mallin käytettävyysosatekijän kehitykseen. Seuraa CHECKissä, näkyykö panostus kapasiteetissa ja osaston tunnusluvuissa.',
  },
  {
    id: 'spc',
    title: 'SPC',
    summary: 'SPC eli tilastollinen prosessinohjaus seuraa prosessin vaihtelua mittaustiedon avulla. Tavoitteena on erottaa tavanomainen vaihtelu erityisestä poikkeamasta, jotta korjaava toimenpide kohdistuu syyhyn eikä satunnaiseen heilahteluun.',
    inGame: 'SPC-kehitystunnit ovat pelissä tarjolla koneistuksen osastolle, ja mallissa ne kohdistuvat koneistuksen L-kehitykseen. Peli ei simuloi ohjauskortteja tai erillistä SPC-mittaussarjaa. Tarkastele laadun kehitystä kierrosten KNL-tiedoista.',
  },
  {
    id: 'method-work',
    title: 'Menetelmätyö',
    summary: 'Menetelmätyössä työvaihe kuvataan ja kehitetään turvalliseksi, laadukkaaksi ja toistettavaksi. Yhtenäinen paras tunnettu työtapa vähentää tarpeetonta vaihtelua ja helpottaa uuden toimintatavan jakamista tiimille.',
    inGame: 'Menetelmätyön kehitystunteja voi kohdistaa kokoonpanoon ja lähettämöön. Näissä osastoissa tunnit vaikuttavat mallissa N-tekijän kehitykseen. Koneistuksessa vastaavaa Menetelmätyö-valintaa ei ole, eikä peli arvioi työohjeita erikseen.',
  },
  {
    id: 'poka-yoke',
    title: 'Poka-Yoke',
    summary: 'Poka-Yoke tarkoittaa virheen ehkäisyä tai virheen havaitsemista mahdollisimman aikaisin. Ratkaisu voi estää väärän työvaiheen, osan tai asetuksen käytön tai tehdä virheestä heti näkyvän, jolloin virhe ei etene seuraaviin vaiheisiin.',
    inGame: 'Poka-Yoke-kehitystunteja voi kohdistaa kokoonpanoon ja lähettämöön. Pelimallissa ne vaikuttavat näiden osastojen L-tekijän kehitykseen. Erillisiä virhetilanteita tai yksittäisiä poka-yoke-laitteita ei simuloida, joten vaikutus näkyy laadun tunnusluvussa.',
  },
  {
    id: 'batch-changeover',
    title: 'Eräkoko ja vaihtoaika',
    summary: 'Eräkoko kertoo, kuinka monta tuotetta valmistetaan samalla asetuksella ennen tuotteen vaihtamista. Pienet erät voivat vähentää keskeneräistä varastoa ja nopeuttaa reagointia, mutta lisäävät vaihtojen määrää. Suuret erät vähentävät vaihtoja, mutta sitovat aikaa ja varastoa.',
    inGame: 'Koneistuksen vaihtojen määrä seuraa laskentaa tuotantomäärä ÷ eräkoko; asetusaika tulee SMED-mallista. Vaihdot vaikuttavat koneistuksen K:hon ja kapasiteettiin. Eräkoko vaikuttaa myös minimivalmisvarastoon, mutta se ei ole sama asia kuin fyysisen varaston määrä.',
  },
  {
    id: 'jit-inventory',
    title: 'JIT ja varastot',
    summary: 'JIT eli juuri oikeaan aikaan -ajattelu pyrkii sovittamaan materiaalien ja tuotteiden virtauksen tarpeeseen. Varasto voi suojata toimituksia, mutta sitoo tilaa ja pääomaa. Tavoitteena ei ole varaston vähentäminen hinnalla millä hyvänsä, vaan hallittu virtaus ja luotettavat toimitukset.',
    inGame: 'Peli seuraa fyysistä valmisvarastoa, eräkoon mukaista minimivarastoa ja varaston tilantarvetta erillisinä tietoina. ACTissa voit päättää, täydennetäänkö toimituksia myytävissä olevasta alkuvarastosta. Pelissä ei ole erillistä JIT-toimenpidettä eikä raaka-ainetilausten ajoituksen simulaatiota.',
  },
  {
    id: 'investment-finance',
    title: 'Investoinnit ja talous',
    summary: 'Investoinnin hyötyä arvioidaan suhteessa sen hankintahintaan, rahoitukseen, käyttökuluihin ja käytettävissä oleviin resursseihin. Tuotantokone voi kasvattaa kapasiteettia, mutta vaatii tilaa ja henkilöstöä. Tehdaslaajennus kasvattaa käytettävissä olevaa tilaa, ei yksin tuotantokapasiteettia.',
    inGame: 'DOssa voit hankkia koneita tai laajentaa tehdasta. Malli huomioi koneen kapasiteetin, henkilöstön ja tilan sekä investointien kustannukset, poistot ja rahoituksen. CHECK ja Investoinnit erittelevät tilankäytön. Seuraa tulosta ja tasetta: investointi vaikuttaa talouteen myös myöhemmillä kierroksilla.',
  },
]
