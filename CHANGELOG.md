# Changelog

## 29.06
- Learning module
- Allowed chat ids, default chat id && password from config to .env

## 23.06

- Now networking monitors statistics for total sent/done interactions both globally and for each person.
- Old data formats should be automatically adapted to new one, but make sure to back up data before updating.
- Added /done and /done [name] commands for tracking done interactions appropriately.
- /list command also shows done and totalsent for each person.
- /remove command now only disables a person from futher sending, saving all of it's statistics in the file.