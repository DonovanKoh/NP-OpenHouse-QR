Absolutely! Here’s a **teacher-friendly README** that explains everything in plain language, focusing on setup, printing QR codes, and running the event.

````markdown
# Open House AR Quest – Teacher’s Guide

This guide will help you run a fun, interactive scavenger hunt for your school’s open house using mobile devices. Visitors can scan QR codes around the school to complete a quest and get a prize at the end.

---

## What It Does

- Visitors scan QR codes placed at different locations in the school.
- Each scan checks off a “quest” item on their progress list.
- When all QR codes are scanned, a completion token appears for staff to verify.
- No app installation or login is required – visitors just open a website on their phone.

---

## Setup Instructions

### 1. Hosting the Website

You need to host the app so visitors can open it on their phones.

**Option 1: GitHub Pages (free)**

1. Upload the project to a GitHub repository.
2. Build the project:
   ```bash
   npm run build
````

3. Enable GitHub Pages in your repo settings (use `gh-pages` branch or `docs` folder).
4. Share the link with visitors (e.g., `https://your-school.github.io/open-house-ar-quest/`).

**Option 2: Local / School Server**

* You can also host on a local server in the school.
* Make sure the site uses HTTPS, as cameras require a secure connection on mobile devices.

---

### 2. Printing QR Codes

Each location needs a unique QR code. Use **any free QR code generator** and encode the exact text for each station.

#### Format

```
OPENHOUSE:STATION_ID
```

* `OPENHOUSE:` → prefix that identifies valid codes
* `STATION_ID` → matches the internal ID in the app

#### Example Station Codes

| Location         | QR Code Text        |
| ---------------- | ------------------- |
| Main Entrance    | OPENHOUSE\:ENTRANCE |
| School Library   | OPENHOUSE\:LIBRARY  |
| Gymnasium        | OPENHOUSE\:GYM      |
| Science Lab      | OPENHOUSE\:SCI-LAB  |
| Art Studio       | OPENHOUSE\:ART      |
| Student Services | OPENHOUSE\:COUNSEL  |

**Tips for printing:**

* Make QR codes at least **8–10 cm wide** for easy scanning.
* Laminate or place in visible spots near the locations.
* Ensure good lighting for reliable scanning.

---

### 3. Running the Event

1. Open the website on mobile phones or tablets.
2. Allow camera access when prompted.
3. Visitors move around the school and scan the QR codes.
4. Each scanned code checks off the location in their progress list.
5. When all stations are completed, the app shows a **completion token**.
6. Staff can verify the token and give a prize.

---

### 4. Optional Teacher Controls

* **Reset progress:** Clear the progress list by pressing the “Reset Progress” button or clearing browser data.
* **Simulate scans:** For testing, you can click the buttons in the app to simulate scanning each station.
* **Hints:** Hints can be displayed for each station in the app to help visitors find locations.

---

### 5. Troubleshooting

* **Camera not working:** Ensure the browser has permission to access the camera and the website is loaded over HTTPS.
* **QR codes not scanning:** Make sure they are printed large enough and well-lit.
* **Progress not updating:** Clear browser localStorage or refresh the page.

---

### 6. Safety & Accessibility

* Encourage visitors to walk carefully while scanning.
* Place QR codes at accessible heights for all visitors.
* Make sure pathways are clear to avoid congestion around stations.

---

### 7. Summary

* **No login required**
* **No app needed**
* **Scan QR codes → Complete quest → Show token → Collect prize**

This makes a fun, interactive experience for students and visitors while showing off different parts of your school.
