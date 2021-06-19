# Personal telegram bot

Small telegram bot to help me make some operations during a day, such as:
- Creating notes
- Publishing them to personal wiki
- Maintaining networking

All major config is included in `.env` and `src/config.ts`. FTP upload always uses basedir. You can make separate user with correct base folder for uploading to the right folder.

## Installation

Serve it as a regular Node.JS app: `npm start`.

Don't forget to change `.env example` to `.env` and fill required variables. You can ignore ftp-related things if you won't use Publishing mechanisms.