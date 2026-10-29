# Brix — Portfolio

Portfolio site with a home page and a linked booking page, hosted on GitHub Pages.

## Files
- `index.html` — portfolio home page (Book now buttons link to `booking.html`)
- `booking.html` — booking page; embeds your booking system
- `style.css` — shared styles (light + dark mode)

## Connect your booking system
Open `booking.html` and set:
```js
const BOOKING_URL = "https://your-booking-page-url";
```
If the booking site blocks being embedded, visitors can still use the "Open it in a new tab" link.

## Publish on GitHub Pages
1. Create a new repo on GitHub — name it `<your-username>.github.io` for a site at `https://<your-username>.github.io`.
2. Upload these files (Add file → Upload files) and commit.
3. Go to **Settings → Pages**, set Source to **Deploy from a branch**, branch `main`, folder `/ (root)`, and save.
4. Wait a minute, then open the URL shown on that page.
