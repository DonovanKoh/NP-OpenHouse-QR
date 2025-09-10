Absolutely! Here's a professional, clear **README.md** tailored for your Open House Web AR Quest app. It’s written for developers and includes all the QR code formatting details.

````markdown
# Open House Web AR Quest

A browser-based AR scavenger hunt for school open house events. Visitors can scan QR codes placed around the school to complete a quest. No app installation or login required.

---

## Table of Contents

- [Demo](#demo)
- [Features](#features)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [QR Code Format](#qr-code-format)
- [Configuration](#configuration)
- [Usage](#usage)
- [Dependencies](#dependencies)
- [Notes](#notes)

---

## Demo

Visitors open the website on their phone and scan QR codes at each station. Completed stations are checked off in real-time, and a completion token appears when all stations are done.

---

## Features

- Mobile-friendly, no app install required
- Real-time QR code scanning with visual feedback
- Progress saved in browser `localStorage`
- Optional completion token for staff verification
- Fully customizable quest stations

---

## Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/open-house-ar-quest.git
   cd open-house-ar-quest
````

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Run the development server**

   ```bash
   npm run dev
   ```

   Open your browser to `http://localhost:5173` (or as indicated in the terminal).
   ⚠ Camera access requires HTTPS on mobile devices; for local testing, use a modern browser with `localhost`.

4. **Build for production**

   ```bash
   npm run build
   npm run preview
   ```

---

## Project Structure

```
src/
 ├─ App.jsx          # Main React component with camera + scanner logic
 ├─ index.jsx        # Entry point
 ├─ styles.css       # Optional custom styling
```

---

## QR Code Format

Each station requires a unique QR code. The app expects the **exact string**:

```
OPENHOUSE:STATION_ID
```

* `OPENHOUSE:` – prefix to identify valid codes
* `STATION_ID` – matches the `id` field in the `STATIONS` array

### Example QR Code Values

| Station Name     | QR Code String      |
| ---------------- | ------------------- |
| Main Entrance    | OPENHOUSE\:ENTRANCE |
| School Library   | OPENHOUSE\:LIBRARY  |
| Gymnasium        | OPENHOUSE\:GYM      |
| Science Lab      | OPENHOUSE\:SCI-LAB  |
| Art Studio       | OPENHOUSE\:ART      |
| Student Services | OPENHOUSE\:COUNSEL  |

You can generate QR codes using any online QR generator. Make sure the text matches exactly.

---

## Configuration

Edit the `STATIONS` array in `App.jsx`:

```javascript
const STATIONS = [
  { id: "ENTRANCE", name: "Main Entrance", code: "OPENHOUSE:ENTRANCE", hint: "Start here" },
  { id: "LIBRARY", name: "School Library", code: "OPENHOUSE:LIBRARY", hint: "Find the quiet thinkers" },
  // Add more stations here
];
```

* `id` → internal ID for tracking progress
* `name` → displayed on the progress list
* `code` → QR payload (must match QR exactly)
* `hint` → optional text hint for visitors

---

## Usage

* Open the website on a mobile device
* Allow camera access
* Scan the QR codes at each station
* Completed stations are highlighted in the list
* When all stations are scanned, a completion token is displayed for staff verification
* Staff can optionally validate the token manually

### Developer Notes

* Progress is stored in `localStorage`:

  * `ohq_progress_v1` → map of completed stations
  * `ohq_completed_v1` → timestamp of completion
* To reset progress, either use the “Reset Progress” button or clear localStorage

---

## Dependencies

* [React](https://reactjs.org/)
* [Framer Motion](https://www.framer.com/motion/) – optional animations
* [ZXing Browser](https://www.npmjs.com/package/@zxing/browser) – fallback QR scanner
* Modern browsers supporting camera access

---

## Notes

* Camera access requires HTTPS on mobile devices
* App supports both **native BarcodeDetector** API (fastest) and ZXing fallback
* Make QR codes large enough (\~8–10cm) for reliable scanning
* The completion token is **weakly verifiable**; it’s meant for human staff validation, not security

---
