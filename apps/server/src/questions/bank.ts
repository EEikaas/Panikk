import type { CategoryId, Difficulty, Question } from '@podiepanikk/shared';
import { ADULT_BLOCK } from './adult';

// Innebygd spørsmålsbank på norsk bokmål. Format per linje:
//   kategori|spørsmål|RIKTIG svar|feil|feil|feil
// Svaralternativene stokkes per spill. Faktaopplysninger bør kontrolleres av
// en redaktør før offentlig bruk – rett gjerne via administrasjonssiden.

const BARN = `
dyr|Hvilket dyr sier «mø»?|Kua|Hesten|Grisen|Sauen
dyr|Hvor mange bein har en edderkopp?|8|6|10|4
dyr|Hvilket dyr har en lang snabel?|Elefanten|Sjiraffen|Neshornet|Flodhesten
dyr|Hva heter babyen til en frosk mens den svømmer i vannet?|Rumpetroll|Kalv|Kylling|Valp
dyr|Hvilket dyr er verdens største?|Blåhvalen|Elefanten|Sjiraffen|Haien
dyr|Hva spiser pandaer mest av?|Bambus|Fisk|Gress|Bananer
dyr|Hvilken fugl kan ikke fly, men er flink til å svømme?|Pingvinen|Måken|Ørnen|Spurven
dyr|Hvor mange bein har et insekt?|6|8|4|10
dyr|Hva kalles en baby-hund?|Valp|Kattunge|Kalv|Føll
dyr|Hvilket dyr har svarte og hvite striper?|Sebraen|Løven|Kamelen|Ulven
dyr|Hvilket dyr bygger demninger i elver?|Beveren|Elgen|Reven|Ekornet
dyr|Hva heter babyen til en hest?|Føll|Lam|Kje|Kalv
dyr|Hvilket dyr blir ofte kalt «dyrenes konge»?|Løven|Tigeren|Gorillaen|Elefanten
dyr|Hvilket dyr har en pung der ungen bor?|Kenguruen|Isbjørnen|Apen|Ugla
dyr|Hva liker kaniner å spise?|Gulrøtter|Pølser|Sjokolade|Fisk
dyr|Hva kalles hjemmet til biene?|Bikube|Rede|Hule|Stall
dyr|Hvilket dyr kan skifte farge for å gjemme seg?|Kameleonen|Hesten|Kua|Sauen
dyr|Hvilket dyr har pigger på ryggen og ruller seg sammen til en ball?|Pinnsvinet|Ekornet|Haren|Musa
dyr|Hva kalles en baby-katt?|Kattunge|Valp|Kylling|Kalv
geografi|Hva heter hovedstaden i Norge?|Oslo|Bergen|Trondheim|Stavanger
geografi|Hvilken farge har havet på de fleste kart?|Blå|Grønn|Rød|Gul
geografi|Hvor bor isbjørnen?|I Arktis|I Afrika|I ørkenen|I regnskogen
geografi|Hva heter verdens største hav?|Stillehavet|Atlanterhavet|Nordsjøen|Middelhavet
geografi|I hvilket land finner vi de berømte pyramidene i Giza?|Egypt|Mexico|Kina|Hellas
geografi|Hva kalles et stort område med mye sand og nesten ikke vann?|Ørken|Skog|Myr|Fjord
geografi|Hvilket land har form som en støvel?|Italia|Spania|Frankrike|Sverige
geografi|Hvilket naboland har Stockholm som hovedstad?|Sverige|Danmark|Finland|Island
geografi|Hva heter det høyeste fjellet i verden?|Mount Everest|Kilimanjaro|Galdhøpiggen|Mont Blanc
geografi|Hva kaller vi en lang, smal havarm mellom høye fjell, som det er mange av i Norge?|Fjord|Elv|Innsjø|Bekk
generelt|Hvor mange dager er det i en uke?|7|5|10|6
generelt|Hvilken farge får du hvis du blander blått og gult?|Grønn|Lilla|Oransje|Brun
generelt|Hvilken farge får du hvis du blander rødt og hvitt?|Rosa|Grønn|Blå|Grå
generelt|Hvor mange måneder er det i et år?|12|10|11|13
generelt|Hvilken årstid kommer etter vinteren?|Våren|Sommeren|Høsten|Julen
generelt|Hvor mange sider har en trekant?|3|4|5|6
generelt|Hva er 5 + 5?|10|55|9|11
generelt|Hvor mange minutter er det i en time?|60|100|30|24
generelt|Hva er det motsatte av «varm»?|Kald|Våt|Myk|Lys
generelt|Hvor mange hjul har en vanlig sykkel?|2|3|4|1
generelt|Hvilket tall kommer etter 99?|100|98|101|909
generelt|Hvilken dag kommer etter fredag?|Lørdag|Torsdag|Søndag|Mandag
generelt|Hva heter den fargerike buen som kan komme på himmelen etter regn?|Regnbue|Lynbue|Skybue|Solbue
generelt|Hvor mange fingre har du til sammen på begge hender?|10|8|12|5
vitenskap|Hva trenger planter for å vokse?|Sollys og vann|Melk og brød|Saft og is|Bare mørke
vitenskap|Hva er sola?|En stjerne|En planet|En måne|En komet
vitenskap|Hvilken planet bor vi på?|Jorda|Mars|Venus|Jupiter
vitenskap|Hva skjer med vann når det fryser?|Det blir is|Det blir damp|Det blir sand|Det blir melk
vitenskap|Hvilken planet kalles «den røde planeten»?|Mars|Saturn|Merkur|Neptun
vitenskap|Hva bruker vi ørene til?|Å høre|Å lukte|Å smake|Å se
vitenskap|Hva kalles det når vanndråper faller fra skyene?|Regn|Torden|Tåke|Vind
vitenskap|Hvilket organ pumper blodet rundt i kroppen?|Hjertet|Lungene|Magen|Hjernen
vitenskap|Hvilken planet er kjent for sine store, flotte ringer?|Saturn|Mars|Jorda|Merkur
vitenskap|Hva kalles de hvite fnuggene som daler ned om vinteren?|Snø|Støv|Dugg|Sand
vitenskap|Hva lyser på himmelen om natta og ser forskjellig ut fra uke til uke?|Månen|Sola|Regnbuen|Skyene
mat|Hva lager bier?|Honning|Melk|Syltetøy|Smør
mat|Hvilken frukt er gul og bøyd?|Banan|Eple|Pære|Plomme
mat|Hva er pommes frites laget av?|Poteter|Gulrøtter|Epler|Ris
mat|Hvilket dyr gir oss melken vi vanligvis kjøper i butikken?|Kua|Grisen|Hønen|Hesten
mat|Hva lager man popcorn av?|Mais|Ris|Hvete|Bønner
mat|Hvilken grønnsak er oransje og vokser nede i jorda?|Gulrot|Agurk|Brokkoli|Tomat
mat|Hva bruker man for å lage vafler?|Vaffeljern|Brødrister|Mikrobølgeovn|Blender
mat|Hvilken farge har innsiden av en vannmelon?|Rød|Blå|Lilla|Svart
mat|Hvilken frukt sier man at det er sunt å spise ett av hver dag?|Eple|Kiwi|Mango|Ananas
filmtv|Hva heter den lille havfruen i Disney-filmen fra 1989?|Ariel|Elsa|Moana|Belle
filmtv|Hva heter snømannen i «Frost»?|Olaf|Sven|Kristoffer|Hans
filmtv|Hvilken farge har Shrek?|Grønn|Blå|Rød|Gul
filmtv|Hva heter cowboyen i «Toy Story»?|Woody|Rex|Slinky|Hamm
filmtv|Hvilket dyr er Simba i «Løvenes konge»?|Løve|Tiger|Gepard|Leopard
filmtv|Hva heter klovnefisken som Marlin leter etter?|Nemo|Dory|Bubbles|Gill
filmtv|Hva heter Mikke Mus' kjæreste?|Minni Mus|Dolly Duck|Klarabella|Andrine
filmtv|Hvilken tegneseriefigur bor i en ananas under havet?|SvampeBob|Patrick|Blekkulf|Sandy
filmtv|Hva heter bjørnen som elsker honning og bor i Hundremeterskogen?|Ole Brumm|Paddington|Baloo|Bamse
filmtv|Hva heter prinsessen med magiske iskrefter i «Frost»?|Elsa|Anna|Rapunsel|Askepott
musikk|Hvor mange strenger har en vanlig gitar?|6|4|8|12
musikk|Hvilket instrument har svarte og hvite tangenter?|Piano|Fiolin|Trommer|Fløyte
musikk|Hvilket instrument slår man på med stikker?|Trommer|Gitar|Trompet|Fiolin
musikk|Hvilket av disse instrumentene blåser man i?|Trompet|Trommer|Piano|Xylofon
musikk|Hvilken sang begynner med «Ja, vi elsker dette landet»?|Norges nasjonalsang|Bursdagssangen|En julesang|En vuggevise
sport|Hvor mange spillere har et fotballag på banen samtidig?|11|9|7|15
sport|I hvilken idrett går man på ski og skyter på blinker?|Skiskyting|Skihopp|Slalåm|Telemark
sport|I hvilken idrett bruker man racket og fjærball?|Badminton|Tennis|Golf|Hockey
sport|Hvor mange ringer er det i det olympiske symbolet?|5|4|6|7
sport|Hva kalles det når man scorer i fotball?|Mål|Touchdown|Strike|Ess
sport|Hvilken idrett spilles på is med kølle og puck?|Ishockey|Curling|Kunstløp|Bandy
norge|Hvilken dato er Norges nasjonaldag?|17. mai|24. desember|1. januar|23. juni
norge|Hvilke farger har det norske flagget?|Rødt, hvitt og blått|Rødt og hvitt|Blått og gult|Grønt, hvitt og rødt
norge|Hvem bor under brua i eventyret om de tre bukkene Bruse?|Et troll|En nisse|En drage|En heks
norge|Hva heter den søte, brune osten mange nordmenn har på brødskiva?|Brunost|Gulost|Mozzarella|Parmesan
norge|Hvilket stort dyr med svært gevir kalles ofte «skogens konge»?|Elgen|Bjørnen|Ulven|Reven
teknologi|Hva bruker man en datamus til?|Å peke og klikke på skjermen|Å lade mobilen|Å skrive ut papir|Å ta bilder
teknologi|Hva trenger en mobiltelefon for å virke?|Strøm fra batteriet|Vann|Bensin|Ved
teknologi|Hva kalles en maskin som kan bevege seg og gjøre oppgaver av seg selv?|Robot|Kalkulator|Mikrofon|Høyttaler
teknologi|Hva bruker man et kamera til?|Å ta bilder|Å ringe|Å varme mat|Å vaske klær
historie|Hva kaller vi sjøfolkene fra Norden som seilte i langskip for over 1000 år siden?|Vikinger|Romere|Cowboyer|Samuraier
historie|Hvilke dyr levde på jorda for millioner av år siden og er nå utdødd?|Dinosaurer|Elefanter|Hester|Delfiner
historie|Hva brukte riddere for å beskytte seg i kamp?|Rustning|Regnfrakk|Badedrakt|Pyjamas
historie|Hva kalles de store byggene der konger og dronninger bor?|Slott|Hytter|Telt|Iglooer
`;

const FAMILIE = `
geografi|Hva er hovedstaden i Sverige?|Stockholm|Göteborg|Malmö|Uppsala
geografi|Hva er hovedstaden i Danmark?|København|Aarhus|Odense|Aalborg
geografi|Hva er hovedstaden i Frankrike?|Paris|Lyon|Marseille|Nice
geografi|Hva er hovedstaden i Spania?|Madrid|Barcelona|Sevilla|Valencia
geografi|Hva er hovedstaden i Tyskland?|Berlin|München|Hamburg|Frankfurt
geografi|Hva er hovedstaden i Island?|Reykjavík|Akureyri|Nuuk|Tórshavn
geografi|Hvilken elv renner gjennom Egypt?|Nilen|Amazonas|Donau|Mississippi
geografi|Hvilket land er verdens største i areal?|Russland|Canada|Kina|USA
geografi|Hvilket kontinent ligger Brasil i?|Sør-Amerika|Afrika|Asia|Nord-Amerika
geografi|Hva heter Norges høyeste fjell?|Galdhøpiggen|Glittertind|Snøhetta|Store Skagastølstind
geografi|Hvilket hav ligger mellom Norge og Storbritannia?|Nordsjøen|Østersjøen|Barentshavet|Middelhavet
geografi|I hvilken by står Frihetsgudinnen?|New York|Washington|Paris|Chicago
geografi|I hvilket land ligger inkabyen Machu Picchu?|Peru|Chile|Mexico|Bolivia
geografi|Hvilket land ble ifølge FN verdens mest folkerike i 2023?|India|Kina|USA|Indonesia
historie|Hvilket år ble Norges grunnlov vedtatt på Eidsvoll?|1814|1905|1776|1850
historie|Hvilket år ble unionen mellom Norge og Sverige oppløst?|1905|1814|1945|1884
historie|Hvem var den første mannen som gikk på månen?|Neil Armstrong|Juri Gagarin|Buzz Aldrin|John Glenn
historie|Hvilket skip sank etter å ha truffet et isfjell i 1912?|Titanic|Lusitania|Fram|Bismarck
historie|Hvem malte «Skrik»?|Edvard Munch|Vincent van Gogh|Pablo Picasso|Claude Monet
historie|Hvilken nordmann krysset Stillehavet på flåten Kon-Tiki i 1947?|Thor Heyerdahl|Roald Amundsen|Fridtjof Nansen|Børge Ousland
historie|Hvem ledet ekspedisjonen som først nådde Sydpolen i 1911?|Roald Amundsen|Robert Scott|Fridtjof Nansen|Ernest Shackleton
historie|Hvilket år falt Berlinmuren?|1989|1961|1991|1975
historie|Hvilken krig varte fra 1939 til 1945?|Andre verdenskrig|Første verdenskrig|Den kalde krigen|Hundreårskrigen
historie|Hva het polarskuta som både Nansen og Amundsen brukte på ekspedisjoner?|Fram|Gjøa|Maud|Kon-Tiki
historie|Hvilken sivilisasjon bygde pyramidene i Giza?|Det gamle Egypt|Romerriket|Det gamle Hellas|Inkariket
vitenskap|Hva er den kjemiske formelen for vann?|H2O|CO2|O2|NaCl
vitenskap|Hvor mange planeter er det i solsystemet vårt?|8|9|7|10
vitenskap|Hvilken planet er nærmest sola?|Merkur|Venus|Mars|Jorda
vitenskap|Hvilken gass må vi puste inn for å leve?|Oksygen|Karbondioksid|Helium|Nitrogen
vitenskap|Ved hvor mange grader celsius koker vann ved havnivå?|100|90|80|120
vitenskap|Hva er menneskekroppens største organ?|Huden|Leveren|Hjernen|Lungene
vitenskap|Omtrent hvor mange knokler har et voksent menneske?|206|106|306|156
vitenskap|Hva kalles prosessen der planter lager næring ved hjelp av sollys?|Fotosyntese|Fordøyelse|Fordampning|Gjæring
vitenskap|Hva er den største planeten i solsystemet?|Jupiter|Saturn|Neptun|Jorda
vitenskap|Hvor mange tenner har et voksent menneske vanligvis, med visdomstenner?|32|28|36|24
vitenskap|Hva måler et termometer?|Temperatur|Lufttrykk|Vindstyrke|Fuktighet
dyr|Hva er det raskeste landdyret?|Geparden|Løven|Antilopen|Strutsen
dyr|Hvilket av disse pattedyrene kan virkelig fly?|Flaggermusen|Flygeekornet|Pingvinen|Flygefisken
dyr|Hvor mange hjerter har en blekksprut?|3|1|2|4
dyr|Hvilken fugl er Norges nasjonalfugl?|Fossekall|Kongeørn|Lundefugl|Skjære
dyr|Hvilket dyr har lengst hals?|Sjiraffen|Strutsen|Kamelen|Lamaen
dyr|Hva spiser blåhvalen hovedsakelig?|Krill|Sel|Hai|Tang
dyr|Omtrent hvor lenge er en elefant drektig?|22 måneder|9 måneder|12 måneder|36 måneder
dyr|Hvilket dyr bor i eukalyptustrær og sover nesten hele døgnet?|Koala|Dovendyr|Panda|Vombat
dyr|Hva kalles en hunnhest?|Hoppe|Hingst|Vallak|Kvige
dyr|Hvilket av disse dyrene er en amfibie?|Frosk|Øgle|Slange|Skilpadde
mat|Hvilket land kommer pizza opprinnelig fra?|Italia|Hellas|USA|Frankrike
mat|Hva er hovedingrediensen i guacamole?|Avokado|Erter|Agurk|Spinat
mat|Hva er sushi tradisjonelt laget med?|Ris|Pasta|Poteter|Couscous
mat|Hvilket krydder gir karri den gule fargen?|Gurkemeie|Kanel|Pepper|Muskat
mat|Hva heter den norske nasjonalretten med lammekjøtt og kål?|Fårikål|Lapskaus|Pinnekjøtt|Raspeballer
mat|Hva er hovedingrediensen i hummus?|Kikerter|Linser|Bønner|Erter
mat|Hva heter den norske festkaken som er bygd som et tårn av ringer?|Kransekake|Sandkake|Krumkake|Goro
mat|Hvilken nøtt er hovedingrediensen i marsipan?|Mandel|Peanøtt|Hasselnøtt|Valnøtt
mat|Hvilket land er kjent for risretten paella?|Spania|Italia|Portugal|Mexico
mat|Hva er tofu laget av?|Soyabønner|Ris|Hvete|Kokos
filmtv|Hvem regisserte «Jurassic Park» (1993)?|Steven Spielberg|James Cameron|George Lucas|Ridley Scott
filmtv|Hva heter trollmannsskolen i Harry Potter-bøkene?|Galtvort|Durmstrang|Beauxbatons|Hogsmeade
filmtv|Hva heter skurken med svart pustemaske i Star Wars?|Darth Vader|Darth Maul|Kylo Ren|Jabba
filmtv|I hvilken norsk animasjonsfilm fra 1975 bygger Reodor Felgen racerbilen Il Tempo Gigante?|Flåklypa Grand Prix|Jul i Skomakergata|Reisen til julestjernen|Olsenbanden jr.
filmtv|Hvilken film fra 1997 handler om et skip som synker, med Leonardo DiCaprio i hovedrollen?|Titanic|Inception|Poseidon|Den siste reisen
filmtv|Hva heter løven i «Narnia»?|Aslan|Mufasa|Simba|Scar
filmtv|Hva heter hobbiten som bærer ringen i «Ringenes herre»?|Frodo|Bilbo|Sam|Pippin
filmtv|I hvilken by bor familien Simpson?|Springfield|Shelbyville|Riverdale|Quahog
filmtv|Hva heter den spretne tigeren som er venn med Ole Brumm?|Tigergutt|Nasse Nøff|Tussi|Kengu
musikk|Hvilket norsk band ga ut «Take On Me»?|a-ha|Europe|ABBA|Roxette
musikk|Hvilket land kom ABBA fra?|Sverige|Norge|Danmark|Finland
musikk|Hvem vant Eurovision for Norge i 2009 med «Fairytale»?|Alexander Rybak|Bobbysocks|Secret Garden|Kurt Nilsen
musikk|Hvem komponerte «I Dovregubbens hall»?|Edvard Grieg|Johan Svendsen|Ole Bull|Wolfgang A. Mozart
musikk|Hvilket band var John Lennon og Paul McCartney med i?|The Beatles|The Rolling Stones|Queen|The Who
musikk|Hvor mange tangenter har et vanlig piano?|88|76|100|64
musikk|Hvem blir ofte kalt «Kongen av pop»?|Michael Jackson|Elvis Presley|Prince|Justin Bieber
musikk|Hvem sang «Shake It Off» (2014)?|Taylor Swift|Katy Perry|Adele|Beyoncé
musikk|Hvilken norsk produsent står bak hiten «Faded» (2015)?|Alan Walker|Kygo|Matoma|Cashmere Cat
sport|Hvor ofte arrangeres sommer-OL vanligvis?|Hvert fjerde år|Hvert andre år|Hvert år|Hvert femte år
sport|Hvor mange hull spiller man på en standard golfrunde?|18|9|12|24
sport|Hvilket land hadde vunnet flest VM-titler i fotball for herrer før VM 2026?|Brasil|Tyskland|Italia|Argentina
sport|Hvor langt er et maratonløp?|42,195 km|40 km|21,1 km|50 km
sport|I hvilken idrett er Marit Bjørgen en legende?|Langrenn|Skiskyting|Alpint|Skøyter
sport|I hvilken idrett har Magnus Carlsen blitt verdensmester?|Sjakk|Tennis|Golf|Poker
sport|Hvilken by arrangerte vinter-OL i 1994?|Lillehammer|Oslo|Calgary|Albertville
sport|Hvor mange spillere har hvert lag på banen i håndball?|7|6|5|11
sport|Hva heter det berømte sykkelrittet gjennom Frankrike hver sommer?|Tour de France|Giro d'Italia|Vuelta a España|Paris–Roubaix
sport|Hvor mange poeng gir et vellykket straffekast i basketball?|1|2|3|0
teknologi|Hva står «www» for?|World Wide Web|Wide World Window|World Web Wire|Web Wide World
teknologi|Hvilket selskap lager iPhone?|Apple|Samsung|Google|Nokia
teknologi|Hva kalles «hjernen» i en datamaskin som utfører beregningene?|Prosessoren (CPU)|Harddisken|Skjermkortet|Strømforsyningen
teknologi|Hvilket land kommer mobilprodusenten Nokia fra?|Finland|Sverige|Japan|Tyskland
teknologi|Hva står «USB» for?|Universal Serial Bus|United System Board|Universal Speed Button|Ultra Serial Bridge
teknologi|Hvem grunnla Microsoft sammen med Paul Allen?|Bill Gates|Steve Jobs|Elon Musk|Mark Zuckerberg
teknologi|Hva brukes en ruter til hjemme?|Å koble enheter til nettverk og internett|Å lade batterier|Å skrive ut|Å skanne bilder
norge|Hvilken by er Norges nest største?|Bergen|Trondheim|Stavanger|Drammen
norge|Hva er Norges lengste fjord?|Sognefjorden|Hardangerfjorden|Oslofjorden|Trondheimsfjorden
norge|I hvilken by står Nidarosdomen?|Trondheim|Bergen|Oslo|Stavanger
norge|Hvilken konge besteg Norges trone i 1991?|Harald V|Olav V|Haakon VII|Haakon V
norge|Hva heter Norges lengste elv?|Glomma|Numedalslågen|Tana|Drammenselva
norge|Hvilken by kalles ofte «Nordens Paris»?|Tromsø|Bodø|Hammerfest|Alta
norge|I hvilket fylke ligger Preikestolen?|Rogaland|Vestland|Nordland|Telemark
norge|Hvilket år ble vinter-OL arrangert i Oslo?|1952|1964|1994|1936
norge|Hvem skrev skuespillet «Et dukkehjem»?|Henrik Ibsen|Bjørnstjerne Bjørnson|Knut Hamsun|Sigrid Undset
norge|Hva kalles toget med skolebarn som går i gatene på 17. mai?|Barnetoget|Folketoget|Russetoget|Kongetoget
generelt|Hvor mange sekunder er det i en time?|3600|360|6000|1200
generelt|Hva er romertallet for 10?|X|V|L|C
generelt|Hvor mange sider har en sekskant?|6|5|7|8
generelt|Hva kalles et år med 366 dager?|Skuddår|Jubelår|Fullår|Langår
generelt|Hvilken edelstein er rød?|Rubin|Safir|Smaragd|Diamant
generelt|Hva heter havets gud i gresk mytologi?|Poseidon|Zevs|Hades|Apollon
generelt|Hvor mange kort er det i en vanlig kortstokk uten jokere?|52|54|48|50
generelt|Hvilket språk har flest morsmålsbrukere i verden?|Mandarin|Engelsk|Spansk|Hindi
`;

const VOKSEN = `
geografi|Hva er hovedstaden i Australia?|Canberra|Sydney|Melbourne|Perth
geografi|Hva er hovedstaden i Canada?|Ottawa|Toronto|Vancouver|Montréal
geografi|Hvilken innsjø er verdens dypeste?|Bajkalsjøen|Tanganyikasjøen|Lake Superior|Kaspihavet
geografi|Hva er hovedstaden i Mongolia?|Ulan Bator|Astana|Bisjkek|Tasjkent
geografi|Hva er verdens største varme ørken?|Sahara|Gobi|Kalahari|Atacama
geografi|Hvilken elv renner gjennom flest land?|Donau|Nilen|Rhinen|Amazonas
geografi|I hvilket land ligger Timbuktu?|Mali|Niger|Marokko|Senegal
geografi|Hva heter stredet mellom Spania og Marokko?|Gibraltarstredet|Bosporos|Hormuzstredet|Magellanstredet
geografi|Hva er hovedstaden i Tyrkia?|Ankara|Istanbul|Izmir|Antalya
geografi|Hva er Afrikas høyeste fjell?|Kilimanjaro|Mount Kenya|Toubkal|Mount Stanley
geografi|Hvilket land regnes for å ha flest innsjøer?|Canada|Finland|Russland|Sverige
geografi|Hvilket regjeringssete ligger høyest over havet?|La Paz|Quito|Bogotá|Katmandu
geografi|Hva heter den største bosetningen på Svalbard?|Longyearbyen|Ny-Ålesund|Barentsburg|Sveagruva
historie|Hvilket år startet den franske revolusjonen?|1789|1776|1815|1848
historie|Hvem var Romerrikets første keiser?|Augustus|Julius Cæsar|Nero|Caligula
historie|Hvilket år nådde Columbus Amerika for første gang?|1492|1512|1453|1607
historie|I hvilket slag falt Harald Hardråde i 1066?|Slaget ved Stamford Bridge|Slaget ved Hastings|Slaget på Stiklestad|Slaget ved Svolder
historie|Hvilket år falt Olav Haraldsson (Olav den hellige) på Stiklestad?|1030|1066|1000|1130
historie|Hvem var USAs første president?|George Washington|Thomas Jefferson|Abraham Lincoln|John Adams
historie|Hvilket år ble Norge angrepet av Tyskland under andre verdenskrig?|1940|1939|1941|1942
historie|Hvem var Storbritannias statsminister i det meste av andre verdenskrig?|Winston Churchill|Neville Chamberlain|Clement Attlee|Anthony Eden
historie|Hvilket år ble FN opprettet?|1945|1919|1948|1955
historie|Hvem skrev «Det kommunistiske manifest» sammen med Friedrich Engels?|Karl Marx|Vladimir Lenin|Lev Trotskij|Josef Stalin
historie|Under hvilket dynasti ble det meste av den kinesiske muren vi ser i dag bygget?|Ming|Qin|Han|Tang
historie|Hvilken by ble erobret av osmanerne i 1453?|Konstantinopel|Athen|Jerusalem|Venezia
historie|Hvem var Norges første kvinnelige statsminister?|Gro Harlem Brundtland|Erna Solberg|Kari Gjesteby|Siv Jensen
historie|Hvem ble i 1911 den første kvinnen som møtte på Stortinget?|Anna Rogstad|Gina Krog|Fredrikke Marie Qvam|Camilla Collett
vitenskap|Hva er det kjemiske symbolet for gull?|Au|Ag|Gd|Go
vitenskap|Hvilket grunnstoff har atomnummer 1?|Hydrogen|Helium|Oksygen|Karbon
vitenskap|Omtrent hvor raskt går lyset i vakuum?|300 000 km/s|30 000 km/s|3 000 km/s|3 000 000 km/s
vitenskap|Hvem utviklet relativitetsteorien?|Albert Einstein|Isaac Newton|Niels Bohr|Max Planck
vitenskap|Hvilken blodtype regnes som universalgiver?|0 negativ|AB positiv|A negativ|B positiv
vitenskap|Hva heter stjernen som er nærmest oss etter sola?|Proxima Centauri|Sirius|Betelgeuse|Polarstjernen
vitenskap|Hva er det kjemiske symbolet for jern?|Fe|Ir|Jn|In
vitenskap|Hvor i en dyrecelle finner vi mesteparten av DNA-et?|Cellekjernen|Cellemembranen|Ribosomene|Vakuolen
vitenskap|Hva er pH-verdien til rent vann ved romtemperatur?|7|0|10|14
vitenskap|Hvem oppdaget penicillinet i 1928?|Alexander Fleming|Louis Pasteur|Marie Curie|Robert Koch
vitenskap|Hvilken planet bruker lengst tid på å rotere én gang rundt sin egen akse?|Venus|Merkur|Jupiter|Neptun
vitenskap|Hvilken gass utgjør mesteparten av jordas atmosfære?|Nitrogen|Oksygen|Argon|Karbondioksid
vitenskap|Hva måles i hertz?|Frekvens|Effekt|Spenning|Motstand
dyr|Hvilket dyr har blått blod?|Blekksprut|Hai|Delfin|Sel
dyr|Hvor mange magekamre har en ku?|4|2|3|1
dyr|Hvilket pattedyr legger egg?|Nebbdyr|Flaggermus|Dovendyr|Beltedyr
dyr|Hvor mange arter av bjørn finnes i dag?|8|5|12|3
dyr|Hva heter verdens største øgle?|Komodovaran|Grønn leguan|Kameleon|Tokkegekko
dyr|Hvilken fugl kan fly baklengs?|Kolibri|Svale|Ørn|Spurv
dyr|Hvor mange hjertekamre har en krokodille?|4|3|2|5
dyr|Hvilket dyr har de største øynene i dyreriket?|Kjempeblekksprut|Blåhval|Struts|Elefant
mat|Fra hvilket land kommer blåmuggosten Roquefort?|Frankrike|Italia|Sveits|Spania
mat|Hva regnes som verdens dyreste krydder etter vekt?|Safran|Vanilje|Kardemomme|Kanel
mat|Hva er miso?|Fermentert soyabønnepasta|Tørket tang|Fiskesaus|Rissirup
mat|Hvilket land forbindes oftest med retten moussaka?|Hellas|Tyskland|Italia|Spania
mat|Hvilken grønn druesort er en av de tre klassiske i champagne?|Chardonnay|Riesling|Sauvignon Blanc|Grüner Veltliner
mat|Hva kalles pasta som er kokt så den er «fast i bittet»?|Al dente|Al forno|Al fresco|À la carte
mat|Hvilken saus lages av eggeplomme, smør og sitronsaft?|Hollandaise|Béchamel|Velouté|Aioli
mat|Hva legges tørrfisken i for å bli til lutefisk?|Lut|Eddik|Saltlake|Sitronsaft
filmtv|Hvilken film vant Oscar for beste film ved utdelingen i 2020?|Parasitt|1917|Joker|Once Upon a Time in Hollywood
filmtv|Hvem spilte Jack Sparrow i «Pirates of the Caribbean»?|Johnny Depp|Orlando Bloom|Brad Pitt|Tom Cruise
filmtv|Hvem regisserte «Pulp Fiction»?|Quentin Tarantino|Martin Scorsese|David Fincher|Guy Ritchie
filmtv|Hvilken norsk serie følger ungdommer på Hartvig Nissens skole?|Skam|Lilyhammer|Exit|Heimebane
filmtv|I hvilken TV-serie møter vi slektene Stark og Lannister?|Game of Thrones|The Witcher|Vikings|The Crown
filmtv|Hvem regisserte «Psycho» fra 1960?|Alfred Hitchcock|Stanley Kubrick|Orson Welles|Billy Wilder
filmtv|Hvilket år kom den første «Star Wars»-filmen på kino?|1977|1980|1983|1974
filmtv|Hvem spilte Frank Tagliano i «Lilyhammer»?|Steven Van Zandt|Robert De Niro|James Gandolfini|Joe Pesci
filmtv|Hvilken film fra 1994 sammenligner livet med en eske sjokolade?|Forrest Gump|Frihetens regn|Speed|Pulp Fiction
musikk|Hvilket år vant ABBA Eurovision med «Waterloo»?|1974|1972|1976|1980
musikk|Hvem skrev musikken til Ibsens «Peer Gynt»?|Edvard Grieg|Jean Sibelius|Carl Nielsen|Johan Halvorsen
musikk|Hvilket band ga ut albumet «The Dark Side of the Moon»?|Pink Floyd|Led Zeppelin|The Doors|Genesis
musikk|Hvem var vokalist i Queen?|Freddie Mercury|David Bowie|Elton John|Robert Plant
musikk|Hvilket år vant Bobbysocks Eurovision for Norge?|1985|1982|1988|1979
musikk|Hvem komponerte melodien til «Ja, vi elsker»?|Rikard Nordraak|Edvard Grieg|Ole Bull|Johan Svendsen
musikk|Hvor mange symfonier fullførte Beethoven?|9|5|7|12
musikk|Hvilken norsk artist ga ut «Firestone» i 2014?|Kygo|Alan Walker|Matoma|Seeb
musikk|Fra hvilket land kommer K-pop?|Sør-Korea|Japan|Kina|Thailand
sport|Hvilket land arrangerte fotball-VM for herrer i 2022?|Qatar|Russland|Brasil|Saudi-Arabia
sport|Hvem har vunnet flest olympiske gullmedaljer gjennom tidene?|Michael Phelps|Usain Bolt|Bjørn Dæhlie|Carl Lewis
sport|Hvor mange olympiske gullmedaljer vant Bjørn Dæhlie?|8|6|10|5
sport|I hvilken idrett deles Stanley Cup ut?|Ishockey|Basketball|Baseball|Amerikansk fotball
sport|Hvor høyt over gulvet henger ringen i basketball?|3,05 m|2,75 m|3,50 m|2,90 m
sport|Hvilket land vant det første fotball-VM i 1930?|Uruguay|Brasil|Argentina|Italia
sport|Hvem tok OL-gull på 400 meter hekk i Tokyo-lekene?|Karsten Warholm|Jakob Ingebrigtsen|Andreas Thorkildsen|Vebjørn Rodal
sport|Hvilken by arrangerte sommer-OL i 2024?|Paris|Los Angeles|Tokyo|London
sport|Hvilken norsk tennisspiller nådde finalen i French Open både i 2022 og 2023?|Casper Ruud|Christian Ruud|Viktor Durasovic|Ulrikke Eikeri
teknologi|Hvilket år ble den første iPhonen lansert?|2007|2005|2009|2010
teknologi|Hva står «HTML» for?|HyperText Markup Language|High Tech Modern Language|Hyper Transfer Machine Language|Home Tool Markup Language
teknologi|Hvem regnes som oppfinneren av World Wide Web?|Tim Berners-Lee|Vint Cerf|Alan Turing|Linus Torvalds
teknologi|Hva heter operativsystemkjernen Linus Torvalds startet i 1991?|Linux|Unix|Minix|BSD
teknologi|Hvor mange bit er det i én byte?|8|4|16|10
teknologi|Hva står «GPS» for?|Global Positioning System|General Path Service|Geo Pointing Satellite|Global Phone Signal
teknologi|Hvilket programmeringsspråk er oppkalt etter en britisk komigruppe?|Python|Ruby|Java|Perl
teknologi|Hva het den programmerbare elektroniske datamaskinen som ble ferdig i USA i 1945?|ENIAC|UNIVAC|Colossus|Z3
teknologi|Hvilken nettleser ble opprinnelig utviklet i Norge?|Opera|Firefox|Safari|Chrome
norge|Hvor mange fylker har Norge hatt fra 1. januar 2024?|15|11|19|18
norge|Hvilken norsk forfatter fikk Nobelprisen i litteratur i 2023?|Jon Fosse|Karl Ove Knausgård|Jo Nesbø|Dag Solstad
norge|Hva er Norges største innsjø?|Mjøsa|Femunden|Tyrifjorden|Randsfjorden
norge|Hvilket år startet Hurtigruten?|1893|1905|1920|1870
norge|Hvem var statsminister da unionen med Sverige ble oppløst i 1905?|Christian Michelsen|Johan Sverdrup|Gunnar Knudsen|Frederik Stang
norge|Hva heter det nordligste punktet på det europeiske fastlandet?|Kinnarodden|Nordkapp|Knivskjellodden|Vardø
norge|Hvem skrev romanen «Sult» fra 1890?|Knut Hamsun|Henrik Ibsen|Alexander Kielland|Arne Garborg
norge|Hvem malte «Brudeferden i Hardanger» sammen med Hans Gude?|Adolph Tidemand|Edvard Munch|J.C. Dahl|Harriet Backer
norge|Hvilket år fikk norske kvinner alminnelig stemmerett ved stortingsvalg?|1913|1905|1898|1920
generelt|Hvor mange kvadratmeter er ett dekar (mål)?|1000|100|10 000|500
generelt|Hva er det offisielle språket i Brasil?|Portugisisk|Spansk|Brasiliansk|Fransk
generelt|Hvilket årstall er romertallet MCMXC?|1990|1940|2090|1890
generelt|Hvor mange nuller har en milliard?|9|6|12|8
generelt|Hvem skrev «Hamlet»?|William Shakespeare|Charles Dickens|Christopher Marlowe|Oscar Wilde
generelt|Hva heter valutaen i Japan?|Yen|Won|Yuan|Ringgit
generelt|Hvilket organ produserer insulin?|Bukspyttkjertelen|Leveren|Nyrene|Milten
generelt|Hvilket av disse maleriene er laget av Leonardo da Vinci?|Mona Lisa|Stjernenatt|Pike med perleørering|Nattevakten
generelt|Hva er kvadratroten av 144?|12|14|11|16
`;

export function parse(block: string, difficulty: Difficulty, idPrefix: string = difficulty): Question[] {
  return block
    .trim()
    .split('\n')
    .filter((l) => l.trim())
    .map((line, i) => {
      const [category, text, a, b, c, d] = line.split('|').map((s) => s.trim());
      if (!d) throw new Error(`Ugyldig spørsmålslinje (${difficulty} #${i + 1}): ${line}`);
      return {
        id: `nb-${idPrefix}-${i + 1}`,
        text,
        options: [a, b, c, d],
        correctIndex: 0,
        category: category as CategoryId,
        difficulty,
        language: 'nb',
        source: 'PODIEPANIKK-redaksjonen',
      } satisfies Question;
    });
}

const ADULT_QUESTIONS = parse(ADULT_BLOCK, 'voksen', 'voksen18');

export const BUILTIN_QUESTIONS: Question[] = [...parse(BARN, 'barn'), ...parse(FAMILIE, 'familie'), ...parse(VOKSEN, 'voksen'), ...ADULT_QUESTIONS];
