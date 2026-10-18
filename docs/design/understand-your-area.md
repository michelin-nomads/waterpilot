# Understand your area

The first step establishes the planning area and explains its current water conditions. It uses WaterPilot’s Estuary palette, navy typography, teal actions, semantic condition colours and existing light/dark tokens.

## Screen and flow

- Search for a place, use device location or pick a map point. Review the centre and a 1–10 km planning radius.
- Keep location search and controls on the left and the map on the right. Place water stress, rainfall, reliable supply, current water deficit, shortage days and groundwater in a separate section below: three columns on desktop, two on tablet and one on mobile. Use neutral card borders, generous spacing and colour only in the condition icons.
- Water conditions remain hidden until “Understand this area” is clicked. The action saves the selection, requests the current baseline, and shows a translucent overlay with the full-size animated droplet, percentage and status text near the top of the screen, without a background card. The percentage follows the save and data-request stages. After the response, reveal the conditions and scroll to them, respecting reduced motion. Keep the same editable search, area details and radius controls mounted. Other planning steps continue to use the location summary. “Continue to baseline” is available after successful loading. Changing the selection or radius hides stale results.
- Each available result includes units, reporting period and provenance. Definitions are keyboard-accessible tooltips. The source disclosure provides publishers, dates, methods and uncertainty supplied by the API.
- A key insight explains available evidence and the next action. It does not invent an area-specific assessment when evidence is missing.

## Data integration

The overview currently reads the existing AreaBaseline query after area confirmation. Rainfall and groundwater use environmental indicators; dependable_supply_ratio, deficit and shortage_days use baseline metrics. Water stress stays unavailable until a reviewed assessment is supplied. No new Google Earth Engine integration or satellite fetch is implemented by this UI change.

Future Earth Engine and other public-source ingestion belongs behind the API. Preserve a condition’s method, units, reporting period, observation date, spatial resolution, provenance and uncertainty. Do not infer water stress from a local supply deficit. Reliable supply and shortage days also require local demand and supply records.

## States

Before the user requests analysis, the water-condition cards remain hidden. While querying, the translucent droplet overlay blocks editing until the request finishes. A failure removes the loader, preserves the editor and offers a retry through the same action. Missing conditions show a dash and an explanation, not a zero. Provisional results and synthetic examples remain explicitly labelled. An observed zero remains a numeric result. Reporting windows remain visible so a short observation period cannot be mistaken for an annual forecast.

The location card fits its contents without stretching. The map keeps its minimum height and grows when the location editor becomes taller on desktop. Below the map, show “Your planning area (1–10 km radius)” and “Change the point, then adjust the area”. There is no heading or instruction above it.
