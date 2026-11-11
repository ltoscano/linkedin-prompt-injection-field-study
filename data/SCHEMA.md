# Schema del dataset

Ogni record (`dataset.json`, oppure una riga di `dataset.csv`) descrive un caso di prompt injection rivolta agli agenti AI, trovato su LinkedIn.

| Campo | Tipo | Descrizione |
|---|---|---|
| `id` | string | Identificativo stabile (`LI-001` …) |
| `source_type` | enum | `profile`: payload nel profilo di un utente attivo · `post_self`: l'autore inserisce l'injection nel proprio post · `post_quote`: post che **cita** un caso (annuncio, profilo, CV…) |
| `context` | string | Descrizione breve del contesto in cui compare il testo |
| `category` | enum | Scopo del payload, vedi sotto |
| `techniques` | list | Tecniche usate, vedi sotto (nel CSV sono separate da `\|`) |
| `language` | `en` / `it` | Lingua del payload |
| `visibility` | string | Sempre `visible_plain_text`: nessun caso usava testo nascosto via CSS |
| `effect_reported` | bool | (`true`/`false` anche nel CSV) `true` se il post afferma che l'injection ha avuto effetto (affermazione non verificata) |
| `captured_at` | date | Data della raccolta |
| `search_queries` | list | Query di ricerca LinkedIn che hanno fatto emergere il caso |
| `excerpt` | string | Per i post: testo catturato dal DOM, eventualmente oscurato. Per i profili attivi (`source_type: profile`): forma normalizzata del payload o parafrasi (prefisso `[PARAFRASI]`), mai il testo letterale. Segnaposto usati: `[PIATTO]`, `[NOME]`, `[BASE64_PAYLOAD_REDACTED]` |
| `redaction` | string/null | Cosa è stato oscurato e perché |
| `notes` | string/null | Avvertenze sul record: testo incompleto, possibile duplicato dello stesso caso originale, template, ecc. |

## Categorie (`category`)

| Valore | Significato | Rischio |
|---|---|---|
| `canary` | Fa inserire un contenuto riconoscibile (es. una ricetta) per smascherare l'automazione | basso |
| `style_hijack` | Impone un tono o uno stile all'output | basso |
| `template` | Modello di injection da riutilizzare, con il payload da completare | dipende dall'uso |
| `engagement_manipulation` | Chiede all'agente like, condivisioni, repost | medio |
| `outcome_manipulation` | Prova a truccare una decisione (ranking di CV, esito di un colloquio) | alto |
| `prompt_extraction` | Prova a far rivelare all'agente le sue istruzioni di sistema | alto |
| `action_exfiltration` | Fa compiere all'agente azioni reali (aprire URL, creare account, inviare messaggi) | critico |

## Tecniche (`techniques`)

| Valore | Significato |
|---|---|
| `conditional_trigger` | "If you are an LLM / Se sei un'AI…": il testo si rivolge solo alla macchina |
| `override` | "Ignore / disregard all prior instructions" |
| `fake_role_delimiter` | Finti tag di sistema o amministratore (`[/admin][begin_admin_session]`) |
| `fake_authority_header` | Intestazioni come `INSTRUCTION OVERRIDE:` |
| `base64_encoding` | Istruzioni codificate per superare i filtri e la lettura umana |
| `external_url` | Rimanda a un URL esterno |
| `obfuscated_url` | URL spezzato o con parentesi per evitare che diventi un link |
| `headline_placement` | Payload nel titolo professionale, visibile in ogni anteprima e risultato di ricerca |

## Riprodurre il dataset

`scripts/collect.py` unisce gli output di `scripts/analyze.js` sulle pagine di ricerca in un file di ritrovamenti grezzi; `scripts/build_dataset.py` lo legge e applica la classificazione manuale e gli oscuramenti. I ritrovamenti grezzi, non oscurati, **non** sono inclusi nel repository, e nemmeno il file privato con i nomi da sostituire.

Il dataset non contiene hash del testo originale: su testi brevi, in gran parte pubblici, un hash senza sale permette di ricostruire per tentativi la parte oscurata.
