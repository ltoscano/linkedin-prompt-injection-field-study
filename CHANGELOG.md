# Revisioni

## Revisione dell'11 novembre 2026

Revisione fatta dopo la raccolta dei dati (9 e 10 novembre 2026). I numeri del README non cambiano: i 24 record e la loro classificazione sono quelli originali; cambia solo il testo degli estratti presi dai profili.

### Privacy

- `build_dataset.py` conteneva in chiaro il nome proprio che il dataset oscura. Ora i nomi da sostituire arrivano da un file privato, fuori dal repository.
- Tolti dal dataset `original_sha256` e `decoded_payload_sha256`. Erano SHA-256 senza sale su testi brevi di cui il resto è pubblico: la parte oscurata si poteva ricostruire per tentativi. Per il nome il controllo è stato fatto, e l'hash si riproduceva.
- Nessun collegamento esplicito ai profili attivi: i cinque record `profile` (LI-020…LI-024) contengono una forma normalizzata del payload o una parafrasi, non il testo letterale, che incollato nella ricerca di LinkedIn porterebbe al profilo. Stesso trattamento per il piatto citato in LI-006, che riporta il testo di un profilo. Dal README è sparito l'elenco dei piatti presi dai profili.
- La sezione Privacy del README dice che gli estratti dei post restano citazioni letterali e permettono di risalire al post.
- Aggiunto `.gitignore` per tenere fuori dal repository il materiale di lavoro non oscurato.
- Aggiunta la licenza MIT.

### Dataset

- Nuovo campo `notes` su 9 record: i sei del meme del flan, il template (LI-009), la frase da dire a voce (LI-002), il testo incompleto (LI-008).
- Nel CSV `effect_reported` è `true`/`false` in minuscolo.

### README

- "24 prompt injection reali" è diventato "24 casi catalogati", con un limite esplicito: 24 casi non sono 24 attacchi distinti.
- Precisato che delle 14 ricerche, 8 hanno prodotto i casi del dataset.
- Le descrizioni delle fasi 1 e 2 ora corrispondono a ciò che gli script originali facevano davvero.
- Aggiunte le istruzioni per riprodurre.
- Il README principale è in inglese; l'originale italiano è in `README.it.md`. "Canarino" è diventato "canary", il termine tecnico.
- Nuovo titolo, e un paragrafo sulla prova fatta con Grok Bot, con il limite corrispondente aggiornato.

### Script

- `analyze.js`
  - L'occultamento (contrasto, opacità, dimensioni, posizione) è calcolato per tutti i nodi di testo. Prima lo era solo dentro i selettori del contenuto utente o per i testi che già facevano scattare una regola, e il contatore `sysHidden` restava sempre a zero.
  - Entra negli shadow DOM aperti e negli iframe della stessa origine. Quelli chiusi o di altra origine vengono solo contati (`framesBlocked`).
  - Se nessun selettore del contenuto utente trova elementi, l'output lo dice in `warnings`: prima il controllo si spegneva in silenzio.
  - Il limite dei ritrovamenti passa da 80 a 300, e quelli scartati sono contati in `dropped`.
  - Corretto l'uso di una regex con flag `g` dentro `.test()`, che poteva far saltare un meta tag dopo uno positivo.
  - Nuovo canale `variation-selector-run` per le sequenze di selettori di variazione Unicode.
- `cdp.mjs`: porta configurabile (`CDP_PORT`), scheda in primo piano per impostazione predefinita, attesa dell'evento di caricamento, scorrimento finché la pagina smette di crescere, errori dell'analizzatore e di navigazione riportati con codice di uscita 1.
- `extract.py`: verifica il magic iniziale, legge la struttura del file dai record di chiusura (con il metodo originale come riserva), filtro della chiave come terzo argomento, messaggio chiaro se la cache usa il backend SQL. Tolta una costante errata e mai usata.
- `scan.py`: decodifica entità HTML ed escape JSON prima di cercare i caratteri invisibili.
- `ocr.py`: tre passate in più (toni chiarissimi, toni scurissimi, contrasto locale CLAHE).
- `build_dataset.py`: percorsi come argomenti, niente hash, campo `notes`.
- `collect.py`: nuovo. Nella raccolta originale i ritrovamenti grezzi erano stati messi insieme a mano.

### Come è stata verificata

- `analyze.js`, `cdp.mjs` e `collect.py`: eseguiti in Chrome 153 headless su una pagina di prova con testo bianco su bianco, shadow DOM, iframe, caratteri tag, meta tag con spazi a larghezza zero. Tutti i casi rilevati.
- `extract.py`: eseguito su una cache reale di Chrome 153 in formato "simple cache"; corpo decompresso identico all'originale, e i due metodi di lettura danno lo stesso risultato.
- `ocr.py`: su un'immagine sintetica con testo a 5 livelli di grigio dal fondo, RapidOCR lo legge già nell'immagine originale e nelle passate `hi` e `clahe`; l'equalizzazione globale invece lo perde.
- `build_dataset.py`: il dataset rigenerato coincide con l'originale su tutti i campi mantenuti, tranne gli estratti normalizzati di proposito.

Non verificato: nessuno script è stato rieseguito su LinkedIn o sulla cache originale.

### Punti aperti

- LI-001 è classificato `engagement_manipulation`, ma l'estratto da solo non lo mostra: da ricontrollare sul post originale.
- I selettori CSS di LinkedIn in `analyze.js` invecchiano: vanno ricontrollati a ogni nuova raccolta.
