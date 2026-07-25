# WhatsApp Wrapped

A browser-based viewer for WhatsApp chat exports. Everything runs locally — no server, no uploads, no tracking.

## What it does

- Import a WhatsApp `.txt` or `.zip` export via drag and drop
- Browse conversations with full media support: images, video, audio, stickers, documents
- Handles large histories (50k+ messages) without degrading performance, via virtual rendering
- Switch between WhatsApp and iMessage visual themes
- Search contacts in the sidebar or messages within a conversation
- Rename phone numbers to real names (stored locally)
- Messages are persisted in IndexedDB so you don't have to re-import on every visit

## Getting started

Requires Node.js 18+.

```bash
git clone https://github.com/chandranshB/whatsapp-wrapped.git
cd "WhatsApp Reader"
npm install
npm run dev
```

Open `http://localhost:5173`.

To build for production:

```bash
npm run build
```

Output goes to `dist/`, deployable to any static host.

## Exporting a chat from WhatsApp

**Android:** Open chat > three-dot menu > More > Export Chat > choose With or Without Media.

**iOS:** Open chat > tap the contact/group name at the top > Export Chat > choose With or Without Media.

Drop the resulting `.txt` or `.zip` directly into the app window. If you export with media, the zip is extracted in the browser and all attachments are stored in IndexedDB.

## Tech

React 19, Vite 8, JSZip, React Virtuoso, Lucide React, vanilla CSS with CSS variables.

## License

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more details: https://www.gnu.org/licenses/agpl-3.0.html
