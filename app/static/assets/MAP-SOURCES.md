# Flight map sources

## Interactive basemap (2026-11-03)

The live map now uses locally served MapLibre GL JS 6.16.0 and OpenFreeMap's Liberty
style (OpenStreetMap / OpenMapTiles data), replacing the coarse polygon renderer.
https://openfreemap.org/quick_start/
https://openfreemap.org/terms/
https://maplibre.org/maplibre-gl-js/docs/
The provider's attribution remains visible through MapLibre's attribution control.
No signup or API key is required for OpenFreeMap's public service. Map tiles are
requested directly by the browser; fares, accounts and notifications are not sent.
The renderer and worker are same-origin, built by `npm run assets:maps`.
`route-airports.json` retains only airport coordinates for fitting routes and pins;
Natural Earth polygon data from the earlier renderer is no longer requested.

The Liberty style retains its geographic layers in a flat (2D) presentation.
A coastal palette uses turquoise water, warm land, softer terrain shading and quiet
borders. These colors are decorative and do not encode fares or travel advice. Local-language labels use the Chinese name when supplied by the tile,
then English; not every place has a Chinese translation.

## Destination photography

`destination-photos.json` records each thumbnail's destination, original photo page,
author and license. New thumbnails for Da Nang (Khoi Tran), Kaohsiung (Johnson Hung),
and Hanoi (Quang Nguyen Vinh) use the free Unsplash License; source pages were checked
on 2026-11-03. `scripts/update_destination_photos.py` reproduces their downloads.
The other entries reuse the existing, attributed Hong Kong, Singapore, Tokyo and Bali
photographs listed in `assets/places/CREDITS.md`. A missing photo displays a code/plane
placeholder; it is never replaced by a photograph of a different city. Each photo card
links to its source; the detail hero also shows its photographer and license.

Airport coordinates in `route-airports.json` come from Travelpayouts public reference data
(https://api.travelpayouts.com/data/en/airports.json), fetched 2026-11-03.
Coordinates are rounded to four decimals; only records with numeric coordinates are included.
Route lines connect outbound airports schematically, rather than describing flown tracks.
