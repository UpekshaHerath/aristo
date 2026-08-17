# Syllabus content

Files here are chunked, embedded and indexed by `npm run ingest -- ./content`.

## Licensing

Only add material you have the right to use. Cambridge syllabus documents are
published openly, but **past papers, mark schemes and examiner reports are
licensed to registered exam centres** and are not cleared for reuse in a product.
Self-authored notes, worked examples and practice questions are always safe.

Set `sourceType: past-paper` only for material you hold a licence for.

## Front matter

Every file needs front matter. `subject`, `syllabusCode` and `qualification` are
required; ingest fails loudly on a file that is missing one, rather than
indexing an unfilterable chunk.

```markdown
---
subject: Physics
syllabusCode: "0625"
qualification: IGCSE
sourceType: notes
topic: Electromagnetic induction
sourceTitle: Unit 4 revision notes
---

Your content here.
```

| Field | Required | Values |
| --- | --- | --- |
| `subject` | yes | Free text, e.g. `Physics` |
| `syllabusCode` | yes | Quoted, so `"0625"` keeps its leading zero |
| `qualification` | yes | `IGCSE`, `O Level`, `AS Level`, `A Level` |
| `sourceType` | no | `syllabus`, `notes`, `worked-example`, `past-paper` (default `notes`) |
| `topic` | no | Free text |
| `paper` | no | e.g. `Paper 4` |
| `year` | no | e.g. `2024` |
| `sourceTitle` | no | Defaults to the filename |

Re-ingesting a file replaces its own chunks, so running ingest repeatedly is safe.
