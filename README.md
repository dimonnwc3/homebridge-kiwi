# Kiwi Platform

Example `config.json`:

```
{
  "platforms": [
    {
      "platform": "KiwiPlatform",
      "name": "Kiwi",
      "username": "username",
      "password": "password"
    }
  ]
}
```

Exposes kiwi locks as switch accessories.

This plugin polls Kiwi API to refresh accessories.

You can change polling interval for kiwi locks by changing `interval` config value.
