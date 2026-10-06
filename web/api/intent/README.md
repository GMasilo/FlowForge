# FlowForge TensorFlow service

This service uses TensorFlow.js and Universal Sentence Encoder Lite to compare a visitor message with example phrases. It is a nearest-example classifier, not a trained custom intent model or a generative chatbot. English is the initial intended use; evaluate your own languages and phrasing. Similarity scores are not probabilities.

## Run

The service source is in `web/api/intent`. Run the commands below from that folder.
Apache must proxy requests to Node; copying these files to a PHP host does not start the service.

For the existing `/flowforge` deployment, add `apache.example.conf` to your HTTPS VirtualHost and reload Apache after checking its configuration. This exposes:

- `POST https://YOUR-DOMAIN/flowforge/api/intent/classify`
- `GET https://YOUR-DOMAIN/flowforge/api/intent/health`
- `POST https://YOUR-DOMAIN/flowforge/api/intent/sentiment`
- `POST https://YOUR-DOMAIN/flowforge/api/intent/similarity`
- `POST https://YOUR-DOMAIN/flowforge/api/intent/image/classify`

All endpoints require the service's Bearer token. Set the Custom API integration base URL to `https://YOUR-DOMAIN/flowforge/api/intent`. Replace the domain and adjust the path in the Apache example if your installation uses a different prefix. The API `.htaccess` blocks direct source access; reverse proxy configuration belongs in the VirtualHost and is handled before filesystem routing. For other web servers, proxy only these five exact routes and deny all other requests beneath `/flowforge/api/intent`.

Use Node.js 20 or newer. In this directory run `npm ci` (or `npm install` when creating the lockfile). Set `INTENT_API_TOKEN` to a random secret with at least 32 characters. Run `npm start`. The default listener is `127.0.0.1:8091`; set `HOST` and `PORT` for your deployment. Put the service behind your HTTPS reverse proxy. Do not put the token in a chatbot variable, field, or browser code.

The models and vocabulary download on startup. `/health` returns 503 until ready and 200 afterwards, with `Authorization: Bearer <token>`. Its body includes `ready`, `busy`, and `capabilities`. Text capabilities are intent, sentiment and similarity; optional MobileNet support adds `image_classify`. Inference runs in a worker so it does not block HTTP handling. One prediction runs at a time; extra requests receive 429. A prediction exceeding 30 seconds stops the worker; restart the service to recover. Request bodies are limited to 6,500,000 bytes, with additional per-input validation. The PHP text-action requests time out after 20 seconds and image requests after 40 seconds, so callers may time out before the worker finishes. Visitor messages and example phrases are not logged by this service.

## Connect to FlowForge

1. Create a **Custom API** integration with the HTTPS base URL of this service (without `/classify`). Store `INTENT_API_TOKEN` in its API key/token secret field. Install the integration on the chatbot. The current ML handler also accepts localhost or 127.0.0.1 for a model process on the PHP server; these addresses refer to that server, not the visitor’s computer. Other addresses pass the existing public-URL safety checks.
2. Save the integration with status **Connected**, add an **Integration** step, select it, and choose **Understand intent**. Connected is a saved setting, not proof of a successful health check.
3. Set Visitor message to `{{vars.message}}`. Use the category editor to add at least two categories and examples. Category keys are unique lowercase letters, digits or underscores, starting with a letter. `unknown` is reserved.
4. Leave minimum similarity and margin blank for defaults 0.65 and 0.08, or tune them against labelled validation examples. These defaults are starting points, not measured accuracy guarantees.
5. Save output as `intentResult`.
6. Add a **Switch** with value `{{vars.intentResult.data.intent}}` and cases matching your category keys. Its default path should ask the visitor to clarify or offer human help.
7. Add a failure handler configured to run after a failed or timed-out integration. Missing configuration, HTTP errors, and invalid results are failures, not successful classifications.

## Response

`POST /classify` accepts `text`, `categories` (array of `{name, examples}`), optional numeric `threshold` and `margin`. Results contain `intent`, `matched`, `score`, `margin`, `reason`, ranked `scores`, `model`, and `scoreType`. The FlowForge integration wraps this as `{ok,status,data,error}`.

A low score or close tie produces `intent: "unknown"` and `matched: false`. A service failure produces a failed integration step. No connection secrets are passed to visitors.

## Test

### Additional actions

| Action | Request fields | Result inside `data` |
| --- | --- | --- |
| Analyze sentiment | `text`, optional `threshold` (default 0.35) | `sentiment`, `score`, ranked `scores` |
| Compare text similarity | `text_a`, `text_b` | `score`, `scoreType` |
| Classify image (MobileNet) | `image_url` or `image_base64`, optional `top_k` (1–10, default 5) | `predictions`, `top`, `model`, `scoreType` |
| Check ML service health | No action fields | `ready`, `busy`, `capabilities` |

Sentiment compares against built-in English examples; low similarity becomes neutral. Text scores are cosine similarity, not probabilities. Image classification returns ImageNet labels and model probabilities, not document extraction or identity verification. Only JPEG/PNG decoding is supported. URL downloads are limited to 5 MB after download; base64 input has its own size limit. The worker must be able to access image URLs; browser-only authentication is not forwarded.

### Deployment troubleshooting

- `Integration is not connected`: check the saved integration status and token.
- `integration_action_not_implemented`: deploy the current `web/api/integration/execute.php`; a new frontend paired with an old PHP handler cannot execute new ML actions.
- HTML `Forbidden`: check the VirtualHost proxy rules. Do not remove source-file protections. The correct path is `/flowforge`, not `/floforge`.
- JSON 401: supply the matching Bearer token, including for `/health`.
- JSON 503: wait for startup or restart an unavailable worker; check model download access.
- JSON 429: one inference is already running; retry later.

Deploy both the PHP handler and this service. Verify authenticated health first, then a fictional example through Preview, then your labelled validation set. A unit test or a manually selected Connected status does not establish production readiness.

`npm test` runs deterministic scoring/validation tests without downloading a model. Run `node smoke.mjs` to download and exercise the actual TensorFlow model with fictional billing/admissions examples. This checks execution, not production accuracy. Keep a separate labelled validation set and measure wrong routes and fallback rates before publishing. Re-run evaluation after changing examples, thresholds, model versions, or languages.

TensorFlow model documentation: https://github.com/tensorflow/tfjs-models/tree/master/universal-sentence-encoder
