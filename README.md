# ActivityPub Web Viewer

## Overview
ActivityPub Web Viewer is a single-page web application backed by a lightweight PHP API. It fetches and renders public posts for a given ActivityPub actor (Mastodon, Misskey, etc.) without storing retrieved content. The repository currently serves as a handover test case for AI-assisted workflows.

## Key Features
- Fetches actor metadata and the latest posts (1-50 items) through a dedicated PHP ActivityPub client.
- Sanitises HTML content and attachments before display to minimise XSS risk.
- Provides user guidance, retry flows, and granular error reporting for network/API failures.
- Bundles sample actor URLs and local history (saved in `localStorage`) to streamline manual testing.
- Ships as a static frontend (`index.html`, `css/`, `js/`) with a single backend entry point (`api.php`).

## Tech Stack & Runtime Requirements
- Front end: Vanilla HTML5/CSS3/ES2020 JavaScript (no build tooling required).
- Back end: PHP 8.1+ (uses `readonly` properties) with the cURL extension enabled.
- Hosting: Any static web server plus PHP runtime (Apache, Nginx + PHP-FPM, or `php -S` for local testing).
- Outbound HTTPS connectivity is required so the server can reach remote ActivityPub endpoints.

## Project Structure
```
ActivityPubWebViewer/
|-- api.php               # Single entry point for AJAX requests
|-- index.html            # SPA shell + APP_CONFIG bootstrap
|-- css/
|   `-- style.css         # Layout, typography, accessibility helpers
|-- js/
|   |-- app.js            # App bootstrap + AppUtils helper collection
|   |-- api-client.js     # Front-end API helper with retry/timeout handling
|   |-- form-handler.js   # Fetch form lifecycle, validation, history
|   |-- post-renderer.js  # Renders actor profile + posts list
|   |-- error-handler.js  # User-facing error reporting and ARIA alerts
|   |-- loading-manager.js# Progress indicator and button state toggles
|   `-- sample-urls.js    # Sample actor URL palette and selection UX
`-- php/
    |-- Client.php        # ActivityPub client (fetches actor/outbox/data)
    |-- Note.php          # Immutable value object for post normalisation
    |-- Validator.php     # Input/activity validation helpers
    |-- SecurityHandler.php# CORS/security headers and JSON validation
    |-- ErrorResponse.php # Standardised success/error responses
    |-- FetchException.php# Network/HTTP errors
    `-- ParseException.php# JSON/structure errors
```

## End-to-End Flow
1. `index.html` bootstraps `APP_CONFIG` and loads the JavaScript modules once the DOM is ready.
2. `FormHandler` validates the actor URL, debounces user input, and coordinates request lifecycle events.
3. `ApiClient` sends a JSON POST to `api.php` (`action=fetch_posts`) with timeout/retry handling.
4. The PHP `Client` fetches the actor document, resolves the `outbox`, gathers up to `max_posts` notes, and normalises them into `Note` value objects.
5. Sanitised data is returned via `ErrorResponse::success` and rendered by `PostRenderer`.
6. `ErrorHandler` and `LoadingManager` manage user feedback, while `SampleUrls` and `AppUtils.storage` provide convenience features.

## API Contract (`api.php`)
**Request**
```
POST /api.php
Content-Type: application/json

{
  "action": "fetch_posts",
  "actor_url": "https://mastodon.social/users/Gargron",
  "max_posts": 20
}
```

**Success Response**
```
200 OK
{
  "success": true,
  "data": {
    "posts": [
      {
        "id": "https://example.com/notes/123",
        "content": "<p>Sanitised HTML</p>",
        "published_at": "2024-08-10T12:34:56+00:00",
        "formatted_date": "2024-08-10 21:34 JST",
        "url": "https://example.com/@user/123",
        "attachments": [
          { "type": "image", "url": "https://example.com/media.png", "alt_text": "" }
        ],
        "author": { "id": "https://example.com/users/user", "name": "User", "avatar": "https://example.com/avatar.png" }
      }
    ],
    "actor_info": {
      "id": "https://example.com/users/user",
      "name": "User",
      "preferredUsername": "user",
      "summary": "Plain text bio",
      "url": "https://example.com/@user",
      "avatar": "https://example.com/avatar.png",
      "header": null,
      "followers_count": 0,
      "following_count": 0
    },
    "meta": {
      "count": 20,
      "fetched_at": "2024-08-10T12:35:00+00:00",
      "actor_url": "https://mastodon.social/users/Gargron",
      "outbox_url": "https://mastodon.social/users/Gargron/outbox"
    },
    "debug_outbox_page": { "...": "..." },
    "debug_test": null
  }
}
```

**Error Response** (example)
```
400 Bad Request
{
  "success": false,
  "error": {
    "code": "INVALID_URL",
    "message": "Invalid URL format",
    "user_message": "URLの書式が正しくありません。HTTPSのURLを入力してください。",
    "timestamp": "2024-08-10T12:34:56+00:00"
  }
}
```

See `php/ErrorResponse.php` and `php/Client.php` for the complete mapping of status codes and error reasons.

## Local Setup
1. Confirm PHP and cURL: `php -v` and `php -m | findstr curl` (PowerShell) or `php -m | grep curl` (bash).
2. From the project root, start the built-in server: `php -S 127.0.0.1:8000`.
3. Open `http://127.0.0.1:8000/index.html` in a modern browser.
4. Enter an ActivityPub actor URL or choose one of the sample URLs.

Note: the PHP process must have outbound HTTPS access to federated servers. If you are behind a proxy, configure cURL via environment variables or `php.ini`.

## Configuration Surface
- **Front end (`index.html`, `APP_CONFIG`)**
  - `app.timeout`: seconds before the front end aborts a request (mirrors the PHP timeout).
  - `security.allowedDomains`: UI-level allow list. Currently `['*']`; tighten as needed.
  - `display`: controls pagination (`maxPosts`), date format, and media rendering limits.
  - `sampleUrls`: declarative list used by `SampleUrls`.
- **Back end (`php/Client.php`)**
  - Constructor accepts `timeout` and `allowedDomains`. Update `api.php` to inject restrictions if you need to block certain hosts.
  - HTTP headers (User-Agent, Accept, Accept-Language) are set in `$httpHeaders` and can be tuned for federation quirks.
- **Security (`php/SecurityHandler.php`)**
  - CORS is currently `Access-Control-Allow-Origin: *`. Restrict this before deploying publicly.
  - Strict transport headers are emitted when HTTPS is detected.
- **Content sanitisation**
  - Both the PHP (`Note::sanitizeContent`) and JS renderers keep HTML whitelisted and length-limited.

## Error Handling & Observability
- Front end `ErrorHandler` surfaces friendly messages, hints, and optional retry actions.
- `LoadingManager` keeps the fetch button and spinner in sync.
- `ApiClient` retries network/timeouts (`retryAttempts = 2`) with incremental delay.
- PHP logs unexpected failures via `error_log` and returns normalised error payloads.
- `debug_outbox_page` and `debug_test` fields expose raw data for troubleshooting; disable or guard them for production.

## UX Helpers
- Recent actor URLs are cached in `localStorage` (see `FormHandler.saveToHistory`) with room for ten entries.
- Sample URL buttons populate the form and announce selections through ARIA live regions.
- Keyboard shortcuts: Ctrl/Cmd + Enter triggers fetch; focus handling and validation feedback assist accessibility.
- Images load lazily (`IntersectionObserver`) and fall back to text when downloads fail.

## Known Limitations / Next Steps
- No automated tests; consider adding PHPUnit integration tests with mocked ActivityPub responses.
- No rate limiting or caching; heavy usage can hit upstream federation limits.
- Authentication for private or protected actors is out of scope.
- CORS is permissive; restrict origins before production release.
- Consider exposing additional metadata (boosts, replies, visibility) based on product goals.

## Handover Checklist
- [ ] Confirm PHP 8.1+ with cURL on target environments.
- [ ] Review `APP_CONFIG.security.allowedDomains` and tighten CORS policy.
- [ ] Verify network access to the target ActivityPub instances (firewall/proxy rules).
- [ ] Decide whether to keep or remove `debug_*` fields in responses.
- [ ] Capture and retain server `error_log` output in deployment environments.
- [ ] Add CI/CD or GitHub Actions once the repository is mirrored to GitHub.

