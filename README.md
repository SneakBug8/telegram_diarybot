# Personal telegram bot

Small telegram bot to help me make some operations during a day, such as:
- Creating notes
- Publishing them to personal wiki
- Maintaining networking

All major config is included in `.env` and `src/config.ts`. FTP upload always uses basedir. You can make separate user with correct base folder for uploading to the right folder.

## Installation

Serve it as a regular Node.JS app: `npm start`.

Don't forget to change `.env example` to `.env` and fill required variables. You can ignore ftp-related things if you won't use Publishing mechanisms.

## Usage

Default behaviour for the bot upon receiving message is to save it a note (optionally, create a file with current date and time). Other commands are:

  - `/ping` - check whether bot is online
  - `/path` - show current filepath
  - `/reset` - reset current filepath
  - `/space` - insert big separator (horizontal line)
  - `/files` - list list of files by folders
  - `/file [name]` - set current filename (open or create a file)
  - `/log` - read current file
  - `/logs` - read current file splitted by separators.
  - `/get [name]` - read another file
  - `/logs [name]` - read another file splitted by separators.
  - `/delete` - delete current file
  - `/delete [name]` - delete another file

  - `/publish` - send file to remote FTP server
  - `/load` - download file from remote FTP server

  - `/add [name]` - add contact to your networking list
  - `/remove [name]` - remove contact from your networking list
  - `/list` - list all your contacts
  - `/force` - run networking script right now