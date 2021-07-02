# Changelog

## 02.07.2021

- Slots for Notes
- Major bugfixes
- Improved commands usability: output readability

## 29.06.2021

- Learning module
- Allowed chat ids, default chat id && password from config to .env

## 23.06.2021

- Now networking monitors statistics for total sent/done interactions both globally and for each person.
- Old data formats should be automatically adapted to new one, but make sure to back up data before updating.
- Added /done and /done [name] commands for tracking done interactions appropriately.
- /list command also shows done and totalsent for each person.
- /remove command now only disables a person from futher sending, saving all of it's statistics in the file.