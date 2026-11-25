/* Forma — dati di partenza: alimenti, scheda, dieta del nutrizionista */
'use strict';

/* Valori nutrizionali indicativi per 100 g (o 100 ml). cat: C carboidrati, P proteine, F grassi, V verdura, X misto */
const FOODS = {
  pane:        { n: 'Pane', k: 270, p: 9, c: 54, f: 1.5, cat: 'C', a: ['pane'] },
  pb:          { n: "Burro d'arachidi", k: 600, p: 25, c: 15, f: 50, cat: 'F', a: ['burro d', 'arachidi', 'burro'] },
  yogurt0:     { n: 'Yogurt greco 0%', k: 57, p: 10, c: 4, f: 0.2, cat: 'P', a: ['yogurt'] },
  frutta:      { n: 'Frutta', k: 50, p: 0.6, c: 12, f: 0.2, cat: 'C', a: ['frutta', 'mela', 'banana', 'pera', 'arancia', 'kiwi'] },
  fsecca:      { n: 'Frutta secca', k: 600, p: 18, c: 12, f: 52, cat: 'F', a: ['frutta secca', 'noci', 'mandorle', 'nocciole', 'anacardi'] },
  riso:        { n: 'Riso', k: 360, p: 7, c: 80, f: 0.6, cat: 'C', a: ['riso'] },
  pasta:       { n: 'Pasta', k: 355, p: 12.5, c: 72, f: 1.5, cat: 'C', a: ['pasta'] },
  cereale:     { n: 'Cereale', k: 340, p: 12, c: 70, f: 2, cat: 'C', a: ['farro', 'orzo', 'cous cous', 'couscous', 'cereale', 'quinoa'] },
  gnocchi:     { n: 'Gnocchi', k: 160, p: 4, c: 34, f: 0.6, cat: 'C', a: ['gnocchi'] },
  patate:      { n: 'Patate', k: 77, p: 2, c: 17, f: 0.1, cat: 'C', a: ['patate', 'patata'] },
  cereali_col: { n: 'Cereali colazione', k: 375, p: 8, c: 80, f: 2, cat: 'C', a: ['cereali', 'corn flakes', 'fiocchi'] },
  latte:       { n: 'Latte scremato', k: 35, p: 3.5, c: 5, f: 0.1, cat: 'P', a: ['latte'] },
  pollo:       { n: 'Petto di pollo', k: 100, p: 23, c: 0, f: 1, cat: 'P', a: ['pollo'] },
  tacchino:    { n: 'Tacchino', k: 107, p: 24, c: 0, f: 1.2, cat: 'P', a: ['tacchino', 'fesa'] },
  mac_tacchino:{ n: 'Macinato magro di tacchino', k: 125, p: 21, c: 0, f: 4.5, cat: 'P', a: ['macinato'] },
  merluzzo:    { n: 'Merluzzo / pesce bianco', k: 80, p: 18, c: 0, f: 0.7, cat: 'P', a: ['merluzzo', 'nasello', 'platessa', 'pesce bianco'] },
  orata:       { n: 'Orata', k: 120, p: 20, c: 0, f: 4.5, cat: 'P', a: ['orata'] },
  tonno:       { n: 'Tonno al naturale', k: 103, p: 25, c: 0, f: 0.5, cat: 'P', a: ['tonno'] },
  cavallo:     { n: 'Carne di cavallo', k: 110, p: 21, c: 0, f: 2.5, cat: 'P', a: ['cavallo'] },
  vitello:     { n: 'Vitello magro', k: 110, p: 21, c: 0, f: 2.5, cat: 'P', a: ['vitello'] },
  rossa:       { n: 'Carne rossa magra', k: 120, p: 21, c: 0, f: 4, cat: 'P', a: ['carne rossa', 'manzo', 'bovino'] },
  gamberi:     { n: 'Gamberetti', k: 71, p: 14, c: 0.5, f: 1, cat: 'P', a: ['gamber'] },
  seppie:      { n: 'Seppie / calamari', k: 72, p: 14, c: 1, f: 1, cat: 'P', a: ['seppi', 'calamar', 'polpo'] },
  salmone:     { n: 'Salmone', k: 185, p: 20, c: 0, f: 12, cat: 'P', a: ['salmone'] },
  spada:       { n: 'Pesce spada', k: 110, p: 19, c: 0, f: 4, cat: 'P', a: ['spada'] },
  hamb:        { n: 'Hamburger di pollo/tacchino', k: 130, p: 18, c: 2, f: 6, cat: 'P', a: ['hamburger'] },
  bresaola:    { n: 'Bresaola', k: 151, p: 32, c: 0, f: 2, cat: 'P', a: ['bresaola'] },
  grana:       { n: 'Grana', k: 390, p: 33, c: 0, f: 28, cat: 'P', a: ['grana', 'parmigiano'] },
  mozz_light:  { n: 'Mozzarella light', k: 160, p: 20, c: 1, f: 9, cat: 'P', a: ['mozzarella light'] },
  mozz:        { n: 'Mozzarella', k: 250, p: 18, c: 1, f: 19, cat: 'P', a: ['mozzarella'] },
  fagioli:     { n: 'Fagioli lessati', k: 100, p: 7, c: 15, f: 0.5, cat: 'X', a: ['fagioli', 'ceci', 'lenticchie', 'legumi'] },
  uovo:        { n: 'Uova', k: 140, p: 12.5, c: 0.5, f: 10, cat: 'P', a: ['uov'], pz: 55 },
  albume:      { n: 'Albume', k: 45, p: 10.5, c: 0.5, f: 0.2, cat: 'P', a: ['album'] },
  ciocc:       { n: 'Cioccolato fondente >75%', k: 580, p: 9, c: 32, f: 45, cat: 'F', a: ['cioccolat'] },
  sugo:        { n: 'Sugo di pomodoro', k: 30, p: 1.3, c: 5, f: 0.5, cat: 'V', a: ['sugo', 'passata', 'pomodoro'] },
  zucchine:    { n: 'Zucchine', k: 15, p: 1.3, c: 1.5, f: 0.1, cat: 'V', a: ['zucchin'] },
  verdura:     { n: 'Verdura', k: 22, p: 1.5, c: 3, f: 0.2, cat: 'V', a: ['verdur', 'insalata', 'spinaci', 'broccoli'] },
  olio:        { n: "Olio extravergine d'oliva", k: 900, p: 0, c: 0, f: 100, cat: 'F', a: ['olio'] },
};

const p = (n, f, g, u = 'g') => ({ n, f, g, u });
const it = (...opts) => ({ o: opts.map(o => (Array.isArray(o) ? o : [o])) });
const meal = (n, ...items) => ({ n, items });

const OLIO10 = () => it(p("Olio EVO", 'olio', 10));

/* Giorni: 0 = domenica, 1 = lunedì ... 6 = sabato */
const DEFAULT_DIET = {
  name: 'Piano nutrizionista (nov 2026)',
  days: {
    1: [
      meal('Colazione', it(p('Pane', 'pane', 70)), it(p("Burro d'arachidi", 'pb', 20)), it(p('Yogurt greco 0%', 'yogurt0', 150))),
      meal('Spuntino', it(p('Frutta', 'frutta', 150)), it(p('Frutta secca', 'fsecca', 15))),
      meal('Pranzo',
        it(p('Riso', 'riso', 110), p('Pasta / farro / orzo / cous cous', 'cereale', 110), p('Pane', 'pane', 120)),
        it(p('Petto di pollo', 'pollo', 200), p('Merluzzo', 'merluzzo', 240), p('Tacchino', 'tacchino', 200), p('Tonno al naturale', 'tonno', 180), [p('Carne di cavallo', 'cavallo', 190), p('Grana', 'grana', 20)]),
        it(p('Zucchine', 'zucchine', 200)), OLIO10()),
      meal('Merenda', it(p('Frutta', 'frutta', 150)), it(p('Yogurt greco 0%', 'yogurt0', 150))),
      meal('Cena',
        it(p('Patate', 'patate', 400), p('Riso / altro cereale', 'riso', 110), p('Gnocchi', 'gnocchi', 220)),
        it(p('Merluzzo / nasello / platessa', 'merluzzo', 240), p('Petto di pollo', 'pollo', 190), p('Gamberetti', 'gamberi', 220)),
        it(p('Verdura', 'verdura', 200)), OLIO10()),
    ],
    2: [
      meal('Colazione', it(p('Latte scremato', 'latte', 250, 'ml')), it(p('Cereali', 'cereali_col', 55))),
      meal('Pranzo',
        it(p('Pasta', 'pasta', 100), p('Orzo / riso / altro cereale', 'cereale', 100), p('Gnocchi', 'gnocchi', 200), p('Pane', 'pane', 110)),
        it(p('Gamberetti sgusciati', 'gamberi', 250), p('Petto di pollo', 'pollo', 220), p('Merluzzo', 'merluzzo', 270), [p('Carne di cavallo', 'cavallo', 210), p('Grana', 'grana', 20)]),
        it(p('Zucchine', 'zucchine', 200)), it(p('Olio EVO', 'olio', 14))),
      meal('Merenda', it(p('Pane', 'pane', 70)), it(p('Bresaola', 'bresaola', 90), p('Fesa di tacchino', 'tacchino', 95)), it(p('Frutta', 'frutta', 150))),
      meal('Cena',
        it(p('Pasta', 'pasta', 120), p('Gnocchi', 'gnocchi', 240), p('Patate', 'patate', 420)),
        it(p('Macinato magro di tacchino', 'mac_tacchino', 250), p('Vitello magro', 'vitello', 220), p('Petto di pollo', 'pollo', 250)),
        it(p('Sugo di pomodoro', 'sugo', 100)), it(p('Verdura', 'verdura', 150)), OLIO10()),
    ],
    3: [
      meal('Colazione', it(p('Yogurt greco 0%', 'yogurt0', 200)), it(p('Cereali', 'cereali_col', 60)), it(p('Cioccolato fondente >75%', 'ciocc', 10))),
      meal('Spuntino', it(p('Frutta', 'frutta', 200)), it(p('Frutta secca', 'fsecca', 10))),
      meal('Pranzo', it(p('Tonno al naturale sgocciolato', 'tonno', 140)), it(p('Mozzarella light', 'mozz_light', 90)), it(p('Fagioli lessati', 'fagioli', 50)),
        it(p('Insalata / verdura mista (150-200)', 'verdura', 200)), it(p('Pane', 'pane', 60)), OLIO10()),
      meal('Merenda', it(p('Frutta', 'frutta', 150)), it(p('Yogurt greco 0%', 'yogurt0', 150))),
      meal('Cena',
        it(p('Gnocchi di patate', 'gnocchi', 200), p('Pasta / riso / altro cereale', 'pasta', 100), p('Patate', 'patate', 350)),
        it(p('Petto di pollo', 'pollo', 190), p('Tacchino', 'tacchino', 190), p('Merluzzo / nasello / platessa / orata', 'merluzzo', 240), p('Tonno al naturale', 'tonno', 170)),
        it(p('Sugo di pomodoro', 'sugo', 100)), it(p('Verdura', 'verdura', 150)), OLIO10()),
    ],
    4: [
      meal('Colazione', it(p('Pane', 'pane', 80)), it(p("Burro d'arachidi", 'pb', 15)), it(p('Yogurt greco 0%', 'yogurt0', 150))),
      meal('Pranzo',
        it(p('Farro', 'cereale', 90), p('Riso / pasta / cous cous', 'riso', 90), p('Pane', 'pane', 100), p('Gnocchi', 'gnocchi', 180)),
        it(p('Fesa di tacchino', 'tacchino', 200), p('Petto di pollo', 'pollo', 200), p('Gamberetti / seppie / calamari', 'gamberi', 220), p('Tonno al naturale', 'tonno', 180), [p('Carne di cavallo', 'cavallo', 190), p('Grana', 'grana', 20)]),
        it(p('Zucchine', 'zucchine', 200)), OLIO10()),
      meal('Merenda', it(p('Pane', 'pane', 70)), it(p('Bresaola', 'bresaola', 70), p('Fesa di tacchino', 'tacchino', 95)), it(p('Frutta', 'frutta', 150))),
      meal('Cena',
        it(p('Patate', 'patate', 400), p('Riso', 'riso', 110), p('Gnocchi', 'gnocchi', 220)),
        it(p('Carne rossa magra / vitello', 'rossa', 205), p('Macinato di tacchino', 'mac_tacchino', 220), p('Merluzzo', 'merluzzo', 240), [p('Frittata: uova', 'uovo', 2, 'pz'), p('Albume', 'albume', 200, 'ml')]),
        it(p('Verdura', 'verdura', 200)), OLIO10()),
    ],
    5: [
      meal('Colazione', it(p('Latte scremato', 'latte', 250, 'ml')), it(p('Cereali', 'cereali_col', 70))),
      meal('Spuntino', it(p('Grana', 'grana', 20)), it(p('Frutta', 'frutta', 150))),
      meal('Pranzo',
        it(p('Riso', 'riso', 100), p('Farro / orzo / altro cereale', 'cereale', 100), p('Gnocchi', 'gnocchi', 200), p('Pane', 'pane', 110)),
        it(p('Petto di pollo', 'pollo', 190), p('Gamberetti', 'gamberi', 220), p('Merluzzo / platessa / nasello', 'merluzzo', 240), p('Hamburger di pollo o tacchino', 'hamb', 180), p('Tonno al naturale', 'tonno', 170), [p('Carne di cavallo', 'cavallo', 180), p('Grana', 'grana', 20)]),
        it(p('Zucchine / verdura', 'zucchine', 200)), OLIO10()),
      meal('Merenda', it(p('Frutta', 'frutta', 150)), it(p('Frutta secca', 'fsecca', 10))),
      meal('Cena',
        it(p('Pasta', 'pasta', 110), p('Gnocchi', 'gnocchi', 220), p('Riso / altro cereale', 'riso', 110), p('Patate', 'patate', 400)),
        it(p('Salmone (trancio)', 'salmone', 210), p('Pesce spada', 'spada', 230), p('Tacchino / pollo', 'tacchino', 200)),
        it(p('Verdura', 'verdura', 150)), OLIO10()),
    ],
    6: [
      meal('Colazione', it([p('Uova strapazzate', 'uovo', 2, 'pz'), p('Albume', 'albume', 150)]), it(p('Pane', 'pane', 80))),
      meal('Spuntino', it(p('Frutta', 'frutta', 150)), it(p('Yogurt greco 0%', 'yogurt0', 150))),
      meal('Pranzo', it(p('Tonno al naturale sgocciolato', 'tonno', 140)), it(p('Mozzarella', 'mozz', 90)), it(p('Fagioli lessati', 'fagioli', 50)),
        it(p('Verdura mista', 'verdura', 200)), it(p('Pane', 'pane', 70)), OLIO10()),
      meal('Merenda', it(p('Grana', 'grana', 20)), it(p('Frutta', 'frutta', 150))),
      meal('Cena',
        it(p('Patate', 'patate', 400), p('Riso / altro cereale', 'riso', 110), p('Gnocchi', 'gnocchi', 220)),
        it(p('Fesa di tacchino', 'tacchino', 200), p('Petto di pollo', 'pollo', 200), p('Macinato di pollo o tacchino', 'mac_tacchino', 200), p('Merluzzo / pesce bianco', 'merluzzo', 240), p('Tonno al naturale', 'tonno', 180)),
        it(p('Verdura', 'verdura', 200)), OLIO10()),
    ],
    0: [
      meal('Colazione', it([p('Uova intere strapazzate', 'uovo', 2, 'pz'), p('Albume', 'albume', 150)]), it(p('Pane', 'pane', 80))),
      meal('Pranzo',
        it(p('Riso / farro / altro cereale', 'riso', 130), p('Patate', 'patate', 420)),
        it(p('Pollo / tacchino', 'pollo', 190), p('Gamberetti', 'gamberi', 220), p('Carne rossa magra', 'rossa', 210)),
        it(p('Zucchine / verdura', 'zucchine', 200)), OLIO10()),
      meal('Merenda (pomeriggio)', it(p('Frutta', 'frutta', 200)), it(p('Frutta secca', 'fsecca', 15))),
      meal('Cena',
        it(p('Gnocchi di patate', 'gnocchi', 220), [p('Pasta', 'pasta', 110), p('Sugo di pomodoro', 'sugo', 100)], p('Patate', 'patate', 400)),
        it(p('Macinato magro di tacchino', 'mac_tacchino', 220), p('Pesce spada', 'spada', 240), p('Petto di pollo', 'pollo', 220), p('Merluzzo / nasello / pesce bianco', 'merluzzo', 260)),
        it(p('Verdura', 'verdura', 150)), OLIO10()),
    ],
  },
};

/* rest in secondi; inc = incremento kg per la doppia progressione; unit: 'rip' o 'sec' */
const ex = (id, n, sets, repMin, repMax, rest, inc, extra = {}) => ({ id, n, sets, repMin, repMax, rest, inc, unit: 'rip', side: false, note: '', ...extra });

const DEFAULT_WORKOUTS = [
  {
    id: 'upper', n: 'Upper spinta', day: 1, legs: false, fatigue: 'none', note: '',
    ex: [
      ex('u1', 'Panca piana bilanciere', 4, 6, 8, 150, 2.5),
      ex('u2', 'Military press bilanciere', 3, 8, 10, 120, 2.5),
      ex('u3', 'Distensioni manubri inclinati', 3, 8, 12, 90, 2),
      ex('u4', 'Alzate laterali manubri', 3, 12, 15, 60, 1),
      ex('u5', 'Tricipiti ai cavi', 3, 10, 12, 60, 2.5),
      ex('u6', 'Crunch ai cavi', 3, 10, 12, 60, 2.5),
    ],
  },
  {
    id: 'lower', n: 'Lower', day: 3, legs: true, fatigue: 'sets',
    note: 'Giorno dopo il judo: se le gambe sono molto stanche, togli una serie a ogni esercizio.',
    ex: [
      ex('l1', 'Squat bilanciere', 4, 6, 8, 150, 2.5),
      ex('l2', 'Stacchi rumeni', 3, 8, 10, 120, 2.5),
      ex('l3', 'Leg press', 3, 10, 12, 90, 5),
      ex('l4', 'Leg curl sdraiato', 3, 10, 12, 90, 2.5),
      ex('l5', 'Affondi manubri', 3, 10, 10, 90, 2, { side: true }),
      ex('l6', 'Polpacci in piedi', 3, 12, 15, 60, 2.5),
      ex('l7', 'Plank', 3, 45, 60, 60, 5, { unit: 'sec', note: 'Peso = disco sulla schiena (0 se a corpo libero)' }),
    ],
  },
  {
    id: 'full', n: 'Full body', day: 6, legs: true, fatigue: 'weight',
    note: 'Arrivi dal judo del venerdì: riduci i pesi del 5-10% se senti stanchezza.',
    ex: [
      ex('f1', 'Stacchi da terra', 3, 5, 5, 180, 2.5),
      ex('f2', 'Rematore bilanciere', 3, 8, 10, 90, 2.5),
      ex('f3', 'Lat machine presa larga', 3, 10, 12, 90, 2.5),
      ex('f4', 'Panca inclinata manubri', 3, 8, 10, 90, 2),
      ex('f5', 'Hip thrust', 3, 10, 12, 90, 5),
      ex('f6', 'Leg extension', 3, 12, 15, 60, 2.5),
      ex('f7', 'Crunch con peso', 3, 12, 12, 60, 1),
    ],
  },
];

const DEFAULT_CONTAINERS = [
  { id: 'glass', n: 'Bicchiere', ml: 200, kind: 'glass' },
  { id: 'plastic', n: 'Bicchiere di plastica', ml: 200, kind: 'cup' },
  { id: 'b05', n: 'Bottiglia 0,5 L', ml: 500, kind: 'bottle' },
  { id: 'flask', n: 'Borraccia 0,75 L', ml: 750, kind: 'flask' },
  { id: 'b1', n: 'Bottiglia 1 L', ml: 1000, kind: 'bottle' },
  { id: 'b15', n: 'Bottiglia 1,5 L', ml: 1500, kind: 'bigbottle' },
];
